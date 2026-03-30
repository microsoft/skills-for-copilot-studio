---
user-invocable: false
description: Send a message to a Copilot Studio agent via DirectLine v3. Use for agents with no auth or manual auth. Requires a token endpoint URL or DirectLine secret.
argument-hint: <utterance>
allowed-tools: Bash(node *chat-with-agent.bundle.js *), Read, Glob
agent: copilot-studio-test
---

# Chat via DirectLine

Send a single utterance to a published agent via the DirectLine v3 REST API. Use this for agents with **no authentication** (authenticationmode 1) or **manual authentication** (authenticationmode 3).

## Instructions

1. Run the script with `--token-endpoint` (from detect-mode output) and the utterance from `$ARGUMENTS`:

   ```bash
   node ${CLAUDE_SKILL_DIR}/../../scripts/chat-with-agent.bundle.js \
     --token-endpoint "<tokenEndpoint>" "<utterance>"
   ```

   If the user provided a DirectLine secret instead:

   ```bash
   node ${CLAUDE_SKILL_DIR}/../../scripts/chat-with-agent.bundle.js \
     --directline-secret "<secret>" "<utterance>"
   ```

2. Parse the JSON output from stdout.

### Normal response (`status: "ok"`)

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

Display the agent's response from the `activities` array:
- **Text**: activities where `type === "message"` — show `text`
- **Suggested actions**: `suggestedActions.actions` array
- **Adaptive cards**: `attachments` with `contentType === "application/vnd.microsoft.card.adaptive"`

**Save `conversation_id`, `directline_token`, and `watermark`** — needed for follow-ups.

### Sign-in required (`status: "signin_required"`)

The agent requires the user to authenticate (manual auth agents):

```json
{
  "status": "signin_required",
  "protocol": "directline",
  "signin_url": "https://...",
  "resume_command": "...",
  "followup_command": "..."
}
```

1. Show the `signin_url` to the user, ask for the validation code
2. Send the code: `node ${CLAUDE_SKILL_DIR}/../../scripts/chat-with-agent.bundle.js <resume_command with code substituted>`
3. Re-send the utterance: `node ${CLAUDE_SKILL_DIR}/../../scripts/chat-with-agent.bundle.js <followup_command>`

Use `resume_command` and `followup_command` exactly as given.

## Multi-turn

Pass all three values from the previous response:

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/chat-with-agent.bundle.js \
  --token-endpoint "<url>" "<follow-up>" \
  --conversation-id "<id>" --directline-token "<token>" --watermark "<watermark>"
```

- **`directline_token`** is bound to the conversation — do NOT fetch a new token. Always reuse from the previous response.
- **`watermark`** tracks seen activities — pass it to avoid duplicates.
- Tokens expire after **~30 minutes**. If expired, start a new conversation (omit `--conversation-id`).

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `Token endpoint rejected` | Agent not published or wrong URL | Verify agent is published |
| `Conversation not found` | Token expired (>30 min) | Start a new conversation |
