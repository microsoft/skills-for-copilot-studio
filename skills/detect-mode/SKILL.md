---
user-invocable: false
description: Detect a Copilot Studio agent's authentication mode (DirectLine vs M365) by querying Dataverse. Returns the mode and connection details needed to chat.
argument-hint: [--agent-dir <path>]
allowed-tools: Bash(node *chat-with-agent.bundle.js --detect-only *), Read, Glob
agent: copilot-studio-test
---

# Detect Agent Authentication Mode

Query the Dataverse `bots` entity to determine whether the agent uses DirectLine (no auth / manual auth) or the Copilot Studio SDK (integrated auth / Entra ID SSO).

## Instructions

1. Run the detect-only command:

   ```bash
   node ${CLAUDE_SKILL_DIR}/../../scripts/chat-with-agent.bundle.js --detect-only $ARGUMENTS
   ```

   If the agent is not at the project root, pass `--agent-dir <path>`.

2. Parse the JSON output from stdout:

   ### DirectLine mode (authenticationmode 1 or 3)
   ```json
   { "status": "ok", "mode": "directline", "authenticationmode": 1, "tokenEndpoint": "https://...", "schemaName": "..." }
   ```
   The agent uses **no authentication** or **manual authentication**. No user credentials needed. The `tokenEndpoint` is ready to use with `/copilot-studio:chat-directline`.

   ### M365 mode (authenticationmode 2)
   ```json
   { "status": "ok", "mode": "m365", "authenticationmode": 2, "schemaName": "..." }
   ```
   The agent uses **integrated authentication (Entra ID SSO)**. An App Registration Client ID is needed for `/copilot-studio:chat-sdk`.

3. Return the result to the caller. Do not proceed to chat — that is a separate step.

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `No agent.mcs.yml found` | No agent in workspace | Clone the agent first |
| `No .mcs/conn.json found` | Agent not cloned via VS Code extension | Clone with the extension |
| `Could not detect authentication mode` | No cached Dataverse token | Run a push/pull first to cache tokens, or ask the user about their auth config |
