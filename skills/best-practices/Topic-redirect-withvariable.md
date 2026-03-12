# Dynamic Topic Redirect with Variable

Use a **Switch expression inside a BeginDialog node** to dynamically redirect to different topics based on a variable value. This replaces complex if/then/else condition chains built in the UI with a single, maintainable YAML pattern.

## When to Use This Pattern

- You need to route the user to one of several topics based on a variable value
- You want to avoid deeply nested ConditionGroup nodes that are hard to read and maintain
- The routing logic maps a single variable to multiple target topics (e.g., lesson selection, category routing, menu choices)

## How It Works

1. A variable is set (e.g., from user input, a random value, or a previous action)
2. A `BeginDialog` node uses a Power Fx `Switch()` expression to resolve the target topic dynamically at runtime
3. The `Switch()` returns the fully qualified topic schema name based on the variable value

## YAML Example

```yaml
kind: AdaptiveDialog
beginDialog:
  kind: OnRecognizedIntent
  id: main
  intent:
    triggerQueries:
      - Dynamic redirects
  actions:
    - kind: SetVariable
      id: setVariable_7bgfoP
      variable: Topic.MyVariable
      value: =RandBetween(0,4)
    - kind: BeginDialog
      id: A4lDAn
      dialog: |-
        =Switch(
            Topic.MyVariable,
            1, "cat_MyBot.topic.Lesson1",
            2, "cat_MyBot.topic.Lesson2",
            3, "cat_MyBot.topic.Lesson3",
            "cat_MyBot.topic.Fallback"
        )
```

## Key Points

- **`dialog` with a Power Fx expression** — the `BeginDialog` node's `dialog` property accepts a `=Switch(...)` expression that evaluates at runtime to a topic schema name
- **Fully qualified topic names** — each branch value must be the full schema name of the target topic (e.g., `cat_MyBot.topic.Lesson1`). Read `settings.mcs.yml` to get your agent's schema name prefix
- **Default/fallback** — the last argument to `Switch()` (without a match value) is the default case, used when no other value matches
- **`|-` block scalar** — use the YAML literal block style (`|-`) for the multi-line Power Fx expression to preserve formatting

## Replacing If/Then/Else Chains

Instead of building this in the UI:

```
ConditionGroup (Topic.MyVariable = 1)
  -> BeginDialog: Lesson1
ConditionGroup (Topic.MyVariable = 2)
  -> BeginDialog: Lesson2
ConditionGroup (Topic.MyVariable = 3)
  -> BeginDialog: Lesson3
Else
  -> BeginDialog: Fallback
```

Use the single `BeginDialog` + `Switch()` pattern above. It is shorter, easier to maintain, and avoids deeply nested condition nodes.
