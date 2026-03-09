---
name: _project-context
description: >
  Shared project context for all Copilot Studio sub-agents. Provides project
  structure, schema lookup usage, and skill invocation guidance.
user-invocable: false
---

# Copilot Studio — Shared Project Context

You are working inside a Copilot Studio agent project. All YAML files have the `.mcs.yml` extension.

## Project Structure

```
<agent-dir>/                          # Auto-discover via Glob: **/agent.mcs.yml
├── agent.mcs.yml                     # Agent metadata (display name, schema version)
├── settings.mcs.yml                  # Agent settings (schemaName, GenerativeActionsEnabled, instructions)
├── topics/                           # Conversation topics (AdaptiveDialog YAML files)
├── actions/                          # Connector-based actions (TaskDialog YAML files)
├── knowledge/                        # Knowledge sources (KnowledgeSourceConfiguration YAML files)
├── variables/                        # Global variables (GlobalVariableComponent YAML files)
└── agents/                           # Child agents (AgentDialog YAML files, each in its own subfolder)
```

## Schema Lookup Script

The schema lookup script is at `${CLAUDE_SKILL_DIR}/../../scripts/schema-lookup.bundle.js`. Use it for any schema queries:

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/schema-lookup.bundle.js lookup SendActivity       # Look up a definition
node ${CLAUDE_SKILL_DIR}/../../scripts/schema-lookup.bundle.js search trigger             # Search by keyword
node ${CLAUDE_SKILL_DIR}/../../scripts/schema-lookup.bundle.js resolve AdaptiveDialog     # Resolve with $refs
node ${CLAUDE_SKILL_DIR}/../../scripts/schema-lookup.bundle.js kinds                      # List all valid kind values
node ${CLAUDE_SKILL_DIR}/../../scripts/schema-lookup.bundle.js summary Question           # Compact overview
node ${CLAUDE_SKILL_DIR}/../../scripts/schema-lookup.bundle.js validate <file.yml>        # Validate a YAML file
```

**NEVER load the full schema file** (`reference/bot.schema.yaml-authoring.json`) — it's too long. Always use the script above.

## Skill-First Rule

You have access to specialized skills that handle YAML creation, editing, validation, and testing. **ALWAYS invoke the matching skill instead of doing it manually.** Skills contain correct templates, schema validation, and patterns. Doing it manually risks hallucinated `kind:` values, missing required fields, and broken YAML.

### Available Skills

| Skill | When to use |
|-------|-------------|
| `/copilot-studio:new-topic` | Create a new topic |
| `/copilot-studio:add-node` | Add/modify a node in an existing topic |
| `/copilot-studio:add-action` | Add a connector action (Teams, Outlook, etc.) |
| `/copilot-studio:add-knowledge` | Add a knowledge source (website, SharePoint) |
| `/copilot-studio:add-generative-answers` | Add SearchAndSummarizeContent or AnswerQuestionWithAI nodes |
| `/copilot-studio:add-other-agents` | Add child agents, connected agents, or other multi-agent patterns |
| `/copilot-studio:add-global-variable` | Add a global variable |
| `/copilot-studio:add-adaptive-card` | Add an adaptive card to a topic |
| `/copilot-studio:edit-agent` | Edit agent settings, instructions, or display name |
| `/copilot-studio:edit-triggers` | Modify trigger phrases or model description |
| `/copilot-studio:best-practices` | JIT glossary, user context, OnActivity initialization |
| `/copilot-studio:validate` | Validate YAML structure against schema |
| `/copilot-studio:lookup-schema` | Query a schema definition |
| `/copilot-studio:list-kinds` | List all valid kind values |
| `/copilot-studio:list-topics` | List all topics in the agent |
| `/copilot-studio:run-tests` | Run tests against a published agent |
| `/copilot-studio:chat-with-agent` | Send a test message to a published agent |

**If no skill matches**, only then work manually — but always validate with `/copilot-studio:validate` afterward.

## Key Conventions

- **Agent Discovery**: NEVER hardcode agent names. Always `Glob: **/agent.mcs.yml`.
- **ID Generation**: Random alphanumeric, 6-8 chars after prefix (e.g., `sendMessage_g5Ls09`).
- **Template `_REPLACE`**: Always replace `_REPLACE` placeholder IDs with unique random IDs.
- **Power Fx**: Expressions start with `=`. String interpolation uses `{}`. Only use supported functions (check `_reference` skill).
- **Generative Orchestration**: When `GenerativeActionsEnabled: true`, use topic inputs/outputs instead of hardcoded questions/messages.
