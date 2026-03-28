---
user-invocable: false
description: Send a message to a published Copilot Studio agent and get its full response. Use when the user asks to test a specific utterance, check how the agent responds, verify a topic was fixed, or do a quick point-test after making YAML changes. Also useful for multi-turn conversation testing.
argument-hint: <utterance to send>
allowed-tools: Bash(node *chat-with-agent.bundle.js *), Read, Glob, Grep
context: fork
agent: copilot-studio-test
---

# Chat With Agent

Send a single utterance to a published Copilot Studio agent and display its full response.

The script supports two protocols — **DirectLine v3** (for no-auth and manual-auth agents) and the **Copilot Studio Client SDK** (for integrated-auth agents). You must detect the mode first before chatting.

## Prerequisites

The agent must be **published** (not just pushed). Pushing creates a draft — drafts are only testable in the Copilot Studio UI Test tab.

---

## Phase 1: Detect Authentication Mode

**Always run this first** before sending any utterance:

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/chat-with-agent.bundle.js --detect-only [--agent-dir <path>]
```

This queries the Dataverse `bots` entity for the agent's `authenticationmode` and returns one of:

### DirectLine mode (`authenticationmode` 1 or 3)

```json
{ "status": "ok", "mode": "directline", "authenticationmode": 1, "tokenEndpoint": "https://...", "schemaName": "..." }
```

The agent uses **no authentication** or **manual authentication**. No credentials needed from the user. The `tokenEndpoint` is auto-constructed. Proceed to **Phase 2a**.

### M365 mode (`authenticationmode` 2)

```json
{ "status": "ok", "mode": "m365", "authenticationmode": 2, "schemaName": "..." }
```

The agent uses **integrated authentication (Entra ID SSO)**. You need the user's App Registration Client ID. Ask:

> "Your agent uses integrated authentication. What is your App Registration Client ID? (The app needs `CopilotStudio.Copilots.Invoke` permission and redirect URI `http://localhost`.)"

Proceed to **Phase 2b**.

### Detection failure

If `--detect-only` fails (no `.mcs/conn.json`, no cached Dataverse token), ask the user:

> "I couldn't auto-detect your agent's authentication mode. How is it configured?"
> - **No authentication** or **Manual authentication** → ask for the token endpoint URL, proceed to Phase 2a
> - **Integrated authentication (Entra ID SSO)** → ask for the App Registration Client ID, proceed to Phase 2b

Tell the user they can run a push or pull first to cache the Dataverse token for auto-detection.

---

## Phase 2a: Chat — DirectLine Mode

For agents with `mode: "directline"`. Pass the `tokenEndpoint` from Phase 1:

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/chat-with-agent.bundle.js --token-endpoint "<tokenEndpoint>" "<utterance>"
```

If the user provided a DirectLine secret instead:

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/chat-with-agent.bundle.js --directline-secret "<secret>" "<utterance>"
```

### Output

The JSON output includes `protocol: "directline"` and DirectLine-specific fields you need for multi-turn:

```json
{
  "status": "ok",
  "protocol": "directline",
  "utterance": "hello",
  "conversation_id": "abc123-XYZ",
  "directline_token": "eyJ...",
  "watermark": "3",
  "start_activities": [ ... ],
  "activities": [ ... ]
}
```

**Save `conversation_id`, `directline_token`, and `watermark`** — you need all three for follow-ups.

### Sign-in flow (manual auth agents)

If `status` is `"signin_required"`, the bot needs the user to authenticate:

```json
{
  "status": "signin_required",
  "protocol": "directline",
  "signin_url": "https://...",
  "resume_command": "--token-endpoint \"...\" \"<VALIDATION_CODE>\" --conversation-id \"...\" --directline-token \"...\"",
  "followup_command": "--token-endpoint \"...\" \"hello\" --conversation-id \"...\" --directline-token \"...\""
}
```

