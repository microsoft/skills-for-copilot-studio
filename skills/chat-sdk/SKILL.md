---
user-invocable: false
description: Send a message to a Copilot Studio agent via the Copilot Studio Client SDK (M365). Use for agents with integrated auth (Entra ID SSO). Requires an App Registration Client ID.
argument-hint: <utterance>
allowed-tools: Bash(node *chat-with-agent.bundle.js *), Read, Glob
agent: copilot-studio-test
---

# Chat via Copilot Studio SDK

Send a single utterance to a published agent via the Copilot Studio Client SDK. Use this for agents with **integrated authentication / Entra ID SSO** (authenticationmode 2).

## Prerequisites

An **Azure App Registration** configured as:
- **Platform**: Public client / Native (Mobile and desktop applications) — NOT SPA
- **Redirect URI**: `http://localhost` (HTTP, not HTTPS)
- **API permissions**: Power Platform API → Delegated → `CopilotStudio.Copilots.Invoke`

## Instructions

1. Run the script with `--client-id` and the utterance from `$ARGUMENTS`:

   ```bash
   node ${CLAUDE_SKILL_DIR}/../../scripts/chat-with-agent.bundle.js \
     --client-id "<clientId>" "<utterance>" [--agent-dir <path>]
   ```

2. **Watch stderr for MSAL device-code flow.** On first use (no cached token), you'll see:

   ```
   To sign in, use a web browser to open https://microsoft.com/devicelogin and enter the code XXXXXXXXX
   ```

   Present this prominently:

   > **Authentication Required**
   >
   > Open: https://microsoft.com/devicelogin
   > Enter code: **XXXXXXXXX**
   >
   > After signing in, the response will appear automatically.

   Subsequent calls use cached tokens silently (~90 day refresh).

3. Parse the JSON output from stdout:

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

Display the agent's response from the `activities` array:
- **Text**: activities where `type === "message"` — show `text`
- **Suggested actions**: `suggestedActions.actions` array
- **Adaptive cards**: `attachments` with `contentType === "application/vnd.microsoft.card.adaptive"`

**Save `conversation_id`** for follow-ups.

## Multi-turn

Pass `--conversation-id` from the previous response:

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/chat-with-agent.bundle.js \
  --client-id "<id>" "<follow-up>" --conversation-id "<id>"
```

SDK sessions do not expire as quickly as DirectLine. Reuse `conversation_id` automatically for follow-ups.

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `Authentication failed` | Wrong client ID or tenant | Verify app registration and permissions |
| `Could not obtain conversation_id` | Agent not published or wrong config | Verify agent is published |
