---
user-invocable: false
description: Send a message to a published Copilot Studio agent and get its full response. Use when the user asks to test a specific utterance, check how the agent responds, verify a topic was fixed, or do a quick point-test after making YAML changes. Also useful for multi-turn conversation testing.
argument-hint: <utterance to send>
allowed-tools: Bash(node *chat-with-agent.bundle.js *), Read, Glob, Grep
context: fork
agent: copilot-studio-test
---

# Chat With Agent

Send a single utterance to a published Copilot Studio agent and display its full response. Useful for point-testing after YAML changes without running the full test suite.

## Prerequisites

1. The agent must be **published** (not just pushed). Pushing with the VS Code Extension creates a draft — drafts are only testable in the Copilot Studio UI Test tab. This skill can only reach **published** content. The user must publish in the Copilot Studio UI at [copilotstudio.microsoft.com](https://copilotstudio.microsoft.com) after pushing.

2. An **Azure App Registration** configured as follows:
   - **Platform**: Public client / Native (Mobile and desktop applications) — NOT SPA
   - **Redirect URI**: `http://localhost` (HTTP, not HTTPS)
   - **API permissions**: `CopilotStudio.Copilots.Invoke` (granted by admin)
   - This uses MSAL device-code flow, which requires a public client

## Phase 0: Resolve Client ID

The script auto-discovers agent connection details (environmentId, tenantId, agentIdentifier) from the VS Code extension's `.mcs/conn.json` and `settings.mcs.yml`. The only value it cannot discover is the **App Registration Client ID**.

1. **Ask the user** for their app registration client ID:
   - "What is your app registration client ID? The app must have `CopilotStudio.Copilots.Invoke` API permission and redirect URI `http://localhost` (HTTP, not HTTPS)."

2. Remember the client ID for the rest of the conversation (pass it as `--client-id` on each invocation).

## Phase 1: Send Utterance

Run the bundled script with the utterance from `$ARGUMENTS` (or ask the user if not provided):

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/chat-with-agent.bundle.js --client-id <id> "<utterance>"
```

If the agent is not at the project root (or multiple agents exist), pass `--agent-dir`:

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/chat-with-agent.bundle.js --client-id <id> "<utterance>" --agent-dir <path-to-agent>
```

The script outputs:
- **stderr**: diagnostic messages (auth status, progress)
- **stdout**: a single JSON object with the full result

### Detect authentication state from stderr

- If stderr contains **"Using cached token"**: auth succeeded automatically.
- If stderr contains **"To sign in, use a web browser"** or **"devicelogin"**: extract the URL and device code from the message and present them prominently:

  > **Authentication Required**
  >
  > Open: https://microsoft.com/devicelogin
  > Enter code: **XXXXXXXXX**
  >
  > After signing in, the response will appear automatically.

- If `status` is `"error"` in the JSON output: report the `error` field to the user.

### Parse the JSON output from stdout

The output JSON has this structure:

```json
{
  "status": "ok",
  "utterance": "hello",
  "conversation_id": "abc123-...",
  "start_activities": [ ... ],
  "activities": [ ... ]
}
```

- `start_activities`: full activity payloads from `startConversation` (greeting, welcome messages). Only present on new conversations.
- `activities`: full activity payloads from `askQuestion` — these are the agent's response to the utterance.

Each activity in the arrays is a complete Activity Protocol object with fields like `type`, `text`, `attachments`, `suggestedActions`, `entities`, `conversation`, `from`, etc. Inspect all fields to understand the agent's full response.

### Display the result

Present the agent's response clearly. Extract from the `activities` array:

- **Text responses**: activities where `type` is `"message"` — show the `text` field
- **Suggested actions**: the `suggestedActions.actions` array, if present
- **Adaptive cards**: `attachments` array entries with `contentType` of `"application/vnd.microsoft.card.adaptive"`
- **Citations/entities**: the `entities` array may contain citation or AI entity data

Show a summary like:

> **Agent response:**
> [message text]
>
> **Suggested actions:** action1 · action2 _(omit if empty)_
>
> **Attachments:** [count] adaptive card(s) _(omit if none)_

If the user needs the raw JSON for debugging, show it when asked.

## Phase 2: Multi-Turn Sequences

To test a multi-turn conversation, pass the `conversation_id` from the previous response:

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/chat-with-agent.bundle.js --client-id <id> "<follow-up>" --conversation-id <id-from-previous>
```

When the user asks to "continue the conversation" or "send a follow-up", reuse the `conversation_id` from the last successful response automatically without asking.

## Error Handling

| Error message | Likely cause | What to tell the user |
|---|---|---|
| `No agent.mcs.yml found` | Not in a Copilot Studio project, or agent not cloned | Ask user to clone the agent with the VS Code extension first |
| `Multiple agents found` | Multiple agents in project tree | Re-run with `--agent-dir <path>` |
| `No .mcs/conn.json found` | Agent not cloned via VS Code extension | The extension stores connection info in `.mcs/conn.json` — clone the agent first |
| `schemaName not found` | Malformed settings.mcs.yml | Check the agent's settings.mcs.yml has a schemaName field |
| `Authentication failed` | Wrong client ID or tenant ID | Verify app registration and permissions |
| `Could not obtain conversation_id` | Agent not published, wrong environment ID, or wrong agent identifier | Ask user to verify the agent is published and settings are correct |
