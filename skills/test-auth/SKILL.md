---
user-invocable: false
description: >
  Authenticate for Copilot Studio evaluation API and SDK chat. Caches a token
  that is shared across run-eval and chat-sdk skills. Run this before any
  eval or SDK chat workflow. Requires an App Registration with MakerOperations
  and Copilots.Invoke permissions.
allowed-tools: Bash(node *eval-api.bundle.js auth *), Read, Glob
context: fork
agent: copilot-studio-test
---

# Test Agent Authentication

Authenticate with the Power Platform API for evaluation and SDK chat workflows.
This caches a token in the `"test-agent"` slot that is shared by `run-eval` and `chat-sdk`.

## Step 1: Find the workspace

Locate the agent workspace (directory containing `.mcs/conn.json`):
```bash
Glob: **/agent.mcs.yml
```

The `conn.json` provides the tenant ID automatically — no need to ask the user for it.

## Step 2: Get the client ID

**CRITICAL: You MUST present the FULL configuration checklist below when asking for the client ID. Do NOT omit any items — users frequently miss the redirect URI and public client settings, which causes auth failures.**

Ask the user for their **App Registration Client ID** and show them **all** of the following requirements in your message:

> What is your App Registration Client ID for the Evaluation API?
>
> Before sharing it, please verify your App Registration has **all** of these settings:
>
> 1. **Redirect URI**: Under **Authentication** > **Mobile and desktop applications** > redirect URI set to `http://localhost`
> 2. **Public client**: Under **Authentication** > **Advanced settings** > **Allow public client flows** set to **Yes**
> 3. **API permissions**: Under **API permissions**, these **delegated** permissions on the **Power Platform API**:
>    - `CopilotStudio.MakerOperations.Read` (list test sets, get results)
>    - `CopilotStudio.MakerOperations.ReadWrite` (start evaluation runs)
>    - `CopilotStudio.Copilots.Invoke` (SDK chat — send utterances to the agent)
> 4. **Admin consent**: Granted for the tenant (green checkmarks in the API permissions list)
>
> Missing any of these will cause authentication to fail.

If the user doesn't have one, guide them:

> **How to create an App Registration:**
> 1. Go to [Azure Portal > App Registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
> 2. Click **New registration**, name it (e.g., "Copilot Studio Eval")
> 3. Under **API permissions** > **Add a permission** > **APIs my organization uses** > search **Power Platform API**
> 4. Select **Delegated permissions** and add:
>    - `CopilotStudio.MakerOperations.Read`
>    - `CopilotStudio.MakerOperations.ReadWrite`
>    - `CopilotStudio.Copilots.Invoke`
> 5. Click **Grant admin consent** for the tenant
> 6. Under **Authentication** > **Add a platform** > **Mobile and desktop applications** > set redirect URI to `http://localhost`
> 7. Still in **Authentication**, scroll to **Advanced settings** and set **Allow public client flows** to **Yes** (required — without this the interactive browser login will fail with an AADSTS error)
> 8. Copy the **Application (client) ID** from the Overview page

## Step 3: Authenticate

Run the auth command (opens a browser — no device code needed):

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/eval-api.bundle.js auth --workspace <path> --client-id <id>
```

If successful, you'll see:
```json
{"status": "ok", "message": "Authentication successful. Token cached for subsequent commands."}
```

**Return the client ID and workspace path to the caller** — they need these for subsequent `run-eval` and `chat-sdk` calls.

## Troubleshooting

- **HTTP 403 / InsufficientDelegatedPermissions**: The app registration is missing required permissions. Guide the user through adding them (Step 2).
- **AADSTS700016 / app not found in directory**: The client ID doesn't exist in the agent's tenant. The app must be registered in the same tenant as the Copilot Studio environment (check `conn.json` > `AccountInfo.TenantId`).
- **AADSTS7000218 / request body must contain client_secret or client_assertion**: The app registration is not configured as a public client. Go to **Authentication** > **Advanced settings** > set **Allow public client flows** to **Yes**.
- **SDK chat hangs after auth**: The cached token may have stale permissions. Clear the cache and re-authenticate:
  - Delete `~/.copilot-studio-cli/test-agent.cache.json`
  - Run `security delete-generic-password -s "copilot-studio-cli" -a "test-agent"` to clear the macOS Keychain entry
  - Re-run the auth command
