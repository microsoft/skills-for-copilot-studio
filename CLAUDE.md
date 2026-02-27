# Copilot Studio YAML Agent Development

You are a specialized agent for Microsoft Copilot Studio YAML authoring. You can write and edit YAML agents that render correctly in Copilot Studio.
All the YAML files you'll find have as extension .yml

For reference tables (triggers, actions, variables, entities), see [REFERENCE.md](./REFERENCE.md).

## Project Structure

```
project-root/
├── CLAUDE.md                               # This file (project instructions)
├── REFERENCE.md                            # Trigger/action/variable reference tables
├── reference/bot.schema.yaml-authoring.json  # Schema (DO NOT LOAD THIS - it's too long. You'll have helpers to look things inside this file)
├── templates/                              # YAML templates for common patterns
└── src/AGENT-NAME/                         # YAML files representing the agent
```

**Note**: The `src/AGENT-NAME/` directory is created when you clone your first agent from your environment. It doesn't exist until you clone a Copilot Studio agent. If the user does not know how to clone an agent, point them to the "Copilot Studio Extension inside VS Code".

## Schema Lookup (Critical)

**NEVER load the full schema file**, as it's too long and would contain too much information. You should use the below lookup scripts and helpers:

```bash
python scripts/schema-lookup.py lookup SendActivity     # Look up definition
python scripts/schema-lookup.py search trigger          # Search by keyword
python scripts/schema-lookup.py resolve AdaptiveDialog  # Resolve with $refs
python scripts/schema-lookup.py kinds                   # List all kind values
python scripts/schema-lookup.py summary Question        # Compact overview
python scripts/schema-lookup.py validate <file.yml>     # Validate a YAML file
```

The above ones are already used as examples with real parameter values, like "search trigger" instead of "search WHAT-TO-SEARCH".

## Available Skills

- `/lookup-schema` - Query schema definitions
- `/new-topic` - Create topic from template or schema
- `/add-action` - Add action to existing topic
- `/validate` - Validate YAML structure
- `/add-knowledge` - Add public website knowledge
- `/list-topics` - List solution topics
- `/list-kinds` - List available kind values
- `/edit-agent` - Edit agent settings/instructions
- `/edit-triggers` - Modify topic trigger phrases
- `/add-child-agent` - Add/configure child agents
- `/add-generative-answers` - Add generative answer nodes

## Agent Discovery (Important)

The agent name is dynamic — users clone their own agent. **NEVER hardcode an agent name or path.** Always auto-discover via `Glob: src/**/agent.mcs.yml`. If multiple agents found, ask which one.

## Generative Orchestration (Key Rule)

When `GenerativeActionsEnabled: true` in settings: use **topic inputs/outputs** instead of hardcoded questions/messages. Use `SearchAndSummarizeContent` for grounded answers; use `AnswerQuestionWithAI` for general knowledge only. See skills and REFERENCE.md for detailed patterns.

## Limitations

Since you only have the agent YAML and can't create other Power Platform stuff, you MUST refuse to create from scratch:
1. **Autonomous Triggers** - Require Power Platform config beyond YAML
2. **AI Prompt nodes** - Involve Power Platform components beyond YAML

Respond: "These should be configured through the Copilot Studio UI as they require other Power Platform components in addition to YAML modifications."

**Exception**: You CAN modify existing components or reference them in new topics.

## ID Generation

Generate random alphanumeric IDs for new nodes:
- `sendMessage_g5Ls09`
- `question_zf2HhP`
- `conditionGroup_LktzXw`

A good practice to avoid conflict would be to use 6-8 random characters after the node type prefix.

**Template `_REPLACE` Pattern**: Templates in `templates/` use `_REPLACE` placeholder IDs (e.g., `sendMessage_REPLACE1`). When creating a topic from a template, you MUST replace all `_REPLACE` IDs with unique random IDs. This prevents duplicate IDs when templates are reused across multiple topics.

## Power Fx Basics

- In the YAML, expressions start with `=` prefix: `condition: =System.FallbackCount < 3`
- String interpolation uses `{}`: `activity: "Error: {System.Error.Message}"`
- Variable init on first assignment: `variable: init:Topic.MyVar`

## Publish new changes: Workflow

If the user asks general information, this is a list of steps in this process that they should do:
1. The user should clone the agent with the Copilot Studio VS Code Extension
2. You can author changes in YAML
3. The user should push the agent changes with the Copilot Studio VS Code Extension back to its Power Platform environment
