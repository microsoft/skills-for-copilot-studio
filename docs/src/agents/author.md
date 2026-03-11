---
sidebar_position: 1
title: Author Agent
---

# Author Agent

The **author** agent is a specialized YAML authoring agent for Microsoft Copilot Studio. It creates and edits topics, actions, knowledge sources, child agents, and global variables.

## Invocation

```
/copilot-studio:author <your request>
```

## What It Does

The author agent:

- Creates new topics with valid YAML structure, unique node IDs, and proper schema compliance
- Adds and edits connector actions (Teams, Outlook, etc.)
- Configures knowledge sources for grounded responses
- Manages global variables, triggers, and agent settings
- Generates adaptive cards
- Validates all output against the Copilot Studio YAML authoring schema

## Skills Used

The author agent delegates to purpose-built skills for every task. It never writes YAML manually when a skill exists.

| Task | Skill |
|------|-------|
| Create a new topic | `/copilot-studio:new-topic` |
| Add/modify a node in a topic | `/copilot-studio:add-node` |
| Add a connector action | `/copilot-studio:add-action` |
| Edit an existing action | `/copilot-studio:edit-action` |
| Add a knowledge source | `/copilot-studio:add-knowledge` |
| Add generative answers | `/copilot-studio:add-generative-answers` |
| Add child/connected agents | `/copilot-studio:add-other-agents` |
| Add a global variable | `/copilot-studio:add-global-variable` |
| Edit agent settings | `/copilot-studio:edit-agent` |
| Modify trigger phrases | `/copilot-studio:edit-triggers` |
| Add an adaptive card | `/copilot-studio:add-adaptive-card` |
| Validate YAML | `/copilot-studio:validate` |
| Look up schema | `/copilot-studio:lookup-schema` |

## Examples

### Create a new topic

```
/copilot-studio:author Create a topic that handles IT service requests
```

### Add a knowledge source

```
/copilot-studio:author Add a knowledge source pointing to https://contoso.com/hr-policies
```

### Edit trigger phrases

```
/copilot-studio:author Update the greeting topic triggers to include "hello", "hey", and "good morning"
```

### Add an adaptive card

```
/copilot-studio:author Add an adaptive card to the booking confirmation topic that shows date, time, and location
```

## Rules

- Always validates YAML after creation or editing
- Verifies kind values against the schema before writing
- When `GenerativeActionsEnabled: true`, uses topic inputs/outputs via `AutomaticTaskInput` instead of hardcoded question nodes
- For grounded answers, relies on knowledge sources' native lookup. Uses `SearchAndSummarizeContent` only when explicit query manipulation is needed.
- Never hardcodes agent names or paths -- auto-discovers via `**/agent.mcs.yml`

## Limitations

The author agent cannot create from scratch:

1. **Autonomous Triggers** -- require Power Platform configuration beyond YAML
2. **AI Prompt nodes** -- involve Power Platform components beyond YAML

These should be configured through the Copilot Studio UI. However, the agent CAN modify existing components or reference them in new topics.
