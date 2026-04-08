# SharePoint Connector Actions — Reference

Read this file whenever editing a SharePoint action (`shared_sharepointonline`). SharePoint operations have unique complexities: OData query parameters with `$`-prefixed names, dynamic output schemas, and strict quoting rules that differ from other connectors.

## Critical: `$`-Prefixed Property Names in TaskDialog YAML

SharePoint operations like `GetItems`, `GetFileItems`, and `PostItem` use OData parameters: `$filter`, `$orderby`, `$top`. In a `TaskDialog` action YAML, these **must** be wrapped in both double and single quotes:

```yaml
# CORRECT — double-quoted string containing single quotes
- kind: ManualTaskInput
  propertyName: "'$filter'"
  value: "Status eq 'Active'"

- kind: AutomaticTaskInput
  propertyName: "'$orderby'"
  description: The OData orderBy clause (e.g. Created desc, Title asc)

- kind: ManualTaskInput
  propertyName: "'$top'"
  value: "50"
```

```yaml
# WRONG — these will all fail at runtime
- kind: ManualTaskInput
  propertyName: $filter          # ❌ bare $-prefixed key — YAML may misparse
  propertyName: "$filter"        # ❌ only double quotes — runtime won't match
  propertyName: '$filter'        # ❌ only single quotes — runtime won't match
  propertyName: filter           # ❌ missing $ prefix entirely
```

> **Why `"'$filter'"`?** The Copilot Studio runtime expects the property name to be the literal string `'$filter'` (with single quotes included). The outer double quotes are YAML string delimiters; the inner single quotes are part of the value sent to the connector.

### InvokeConnectorAction (inline in topics) — Different Format

When calling SharePoint inline in a topic (not a standalone TaskDialog), use the `parameters/` prefix instead:

```yaml
- kind: InvokeConnectorAction
  operationId: GetItems
  input:
    parameters/dataset: https://contoso.sharepoint.com/sites/HR
    parameters/table: Events
    parameters/$filter: "Status eq 'Active'"
```

**Do NOT mix these two formats.** `"'$filter'"` is for TaskDialog inputs; `parameters/$filter` is for InvokeConnectorAction.

## OData Filter Syntax

The `$filter` value uses OData v4 syntax — **not** SQL, JavaScript, or Power Fx.

### Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `eq` | Equal | `Status eq 'Active'` |
| `ne` | Not equal | `Status ne 'Closed'` |
| `gt` | Greater than | `Priority gt 3` |
| `lt` | Less than | `Priority lt 5` |
| `ge` | Greater or equal | `DueDate ge '2026-01-01T00:00:00Z'` |
| `le` | Less or equal | `DueDate le '2026-12-31T23:59:59Z'` |
| `and` | Logical AND | `Status eq 'Active' and Priority gt 3` |
| `or` | Logical OR | `Status eq 'Active' or Status eq 'Pending'` |
| `not` | Logical NOT | `not(Status eq 'Closed')` |

### String Functions

| Function | Example |
|----------|---------|
| `startswith(field,'value')` | `startswith(Title,'Project')` |
| `substringof('value',field)` | `substringof('urgent',Title)` |

### Quoting Rules

- **String values** must be in **single quotes**: `Title eq 'My Document'`
- **Numbers** have no quotes: `Priority gt 3`
- **Dates** use ISO 8601 in single quotes: `Created ge '2026-01-01T00:00:00Z'`
- **Boolean** uses no quotes: `IsActive eq true`
- **Column names** (internal names, not display names) have no quotes: `Status eq 'Active'`

### Common Wrong vs. Right

| Wrong | Right | Issue |
|-------|-------|-------|
| `Status == 'Active'` | `Status eq 'Active'` | `==` is not OData |
| `Status eq "Active"` | `Status eq 'Active'` | OData uses single quotes for strings |
| `Status eq Active` | `Status eq 'Active'` | String values must be quoted |
| `Status != 'Closed'` | `Status ne 'Closed'` | `!=` is not OData |
| `Priority > 3 && Status eq 'Active'` | `Priority gt 3 and Status eq 'Active'` | `>` and `&&` are not OData |
| `Created >= '2026-01-01'` | `Created ge '2026-01-01T00:00:00Z'` | Use full ISO 8601 datetime |
| `Display Name eq 'foo'` | `InternalName eq 'foo'` | Use internal column names, not display names |

## Input Recommendations for SharePoint Operations

### GetItems / GetFileItems

| Parameter | Recommended Input Kind | Why |
|-----------|----------------------|-----|
| `dataset` (Site Address) | `ManualTaskInput` | Fixed at design time — the orchestrator will hallucinate URLs if set to Automatic |
| `table` (List/Library Name) | `ManualTaskInput` | Fixed at design time — the orchestrator cannot discover list names |
| `"'$filter'"` | `ManualTaskInput` if the filter is always the same; `AutomaticTaskInput` if it depends on conversation context | If Automatic, provide a very precise description with the exact column names and allowed values |
| `"'$orderby'"` | `ManualTaskInput` | Usually fixed (e.g., `Created desc`) |
| `"'$top'"` | `ManualTaskInput` | Usually a fixed limit (e.g., `"10"`) |

**Example — GetItems with a fixed list and dynamic filter:**

```yaml
inputs:
  - kind: ManualTaskInput
    propertyName: dataset
    value: "https://contoso.sharepoint.com/sites/HR"

  - kind: ManualTaskInput
    propertyName: table
    value: "Employees"

  - kind: AutomaticTaskInput
    propertyName: "'$filter'"
    description: |-
      OData filter for the Employees SharePoint list.
      Available columns: Title (text), Department (text), Status (choice: Active, Inactive, OnLeave), HireDate (datetime).
      Use OData syntax: eq, ne, gt, lt, ge, le, and, or. String values in single quotes.
      Examples: "Department eq 'Engineering'", "Status eq 'Active' and HireDate ge '2025-01-01T00:00:00Z'"
    entity: StringPrebuiltEntity
    shouldPromptUser: true

  - kind: ManualTaskInput
    propertyName: "'$top'"
    value: "50"
```

