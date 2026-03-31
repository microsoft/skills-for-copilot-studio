---
user-invocable: false
description: Detect a Copilot Studio agent's authentication mode by querying Dataverse. Returns the auth mode and a recommended chat protocol (DirectLine or M365 SDK). The recommendation can be overridden by the user.
argument-hint: [--agent-dir <path>]
allowed-tools: Bash(node *detect-mode.bundle.js *), Read, Glob
agent: copilot-studio-test
---

# Detect Agent Authentication Mode

Query the Dataverse `bots` entity to determine the agent's authentication configuration and recommend a chat protocol.

## Instructions

1. Run the detect-mode script:

   ```bash
   node ${CLAUDE_SKILL_DIR}/../../scripts/detect-mode.bundle.js $ARGUMENTS
   ```

   If the agent is not at the project root, pass `--agent-dir <path>`.

2. Parse the JSON output from stdout:

   ### No auth or manual auth (authenticationmode 1 or 3)
   ```json
   { "status": "ok", "authenticationmode": 1, "recommendedMode": "directline", "tokenEndpoint": "https://...", "schemaName": "..." }
   ```
   **Default recommendation:** DirectLine. The `tokenEndpoint` is ready to use with `/copilot-studio:chat-directline`.

   However, the user may override this and use `/copilot-studio:chat-sdk` instead (e.g., for S2S/D2E scenarios where they want to test the M365 Agents SDK path).

   ### Integrated auth (authenticationmode 2)
   ```json
   { "status": "ok", "authenticationmode": 2, "recommendedMode": "m365", "schemaName": "..." }
   ```
   **Recommendation:** Copilot Studio SDK. An App Registration Client ID is needed for `/copilot-studio:chat-sdk`.

3. Return the result to the caller. Do not proceed to chat — that is a separate step. The caller (test agent) decides which chat skill to invoke based on this result and the user's preference.

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `No agent.mcs.yml found` | No agent in workspace | Clone the agent first |
| `No .mcs/conn.json found` | Agent not cloned via VS Code extension | Clone with the extension |
| `No cached Dataverse tokens` | Never ran push/pull | Run a push or pull first to cache tokens |
