---
description: Send a message to a published Copilot Studio agent and get its full response. Use when the user asks to test a specific utterance, check how the agent responds, verify a topic was fixed, or do a quick point-test after making YAML changes. Also useful for multi-turn conversation testing.
argument-hint: <utterance to send>
allowed-tools: Bash(python tests/chat-with-agent.py *), Bash(pip install -r tests/requirements.txt), Read, Write, Edit, Glob, Grep
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

## Phase 0: Resolve Agent Connection

Follow the **Agent Registry** convention from CLAUDE.md:

1. **Read `tests/agents.json`** (if it exists). If the target agent is already registered with complete values, skip to Phase 1.

2. **Auto-discover from VS Code extension clones.** Glob for `**/.mcs/conn.json`. For each match:
   - Read the `.mcs/conn.json` file for `EnvironmentId`, `AccountInfo.TenantId`, and `DataverseEndpoint`
   - Read the sibling `settings.mcs.yml` (one directory up from `.mcs/`) for the `schemaName` field — this is the `agentIdentifier`
   - Read the sibling `agent.mcs.yml` for the display name
   - `localPath` is the agent directory relative to the project root

3. **If no cloned agents found**, ask the user for `environmentId`, `agentIdentifier`, and `tenantId` manually. Explain where to find each:
   - **Environment ID**: "Power Platform admin center > Environments > your environment > GUID in URL, or Copilot Studio > Settings > Session Details."
   - **Agent identifier**: "Copilot Studio > your agent > Settings > Agent details > schema name. Looks like `cr123_myAgentName`."
   - **Tenant ID**: "Azure Portal > Microsoft Entra ID > Overview."

4. **`clientId` is always user-provided** — it's never in the extension metadata. If missing from the registry entry, ask:
   - "What is your app registration client ID? The app must have `CopilotStudio.Copilots.Invoke` API permission and redirect URI `http://localhost` (HTTP, not HTTPS)."

5. **If multiple agents found**, ask the user which one to use.

6. **Persist to `tests/agents.json`**, preserving all existing entries:
   ```json
   {
     "Agent Name": {
       "environmentId": "<from conn.json or user>",
       "tenantId": "<from conn.json or user>",
       "agentIdentifier": "<from settings.mcs.yml or user>",
       "clientId": "<from user>",
       "dataverseEndpoint": "<from conn.json or user>",
       "localPath": "<relative path to agent folder, if cloned>"
     }
   }
   ```

## Phase 1: Install Dependencies

Check whether the Python package is available:

```bash
python -c "from microsoft_agents.copilotstudio.client import CopilotClient" 2>/dev/null && echo "ok" || echo "missing"
```

If output is `missing`, install dependencies:

```bash
pip install -r tests/requirements.txt
```

## Phase 2: Send Utterance

Run the script with the utterance from `$ARGUMENTS` (or ask the user if not provided):

```bash
python tests/chat-with-agent.py "<utterance>"
```

If multiple agents are registered, pass the `--agent` flag:

```bash
python tests/chat-with-agent.py "<utterance>" --agent "<Agent Name>"
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

- `start_activities`: full activity payloads from `start_conversation` (greeting, welcome messages). Only present on new conversations.
- `activities`: full activity payloads from `ask_question` — these are the agent's response to the utterance.

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

## Phase 3: Multi-Turn Sequences

To test a multi-turn conversation, pass the `conversation_id` from the previous response:

```bash
python tests/chat-with-agent.py "<follow-up>" --conversation-id <id-from-previous>
```

When the user asks to "continue the conversation" or "send a follow-up", reuse the `conversation_id` from the last successful response automatically without asking.

## Error Handling

| Error message | Likely cause | What to tell the user |
|---|---|---|
| `tests/agents.json not found` | Registry not populated yet | Run Phase 0 to discover or configure agents |
| `Agent 'X' not found in registry` | Wrong agent name | Check available agents in `tests/agents.json` |
| `Multiple agents in registry` | Need to specify which | Re-run with `--agent "Agent Name"` |
| `Authentication failed` | Wrong client ID or tenant ID | Verify app registration and permissions |
| `Could not obtain conversation_id` | Agent not published, wrong environment ID, or wrong agent identifier | Ask user to verify the agent is published and settings are correct |
| `Error sending request: 4xx` | Auth or permission issue | Check that app has `CopilotStudio.Copilots.Invoke` permission |
