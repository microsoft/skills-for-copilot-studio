/**
 * directline-chat.js — Send a single utterance to a bot via DirectLine v3 REST API.
 *
 * Connection modes:
 *   --token-endpoint <url>            CPS token endpoint (no auth or with auth/sign-in cards)
 *   --directline-secret <secret>      Azure Bot Service DirectLine secret
 *
 * Usage:
 *   node directline-chat.bundle.js --token-endpoint <url> "your message"
 *   node directline-chat.bundle.js --token-endpoint <url> "follow-up" --conversation-id <id>
 *   node directline-chat.bundle.js --directline-secret <secret> "your message"
 *   node directline-chat.bundle.js --directline-secret <secret> "your message" --directline-domain <url>
 *
 * Output (stdout): single JSON object with full activity payloads
 * Diagnostics (stderr): human-readable progress lines
 * Exit codes: 0 = success, 1 = error
 */

const {
  log, die,
  fetchToken, getRegionalDomain,
  startConversation, sendActivity,
  runPollLoop,
} = require("./shared-utils");

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    utterance: null,
    conversationId: null,
    tokenEndpoint: null,
    directlineSecret: null,
    directlineDomain: null,
    directlineToken: null,
    watermark: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
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
      case "--conversation-id":
        parsed.conversationId = args[++i];
        break;
      default:
        if (!args[i].startsWith("--")) {
          parsed.utterance = args[i];
        }
        break;
    }
  }

  if (!parsed.utterance) die("Missing utterance argument.");
  if (!parsed.tokenEndpoint && !parsed.directlineSecret) {
    die("Missing connection: provide --token-endpoint or --directline-secret.");
  }
  if (parsed.tokenEndpoint && parsed.directlineSecret) {
    die("Provide only one of --token-endpoint or --directline-secret, not both.");
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Chat orchestrator
// ---------------------------------------------------------------------------

async function chat(utterance, conversationId, params) {
  let token;
  let domain;

  if (params.mode === "token-endpoint") {
    token = await fetchToken(params.tokenEndpoint);
    domain = await getRegionalDomain(params.tokenEndpoint);
  } else {
    token = params.directlineSecret;
    domain = params.directlineDomain || "https://directline.botframework.com";
    log(`Using DirectLine domain: ${domain}`);
  }

  let startActivities = [];
  let watermark;

  if (conversationId === null) {
    const conv = await startConversation(domain, token);
    conversationId = conv.conversationId;
    token = conv.token; // Use refreshed token
    log(`Conversation started: ${conversationId}`);

    // Send startConversation event to trigger welcome message
    await sendActivity(domain, conversationId, token, {
      type: "event",
      name: "startConversation",
      from: { id: "user1", role: "user" },
    });
    log("startConversation event sent.");

    const startResult = await runPollLoop(domain, conversationId, token, {
      timeoutMs: 30000,
      intervalMs: 1000,
    });
    startActivities = startResult.activities;
    watermark = startResult.watermark;

    // If sign-in required in non-interactive mode, return early with sign-in info
    if (startResult.signin) {
      log("Sign-in required. Returning sign-in URL for caller to handle.");
      const connFlag = params.mode === "token-endpoint"
        ? `--token-endpoint "${params.tokenEndpoint}"`
        : `--directline-secret "${params.directlineSecret}"`;
      return {
        status: "signin_required",
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
    // Use provided DirectLine token if available (bound to this conversation)
    if (params.directlineToken) {
      token = params.directlineToken;
      log("Using provided DirectLine token.");
    } else if (params.mode === "token-endpoint") {
      token = await fetchToken(params.tokenEndpoint);
    }
    // Use provided watermark to skip already-seen activities
    if (params.watermark) {
      watermark = params.watermark;
      log(`Resuming from watermark: ${watermark}`);
    }
  }

  // Send user message
  await sendActivity(domain, conversationId, token, {
    type: "message",
    from: { id: "user1", role: "user" },
    text: utterance,
  });
  log(`Sent: "${utterance}"`);

  const responseResult = await runPollLoop(domain, conversationId, token, {
    timeoutMs: 30000,
    intervalMs: 1000,
    watermark,
  });

  // Sign-in could also happen after sending the user message
  if (responseResult.signin) {
    log("Sign-in required. Returning sign-in URL for caller to handle.");
    const connFlag = params.mode === "token-endpoint"
      ? `--token-endpoint "${params.tokenEndpoint}"`
      : `--directline-secret "${params.directlineSecret}"`;
    return {
      status: "signin_required",
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
    utterance,
    conversation_id: conversationId,
    directline_token: token,
    watermark: responseResult.watermark,
    start_activities: startActivities,
    activities: responseResult.activities,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();

  const params = args.tokenEndpoint
    ? { mode: "token-endpoint", tokenEndpoint: args.tokenEndpoint, directlineToken: args.directlineToken, watermark: args.watermark }
    : {
        mode: "directline-secret",
        directlineSecret: args.directlineSecret,
        directlineDomain: args.directlineDomain,
        directlineToken: args.directlineToken,
        watermark: args.watermark,
      };

  try {
    const result = await chat(args.utterance, args.conversationId, params);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch (e) {
    die(`Unexpected error: ${e.message}`);
  }
}

main();
