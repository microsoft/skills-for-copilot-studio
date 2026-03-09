/**
 * chat-with-agent.js — Send a single utterance to a published Copilot Studio agent.
 *
 * Agent connection details (environmentId, tenantId, agentIdentifier) are
 * auto-discovered from the VS Code extension's .mcs/conn.json and settings.mcs.yml.
 *
 * Usage:
 *   node chat-with-agent.bundle.js --client-id <id> "your message"
 *   node chat-with-agent.bundle.js --client-id <id> "follow-up" --conversation-id <id>
 *   node chat-with-agent.bundle.js --client-id <id> "hello" --agent-dir <path>
 *
 * Output (stdout): single JSON object with full activity payloads
 * Diagnostics (stderr): human-readable progress lines
 * Exit codes: 0 = success, 1 = error
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { PublicClientApplication } = require("@azure/msal-node");
const {
  CopilotStudioClient,
  PowerPlatformCloud,
} = require("@microsoft/agents-copilotstudio-client");
const { Activity, ActivityTypes } = require("@microsoft/agents-activity");

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
  const parsed = {
    utterance: null,
    clientId: null,
    conversationId: null,
    agentDir: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--client-id":
        parsed.clientId = args[++i];
        break;
      case "--conversation-id":
        parsed.conversationId = args[++i];
        break;
      case "--agent-dir":
        parsed.agentDir = args[++i];
        break;
      default:
        if (!args[i].startsWith("--")) {
          parsed.utterance = args[i];
        }
        break;
    }
  }

  if (!parsed.utterance) die("Missing utterance argument.");
  if (!parsed.clientId) die("Missing --client-id argument.");
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
  // Read .mcs/conn.json for environmentId and tenantId
  const connPath = path.join(agentDir, ".mcs", "conn.json");
  if (!fs.existsSync(connPath)) {
    die(
      `No .mcs/conn.json found at ${connPath}. Is this a Copilot Studio agent cloned with the VS Code extension?`
    );
  }
  const conn = JSON.parse(fs.readFileSync(connPath, "utf-8"));

  // Read settings.mcs.yml for schemaName (agentIdentifier)
  const settingsPath = path.join(agentDir, "settings.mcs.yml");
  if (!fs.existsSync(settingsPath)) {
    die(`No settings.mcs.yml found at ${settingsPath}.`);
  }
  const settings = yaml.load(fs.readFileSync(settingsPath, "utf-8"));

  const environmentId = conn.EnvironmentId;
  const tenantId = conn.AccountInfo?.TenantId;
  const agentIdentifier = settings.schemaName;

  if (!environmentId) die("EnvironmentId not found in .mcs/conn.json");
  if (!tenantId) die("TenantId not found in .mcs/conn.json");
  if (!agentIdentifier) die("schemaName not found in settings.mcs.yml");

  return { environmentId, tenantId, agentIdentifier };
}

// ---------------------------------------------------------------------------
// Authentication (MSAL device-code flow with file cache)
// ---------------------------------------------------------------------------

async function getAccessToken(tenantId, clientId, cachePath) {
  const cachePlugin = {
    beforeCacheAccess: async (context) => {
      if (fs.existsSync(cachePath)) {
        context.tokenCache.deserialize(fs.readFileSync(cachePath, "utf-8"));
      }
    },
    afterCacheAccess: async (context) => {
      if (context.cacheHasChanged) {
        fs.writeFileSync(cachePath, context.tokenCache.serialize());
      }
    },
  };

  const app = new PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
    cache: { cachePlugin },
  });

  const scope = "https://api.powerplatform.com/.default";

  const accounts = await app.getTokenCache().getAllAccounts();
  if (accounts.length > 0) {
    try {
      const result = await app.acquireTokenSilent({
        scopes: [scope],
        account: accounts[0],
      });
      log("Using cached token.");
      return result.accessToken;
    } catch {
      // Silent acquisition failed, fall through to device code
    }
  }

  const result = await app.acquireTokenByDeviceCode({
    scopes: [scope],
    deviceCodeCallback: (response) => {
      log(response.message);
    },
  });

  return result.accessToken;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

function activityToDict(activity) {
  return JSON.parse(JSON.stringify(activity));
}

async function chat(utterance, conversationId, config, token) {
  const settings = {
    environmentId: config.environmentId,
    agentIdentifier: config.agentIdentifier,
    cloud: PowerPlatformCloud.Prod,
    tenantId: config.tenantId,
  };

  const client = new CopilotStudioClient(settings, token);

  let startActivities = [];
  if (conversationId === null) {
    log("Starting new conversation...");
    for await (const activity of client.startConversationStreaming(true)) {
      startActivities.push(activityToDict(activity));
      if (activity.conversation?.id) {
        conversationId = activity.conversation.id;
      }
    }
    if (!conversationId) {
      die("Could not obtain conversation_id from startConversation.");
    }
    log(`Conversation started: ${conversationId}`);
  } else {
    log(`Reusing conversation: ${conversationId}`);
  }

  log(`Sending: ${utterance}`);
  const messageActivity = Activity.fromObject({
    type: "message",
    text: utterance,
    conversation: { id: conversationId },
  });
  const responseActivities = [];
  for await (const activity of client.sendActivityStreaming(
    messageActivity,
    conversationId
  )) {
    responseActivities.push(activityToDict(activity));
  }

  return {
    status: "ok",
    utterance,
    conversation_id: conversationId,
    start_activities: startActivities,
    activities: responseActivities,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();

  // Resolve agent directory
  let agentDir;
  if (args.agentDir) {
    agentDir = path.resolve(args.agentDir);
  } else {
    const found = findAgentDirs(process.cwd());
    if (found.length === 0) {
      die(
        "No agent.mcs.yml found in current directory tree. Use --agent-dir to specify the agent location."
      );
    }
    if (found.length > 1) {
      const dirs = found
        .map((d) => path.relative(process.cwd(), d))
        .join(", ");
      die(
        `Multiple agents found: ${dirs}. Use --agent-dir to specify which one.`
      );
    }
    agentDir = found[0];
  }

  log(`Agent directory: ${path.relative(process.cwd(), agentDir) || "."}`);
  const config = loadAgentConfig(agentDir);
  log(`Using agent: ${config.agentIdentifier}`);

  // Token cache next to conn.json
  const cachePath = path.join(agentDir, ".mcs", ".token_cache.json");

  log("Authenticating...");
  const token = await getAccessToken(config.tenantId, args.clientId, cachePath);

  try {
    const result = await chat(
      args.utterance,
      args.conversationId,
      config,
      token
    );
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch (e) {
    die(`Unexpected error: ${e.message}`);
  }
}

main();
