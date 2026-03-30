---
user-invocable: false
description: "DEPRECATED: Use /copilot-studio:chat-with-agent instead — it auto-detects DirectLine vs M365 mode. This skill is kept for backwards compatibility only."
argument-hint: <utterance to send>
allowed-tools: Bash(node *directline-chat.bundle.js *), Bash(node *manage-agent.bundle.js detect-mode *), Read, Glob, Grep
context: fork
agent: copilot-studio-test
---

# DirectLine Chat (Deprecated)

**This skill has been merged into `/copilot-studio:chat-with-agent`**, which now auto-detects the agent's authentication mode and uses DirectLine automatically for no-auth and manual-auth agents.

**Use `/copilot-studio:chat-with-agent` instead.** It handles both DirectLine and Copilot Studio SDK modes in a single skill.

If you are here because the caller explicitly provided a DirectLine secret or token endpoint URL, you may proceed with the instructions below. Otherwise, redirect to `/copilot-studio:chat-with-agent`.

---

## Direct Usage (when caller provides explicit DirectLine credentials)

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

### Multi-turn

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/directline-chat.bundle.js \
  --token-endpoint "<url>" "<follow-up>" \
  --conversation-id <id> --directline-token "<token>"
```

**Always pass `--directline-token`** when resuming. DirectLine tokens are bound to the conversation. They expire after ~30 min.

### Output format

Same as `/copilot-studio:chat-with-agent` Phase 1a — see that skill for full documentation of JSON output, sign-in flow, and error handling.