### PostItem (Create item) / PatchItem (Update item)

| Parameter | Recommended Input Kind | Why |
|-----------|----------------------|-----|
| `dataset` | `ManualTaskInput` | Fixed site URL |
| `table` | `ManualTaskInput` | Fixed list name |
| `item` | `AutomaticTaskInput` | The item body — describe the exact column names and types in the description |

## Dynamic Outputs Warning

SharePoint's `GetItems` and `GetFileItems` have `outputType: UnresolvedDynamicType` — the output columns depend on the specific list/library schema. **The AI cannot know the column names.** When editing an action that outputs list data:

1. **Ask the user** for the column names they need from the list
2. Only reference columns the user has confirmed
3. Warn the user to verify column internal names in SharePoint (Site Settings → List Settings → Column names)

Internal names differ from display names (e.g., display name "Employee Name" → internal name "EmployeeName" or "Employee_x0020_Name" for names with spaces).

## Discovering List Columns Before Writing Filters

The AI **cannot guess** the column names, types, or internal names of a SharePoint list. Before building a `$filter` or configuring inputs/outputs, **always ask the user to share their list's actual columns**.

The most reliable way is to ask the user to:
1. Run a **GetItems** call (via the Copilot Studio test chat or the SharePoint connector action) with no filter and `$top` set to `1`
2. Share the JSON response — it reveals the exact internal column names, types, and sample values

Use the response to:
- Write accurate `$filter` expressions using the real internal column names
- Populate `AutomaticTaskInput` descriptions with the exact column names and allowed values
- Configure outputs with the correct `propertyName` values

> **Why this matters:** Column display names like "Assigned To" often have internal names like `AssignedTo` or `Assigned_x0020_To`. Choice columns have specific allowed values. Without seeing real data, the AI will guess wrong.

## Person/Group Column Filtering

SharePoint **Person/Group** columns (e.g., "Assigned To", "Created By", "Manager") require special handling. You **cannot** filter them by `DisplayName` — you must filter by the `EMail` sub-property.

### Syntax

```
AssignedTo/EMail eq 'john.doe@contoso.com'
```

**Not** `AssignedTo eq 'John Doe'` — this will return zero results.

### Common Wrong vs. Right (Person/Group)

| Wrong | Right | Issue |
|-------|-------|-------|
| `AssignedTo eq 'John Doe'` | `AssignedTo/EMail eq 'john.doe@contoso.com'` | Must use `/EMail` sub-property |
| `AssignedTo/DisplayName eq 'John Doe'` | `AssignedTo/EMail eq 'john.doe@contoso.com'` | `DisplayName` is not filterable in SharePoint REST |
| `Author eq 'Jane Smith'` | `Author/EMail eq 'jane.smith@contoso.com'` | "Created By" internal name is `Author` |
| `Editor eq 'Jane Smith'` | `Editor/EMail eq 'jane.smith@contoso.com'` | "Modified By" internal name is `Editor` |

### Two-Step Pattern: Resolve User Email First

When the user says "filter by assigned to me" or "show items for John", the agent needs the **email address** — not a display name. Use the **Office 365 Users** connector (`shared_office365users`) to resolve the email first, then pass it to the SharePoint filter.

**Step 1 — Get the user's email** (in a topic, before calling the SharePoint action):

```yaml
# Get current user's profile
- kind: InvokeConnectorAction
  id: getProfile_abc123
  connectionReference: shared_office365users
  connectionProperties:
    mode: Invoker
  operationId: UserGet_V2
  output:
    kind: SingleVariableOutputBinding
    variable: init:Topic.UserProfile

# Extract the email
- kind: SetVariable
  id: setEmail_def456
  variable: Topic.UserEmail
  value: =Topic.UserProfile.mail
```

**Step 2 — Use the email in the SharePoint filter:**

For a **TaskDialog** action with `AutomaticTaskInput`, include the email as part of the description:

```yaml
- kind: AutomaticTaskInput
  propertyName: "'$filter'"
  description: |-
    OData filter for the Tasks SharePoint list.
    To filter by person, use: AssignedTo/EMail eq '{email}'.
    The user's email is available in the conversation context.
    Column reference: Title (text), Status (choice: Not Started, In Progress, Completed), AssignedTo (person), DueDate (datetime).
  entity: StringPrebuiltEntity
  shouldPromptUser: true
```

For an **InvokeConnectorAction** inline in a topic, interpolate the email directly:

```yaml
- kind: InvokeConnectorAction
  id: getMyTasks_ghi789
  connectionReference: shared_sharepointonline
  connectionProperties:
    mode: Invoker
  operationId: GetItems
  input:
    parameters/dataset: https://contoso.sharepoint.com/sites/Projects
    parameters/table: Tasks
    parameters/$filter: ="AssignedTo/EMail eq '" & Topic.UserEmail & "'"
  output:
    kind: SingleVariableOutputBinding
    variable: init:Topic.MyTasks
```

### Other Filterable Person Sub-Properties

| Sub-property | Filterable | Notes |
|-------------|-----------|-------|
| `EMail` | Yes | **Always use this** — most reliable |
| `Id` | Yes | SharePoint user ID (integer) — stable but not human-readable |
| `DisplayName` | No | **Not filterable** in SharePoint REST/OData |
| `Title` | No | Same as DisplayName — not filterable |
