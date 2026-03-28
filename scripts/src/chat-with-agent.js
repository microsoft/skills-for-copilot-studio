/**
 * chat-with-agent.js — Send a single utterance to a published Copilot Studio agent.
 *
 * Auto-detects the agent's authentication mode by querying Dataverse:
 *   - No auth (mode 1) or Manual auth (mode 3) → DirectLine v3 REST API
 *   - Integrated auth / Entra ID SSO (mode 2)  → Copilot Studio Client SDK
 *
 * Agent connection details (environmentId, tenantId, agentIdentifier) are
 * auto-discovered from the VS Code extension's .mcs/conn.json and settings.mcs.yml.
 *
 * Usage:
 *   node chat-with-agent.bundle.js "your message"
 *   node chat-with-agent.bundle.js "your message" --client-id <id>
 *   node chat-with-agent.bundle.js "follow-up" --conversation-id <id>
 *   node chat-with-agent.bundle.js "hello" --agent-dir <path>
 *   node chat-with-agent.bundle.js "hello" --token-endpoint <url>
 *   node chat-with-agent.bundle.js "hello" --directline-secret <secret>
 *
 * Output (stdout): single JSON object with full activity payloads
 * Diagnostics (stderr): human-readable progress lines
 * Exit codes: 0 = success, 1 = error
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { PublicClientApplication } = require("@azure/msal-node");
const { createCachePlugin } = require("./msal-cache");
const {
  CopilotStudioClient,
  PowerPlatformCloud,
} = require("@microsoft/agents-copilotstudio-client");
const { Activity, ActivityTypes } = require("@microsoft/agents-activity");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// VS Code's first-party client ID — pre-authorized with Dataverse, no app
// registration needed. Used only for the detect-mode Dataverse query.
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    detectOnly: false,
    // DirectLine-specific (for explicit mode or multi-turn resume)
    tokenEndpoint: null,
    directlineSecret: null,
    directlineDomain: null,
    directlineToken: null,
    watermark: null,
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
      case "--token-endpoint":
        parsed.tokenEndpoint = args[++i];
        break;
      case "--directline-secret":
        parsed.directlineSecret = args[++i];
        break;
      case "--directline-domain":
        parsed.directlineDomain = args[++i];
        break;
      case "--directline-token":
        parsed.directlineToken = args[++i];
        break;
      case "--watermark":
        parsed.watermark = args[++i];
        break;
      case "--detect-only":
        parsed.detectOnly = true;
        break;
      default:
        if (!args[i].startsWith("--")) {
          parsed.utterance = args[i];
        }
        break;
    }
  }

  if (!parsed.utterance && !parsed.detectOnly) die("Missing utterance argument.");
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
  // Read .mcs/conn.json for environmentId, tenantId, DataverseEndpoint, AgentId
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
    log("Cannot detect mode: missing Dataverse endpoint or agent ID.");
    return null;
  }

  try {
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
      log("No cached Dataverse tokens — cannot auto-detect mode.");
      return null;
    }

    let tokenResult;
    try {
      tokenResult = await app.acquireTokenSilent({
        scopes: [`${envUrl}/.default`],
        account: accounts[0],
      });
    } catch {
      log("Dataverse token refresh failed — cannot auto-detect mode.");
      return null;
    }

    log("Querying agent authentication mode...");
    const res = await fetch(
      `${envUrl}/api/data/v9.2/bots(${config.agentId})?$select=authenticationmode,schemaname,name`,
      { headers: { Authorization: `Bearer ${tokenResult.accessToken}` } }
    );
    if (!res.ok) {
      log(`Dataverse query failed (HTTP ${res.status}) — cannot auto-detect mode.`);
      return null;
    }
    const bot = await res.json();

    const authMode = bot.authenticationmode;
    const schemaName = bot.schemaname;

    // authenticationmode: 1 = No auth, 2 = Integrated (Entra ID SSO), 3 = Manual
    if (authMode === 1 || authMode === 3) {
      const envIdNoDashes = config.environmentId.replace(/-/g, "");
      const prefix = envIdNoDashes.slice(0, -2);
      const suffix = envIdNoDashes.slice(-2);
      const tokenEndpoint = `https://${prefix}.${suffix}.environment.api.powerplatform.com/powervirtualagents/botsbyschema/${schemaName}/directline/token?api-version=2022-03-01-preview`;
      log(`Agent uses ${authMode === 1 ? "no auth" : "manual auth"} → DirectLine mode`);
      return { mode: "directline", authenticationmode: authMode, tokenEndpoint, schemaName };
    } else {
      log(`Agent uses integrated auth → Copilot Studio SDK mode`);
      return { mode: "m365", authenticationmode: authMode, schemaName };
    }
  } catch (e) {
    log(`Mode detection failed: ${e.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// DirectLine v3 HTTP helpers
// ---------------------------------------------------------------------------

async function dlHttpGet(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    die(`HTTP ${res.status} from GET ${url}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function dlHttpPost(url, headers, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    die(`HTTP ${res.status} from POST ${url}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// DirectLine v3 protocol
// ---------------------------------------------------------------------------

async function dlFetchToken(tokenEndpointUrl) {
  log("Fetching DirectLine token from token endpoint...");
  const data = await dlHttpGet(tokenEndpointUrl, {});
  if (!data.token) die("Token endpoint did not return a token.");
  return data.token;
}

async function dlGetRegionalDomain(tokenEndpointUrl) {
  try {
    const parsed = new URL(tokenEndpointUrl);
    const settingsUrl =
      parsed.origin +
      "/powervirtualagents/regionalchannelsettings?api-version=2022-03-01-preview";
    log("Fetching regional DirectLine domain...");
    const data = await dlHttpGet(settingsUrl, {});
    const domain = data.channelUrlsById?.directline?.replace(/\/+$/, "");
    if (domain) {
      log(`Regional domain: ${domain}`);
      return domain;
    }
  } catch (e) {
    log(`Warning: Could not fetch regional domain (${e.message}). Using default.`);
  }
  return "https://directline.botframework.com";
}

async function dlStartConversation(domain, token) {
  log("Starting DirectLine conversation...");
  const data = await dlHttpPost(
    `${domain}/v3/directline/conversations`,
    { Authorization: `Bearer ${token}` },
    {}
  );
  if (!data.conversationId) die("startConversation did not return a conversationId.");
  return { conversationId: data.conversationId, token: data.token || token };
}

async function dlSendActivity(domain, conversationId, token, activity) {
  return dlHttpPost(
    `${domain}/v3/directline/conversations/${conversationId}/activities`,
    { Authorization: `Bearer ${token}` },
    activity
  );
}

async function dlPollActivities(domain, conversationId, token, watermark) {
  let url = `${domain}/v3/directline/conversations/${conversationId}/activities`;
  if (watermark !== undefined) {
    url += `?watermark=${watermark}`;
  }
  const data = await dlHttpGet(url, { Authorization: `Bearer ${token}` });
  return {
    activities: data.activities || [],
    watermark: data.watermark,
  };
}

function dlFindSignInCard(activities) {
  for (const activity of activities) {
    if (activity.type !== "message" || !activity.attachments) continue;
    for (const att of activity.attachments) {
      if (
        att.contentType === "application/vnd.microsoft.card.signin" ||
        att.contentType === "application/vnd.microsoft.card.oauth"
      ) {
        const url =
          att.content?.buttons?.[0]?.value ||
          att.content?.tokenExchangeResource?.uri ||
          null;
        if (url) return { signinUrl: url };
      }
    }
  }
  return null;
}

async function dlRunPollLoop(domain, conversationId, token, opts) {
  const timeoutMs = (opts && opts.timeoutMs) || 30000;
  const intervalMs = (opts && opts.intervalMs) || 1000;
  let watermark = opts && opts.watermark;

  let lastActivityTime = Date.now();
  let authHandled = false;
  const allBotActivities = [];

  while (true) {
    if (Date.now() - lastActivityTime > timeoutMs) {
      log("Poll timeout — no more bot activities.");
      break;
    }

    const result = await dlPollActivities(domain, conversationId, token, watermark);
    watermark = result.watermark;

    const botActivities = result.activities.filter(
      (a) => a.from && a.from.role !== "user"
    );

    for (const activity of botActivities) {
      lastActivityTime = Date.now();

      if (activity.type === "endOfConversation") {
        allBotActivities.push(activity);
        return { activities: allBotActivities, watermark };
      }

      if (!authHandled) {
        const card = dlFindSignInCard([activity]);
        if (card) {
          authHandled = true;
          // Non-interactive — return sign-in info for caller to handle
          allBotActivities.push(activity);
          return {
            activities: allBotActivities,
            watermark,
            signin: { url: card.signinUrl },
          };
        }
      }

      allBotActivities.push(activity);
    }

    await sleep(intervalMs);
  }

  return { activities: allBotActivities, watermark };
}

// ---------------------------------------------------------------------------
// DirectLine chat orchestrator
// ---------------------------------------------------------------------------

async function chatDirectLine(utterance, conversationId, params) {
  let token;
  let domain;

  if (params.directlineSecret) {
    token = params.directlineSecret;
    domain = params.directlineDomain || "https://directline.botframework.com";
    log(`Using DirectLine secret mode (domain: ${domain})`);
  } else {
    token = await dlFetchToken(params.tokenEndpoint);
    domain = await dlGetRegionalDomain(params.tokenEndpoint);
  }

  let startActivities = [];
  let watermark;

  if (conversationId === null) {
    const conv = await dlStartConversation(domain, token);
    conversationId = conv.conversationId;
    token = conv.token;
    log(`Conversation started: ${conversationId}`);

    await dlSendActivity(domain, conversationId, token, {
      type: "event",
      name: "startConversation",
      from: { id: "user1", role: "user" },
    });
    log("startConversation event sent.");

    const startResult = await dlRunPollLoop(domain, conversationId, token, {
      timeoutMs: 30000,
      intervalMs: 1000,
    });
    startActivities = startResult.activities;
    watermark = startResult.watermark;

    if (startResult.signin) {
      log("Sign-in required. Returning sign-in URL for caller to handle.");
      const connFlag = params.directlineSecret
        ? `--directline-secret "${params.directlineSecret}"`
        : `--token-endpoint "${params.tokenEndpoint}"`;
      return {
        status: "signin_required",
        protocol: "directline",
        signin_url: startResult.signin.url,
        conversation_id: conversationId,
        directline_token: token,
        utterance,
        start_activities: startActivities,
        activities: [],
        watermark,
        resume_command: `${connFlag} "<VALIDATION_CODE>" --conversation-id "${conversationId}" --directline-token "${token}" --watermark "${watermark}"`,
        followup_command: `${connFlag} "${utterance}" --conversation-id "${conversationId}" --directline-token "${token}" --watermark "${watermark}"`,
      };
    }

    log(`Received ${startActivities.length} start activities.`);
  } else {
    log(`Reusing conversation: ${conversationId}`);
    if (params.directlineToken) {
      token = params.directlineToken;
      log("Using provided DirectLine token.");
    } else if (!params.directlineSecret) {
      token = await dlFetchToken(params.tokenEndpoint);
    }
    if (params.watermark) {
      watermark = params.watermark;
      log(`Resuming from watermark: ${watermark}`);
    }
  }

  await dlSendActivity(domain, conversationId, token, {
    type: "message",
    from: { id: "user1", role: "user" },
    text: utterance,
  });
  log(`Sent: "${utterance}"`);

  const responseResult = await dlRunPollLoop(domain, conversationId, token, {
    timeoutMs: 30000,
    intervalMs: 1000,
    watermark,
  });

  if (responseResult.signin) {
    log("Sign-in required. Returning sign-in URL for caller to handle.");
    const connFlag = params.directlineSecret
      ? `--directline-secret "${params.directlineSecret}"`
      : `--token-endpoint "${params.tokenEndpoint}"`;
    return {
      status: "signin_required",
      protocol: "directline",
      signin_url: responseResult.signin.url,
      conversation_id: conversationId,
      directline_token: token,
      utterance,
      start_activities: startActivities,
      activities: responseResult.activities,
      watermark: responseResult.watermark,
      resume_command: `${connFlag} "<VALIDATION_CODE>" --conversation-id "${conversationId}" --directline-token "${token}" --watermark "${responseResult.watermark}"`,
      followup_command: `${connFlag} "${utterance}" --conversation-id "${conversationId}" --directline-token "${token}" --watermark "${responseResult.watermark}"`,
    };
  }

  return {
    status: "ok",
    protocol: "directline",
    utterance,
    conversation_id: conversationId,
    directline_token: token,
    watermark: responseResult.watermark,
    start_activities: startActivities,
    activities: responseResult.activities,
  };
}

// ---------------------------------------------------------------------------
// Copilot Studio SDK chat (integrated auth / M365)
// ---------------------------------------------------------------------------

function activityToDict(activity) {
  return JSON.parse(JSON.stringify(activity));
}

async function getSdkAccessToken(tenantId, clientId) {
  const cachePlugin = await createCachePlugin("chat");

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

async function chatSdk(utterance, conversationId, config, token) {
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
    protocol: "m365",
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

  // --detect-only: resolve agent and detect mode, output result, stop
  if (args.detectOnly) {
    let agentDir;
    if (args.agentDir) {
      agentDir = path.resolve(args.agentDir);
    } else {
      const found = findAgentDirs(process.cwd());
      if (found.length === 0) die("No agent.mcs.yml found. Use --agent-dir.");
      if (found.length > 1) die(`Multiple agents found: ${found.map(d => path.relative(process.cwd(), d)).join(", ")}. Use --agent-dir.`);
      agentDir = found[0];
    }

    log(`Agent directory: ${path.relative(process.cwd(), agentDir) || "."}`);
    const config = loadAgentConfig(agentDir);
    log(`Using agent: ${config.agentIdentifier}`);

    const modeResult = await detectMode(config);
    if (!modeResult) {
      die("Could not detect authentication mode. Ensure Dataverse tokens are cached (run a push/pull first) or provide --token-endpoint / --client-id explicitly.");
    }
    process.stdout.write(JSON.stringify({ status: "ok", ...modeResult }, null, 2) + "\n");
    return;
  }

  // If explicit DirectLine credentials are provided, skip detection and use DirectLine
  if (args.tokenEndpoint || args.directlineSecret) {
    log("Explicit DirectLine credentials provided — using DirectLine mode.");
    const params = {
      tokenEndpoint: args.tokenEndpoint,
      directlineSecret: args.directlineSecret,
      directlineDomain: args.directlineDomain,
      directlineToken: args.directlineToken,
      watermark: args.watermark,
    };
    try {
      const result = await chatDirectLine(args.utterance, args.conversationId, params);
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    } catch (e) {
      die(`Unexpected error: ${e.message}`);
    }
    return;
  }

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

  // Detect authentication mode
  const modeResult = await detectMode(config);

  if (modeResult && modeResult.mode === "directline") {
    // DirectLine mode — no app registration needed
    const params = {
      tokenEndpoint: modeResult.tokenEndpoint,
      directlineToken: args.directlineToken,
      watermark: args.watermark,
    };
    try {
      const result = await chatDirectLine(args.utterance, args.conversationId, params);
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    } catch (e) {
      die(`Unexpected error: ${e.message}`);
    }
  } else {
    // M365 / SDK mode — requires app registration client ID
    if (!args.clientId) {
      die(
        "This agent uses integrated authentication (Entra ID SSO) which requires an App Registration Client ID. " +
        "Pass --client-id <id> with an app that has CopilotStudio.Copilots.Invoke permission and redirect URI http://localhost."
      );
    }

    log("Authenticating...");
    const token = await getSdkAccessToken(config.tenantId, args.clientId);

    try {
      const result = await chatSdk(
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
}

main();
