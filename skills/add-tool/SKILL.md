---
user-invocable: false
agent-types: modern
description: Guide users through adding a tool (connector, MCP, or workflow) to a modern Copilot Studio agent. Tools require UI-based connection setup, so this skill walks users through the portal steps, then edits the YAML after pull.
argument-hint: <tool description, e.g. "get weather from MSN">
allowed-tools: Bash(node *connector-lookup.bundle.js *), Read, Edit, Glob
context: fork
agent: copilot-studio-author
---

# Add Tool (Guide)

This skill guides users through adding a tool to their modern agent. **It does NOT create tool YAML from scratch** because tools require a connection reference that can only be created through the Copilot Studio UI.

## Why This Is a Guide

Tools need:
1. A **connection reference** — an authenticated link to the external service (Teams, Outlook, Weather, etc.)
2. The connection can only be created by the user authenticating in the Copilot Studio portal
3. Once the tool is added via the UI and pulled locally, the YAML can be edited

## Pre-checks

1. Run `Glob: **/settings.mcs.yml` to find the agent workspace.
2. Read `settings.mcs.yml` and confirm it's a modern agent (`template: cliagent-1.0.0` or `$kind: CLICopilotRecognizer`).

## Tool Types

Modern agents support these tool types:

| Type | UI Path | YAML Kind |
|------|---------|-----------|
| **Connectors** (Outlook, Teams, SharePoint, Weather, etc.) | Tools → + → Connectors | `ConnectorTool` |
| **MCP servers** | Tools → + → Model Context Protocol (MCP) | `McpTool` |
| **Workflows** (Power Automate flows) | Tools → + → Workflows | `WorkflowTool` |

## Connector Lookup

Help the user find the right connector and operation before they go to the UI:

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/connector-lookup.bundle.js list
node ${CLAUDE_SKILL_DIR}/../../scripts/connector-lookup.bundle.js operations <connector>
node ${CLAUDE_SKILL_DIR}/../../scripts/connector-lookup.bundle.js operation <connector> <operationId>
node ${CLAUDE_SKILL_DIR}/../../scripts/connector-lookup.bundle.js search <keyword>
```

`<connector>` matches by API name (`shared_msnweather`) or partial display name (`weather`).

If the connector is not in the lookup, tell the user to find it directly in the CPS portal.

## Instructions

1. **Understand what the user wants** — ask clarifying questions if vague (e.g., "send a message" — Teams? Outlook? Slack?)

2. **Search for the operation** using connector-lookup:
   ```bash
   node ${CLAUDE_SKILL_DIR}/../../scripts/connector-lookup.bundle.js search "<user's description>"
   ```

3. **Show the operation details** so the user knows what to look for:
   ```bash
   node ${CLAUDE_SKILL_DIR}/../../scripts/connector-lookup.bundle.js operation <connector> <operationId>
   ```

4. **Walk the user through the UI steps**:

   > Here's how to add this tool in Copilot Studio:
   >
   > 1. Open your agent in Copilot Studio
   > 2. In the right panel, click **+** next to **Tools**
   > 3. Select the **Connectors** tab (or **Model Context Protocol (MCP)** / **Workflows** depending on tool type)
   > 4. Search for **{connector name}**
   > 5. Select the **{operation name}** operation
   > 6. Authenticate when prompted (this creates the connection reference)
   > 7. Save the changes
   >
   > Once the tool is added, run `/copilot-studio:manage-agent` to **pull** the updated files locally.

5. **After pull**, the tool YAML appears in `translations/` as a `ConnectorTool`:

   ```yaml
   mcs.metadata:
     componentName: MSN Weather — Get current weather
     description: Get the current weather for a location.
   kind: ConnectorTool
   connectorId: /providers/Microsoft.PowerApps/apis/shared_msnweather
   connectionReference: Default_draft_xxx.shared_msnweather.xxx
   operationId: CurrentWeather
   ```

6. **Offer to edit** the tool's description (which the orchestrator uses for routing):

   > I can now edit the tool's description to better match when it should be invoked. Would you like me to update it?

   Safe to edit: `componentName`, `description` in `mcs.metadata`
   **NEVER modify**: `connectorId`, `connectionReference`, `operationId` — these are set by the connection and will break the tool if changed.

## YAML Structure Reference

### ConnectorTool (after pull)
```yaml
mcs.metadata:
  componentName: {Display Name}
  description: {When the orchestrator should invoke this tool}
kind: ConnectorTool
connectorId: /providers/Microsoft.PowerApps/apis/{connector_api_name}
connectionReference: {schema}.{connector}.{connection_id}
operationId: {operation_id}
```

### McpTool (after pull)
```yaml
mcs.metadata:
  componentName: {Display Name}
  description: {When to invoke}
kind: McpTool
connectorId: /providers/Microsoft.PowerApps/apis/{mcp_connector}
connectionReference: {schema}.{connector}.{connection_id}
operationId: {operation_id}
```

### WorkflowTool (after pull)
```yaml
mcs.metadata:
  componentName: {Display Name}
  description: {When to invoke}
kind: WorkflowTool
workflowId: {guid}
```
