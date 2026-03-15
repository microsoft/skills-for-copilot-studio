---
user-invocable: false
description: Push/pull Copilot Studio agent content via the VS Code extension's LanguageServerHost LSP binary. Handles authentication (interactive browser login for push/pull, device code flow for chat token), sync push, sync pull, clone, and diff operations.
argument-hint: <push|pull|clone|changes|auth>
allowed-tools: Bash(node *manage-agent.bundle.js *), Read, Glob, Grep
context: fork
agent: manage
---

# Manage Agent

Push and pull Copilot Studio agent content by calling the VS Code extension's LanguageServerHost binary directly, using the same custom LSP protocol the extension uses internally.

## Prerequisites

1. **Copilot Studio VS Code extension** must be installed (`ms-copilotstudio.vscode-copilotstudio`).
2. **Azure AD app registration** (optional) — only needed for device code flow (`auth` command). If `--client-id` is omitted, the script uses VS Code's first-party client ID with interactive browser login instead.
3. **Environment details** — tenant ID, environment ID, environment URL, and agent management URL. These come from the `.mcs/conn.json` inside a cloned agent workspace (created automatically during clone).

## Phase 0: Resolve Configuration

Search for `.mcs/conn.json` in the workspace and nearby directories to find existing connection details. The script auto-reads environment details from `conn.json`. If no `conn.json` is found, ask the user for the required parameters.

## Phase 1: Authenticate

There are **two different auth flows** depending on the operation:

### For push / pull / clone / changes / list-agents (interactive browser login)

These commands use VS Code's first-party client ID with the **Island API gateway**. Authentication is **interactive** — a browser window opens automatically for sign-in. No manual code entry is needed.

- On first use, a browser window opens for Microsoft sign-in
- Tokens are cached in `.token_cache.json` and silently refreshed for ~90 days
- After ~90 days, the browser will open again for re-authentication

**No separate auth step is needed before push/pull.** The commands handle token acquisition automatically. Just run the command directly (Phase 2).

### For the `auth` command (device code flow — chat/test token)

The `auth` command acquires a generic `api.powerplatform.com` token using **device code flow**. This token is used by the chat and test skills, not by push/pull.

Run with a **5-minute timeout**:

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/manage-agent.bundle.js auth \
  --tenant-id "<tenantId>" \
  --client-id "<clientId>" \
  --environment-url "<environmentUrl>"
```

**Timeout: 300000ms (5 minutes)** — set this on the Bash tool call.

### Token caching and silent refresh

Tokens and MSAL refresh tokens are persisted in `.token_cache.json`. After initial authentication:
- Access tokens are valid for ~1 hour
- Refresh tokens are valid for ~90 days
- The script automatically refreshes expired access tokens silently using the cached refresh token
- **Re-authentication is only needed on the very first use or after ~90 days**

### When device code flow starts (auth command only)

The script emits a JSON line to stdout:

```json
{"status":"device_code","userCode":"XXXXXXXX","verificationUri":"https://login.microsoft.com/device","message":"...","expiresIn":900}
```

**When you see this in the output**, immediately tell the user:

> **Authentication Required**
>
> Please open **{verificationUri}** in your browser and enter code **{userCode}**
>
> The command is waiting for you to complete sign-in. You have {expiresIn/60} minutes.

The command will automatically continue once the user completes authentication. **Do NOT cancel the command** — it is waiting for the browser sign-in to complete.

Two tokens are acquired sequentially (Copilot Studio API, then Dataverse API), so the user may need to authenticate **twice** on first use.

### If the command completes with `status: "ok"`

Tokens are cached. Proceed to Phase 2.

### If the command fails with `device_code_expired`

The user didn't authenticate in time. Re-run the `auth` command and remind them to authenticate promptly.

## Phase 2: Execute Command

All commands auto-detect the agent directory (finds the subfolder with `.mcs/conn.json`) and read connection details from it.

### Pull (download remote changes)

`--client-id` is optional. When omitted, uses VS Code's 1p client with interactive browser login.

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/manage-agent.bundle.js pull \
  --workspace "<path-to-agent-folder>" \
  --tenant-id "<tenantId>" \
  --environment-id "<envId>" \
  --environment-url "<envUrl>" \
  --agent-mgmt-url "<mgmtUrl>"
```

### Push (upload local changes)

**Important:** Always `pull` before `push` to get fresh row versions. If you push without pulling first, you'll get a `ConcurrencyVersionMismatch` error.

`--client-id` is optional. When omitted, uses VS Code's 1p client with interactive browser login.

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/manage-agent.bundle.js push \
  --workspace "<path-to-agent-folder>" \
  --tenant-id "<tenantId>" \
  --environment-id "<envId>" \
  --environment-url "<envUrl>" \
  --agent-mgmt-url "<mgmtUrl>"
```

### Clone (download agent to new local folder)

Requires `--agent-id` (the bot GUID from `list-agents`). Uses Island API token automatically.

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/manage-agent.bundle.js clone \
  --workspace "<target-folder>" \
  --tenant-id "<tenantId>" \
  --environment-id "<envId>" \
  --environment-url "<envUrl>" \
  --agent-mgmt-url "<mgmtUrl>" \
  --agent-id "<agentId>"
```

### View Changes (diff local vs remote)

`--client-id` is optional. When omitted, uses VS Code's 1p client with interactive browser login.

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/manage-agent.bundle.js changes \
  --workspace "<path-to-agent-folder>" \
  --tenant-id "<tenantId>" \
  --environment-id "<envId>" \
  --environment-url "<envUrl>" \
  --agent-mgmt-url "<mgmtUrl>"
```

### List Agents

Uses Dataverse REST API directly (no LSP binary needed). `--client-id` is optional.

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/manage-agent.bundle.js list-agents \
  --tenant-id "<tenantId>" \
  --environment-url "<envUrl>"
```

### List Environments

Uses BAP REST API directly (no LSP binary needed). `--client-id` is optional.

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/manage-agent.bundle.js list-envs \
  --tenant-id "<tenantId>"
```

## Output Format

All commands output JSON to stdout with a `status` field:

### Device code prompt (during auth)
```json
{"status":"device_code","userCode":"XXXXXXXX","verificationUri":"https://login.microsoft.com/device","message":"...","expiresIn":900}
```

### Success
```json
{"status":"ok","method":"powerplatformls/syncPull","result":{...}}
```

### Error
```json
{"status":"error","error":"description of what went wrong"}
```

## Error Handling

| Error | Likely cause | Resolution |
|-------|-------------|------------|
| Extension not found | Copilot Studio VS Code extension not installed | Install from VS Code marketplace |
| LSP request timed out | Binary not responding or wrong protocol version | Check extension version, try updating |
| device_code_expired | User didn't authenticate in time | Re-run auth, authenticate promptly |
| ConcurrencyVersionMismatch | Push without fresh row versions | Pull first, then push |
| Token expired + silent refresh failed | Refresh token expired (~90 days) | Run `auth` command for new device code flow |
| Binary missing | Extension installed but binary not present | Reinstall the extension |
