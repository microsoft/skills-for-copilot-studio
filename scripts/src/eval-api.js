/**
 * eval-api.js — Copilot Studio Evaluation API (PPAPI) client.
 *
 * Thin HTTP client for the Power Platform evaluation endpoints.
 * Each subcommand makes a single API call — the calling agent drives polling.
 *
 * Subcommands:
 *   node eval-api.bundle.js list-testsets  --workspace <path>
 *   node eval-api.bundle.js start-run      --workspace <path> --testset-id <id>
 *   node eval-api.bundle.js get-run        --workspace <path> --run-id <id>
 *   node eval-api.bundle.js get-results    --workspace <path> --run-id <id>
 *   node eval-api.bundle.js list-runs      --workspace <path>
 *
 * Options:
 *   --workspace <path>       Path to agent workspace (finds .mcs/conn.json)
 *   --environment-id <id>    Override environment ID
 *   --agent-id <id>          Override agent (bot) ID
 *   --tenant-id <id>         Override tenant ID
 *   --client-id <id>         App Registration client ID (requires CopilotStudio.MakerOperations.Read permission)
 *   --testset-id <id>        Test set ID (required for start-run)
 *   --run-id <id>            Evaluation run ID (required for get-run, get-results)
 *   --published              Test published bot (default: test draft)
 *   --run-name <name>        Custom display name for the evaluation run
 *
 * Output: JSON on stdout, diagnostics on stderr.
 * Exit codes: 0 = success, 1 = error
 */

const fs = require("fs");
const path = require("path");
const { log, die } = require("./shared-utils");
const {
  VSCODE_CLIENT_ID,
  acquireTokenSilent,
  acquireTokenDeviceCode,
  getOrAcquireToken,
} = require("./shared-auth");

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    command: null,
    workspace: null,
    environmentId: null,
    agentId: null,
    tenantId: null,
    clientId: null,
    testsetId: null,
    runId: null,
    published: false,
    runName: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--workspace":
        parsed.workspace = args[++i];
        break;
      case "--environment-id":
        parsed.environmentId = args[++i];
        break;
      case "--agent-id":
        parsed.agentId = args[++i];
        break;
      case "--tenant-id":
        parsed.tenantId = args[++i];
        break;
      case "--client-id":
        parsed.clientId = args[++i];
        break;
      case "--testset-id":
        parsed.testsetId = args[++i];
        break;
      case "--run-id":
        parsed.runId = args[++i];
        break;
      case "--published":
        parsed.published = true;
        break;
      case "--run-name":
        parsed.runName = args[++i];
        break;
      default:
        if (!args[i].startsWith("--") && !parsed.command) {
          parsed.command = args[i];
        }
        break;
    }
  }

  if (!parsed.command) {
    die(
      "Usage: eval-api <command> [options]\n" +
      "Commands: list-testsets, start-run, get-run, get-results, list-runs"
    );
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Agent workspace / conn.json discovery
// ---------------------------------------------------------------------------

function findConnJson(startDir) {
  const resolvedStart = path.resolve(startDir || process.cwd());

  // Check if startDir itself has .mcs/conn.json
  const direct = path.join(resolvedStart, ".mcs", "conn.json");
  if (fs.existsSync(direct)) return direct;

  // Search subdirectories (max depth 5)
  function search(dir, depth) {
    if (depth > 5) return null;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      if (entry.isDirectory()) {
        const connPath = path.join(dir, entry.name, ".mcs", "conn.json");
        if (fs.existsSync(connPath)) return connPath;
        const deeper = search(path.join(dir, entry.name), depth + 1);
        if (deeper) return deeper;
      }
    }
    return null;
  }

  return search(resolvedStart, 0);
}

