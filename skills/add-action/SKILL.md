---
user-invocable: false
description: Guide users through adding a new connector action to a Copilot Studio agent. Connector actions require UI-based connection setup, so this skill walks users through the Copilot Studio portal steps, then delegates to edit-action for YAML modifications.
argument-hint: <action description, e.g. "post a Teams message">
allowed-tools: Bash(node *connector-lookup.bundle.js *), Read
context: fork
agent: copilot-studio-author
---

# Add Connector Action (Guide)

This skill guides users through adding a new connector action to their Copilot Studio agent. **It does NOT write action YAML directly** because connector actions require a connection reference that can only be created through the Copilot Studio UI.

## Why This Is a Guide, Not a Generator

Connector actions need:
1. A **connection reference** — an authenticated link to the external service (Teams, Outlook, SharePoint, etc.)
2. The connection reference can only be created by the user authenticating in the Copilot Studio portal
3. Once the action is added via the UI and pulled locally, the YAML can be edited with `/copilot-studio:edit-action`

## Connector Lookup

Help the user find the right connector and operation before they go to the UI. Use the connector lookup tool. Important: The connector lookup script only covers a subset of connectors (run `list` to see which ones). If the user's requested connector is not in the list, tell the user they need to find and add the connector action entirely through the Copilot Studio portal, then ask them to pull again the files locally. Once pulled, `/copilot-studio:edit-action` can still be used to customize the YAML.

When the connector IS available, use the lookup tool to help the user before they go to the UI:

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/connector-lookup.bundle.js list
node ${CLAUDE_SKILL_DIR}/../../scripts/connector-lookup.bundle.js operations <connector>
node ${CLAUDE_SKILL_DIR}/../../scripts/connector-lookup.bundle.js operation <connector> <operationId>
node ${CLAUDE_SKILL_DIR}/../../scripts/connector-lookup.bundle.js search <keyword>
```

`<connector>` matches by API name (`shared_office365`) or partial display name (`outlook`).

Use these to help the user understand:
- Which connector has the operation they need
- What the operation is called (so they can find it in the UI)
- What inputs and outputs it expects

## Instructions

1. **Understand what the user wants** — ask clarifying questions if the request is vague (e.g., "send a message" — Teams? Outlook? Slack?)

2. **Search for the operation** using connector-lookup:
   ```bash
   node ${CLAUDE_SKILL_DIR}/../../scripts/connector-lookup.bundle.js search "<user's description>"
   ```
   If no match, try broader terms. If the connector is not available in the lookup script at all after different tries, inform the user that this connector is not in the local reference and they will need to add the action through the Copilot Studio UI.

3. **Show the operation details** so the user knows exactly what to look for in the UI:
   ```bash
   node ${CLAUDE_SKILL_DIR}/../../scripts/connector-lookup.bundle.js operation <connector> <operationId>
   ```

4. **Walk the user through the UI steps**:

   > Here's how to add this action in Copilot Studio:
   >
   > 1. Open [Copilot Studio](https://copilotstudio.microsoft.com)
   > 2. Navigate to your agent
   > 3. Go to **Actions** in the left sidebar
   > 4. Click **+ Add an action**
   > 5. Search for "**{operation displayName}**" from the **{connector displayName}** connector
   > 6. Configure the connection (authenticate with your credentials)
   > 7. Save the action
   >
   > Once saved, pull the updated agent files using the **Copilot Studio VS Code Extension** (Source Control → Pull).

5. **After the user confirms they've pulled**, check for the new action file:
   ```
   Glob: **/actions/*.mcs.yml
   ```
   If the action file is present, let the user know it was pulled successfully.

6. **Offer to edit the action** — if the user wants to customize inputs, descriptions, or connection mode:

   > Would you like me to edit the action YAML? I can modify input descriptions, switch between automatic and manual inputs, change the connection mode, and more. Just say the word and I'll use `/copilot-studio:edit-action`.

## MCP Server Actions

MCP (Model Context Protocol) server actions use a different YAML structure than regular connector actions. They use `InvokeExternalAgentTaskAction` with `ModelContextProtocolMetadata` instead of `InvokeConnectorTaskAction`.

**Like regular connector actions, MCP actions require a connection reference that can only be created through the Copilot Studio portal.** This skill cannot create MCP connections — the user must add the MCP server through the UI first.

If the user asks to add an MCP server action:

> MCP server actions require a connection to be set up in the Copilot Studio portal first — I can't create that from here.
>
> Here's how to add it:
>
> 1. Open [Copilot Studio](https://copilotstudio.microsoft.com)
> 2. Navigate to your agent
> 3. Go to **Actions** in the left sidebar
> 4. Click **+ Add an action**
> 5. Search for the MCP server connector (e.g., "Microsoft Learn Docs MCP Server")
> 6. Configure the connection (authenticate with your credentials)
> 7. Save the action
>
> Once saved, pull the updated agent files. I can then help you edit the action with `/copilot-studio:edit-action` — for example, changing the `modelDescription` or `modelDisplayName`.

**Key differences from regular connector actions:** MCP actions do not use `AutomaticTaskInput` — the MCP protocol handles tool parameter discovery dynamically. However, `ManualTaskInput` entries are OK for passing context to the MCP server (e.g., user identity via Power Fx: `value: =System.User.Email`).

## Structural Reference

For structural templates, see:

```
Read: ${CLAUDE_SKILL_DIR}/../../templates/actions/connector-action.mcs.yml
Read: ${CLAUDE_SKILL_DIR}/../../templates/actions/mcp-action.mcs.yml
```

Use these alongside `connector-lookup operation` output to understand both the YAML structure and the full inputs/outputs for a specific operation.
