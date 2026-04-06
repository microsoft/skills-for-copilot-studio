/**
 * shared-utils.js — Shared utilities for Copilot Studio CLI scripts.
 *
 * Provides:
 *   - Process I/O helpers (log, die, sleep)
 *   - DirectLine v3 HTTP and protocol helpers
 */

const readline = require("readline");

// ---------------------------------------------------------------------------
// Process I/O helpers
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
// HTTP helpers (fetch-based)
// ---------------------------------------------------------------------------

async function httpGet(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    die(`HTTP ${res.status} from GET ${url}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function httpPost(url, headers, body) {
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
// DirectLine v3 — Token & regional domain
// ---------------------------------------------------------------------------

async function fetchToken(tokenEndpointUrl) {
  log("Fetching DirectLine token from token endpoint...");
  const data = await httpGet(tokenEndpointUrl, {});
  if (!data.token) die("Token endpoint did not return a token.");
  return data.token;
}

async function getRegionalDomain(tokenEndpointUrl) {
  try {
    const parsed = new URL(tokenEndpointUrl);
    const settingsUrl =
      parsed.origin +
      "/powervirtualagents/regionalchannelsettings?api-version=2022-03-01-preview";
    log("Fetching regional DirectLine domain...");
    const data = await httpGet(settingsUrl, {});
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

// ---------------------------------------------------------------------------
// DirectLine v3 — Conversation API
// ---------------------------------------------------------------------------

async function startConversation(domain, token) {
  log("Starting DirectLine conversation...");
  const data = await httpPost(
    `${domain}/v3/directline/conversations`,
    { Authorization: `Bearer ${token}` },
    {}
  );
  if (!data.conversationId) die("startConversation did not return a conversationId.");
  return { conversationId: data.conversationId, token: data.token || token };
}

async function sendActivity(domain, conversationId, token, activity) {
  return httpPost(
    `${domain}/v3/directline/conversations/${conversationId}/activities`,
    { Authorization: `Bearer ${token}` },
    activity
  );
}

async function pollActivities(domain, conversationId, token, watermark) {
  let url = `${domain}/v3/directline/conversations/${conversationId}/activities`;
  if (watermark !== undefined) {
    url += `?watermark=${watermark}`;
  }
  const data = await httpGet(url, { Authorization: `Bearer ${token}` });
  return {
    activities: data.activities || [],
    watermark: data.watermark,
  };
}

// ---------------------------------------------------------------------------
// DirectLine v3 — Sign-in detection
// ---------------------------------------------------------------------------

function findSignInCard(activities) {
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

async function promptForAuthCode(signinUrl) {
  log("");
  log("Sign-in required.");
  log(`Open this URL in your browser:\n  ${signinUrl}`);
  log("After signing in, enter the validation code below.");
  log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  const code = await new Promise((resolve) => {
    rl.question("Validation code: ", (answer) => {
      resolve(answer.trim());
    });
  });
  rl.close();

  if (!code) die("No validation code received on stdin.");
  return code;
}

// ---------------------------------------------------------------------------
// DirectLine v3 — Poll loop
// ---------------------------------------------------------------------------

async function runPollLoop(domain, conversationId, token, opts) {
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

      // Sign-in detection
      if (!authHandled) {
        const card = findSignInCard([activity]);
        if (card) {
          authHandled = true;

          if (process.stdin.isTTY) {
            // Interactive terminal — prompt for code on stdin
            const code = await promptForAuthCode(card.signinUrl);
            await sendActivity(domain, conversationId, token, {
              type: "message",
              from: { id: "user1", role: "user" },
              text: code,
            });
            log("Validation code sent. Waiting for authenticated response...");
            lastActivityTime = Date.now();
            continue;
          } else {
            // Non-interactive (e.g., Claude Bash tool) — return sign-in info in output
            allBotActivities.push(activity);
            return {
              activities: allBotActivities,
              watermark,
              signin: { url: card.signinUrl },
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

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  log,
  die,
  sleep,
  httpGet,
  httpPost,
  fetchToken,
  getRegionalDomain,
  startConversation,
  sendActivity,
  pollActivities,
  findSignInCard,
  runPollLoop,
};
