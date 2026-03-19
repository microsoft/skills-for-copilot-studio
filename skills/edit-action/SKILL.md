---
user-invocable: false
description: Edit an existing connector action (TaskDialog) in a Copilot Studio agent. Modify inputs, outputs, descriptions, connection mode, and other properties using connector definitions as reference.
argument-hint: <what to change, e.g. "add description to SharePoint inputs">
allowed-tools: Bash(node *connector-lookup.bundle.js *), Bash(node *schema-lookup.bundle.js *), Read, Edit, Glob
context: fork
agent: copilot-studio-author
---

# Edit Connector Action

Edit an existing connector action (`kind: TaskDialog`) in a Copilot Studio agent. Uses connector definitions to understand the full operation schema (inputs, outputs, types) and the generic action template as structural reference.

## Connector Lookup

Help the user find the right connector and operation before they go to the UI. Use the connector lookup tool. Important: The connector lookup script only covers a subset of connectors (run `list` to see which ones). If the user's requested connector is not in the list, tell the user they need to find and add the connector action entirely through the Copilot Studio portal, then ask them to pull again the files locally. Once pulled, `/copilot-studio:edit-action` can still be used to customize the YAML.

When the connector IS available, use the lookup tool to help the user before they go to the UI:

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/connector-lookup.bundle.js list                              # List connectors
node ${CLAUDE_SKILL_DIR}/../../scripts/connector-lookup.bundle.js operations <connector>            # List operations
node ${CLAUDE_SKILL_DIR}/../../scripts/connector-lookup.bundle.js operation <connector> <opId>      # Full input/output details
node ${CLAUDE_SKILL_DIR}/../../scripts/connector-lookup.bundle.js search <keyword>                  # Search operations
```

Use schema lookup for structural properties of TaskDialog and InvokeConnectorTaskAction:

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/schema-lookup.bundle.js summary TaskDialog
node ${CLAUDE_SKILL_DIR}/../../scripts/schema-lookup.bundle.js summary InvokeConnectorTaskAction
```

## Instructions

1. **Auto-discover the agent directory**:
   ```
   Glob: **/agent.mcs.yml
   ```
   If multiple agents found, ask which one.

2. **Find the action file** to edit:
   ```
   Glob: <agent-dir>/actions/*.mcs.yml
   ```
   Read the action file. If the user's request is ambiguous and multiple actions exist, list them and ask which one.

3. **Identify the connector and operation**:
   - Read the action YAML to find `action.operationId` and the connector API name from `connectionreferences.mcs.yml`
   - Look up the full operation details (if the connector is available in the lookup script):
     ```bash
     node ${CLAUDE_SKILL_DIR}/../../scripts/connector-lookup.bundle.js operation <connector> <operationId>
     ```
   - This gives you the complete list of available inputs and outputs for the operation
   - If the connector is not found, try broader terms. If still not found, inform the user and proceed with edits based on the existing action YAML and schema-lookup only

4. **Read the generic action template** for structural reference:
   ```
   Read: ${CLAUDE_SKILL_DIR}/../../templates/actions/connector-action.mcs.yml
   ```
   Use this alongside the connector-lookup output from step 3 to understand the YAML structure and available inputs/outputs.

5. **Make the requested edits** using the Edit tool. Common modifications:

   ### Modify Input Descriptions
   Update `description` on `AutomaticTaskInput` entries to improve how the orchestrator fills them:
   ```yaml
   inputs:
     - kind: AutomaticTaskInput
       propertyName: body
       description: The email body content in HTML format   # <-- edit this
   ```

   ### Add or Remove Inputs
   Cross-reference the connector definition to see all available input properties. Add new ones or remove unnecessary ones:
   ```yaml
   # Add a new input from the connector definition
   - kind: AutomaticTaskInput
     propertyName: importance
     description: The importance level of the email (Low, Normal, High)
   ```

   ### Switch Between AutomaticTaskInput and ManualTaskInput
   - `AutomaticTaskInput`: The orchestrator fills this dynamically based on the conversation
   - `ManualTaskInput`: A hardcoded value (string only)
   ```yaml
   # Change from automatic to manual (hardcode a value)
   - kind: ManualTaskInput
     propertyName: timeZone
     value: "(UTC+01:00) Amsterdam, Berlin, Bern, Rome, Stockholm, Vienna"
   ```

   ### Modify Outputs
   Add or remove output properties. Cross-reference the connector definition for available outputs:
   ```yaml
   outputs:
     - propertyName: id
       description: The unique ID of the created item
   ```

   ### Change modelDisplayName / modelDescription
   These control how the orchestrator understands and routes to this action:
   ```yaml
   modelDisplayName: Send a Teams message
   modelDescription: Posts a message to a Teams chat or channel on behalf of the user
   ```

   ### Change Connection Mode
   ```yaml
   action:
     connectionProperties:
       mode: Invoker    # or Maker
   ```
   - `Maker`: Uses the developer's credentials (shared connection)
   - `Invoker`: Each end user authenticates with their own credentials

6. **Validate the edited file**:
   ```bash
   node ${CLAUDE_SKILL_DIR}/../../scripts/schema-lookup.bundle.js validate <action-file-path>
   ```

7. **Inform the user** about next steps:
   - The action has been edited
   - Push changes via the Copilot Studio VS Code Extension
   - If connection mode was changed, the user may need to reconfigure the connection in the portal

## Important Rules

- **Never change `action.operationId`** — this identifies which connector operation runs. Changing it breaks the action.
- **Never change `action.connectionReference`** — this links to the authenticated connection. Changing it breaks the action.
- **Property names must match the connector definition** — use `connector-lookup operation` to verify exact property names.
- **ManualTaskInput values are strings only** — if the value needs to be a number, enum, or complex type, warn the user that it may need UI configuration.
- **Output propertyName values must match the connector definition's output schema** — use `connector-lookup operation` to see available output properties.
