var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/shared-utils.js
var require_shared_utils = __commonJS({
  "src/shared-utils.js"(exports2, module2) {
    var readline = require("readline");
    function log2(msg) {
      process.stderr.write(msg + "\n");
    }
    function die2(msg) {
      process.stdout.write(JSON.stringify({ status: "error", error: msg }) + "\n");
      process.exit(1);
    }
    var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    async function httpGet(url, headers) {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        die2(`HTTP ${res.status} from GET ${url}: ${body.slice(0, 200)}`);
      }
      return res.json();
    }
    async function httpPost(url, headers, body) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        die2(`HTTP ${res.status} from POST ${url}: ${text.slice(0, 200)}`);
      }
      return res.json();
    }
    async function fetchToken2(tokenEndpointUrl) {
      log2("Fetching DirectLine token from token endpoint...");
      const data = await httpGet(tokenEndpointUrl, {});
      if (!data.token) die2("Token endpoint did not return a token.");
      return data.token;
    }
    async function getRegionalDomain2(tokenEndpointUrl) {
      try {
        const parsed = new URL(tokenEndpointUrl);
        const settingsUrl = parsed.origin + "/powervirtualagents/regionalchannelsettings?api-version=2022-03-01-preview";
        log2("Fetching regional DirectLine domain...");
        const data = await httpGet(settingsUrl, {});
        const domain = data.channelUrlsById?.directline?.replace(/\/+$/, "");
        if (domain) {
          log2(`Regional domain: ${domain}`);
          return domain;
        }
      } catch (e) {
        log2(`Warning: Could not fetch regional domain (${e.message}). Using default.`);
      }
      return "https://directline.botframework.com";
    }
    async function startConversation2(domain, token) {
      log2("Starting DirectLine conversation...");
      const data = await httpPost(
        `${domain}/v3/directline/conversations`,
        { Authorization: `Bearer ${token}` },
        {}
      );
      if (!data.conversationId) die2("startConversation did not return a conversationId.");
      return { conversationId: data.conversationId, token: data.token || token };
    }
    async function sendActivity2(domain, conversationId, token, activity) {
      return httpPost(
        `${domain}/v3/directline/conversations/${conversationId}/activities`,
        { Authorization: `Bearer ${token}` },
        activity
      );
    }
    async function pollActivities(domain, conversationId, token, watermark) {
      let url = `${domain}/v3/directline/conversations/${conversationId}/activities`;
      if (watermark !== void 0) {
        url += `?watermark=${watermark}`;
      }
      const data = await httpGet(url, { Authorization: `Bearer ${token}` });
      return {
        activities: data.activities || [],
        watermark: data.watermark
      };
    }
    function findSignInCard(activities) {
      for (const activity of activities) {
        if (activity.type !== "message" || !activity.attachments) continue;
        for (const att of activity.attachments) {
          if (att.contentType === "application/vnd.microsoft.card.signin" || att.contentType === "application/vnd.microsoft.card.oauth") {
            const url = att.content?.buttons?.[0]?.value || att.content?.tokenExchangeResource?.uri || null;
            if (url) return { signinUrl: url };
          }
        }
      }
      return null;
    }
    async function promptForAuthCode(signinUrl) {
      log2("");
      log2("Sign-in required.");
      log2(`Open this URL in your browser:
  ${signinUrl}`);
      log2("After signing in, enter the validation code below.");
      log2("");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stderr
      });
      const code = await new Promise((resolve) => {
        rl.question("Validation code: ", (answer) => {
          resolve(answer.trim());
        });
      });
      rl.close();
      if (!code) die2("No validation code received on stdin.");
      return code;
    }
    async function runPollLoop2(domain, conversationId, token, opts) {
      const timeoutMs = opts && opts.timeoutMs || 3e4;
      const intervalMs = opts && opts.intervalMs || 1e3;
      let watermark = opts && opts.watermark;
      let lastActivityTime = Date.now();
      let authHandled = false;
      const allBotActivities = [];
      while (true) {
        if (Date.now() - lastActivityTime > timeoutMs) {
          log2("Poll timeout \u2014 no more bot activities.");
          break;
        }
        const result = await pollActivities(domain, conversationId, token, watermark);
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
            const card = findSignInCard([activity]);
            if (card) {
              authHandled = true;
              if (process.stdin.isTTY) {
                const code = await promptForAuthCode(card.signinUrl);
                await sendActivity2(domain, conversationId, token, {
                  type: "message",
                  from: { id: "user1", role: "user" },
                  text: code
                });
                log2("Validation code sent. Waiting for authenticated response...");
                lastActivityTime = Date.now();
                continue;
              } else {
                allBotActivities.push(activity);
                return {
                  activities: allBotActivities,
                  watermark,
                  signin: { url: card.signinUrl }
                };
              }
            }
          }
          allBotActivities.push(activity);
        }
        await sleep(intervalMs);
      }
      return { activities: allBotActivities, watermark };
    }
    module2.exports = {
      log: log2,
      die: die2,
      sleep,
      httpGet,
      httpPost,
      fetchToken: fetchToken2,
      getRegionalDomain: getRegionalDomain2,
      startConversation: startConversation2,
      sendActivity: sendActivity2,
      pollActivities,
      findSignInCard,
      runPollLoop: runPollLoop2
    };
  }
});

