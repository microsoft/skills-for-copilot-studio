---
description: Add or modify an action node in an existing Copilot Studio topic. Use when the user asks to add a question, message, condition, or other action to a topic.
argument-hint: <action-type> to <topic-name>
allowed-tools: Bash(python *), Read, Write, Edit, Glob
---

# Add Action to Topic

Add a new action node to an existing Copilot Studio topic, or modify an existing action.

## Instructions

1. **Auto-discover the agent directory**:
   ```
   Glob: src/**/agent.mcs.yml
   ```
   NEVER hardcode an agent name.

2. **Parse the arguments** to identify:
   - The action type (SendActivity, Question, SetVariable, ConditionGroup, etc.)
   - The target topic file
   - If modifying an existing action, which action to modify

3. **Look up the action schema**:
   ```bash
   python scripts/schema-lookup.py resolve <ActionType>
   ```

4. **Read the existing topic file** to understand its current structure.

5. **Generate or modify the action node** with:
   - A unique ID (format: `<nodeType>_<6-8 random alphanumeric>`)
   - All required properties from the schema
   - Appropriate default values

6. **Determine the correct insertion point** in the actions array and present the plan to the user before writing.

## Common Action Types

| Action | Purpose | Key Properties |
|--------|---------|----------------|
| `SendActivity` | Send message | `kind`, `id`, `activity` |
| `Question` | Ask user input | `kind`, `id`, `variable`, `prompt`, `entity` |
| `SetVariable` | Set/compute value | `kind`, `id`, `variable`, `value` |
| `ConditionGroup` | Branching logic | `kind`, `id`, `conditions` |
| `BeginDialog` | Call another topic | `kind`, `id`, `dialog` |
| `EndDialog` | End topic | `kind`, `id` |
| `SearchAndSummarizeContent` | Generative answers | `kind`, `id`, `variable`, `userInput` |
| `CancelAllDialogs` | Cancel all topics | `kind`, `id` |

## Generative Orchestration Guidelines

When the agent has `GenerativeActionsEnabled: true`:

- Prefer **AutomaticTaskInput** over Question nodes for collecting user info (the orchestrator handles prompting automatically).
- Still use Question nodes when: conditional asks (ask X only if Y), or end-of-flow confirmations.
- Prefer **topic outputs** over SendActivity for returning results.
- Do NOT use SendActivity to show final outputs unless it's a precise mid-flow message.

## Power Fx Quick Reference

- Expressions start with `=`: `condition: =System.FallbackCount < 3`
- String interpolation uses `{}`: `activity: "Error: {System.Error.Message}"`
- Variable init on first assignment: `variable: init:Topic.MyVar`
- Common: `Text()`, `Now()`, `IsBlank()`, `!IsBlank()`

## Example: Adding a Question Action

```yaml
- kind: Question
  id: question_k7xPm2
  variable: init:Topic.UserName
  prompt: What is your name?
  entity: StringPrebuiltEntity
  alwaysPrompt: true
  interruptionPolicy:
    allowInterruption: false
```

## Important Notes

- **Unique IDs**: Use random 6-8 alphanumeric characters. Duplicate IDs cause Copilot Studio errors.
- Verify the action type exists in the schema before generating.
- For ConditionGroup, include at least one condition item with its own unique ID.
