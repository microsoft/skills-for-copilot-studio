---
user-invocable: false
description: Send a message to a bot via DirectLine v3 REST API and get the full response. Use when the user has a DirectLine secret or Copilot Studio token endpoint URL. Supports auth/sign-in flows via OAuthCard detection.
argument-hint: <utterance to send>
allowed-tools: Bash(node *directline-chat.bundle.js *), Read, Glob, Grep
context: fork
agent: copilot-studio-test
---

# DirectLine Chat

Send a single utterance to a bot via the DirectLine v3 REST API and display its full response. Works with any bot reachable via DirectLine — either through a Copilot Studio token endpoint (no Azure app registration needed) or a raw DirectLine secret.

## Connection Modes

| Mode | When to use | What you need |
|------|-------------|--------------|
| **Token endpoint** | Agent published in Copilot Studio with Direct Line channel | Copilot Studio token endpoint URL |
| **DirectLine secret** | Azure Bot Service bot with DirectLine channel enabled | DirectLine secret from Azure Portal |

## Phase 0: Resolve Connection Parameters

Ask the user which mode to use if not already clear from `$ARGUMENTS`:

- **Token endpoint mode**: "What is your Copilot Studio token endpoint URL? It looks like `https://...api.powerplatform.com/powervirtualagents/botsbyschema/.../directline/token?api-version=2022-03-01-preview`"
- **DirectLine secret mode**: "What is your DirectLine secret? Find it in Azure Portal > Bot Service > Channels > DirectLine > Secret keys."

Remember the token endpoint or secret for the entire conversation — you will need it for follow-up messages and auth flows.

## Phase 1: Send Utterance

### Token endpoint mode

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/directline-chat.bundle.js \
  --token-endpoint "<url>" "<utterance>"
```

### DirectLine secret mode

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/directline-chat.bundle.js \
  --directline-secret "<secret>" "<utterance>"
```

With optional domain override:

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/directline-chat.bundle.js \
  --directline-secret "<secret>" \
  --directline-domain "https://directline.botframework.com" \
  "<utterance>"
```

The script outputs:
- **stderr**: diagnostic messages (token fetch, conversation start, poll progress)
- **stdout**: a single JSON object with the full result

### Parse the JSON output

The output has one of three `status` values:

#### `status: "ok"` — Normal response

```json
{
  "status": "ok",
  "utterance": "hello",
  "conversation_id": "abc123-XYZ",
  "start_activities": [ ... ],
  "activities": [ ... ]
}
```

#### `status: "signin_required"` — Bot requires authentication

```json
{
  "status": "signin_required",
  "signin_url": "https://token.botframework.com/api/oauth/signin?signin=...",
  "conversation_id": "abc123-XYZ",
  "directline_token": "eyJ...",
  "utterance": "hello",
  "start_activities": [ ... ],
  "activities": [],
  "resume_command": "--token-endpoint \"<url>\" \"<VALIDATION_CODE>\" --conversation-id \"abc123-XYZ\" --directline-token \"eyJ...\"",
  "followup_command": "--token-endpoint \"<url>\" \"hello\" --conversation-id \"abc123-XYZ\" --directline-token \"eyJ...\""
}
```

**CRITICAL: When you see `signin_required`, follow the Auth Flow below. Do NOT start a new conversation. The response includes `resume_command` and `followup_command` with the exact arguments to use — just substitute the validation code and run them.**

#### `status: "error"` — Error

```json
{ "status": "error", "error": "..." }
```

## Auth Flow (Sign-In Required)

When `status` is `"signin_required"`, the bot requires the user to authenticate. Follow these steps exactly:

1. **Show the sign-in URL** to the user:

   > **Sign-in Required**
   >
   > The bot requires authentication. Open this URL in your browser:
   > [signin_url from the response]
   >
   > After signing in, you'll see a validation code. Paste it here.

2. **Wait for the user to provide the validation code.**

3. **Send the validation code** — take `resume_command` from the JSON output, replace `<VALIDATION_CODE>` with the user's code, and run:

   ```bash
   node ${CLAUDE_SKILL_DIR}/../../scripts/directline-chat.bundle.js <resume_command with code substituted>
   ```

   Do NOT construct the command yourself. Use `resume_command` exactly as given — it already contains the correct `--conversation-id` and `--directline-token`.

4. **Send the original utterance** — take `followup_command` from the JSON output and run:

   ```bash
   node ${CLAUDE_SKILL_DIR}/../../scripts/directline-chat.bundle.js <followup_command>
   ```

   This sends the user's original message in the now-authenticated conversation.

### Display the result

Extract from `activities`:

- **Text responses**: `type === "message"` — show `text`
- **Suggested actions**: `suggestedActions.actions` array
- **Adaptive cards**: `attachments` with `contentType === "application/vnd.microsoft.card.adaptive"`

Show a summary like:

> **Agent response:**
> [message text]
>
> **Suggested actions:** action1 · action2 _(omit if empty)_

## Phase 2: Multi-Turn Sequences

Pass `--conversation-id` and `--directline-token` from the previous response:

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/directline-chat.bundle.js \
  --token-endpoint "<url>" "<follow-up>" \
  --conversation-id <id> --directline-token "<token>"
```

**Always pass `--directline-token`** when resuming a conversation. DirectLine tokens are bound to the conversation that created them — a new token from the token endpoint will fail with "Token not valid for this conversation". The `directline_token` field is included in every response for this purpose.

DirectLine tokens expire (~30 min). If the token expires, start a new conversation.

When the user says "continue the conversation" or "send a follow-up", reuse `conversation_id` automatically.

## Error Handling

| Error message | Likely cause | What to tell the user |
|---|---|---|
| `Token endpoint rejected` | Agent not published or wrong URL | Verify agent is published and URL is correct |
| `DirectLine authentication failed` | Wrong secret or expired token | Check the DirectLine secret |
| `Conversation not found` | Conversation expired (>30 min) | Start a new conversation without `--conversation-id` |
| `Network error` | Connectivity issue | Check network and endpoint URL |