function loadConfig(args) {
  let environmentId = args.environmentId;
  let agentId = args.agentId;
  let tenantId = args.tenantId;

  // Try to fill from conn.json if any are missing
  if (!environmentId || !agentId || !tenantId) {
    const connPath = findConnJson(args.workspace);
    if (connPath) {
      try {
        const conn = JSON.parse(fs.readFileSync(connPath, "utf8"));
        log(`Found ${connPath}`);
        if (!environmentId) environmentId = conn.EnvironmentId;
        if (!agentId) agentId = conn.AgentId;
        if (!tenantId) tenantId = conn.AccountInfo?.TenantId;
      } catch (e) {
        log(`Warning: Could not parse conn.json: ${e.message}`);
      }
    }
  }

  if (!environmentId) die("Cannot determine environment ID. Provide --environment-id or --workspace with .mcs/conn.json.");
  if (!agentId) die("Cannot determine agent ID. Provide --agent-id or --workspace with .mcs/conn.json.");
  if (!tenantId) die("Cannot determine tenant ID. Provide --tenant-id or --workspace with .mcs/conn.json.");

  return { environmentId, agentId, tenantId, clientId: args.clientId };
}

// ---------------------------------------------------------------------------
// Authentication — reuses "manage-agent" MSAL cache slot
// ---------------------------------------------------------------------------

const PP_API_SCOPE = "https://api.powerplatform.com/.default";

async function getToken(config) {
  const clientId = config.clientId || VSCODE_CLIENT_ID;

  // Try silent first (tokens cached from manage-agent auth/push or prior eval-api run)
  const silent = await acquireTokenSilent(config.tenantId, clientId, [PP_API_SCOPE]);
  if (silent) {
    log(`Using cached Power Platform API token (expires ${silent.expiresOn})`);
    return silent.accessToken;
  }

  if (config.clientId) {
    // Custom app registration — use device code flow
    log("No cached token — starting device code authentication...");
    const token = await acquireTokenDeviceCode(config.tenantId, clientId, [PP_API_SCOPE]);
    return token.accessToken;
  }

  // VS Code 1P client — use interactive browser login
  log("No cached token — starting interactive login...");
  const token = await getOrAcquireToken(
    config.tenantId, VSCODE_CLIENT_ID, [PP_API_SCOPE], "Power Platform API"
  );
  return token.accessToken;
}

// ---------------------------------------------------------------------------
// HTTP client for PPAPI evaluation endpoints
// ---------------------------------------------------------------------------

const PP_API_VERSION = "2024-10-01";

function buildBaseUrl(environmentId, agentId) {
  return `https://api.powerplatform.com/copilotstudio/environments/${environmentId}/bots/${agentId}/api/makerevaluation`;
}