// src/directline-chat.js
var {
  log,
  die,
  fetchToken,
  getRegionalDomain,
  startConversation,
  sendActivity,
  runPollLoop
} = require_shared_utils();
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    utterance: null,
    conversationId: null,
    tokenEndpoint: null,
    directlineSecret: null,
    directlineDomain: null,
    directlineToken: null,
    watermark: null
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
    token = conv.token;
    log(`Conversation started: ${conversationId}`);
    await sendActivity(domain, conversationId, token, {
      type: "event",
      name: "startConversation",
      from: { id: "user1", role: "user" }
    });
    log("startConversation event sent.");
    const startResult = await runPollLoop(domain, conversationId, token, {
      timeoutMs: 3e4,
      intervalMs: 1e3
    });
    startActivities = startResult.activities;
    watermark = startResult.watermark;
    if (startResult.signin) {
      log("Sign-in required. Returning sign-in URL for caller to handle.");
      const connFlag = params.mode === "token-endpoint" ? `--token-endpoint "${params.tokenEndpoint}"` : `--directline-secret "${params.directlineSecret}"`;
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
        followup_command: `${connFlag} "${utterance}" --conversation-id "${conversationId}" --directline-token "${token}" --watermark "${watermark}"`
      };
    }
    log(`Received ${startActivities.length} start activities.`);
  } else {
    log(`Reusing conversation: ${conversationId}`);
    if (params.directlineToken) {
      token = params.directlineToken;
      log("Using provided DirectLine token.");
    } else if (params.mode === "token-endpoint") {
      token = await fetchToken(params.tokenEndpoint);
    }
    if (params.watermark) {
      watermark = params.watermark;
      log(`Resuming from watermark: ${watermark}`);
    }
  }
  await sendActivity(domain, conversationId, token, {
    type: "message",
    from: { id: "user1", role: "user" },
    text: utterance
  });
  log(`Sent: "${utterance}"`);
  const responseResult = await runPollLoop(domain, conversationId, token, {
    timeoutMs: 3e4,
    intervalMs: 1e3,
    watermark
  });
  if (responseResult.signin) {
    log("Sign-in required. Returning sign-in URL for caller to handle.");
    const connFlag = params.mode === "token-endpoint" ? `--token-endpoint "${params.tokenEndpoint}"` : `--directline-secret "${params.directlineSecret}"`;
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
      followup_command: `${connFlag} "${utterance}" --conversation-id "${conversationId}" --directline-token "${token}" --watermark "${responseResult.watermark}"`
    };
  }
  return {
    status: "ok",
    utterance,
    conversation_id: conversationId,
    directline_token: token,
    watermark: responseResult.watermark,
    start_activities: startActivities,
    activities: responseResult.activities
  };
}
async function main() {
  const args = parseArgs();
  const params = args.tokenEndpoint ? { mode: "token-endpoint", tokenEndpoint: args.tokenEndpoint, directlineToken: args.directlineToken, watermark: args.watermark } : {
    mode: "directline-secret",
    directlineSecret: args.directlineSecret,
    directlineDomain: args.directlineDomain,
    directlineToken: args.directlineToken,
    watermark: args.watermark
  };
  try {
    const result = await chat(args.utterance, args.conversationId, params);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch (e) {
    die(`Unexpected error: ${e.message}`);
  }
}
main();