1. Show `signin_url` to the user, ask for the validation code
2. Send the code: `node ... <resume_command with code substituted>`
3. Re-send the original utterance: `node ... <followup_command>`

Use `resume_command` and `followup_command` exactly as given — they contain the correct conversation ID, token, and watermark.

### Multi-turn (DirectLine)

Pass all three values from the previous response:

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/chat-with-agent.bundle.js \
  --token-endpoint "<url>" "<follow-up>" \
  --conversation-id "<id>" --directline-token "<token>" --watermark "<watermark>"
```

**Critical DirectLine details:**
- **`directline_token`** is bound to the conversation — a new token from the endpoint will NOT work for an existing conversation. Always reuse the token from the previous response.
- **`watermark`** tracks which activities you've already seen. Pass it to avoid re-receiving old messages.
- DirectLine tokens expire after **~30 minutes**. If the token expires, start a new conversation (omit `--conversation-id`).

---

## Phase 2b: Chat — Copilot Studio SDK Mode

For agents with `mode: "m365"`. Pass the user's app registration client ID:

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/chat-with-agent.bundle.js --client-id "<id>" "<utterance>"
```

### MSAL device-code flow

On first use (no cached token), stderr will contain a device login prompt:

```
To sign in, use a web browser to open the page https://microsoft.com/devicelogin and enter the code XXXXXXXXX
```

Present this prominently:

> **Authentication Required**
>
> Open: https://microsoft.com/devicelogin
> Enter code: **XXXXXXXXX**
>
> After signing in, the response will appear automatically.

Subsequent calls use cached tokens silently (~90 day refresh window).

### Output

```json
{
  "status": "ok",
  "protocol": "m365",
  "utterance": "hello",
  "conversation_id": "abc123-...",
  "start_activities": [ ... ],
  "activities": [ ... ]
}
```

**Save `conversation_id`** for follow-ups. No watermark or DirectLine token needed — the SDK manages state internally.

### Multi-turn (SDK)

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/chat-with-agent.bundle.js --client-id "<id>" "<follow-up>" --conversation-id "<id>"
```

SDK conversations do not expire as quickly as DirectLine (~30 min). Reuse `conversation_id` automatically when the user says "continue" or "send a follow-up".

---

## Display the Result

Extract from the `activities` array (same format for both protocols):

- **Text responses**: `type === "message"` — show the `text` field
- **Suggested actions**: `suggestedActions.actions` array, if present
- **Adaptive cards**: `attachments` with `contentType === "application/vnd.microsoft.card.adaptive"`
- **Citations/entities**: `entities` array may contain citation or AI entity data

Show a summary like:

> **Agent response:**
> [message text]
>
> **Suggested actions:** action1 · action2 _(omit if empty)_
>
> **Attachments:** [count] adaptive card(s) _(omit if none)_

If the user needs the raw JSON for debugging, show it when asked.

## Error Handling

| Error message | Likely cause | What to tell the user |
|---|---|---|
| `No agent.mcs.yml found` | Not in a Copilot Studio project | Clone the agent with the VS Code extension first |
| `Multiple agents found` | Multiple agents in project tree | Re-run with `--agent-dir <path>` |
| `No .mcs/conn.json found` | Agent not cloned via VS Code extension | Clone the agent first |
| `Could not detect authentication mode` | No cached Dataverse token | Run a push/pull first, or provide `--token-endpoint` / `--client-id` explicitly |
| `This agent uses integrated authentication` | M365 agent, no `--client-id` | Provide `--client-id` with correct permissions |
| `Authentication failed` | Wrong client ID or tenant ID | Verify app registration and permissions |
| `Could not obtain conversation_id` | Agent not published or wrong config | Verify agent is published |
| `Token endpoint rejected` | Agent not published or wrong URL | Verify agent is published and URL is correct |
| `Conversation not found` | Conversation expired (>30 min) | Start a new conversation |
