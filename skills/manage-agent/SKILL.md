---
user-invocable: false
description: Push/pull Copilot Studio agent content via the VS Code extension's LanguageServerHost LSP binary. Handles authentication (interactive browser login for push/pull, device code flow for chat token), sync push, sync pull, clone, and diff operations.
argument-hint: <push|pull|clone|changes|validate|publish|auth|list-agents|list-envs>
allowed-tools: Bash(node *manage-agent.bundle.js *), Read, Glob, Grep
context: fork
agent: copilot-studio-manage
---

# Manage Agent

Push and pull Copilot Studio agent content by calling the VS Code extension's LanguageServerHost binary directly, using the same custom LSP protocol the extension uses internally.

## IMPORTANT: Do Not Modify Scripts

This is a new capability under active development. The manage-agent scripts (`manage-agent.bundle.js`, `chat-with-agent.bundle.js`) are pre-built bundles that must not be modified, patched, or monkey-patched. If a script fails:

1. **Report the error as-is** — show the user the full error output
2. **Do not attempt to fix, patch, or work around script errors** — the scripts interact with the LSP binary using a specific protocol and any modifications will break things
3. **Direct the user to raise an issue** at https://github.com/microsoft/skills-for-copilot-studio/issues with the error output
4. **Suggest using the VS Code extension directly** — the user can perform the same push/pull/clone operations from the Copilot Studio VS Code extension UI as a fallback

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
- Tokens are cached in the OS credential store and silently refreshed for ~90 days
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

Tokens and MSAL refresh tokens are persisted in the OS credential store (macOS Keychain, Windows DPAPI, Linux secret-tool). After initial authentication:
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

Push automatically validates all `.mcs.yml` files before pushing and blocks if there are errors. Add `--force` to bypass validation (not recommended).

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/manage-agent.bundle.js push \
  --workspace "<path-to-agent-folder>" \
  --tenant-id "<tenantId>" \
  --environment-id "<envId>" \
  --environment-url "<envUrl>" \
  --agent-mgmt-url "<mgmtUrl>"
```

### Validate (check YAML before pushing)

Validates all `.mcs.yml` files in the workspace using the LSP binary's full diagnostics (YAML structure, Power Fx, schema, cross-file references).

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/manage-agent.bundle.js validate \
  --workspace "<path-to-agent-folder>" \
  --tenant-id "<tenantId>" \
  --environment-id "<envId>" \
  --environment-url "<envUrl>" \
  --agent-mgmt-url "<mgmtUrl>"
```

Returns JSON: `{ "valid": true|false, "summary": { "errors": N, "warnings": N }, "files": [...] }`

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

### Publish (make draft agent live)

Publishes the agent so that the current draft becomes the live version reachable by external clients (`/chat-with-agent`, `/run-tests`, Teams, etc.). Uses the Dataverse `PvaPublish` bound action directly (no LSP binary needed).

**IMPORTANT — Publishing makes this version of the agent available to ALL users the agent is shared with.** If you are working in a development environment this is fine, but if the agent is shared with production users, **always confirm with the user before publishing.** Ask: "This will publish the agent and make it live for all users it's shared with. Should I proceed?"

The command polls the `publishedon` field on the bot entity until the timestamp changes, confirming that publish has taken effect. Default timeout is 5 minutes.

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/manage-agent.bundle.js publish \
  --workspace "<path-to-agent-folder>" \
  --tenant-id "<tenantId>" \
  --environment-url "<envUrl>" \
  [--timeout <ms>]
```

**Timeout: 300000ms (5 minutes)** — set this on the Bash tool call.

Optional: `--agent-id "<agentId>"` overrides the bot ID from `conn.json`.

#### Publish output (success)
```json
{"status":"ok","botId":"...","publishedOn":"2026-03-27T12:00:00Z","previousPublishedOn":"2026-03-26T10:00:00Z","durationMs":45000,"durationSeconds":45}
```

#### When to publish

- After a successful `push`, if the user wants changes to be testable via `/chat-with-agent` or `/run-tests`
- In an improvement loop (edit → push → publish → test), publish is required between push and test
- The command confirms publish completion via API — **do not use time-based waits**

### List Agents

Uses Dataverse REST API directly (no LSP binary needed). `--client-id` is optional.

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/manage-agent.bundle.js list-agents \
  --tenant-id "<tenantId>" \
  --environment-url "<envUrl>" \
  [--no-owner]
```

By default lists only agents owned by the current user. Add `--no-owner` to list all unmanaged agents.

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
| PvaPublish failed | Insufficient permissions or bot not found | Verify the user has publish permissions and the agent ID is correct |
| Publish timed out | Publish still in progress after timeout | Increase `--timeout` or check the Copilot Studio UI for status |
