/**
 * detect-mode.js — Detect a Copilot Studio agent's authentication mode.
 *
 * Queries the Dataverse `bots` entity to determine the agent's authenticationmode
 * and returns a JSON result with a recommended chat protocol.
 *
 * Usage:
 *   node detect-mode.bundle.js [--agent-dir <path>]
 *
 * Output (stdout): single JSON object
 * Diagnostics (stderr): human-readable progress lines
 * Exit codes: 0 = success, 1 = error
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { PublicClientApplication } = require("@azure/msal-node");
const { createCachePlugin } = require("./msal-cache");

// VS Code's first-party client ID — pre-authorized with Dataverse, no app
// registration needed. Used only for the Dataverse query.
const VSCODE_CLIENT_ID = "51f81489-12ee-4a9e-aaae-a2591f45987d";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  process.stderr.write(msg + "\n");
}

function die(msg) {
  process.stdout.write(JSON.stringify({ status: "error", error: msg }) + "\n");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { agentDir: null };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--agent-dir":
        parsed.agentDir = args[++i];
        break;
    }
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Agent discovery
// ---------------------------------------------------------------------------

function findAgentDirs(startDir) {
  const results = [];

  function search(dir, depth) {
    if (depth > 5) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      if (entry.name === "agent.mcs.yml" && entry.isFile()) {
        results.push(dir);
      } else if (entry.isDirectory()) {
        search(path.join(dir, entry.name), depth + 1);
      }
    }
  }

  search(startDir, 0);
  return results;
}

function loadAgentConfig(agentDir) {
  const connPath = path.join(agentDir, ".mcs", "conn.json");
  if (!fs.existsSync(connPath)) {
    die(
      `No .mcs/conn.json found at ${connPath}. Is this a Copilot Studio agent cloned with the VS Code extension?`
    );
  }
  const conn = JSON.parse(fs.readFileSync(connPath, "utf-8"));

  const settingsPath = path.join(agentDir, "settings.mcs.yml");
  if (!fs.existsSync(settingsPath)) {
    die(`No settings.mcs.yml found at ${settingsPath}.`);
  }
  const settings = yaml.load(fs.readFileSync(settingsPath, "utf-8"));

  const environmentId = conn.EnvironmentId;
  const tenantId = conn.AccountInfo?.TenantId;
  const agentIdentifier = settings.schemaName;
  const dataverseEndpoint = conn.DataverseEndpoint;
  const agentId = conn.AgentId;

  if (!environmentId) die("EnvironmentId not found in .mcs/conn.json");
  if (!tenantId) die("TenantId not found in .mcs/conn.json");
  if (!agentIdentifier) die("schemaName not found in settings.mcs.yml");

  return { environmentId, tenantId, agentIdentifier, dataverseEndpoint, agentId };
}

// ---------------------------------------------------------------------------
// Auth mode detection — query Dataverse for authenticationmode
// ---------------------------------------------------------------------------

async function detectMode(config) {
  const envUrl = (config.dataverseEndpoint || "").replace(/\/+$/, "");
  if (!envUrl || !config.agentId) {
    die("Cannot detect mode: missing Dataverse endpoint or agent ID in .mcs/conn.json.");
  }

  const cachePlugin = await createCachePlugin("manage-agent");
  const app = new PublicClientApplication({
    auth: {
      clientId: VSCODE_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
    },
    cache: { cachePlugin },
  });

  const accounts = await app.getTokenCache().getAllAccounts();
  if (accounts.length === 0) {
    die("No cached Dataverse tokens. Run a push or pull first to cache tokens.");
  }

  let tokenResult;
  try {
    tokenResult = await app.acquireTokenSilent({
      scopes: [`${envUrl}/.default`],
      account: accounts[0],
    });
  } catch {
    die("Dataverse token refresh failed. Run a push or pull to re-authenticate.");
  }

  log("Querying agent authentication mode...");
  const res = await fetch(
    `${envUrl}/api/data/v9.2/bots(${config.agentId})?$select=authenticationmode,schemaname,name`,
    { headers: { Authorization: `Bearer ${tokenResult.accessToken}` } }
  );
  if (!res.ok) {
    die(`Dataverse query failed (HTTP ${res.status}).`);
  }
  const bot = await res.json();

  const authMode = bot.authenticationmode;
  const schemaName = bot.schemaname;

  // Build recommended mode (default suggestion — LLM can override)
  // authenticationmode: 1 = No auth, 2 = Integrated (Entra ID SSO), 3 = Manual
  let recommendedMode;
  if (authMode === 1 || authMode === 3) {
    const envIdNoDashes = config.environmentId.replace(/-/g, "");
    const prefix = envIdNoDashes.slice(0, -2);
    const suffix = envIdNoDashes.slice(-2);
    const tokenEndpoint = `https://${prefix}.${suffix}.environment.api.powerplatform.com/powervirtualagents/botsbyschema/${schemaName}/directline/token?api-version=2022-03-01-preview`;
    recommendedMode = "directline";
    log(`Agent uses ${authMode === 1 ? "no auth" : "manual auth"} → recommended: DirectLine`);
    return {
      status: "ok",
      authenticationmode: authMode,
      recommendedMode,
      tokenEndpoint,
      schemaName,
    };
  } else {
    recommendedMode = "m365";
    log(`Agent uses integrated auth → recommended: Copilot Studio SDK`);
    return {
      status: "ok",
      authenticationmode: authMode,
      recommendedMode,
      schemaName,
    };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();

  let agentDir;
  if (args.agentDir) {
    agentDir = path.resolve(args.agentDir);
  } else {
    const found = findAgentDirs(process.cwd());
    if (found.length === 0) die("No agent.mcs.yml found. Use --agent-dir.");
    if (found.length > 1)
      die(
        `Multiple agents found: ${found.map((d) => path.relative(process.cwd(), d)).join(", ")}. Use --agent-dir.`
      );
    agentDir = found[0];
  }

  log(`Agent directory: ${path.relative(process.cwd(), agentDir) || "."}`);
  const config = loadAgentConfig(agentDir);
  log(`Using agent: ${config.agentIdentifier}`);

  try {
    const result = await detectMode(config);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch (e) {
    die(`Unexpected error: ${e.message}`);
  }
}

main();