function withApiVersion(url) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}api-version=${PP_API_VERSION}`;
}

async function ppApiRequest(method, url, body, accessToken) {
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(30000),
  };

  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);

  // Handle specific error codes with helpful messages
  if (res.status === 401 || res.status === 403) {
    const errBody = await res.text().catch(() => "");
    die(`Authentication failed (HTTP ${res.status}). Re-run 'manage-agent auth' to refresh tokens.\n${errBody.substring(0, 300)}`);
  }
  if (res.status === 409) {
    const errBody = await res.text().catch(() => "");
    die(`Conflict (HTTP 409): A run is already in progress for this bot. Use 'get-run' with the existing runId, or wait for it to complete.\n${errBody.substring(0, 300)}`);
  }
  if (res.status === 429) {
    const errBody = await res.text().catch(() => "");
    die(`Rate limited (HTTP 429): Maximum 20 evaluation runs per bot per 24 hours.\n${errBody.substring(0, 300)}`);
  }
  if (res.status === 404) {
    const errBody = await res.text().catch(() => "");
    die(`Not found (HTTP 404). Verify the environment ID, agent ID, and resource IDs are correct.\n${errBody.substring(0, 300)}`);
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    die(`HTTP ${res.status}: ${errBody.substring(0, 500)}`);
  }

  // 202 Accepted (start-run) or 200 OK
  const text = await res.text();
  if (!text.trim()) return null;
  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// Subcommand implementations
// ---------------------------------------------------------------------------

async function cmdListTestsets(config, accessToken) {
  const url = withApiVersion(`${buildBaseUrl(config.environmentId, config.agentId)}/testsets`);
  log(`GET ${url}`);
  const data = await ppApiRequest("GET", url, null, accessToken);

  const testsets = (data && data.value) || [];
  process.stdout.write(JSON.stringify({
    status: "ok",
    testsets: testsets.map(ts => ({
      id: ts.id,
      displayName: ts.displayName,
      description: ts.description || null,
      state: ts.state,
      totalTestCases: ts.totalTestCases,
    })),
  }, null, 2) + "\n");
}

async function cmdStartRun(config, accessToken, args) {
  if (!args.testsetId) die("--testset-id is required for start-run.");

  const url = withApiVersion(`${buildBaseUrl(config.environmentId, config.agentId)}/testsets/${args.testsetId}/run`);
  const body = {
    runOnPublishedBot: args.published,
  };
  if (args.runName) {
    body.evaluationRunName = args.runName;
  }

  log(`POST ${url}`);
  log(`  runOnPublishedBot: ${args.published}`);
  if (args.runName) log(`  evaluationRunName: ${args.runName}`);

  const data = await ppApiRequest("POST", url, body, accessToken);

  process.stdout.write(JSON.stringify({
    status: "ok",
    run: {
      runId: data.runId,
      state: data.state,
      executionState: data.executionState,
      totalTestCases: data.totalTestCases,
      testCasesProcessed: data.testCasesProcessed || 0,
      callbackUri: data.callbackUri || null,
    },
  }, null, 2) + "\n");
}

async function cmdGetRun(config, accessToken, args) {
  if (!args.runId) die("--run-id is required for get-run.");

  const url = withApiVersion(`${buildBaseUrl(config.environmentId, config.agentId)}/testruns/${args.runId}`);
  log(`GET ${url}`);
  const data = await ppApiRequest("GET", url, null, accessToken);

  process.stdout.write(JSON.stringify({
    status: "ok",
    run: {
      runId: data.id,
      state: data.state,
      executionState: data.executionState || null,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      name: data.name || null,
      totalTestCases: data.totalTestCases,
      testCasesProcessed: data.testCasesProcessed || 0,
    },
  }, null, 2) + "\n");
}

async function cmdGetResults(config, accessToken, args) {
  if (!args.runId) die("--run-id is required for get-results.");

  const url = withApiVersion(`${buildBaseUrl(config.environmentId, config.agentId)}/testruns/${args.runId}`);
  log(`GET ${url}`);
  const data = await ppApiRequest("GET", url, null, accessToken);

  process.stdout.write(JSON.stringify({
    status: "ok",
    run: {
      runId: data.id,
      state: data.state,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      name: data.name || null,
      totalTestCases: data.totalTestCases,
      testCasesResults: data.testCasesResults || [],
    },
  }, null, 2) + "\n");
}

async function cmdListRuns(config, accessToken) {
  const url = withApiVersion(`${buildBaseUrl(config.environmentId, config.agentId)}/testruns`);
  log(`GET ${url}`);
  const data = await ppApiRequest("GET", url, null, accessToken);

  const runs = (data && data.value) || [];
  process.stdout.write(JSON.stringify({
    status: "ok",
    runs: runs.map(r => ({
      runId: r.id,
      state: r.state,
      startTime: r.startTime || null,
      endTime: r.endTime || null,
      name: r.name || null,
      totalTestCases: r.totalTestCases,
      testSetId: r.testSetId || null,
    })),
  }, null, 2) + "\n");
}

async function cmdGetTestset(config, accessToken, args) {
  if (!args.testsetId) die("--testset-id is required for get-testset.");
  const url = withApiVersion(`${buildBaseUrl(config.environmentId, config.agentId)}/testsets/${args.testsetId}`);
  log(`GET ${url}`);
  const data = await ppApiRequest("GET", url, null, accessToken);
  process.stdout.write(JSON.stringify({ status: "ok", testset: data }, null, 2) + "\n");
}



// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  const config = loadConfig(args);
  const accessToken = await getToken(config);

  switch (args.command) {
    case "list-testsets":
      await cmdListTestsets(config, accessToken);
      break;
    case "start-run":
      await cmdStartRun(config, accessToken, args);
      break;
    case "get-run":
      await cmdGetRun(config, accessToken, args);
      break;
    case "get-results":
      await cmdGetResults(config, accessToken, args);
      break;
    case "list-runs":
      await cmdListRuns(config, accessToken);
      break;
    case "get-testset":
      await cmdGetTestset(config, accessToken, args);
      break;
    default:
      die(`Unknown command: ${args.command}\nCommands: list-testsets, get-testset, start-run, get-run, get-results, list-runs`);
  }
}

main().catch((e) => die(`Unexpected error: ${e.message}`));
