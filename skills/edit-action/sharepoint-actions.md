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
