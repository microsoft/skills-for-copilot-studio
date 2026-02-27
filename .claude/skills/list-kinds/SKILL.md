---
description: List all available kind discriminator values from the Copilot Studio YAML schema. Use when the user asks what kinds/types are available.
argument-hint: <optional-filter-keyword>
allowed-tools: Bash(python *)
---

# List Available Kind Values

List all available `kind` discriminator values from the schema, dynamically.

## Instructions

1. Run the schema lookup script to get all kinds:
   ```bash
   python scripts/schema-lookup.py kinds
   ```

2. If `$ARGUMENTS` contains a filter keyword, filter the output to show only matching kinds.

3. Categorize the results for easier reading:
   - **Triggers** — kinds starting with "On" (e.g., OnRecognizedIntent, OnConversationStart)
   - **Actions** — node actions (e.g., SendActivity, Question, SetVariable)
   - **Dialogs** — dialog types (e.g., AdaptiveDialog, TaskDialog, AgentDialog)
   - **Cards** — card templates (e.g., AdaptiveCardTemplate, HeroCardTemplate)
   - **Knowledge Sources** — knowledge kinds (e.g., KnowledgeSourceConfiguration)
   - **Inputs** — input kinds (e.g., AutomaticTaskInput, ManualTaskInput)

4. Present the categorized list to the user.

**Important**: Always use the script output as the source of truth. Do NOT hardcode kind values.
