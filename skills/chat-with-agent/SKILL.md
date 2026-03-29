---
user-invocable: false
description: "DEPRECATED: Use /copilot-studio:detect-mode then /copilot-studio:chat-directline or /copilot-studio:chat-sdk instead."
argument-hint: <utterance to send>
allowed-tools: Bash(node *chat-with-agent.bundle.js *), Read, Glob, Grep
agent: copilot-studio-test
---

# Chat With Agent (Deprecated)

This skill has been split into atomic skills:

1. **`/copilot-studio:detect-mode`** — detect the agent's auth mode
2. **`/copilot-studio:chat-directline`** — chat via DirectLine v3 (no auth / manual auth)
3. **`/copilot-studio:chat-sdk`** — chat via Copilot Studio SDK (integrated auth / M365)

Follow the **Point-test workflow** in the test agent prompt instead of using this skill directly.
