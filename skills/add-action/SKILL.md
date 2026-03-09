---
user-invocable: false
description: Add a connector-based action (TaskDialog) to a Copilot Studio agent. Use when the user asks to add a connector action like sending a Teams message, creating an Outlook event, or other connector operations.
argument-hint: <action description, e.g. "post a Teams message">
allowed-tools: Bash(node *schema-lookup.bundle.js *), Read, Write, Edit, Glob
context: fork
agent: author
---

# Add Connector Action

Create a connector-based action (`kind: TaskDialog`) from the verified action catalog. Actions invoke external connector operations (Teams, Outlook, etc.).

## What the Schema Can and Cannot Do

The schema **can** be used to understand the structural properties of `TaskDialog` and `InvokeConnectorTaskAction` (e.g., what `connectionProperties.mode` options exist, what fields are available). Use schema lookup for structural questions:

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/schema-lookup.bundle.js summary TaskDialog
node ${CLAUDE_SKILL_DIR}/../../scripts/schema-lookup.bundle.js summary InvokeConnectorTaskAction
```

The schema **cannot** tell you the specific inputs and outputs for each connector operation — those are connector-specific and only available through the verified sample catalog.

## Critical Constraint

If the user requests an action **not in the catalog**, refuse and tell them:

> "This action is not yet in our verified catalog. The specific inputs and outputs for this connector operation can only come from a working example. Please create it through the Copilot Studio UI, then clone it here. Once you have a working example, it can be added to the catalog for future use (see the 'How to Add a New Action' section in catalog.md)."

## Instructions

1. **Auto-discover the agent directory**:
   ```
   Glob: **/agent.mcs.yml
   ```
   If multiple agents found, ask which one. NEVER hardcode an agent name.

2. **Read the action catalog** to find available actions:
   ```
   Read: ${CLAUDE_SKILL_DIR}/catalog.md
   ```

3. **Match the user's request** against the catalog:
   - Compare to the Action Name, Connector, and Description columns
   - If a match is found, proceed to step 4
   - If NO match is found, refuse (see Critical Constraint above)

4. **Read the sample file** from `${CLAUDE_SKILL_DIR}/../../templates/actions/samples/<sample-file>` as indicated in the catalog.

5. **Optionally look up the schema** for structural reference:
   ```bash
   node ${CLAUDE_SKILL_DIR}/../../scripts/schema-lookup.bundle.js summary InvokeConnectorTaskAction
   ```
   Use this to verify or adapt structural properties if the user has specific needs (e.g., changing connection mode, adding timeout settings). Do NOT use it for inputs/outputs.

6. **Read `settings.mcs.yml`** to extract the `schemaName` (e.g., `copilots_header_e1ca2`). This is needed for the connection reference.

7. **Check if the connector already exists** in `connectionreferences.mcs.yml`:
   - Read the agent's `connectionreferences.mcs.yml`
   - Search for the connector's API name (e.g., `shared_teams`) in the `connectorId` values
   - If found: **reuse** the existing `connectionReferenceLogicalName`
   - If NOT found: **generate a new one** (see Connection Reference Generation below)
   - If the file does not exist: you will create it in step 10

8. **Generate the action YAML**:
   - Start from the sample file content
   - Replace `_CONNECTION_REFERENCE_` with the connection reference from step 7
   - Update the `# Name:` comment at the top to `# Name: <ConnectorName> - <ActionTitle>`
   - If the user wants to customize inputs/descriptions, adjust accordingly (but keep the same property names)
   - If the sample has `ManualTaskInput` entries, warn the user (see ManualTaskInput Caveat below)

9. **Save the action file** to:
   ```
   <agent-dir>/actions/<ConnectorName>-<TitleName>.mcs.yml
   ```
   - `<ConnectorName>`: connector name in PascalCase (e.g., `MicrosoftTeams`, `Outlook`)
   - `<TitleName>`: modelDisplayName with spaces removed and first letter capitalized (e.g., `Postmessageinachatorchannel`)
   - Create the `actions/` directory if it doesn't exist

10. **Update `connectionreferences.mcs.yml`** (only if the connector was NOT already registered):
    - Append a new entry:
      ```yaml
      - connectionReferenceLogicalName: <connection-reference>
        connectorId: /providers/Microsoft.PowerApps/apis/<api_name>
      ```
    - If the file does not exist, create it:
      ```yaml
      connectionReferences:
        - connectionReferenceLogicalName: <connection-reference>
          connectorId: /providers/Microsoft.PowerApps/apis/<api_name>
      ```

11. **Inform the user** about next steps:
    - The action has been created
    - Push changes via the Copilot Studio VS Code Extension
    - After pushing, configure the connection in the Copilot Studio portal (authenticate with credentials)

## Connection Reference Generation

When creating a new connection reference:

- **Format**: `<schemaName>.<api_name>.<api-name-with-hyphens>-<GUID>`
- The `api-name-with-hyphens` replaces underscores with hyphens: `shared_teams` → `shared-teams`
- The GUID is 8-4-4-4-12 hex format (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
- Generate the GUID randomly (same as ID generation convention in the project)

**Example**: `copilots_header_e1ca2.shared_teams.shared-teams-a1b2c3d4-e5f6-7890-abcd-ef1234567890`

The `api_name` and `ConnectorId` come from the **Connector Reference** table in `catalog.md`.

## Connection Modes

| Mode | Description |
|------|-------------|
| `Maker` | Uses the maker's (developer's) connection credentials. Simpler setup — the connection is shared. |
| `Invoker` | Uses the end user's own credentials. Requires each user to authenticate. |

The sample files specify the recommended default mode. The user can request a different mode if needed.

## ManualTaskInput Caveat

When a sample contains `ManualTaskInput` entries (fixed values like timezone strings, folder paths, or enum values):

- **Always warn the user**: "This action includes fixed input values that may need to be adjusted for your environment:"
- List each `ManualTaskInput` with its current value
- Note that `ManualTaskInput` can only hardcode **string values**. If the intended value is an ID, enum, or other non-string type, the user should review these in Copilot Studio after pushing and potentially adjust them
- Ask the user if they want to change any values before saving

## UI-Configurable Inputs Warning (Important)

Some `AutomaticTaskInput` fields represent choices that can only be properly configured in the Copilot Studio UI after pushing — they are enum-like selections presented as dropdowns/picklists in the portal, not free-text values the orchestrator can resolve.

**Always review each AutomaticTaskInput in the sample and warn the user about inputs that require UI configuration.** Common examples:
- **Teams "poster"** (Post As): User / Flow Bot / Copilot Studio Agent — must be selected in the UI
- **Teams "location"** (Post In): Specific chat or channel — must be selected in the UI
- **Outlook calendar/folder selections**: Must be picked from the user's actual mailbox in the UI

**After creating the action, always tell the user:**
1. Push the changes via the VS Code Extension
2. Open the action in Copilot Studio
3. Configure the UI-only inputs (list them specifically, e.g., "Set 'Post As' to Flow Bot and 'Post In' to your desired chat/channel")
