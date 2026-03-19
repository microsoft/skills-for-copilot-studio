---
user-invocable: false
description: Clone a Copilot Studio agent from the cloud. Guides through environment selection, agent selection, and downloads agent YAML files.
argument-hint: [agent name or environment hint]
allowed-tools: Bash(node *manage-agent.bundle.js *), Read, Glob, Grep
context: fork
agent: copilot-studio-manage
---

# Clone Agent

Guided flow to clone a Copilot Studio agent from the cloud to a local workspace. Walks the user through environment selection, agent selection, and downloads the agent's YAML files.

## IMPORTANT: Do Not Modify Scripts

This is a new capability under active development. If the manage-agent script fails, **do not attempt to fix, patch, or work around it**. Instead:
1. Show the user the full error output
2. Direct them to https://github.com/microsoft/skills-for-copilot-studio/issues
3. Suggest using the Copilot Studio VS Code extension directly as a fallback for push/pull/clone

## Phase 0: Resolve Configuration

Look for existing connection details in this order. Stop at the first source that provides a `tenantId`:

### 0a. Scan for existing `.mcs/conn.json` files

Search the filesystem for previously cloned agents — these already have all the connection details:

```
Glob: **/.mcs/conn.json
```

Also search common project locations:

```
Glob: /Users/**/projects/**/.mcs/conn.json
```

Each `conn.json` contains `TenantId`, `EnvironmentId`, `DataverseEndpoint`, `AgentManagementEndpoint`, and `AccountInfo`. Parse any found files and collect unique tenant/environment pairs. If matches are found, present them to the user:

> **Found existing agent connections:**
> 1. Employee Assistant — Elad's Env (tenant: 8a235459...)
> 2. IT Agent — Contoso Dev (tenant: efb073bb...)
>
> Use one of these, or enter a different tenant ID?

If the user picks one → extract `tenantId`, `environmentId`, `environmentUrl`, `agentMgmtUrl` and **skip to Phase 2** (or Phase 1 if they want a different environment).

### 0b. Ask the user

If no `conn.json` found (or user wants a different tenant) → ask for their **tenant ID** (required).

No `--client-id` is needed — the script uses VS Code's first-party client ID with interactive browser login automatically.

## Phase 1: Select Environment

Tell the user: **"A browser window may open for Microsoft sign-in (tokens are cached after first login)."**

Run the list-envs command:

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/manage-agent.bundle.js list-envs \
  --tenant-id "<tenantId>"
```

**Timeout: 300000ms (5 minutes)** — set this on the Bash tool call to allow time for browser auth.

Parse the JSON output. On success (`status: "ok"`), present the environments as a numbered list to the user:

```
1. Contoso Dev (abc123-...)
2. Contoso Prod (def456-...)
```

Ask the user to pick an environment. Extract:
- `environmentId`
- `environmentUrl` (the `url` or `dataverseUrl` field)
- `agentMgmtUrl` (the `agentManagementUrl` field)

## Phase 2: Select Agent

First, ask the user: **"Do you want to list only agents you own, or all agents in the environment?"**

- If **only mine** → run without `--no-owner` (default, filters by current user)
- If **all agents** → add `--no-owner` flag

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/manage-agent.bundle.js list-agents \
  --tenant-id "<tenantId>" \
  --environment-url "<environmentUrl>" \
  [--no-owner]
```

**Timeout: 300000ms (5 minutes)**

Parse the JSON output. Each agent has `agentId`, `displayName`, and `ownedByCurrentUser`. Present agents as a numbered list:

```
1. My Support Bot (yours)
2. HR Assistant
3. IT Helpdesk (yours)
```

Ask the user to pick an agent. Extract the `agentId`.

## Phase 3: Clone

Run the clone command. The workspace should be the current directory (`.`). The `--agent-id` is required (from Phase 2):

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/manage-agent.bundle.js clone \
  --workspace "." \
  --tenant-id "<tenantId>" \
  --agent-id "<agentId>" \
  --environment-id "<environmentId>" \
  --environment-url "<environmentUrl>" \
  --agent-mgmt-url "<agentMgmtUrl>"
```

**Timeout: 300000ms (5 minutes)**

On success:
1. Run `Glob: **/agent.mcs.yml` to find and show the cloned agent file
2. Check that `.mcs/conn.json` was created in the agent directory
3. Summarize what was cloned and where the files are

## Error Handling

| Error | Resolution |
|-------|-----------|
| Browser auth fails or times out | Ask user to try again; check that they have access to the tenant |
| No environments found | Verify tenant ID is correct and user has Power Platform access |
| No agents found | Verify environment selection; user may need Copilot Studio access |
| Clone fails | Check permissions; the user needs maker/admin access to the agent |
