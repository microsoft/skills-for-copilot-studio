# Copilot Studio YAML Agent Development

You are a specialized agent for Microsoft Copilot Studio YAML authoring. You can write and edit YAML agents that render correctly in Copilot Studio.
All the YAML files you'll find have as extension .yml

For reference tables (triggers, actions, variables, entities, Power Fx functions, templates), see [REFERENCE.md](./REFERENCE.md). Also consult REFERENCE.md when troubleshooting agent behavior (e.g., wrong topic triggered, topic not firing).

## Project Structure

```
project-root/
├── CLAUDE.md                               # This file (project instructions)
├── REFERENCE.md                            # Trigger/action/variable reference tables
├── reference/bot.schema.yaml-authoring.json  # Schema (DO NOT LOAD THIS - it's too long. You'll have helpers to look things inside this file)
├── templates/                              # YAML templates for common patterns
├── tests/                                  # Test runner and chat scripts for published agents
│   ├── run-tests.js                        # Test execution script (Dataverse API)
│   ├── chat-with-agent.py                  # Direct chat with agent (CopilotStudio client)
│   ├── requirements.txt                    # Python dependencies for chat-with-agent
│   ├── agents.json                         # Local agent registry (auto-discovered or manual)
│   ├── settings.json                       # Test configuration (user fills in)
│   └── test-results-*.csv                  # Downloaded test results
└── agents/AGENT-NAME/                         # YAML files representing the agent
    ├── topics/                             # Conversation topics
    ├── actions/                            # Connector-based actions
    ├── knowledge/                          # Knowledge sources
    ├── variables/                          # Global variables
    └── agents/                             # Child agents
```

**Note**: Clone your Copilot Studio agents into the `agents/` directory using the VS Code Extension. The directory is included in the repo but its contents are gitignored (agent clones are user-specific).

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
- `/add-adaptive-card` - Generate and insert an Adaptive Card (info, hero, form, list, confirmation, status) via an AdaptiveCardPrompt node in the topic
- `/add-node` - Add node to existing topic (not for generative answers)
- `/add-action` - Add a connector-based action from the verified catalog (Teams, Outlook, etc.)
- `/validate` - Validate YAML structure
- `/add-knowledge` - Add knowledge source (public website or SharePoint)
- `/list-topics` - List solution topics
- `/list-kinds` - List available kind values
- `/edit-agent` - Edit agent settings/instructions
- `/edit-triggers` - Modify topic triggers (phrases and model description)
- `/add-child-agent` - Add/configure child agents
- `/add-generative-answers` - Add generative answer nodes (use this instead of `/add-node` for SearchAndSummarizeContent / AnswerQuestionWithAI)
- `/add-global-variable` - Add a global variable (persists across topics, optionally visible to AI orchestrator)
- `/run-tests` - Run tests against a published agent, analyze failures, and propose YAML fixes
- `/chat-with-agent` - Send a message to a published agent and get its full response (point-testing)
- `/best-practices` - Best practices for JIT glossary (customer acronyms), JIT user context (M365 profile), and shared OnActivity initialization patterns

## Agent Discovery (Important)

The agent name is dynamic — users clone their own agent. **NEVER hardcode an agent name or path.** Always auto-discover via `Glob: agents/**/agent.mcs.yml`. If multiple agents found, ask which one.

## Agent Registry (Shared Convention)

When a skill needs to connect to a published agent (e.g., `/chat-with-agent`, `/run-tests`), it must resolve agent connection metadata. Use `tests/agents.json` as the shared local registry.

**File**: `tests/agents.json` (gitignored — contains user-specific environment data)

**Format** — keyed by agent display name:
```json
{
  "Agent 7": {
    "environmentId": "6cc0c98e-...",
    "tenantId": "8a235459-...",
    "agentIdentifier": "copilots_header_9b50c",
    "clientId": "user-provided-app-registration-id",
    "dataverseEndpoint": "https://org5d9d4b6b.crm.dynamics.com/",
    "localPath": "agents/Agent 7"
  }
}
```

**Lookup convention** — when a skill needs connection info, follow these steps in order:

1. **Check `tests/agents.json`** — if it exists and has a complete entry for the target agent, use it.
2. **Auto-discover from VS Code extension clones** — glob for `**/.mcs/conn.json` (covers both `agents/` subdirectories and the project root if Claude was initiated directly in a cloned agent folder). For each match:
   - Read `.mcs/conn.json` for `EnvironmentId`, `AccountInfo.TenantId`, and `DataverseEndpoint`
   - Read the sibling `settings.mcs.yml` (one level up from `.mcs/`) for `schemaName` (this is the `agentIdentifier`)
   - Read the sibling `agent.mcs.yml` for the display name
   - `localPath` is the agent directory relative to the project root
3. **If no cloned agent found**, ask the user for `environmentId`, `agentIdentifier`, and `tenantId` manually.
4. **`clientId` is always user-provided** — it's never in `.mcs/conn.json`. If missing, ask the user. The app registration must have `CopilotStudio.Copilots.Invoke` API permission and redirect URI `http://localhost`.
5. **If multiple agents found**, ask the user which one to use.
6. **Always persist** the resolved entry to `tests/agents.json` so the lookup only happens once.

**Rules**:
- Skills should read from `tests/agents.json` first — auto-discovery is a fallback, not the default path.
- When writing to the registry, preserve all existing entries (other agents).
- The `--agent` flag on scripts (e.g., `python tests/chat-with-agent.py --agent "Agent 7"`) selects which registry entry to use. If omitted and only one agent exists, use it automatically.

## Generative Orchestration (Key Rule)

When `GenerativeActionsEnabled: true` in settings: use **topic inputs/outputs** instead of hardcoded questions/messages. Use `SearchAndSummarizeContent` for grounded answers; use `AnswerQuestionWithAI` for general knowledge only. See skill files for detailed patterns.

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
- `System.Activity.Text` is the last message sent by the user — commonly used as input for `SearchAndSummarizeContent` and other nodes that need the user's query
- **Only use supported functions** — Copilot Studio supports a subset of Power Fx. Check the supported functions list in [REFERENCE.md](./REFERENCE.md) before writing expressions

## Agent Lifecycle: Local, Pushed, Published

Agent content exists in three distinct states. Understanding this is critical for testing and debugging.

| State | Where it lives | Who can see it |
|-------|---------------|----------------|
| **Local** | YAML files on disk (`agents/`) | Only you (Claude and the user editing files) |
| **Pushed (Draft)** | Power Platform environment | Copilot Studio UI — visible in the authoring canvas and the in-product **Test** tab at [copilotstudio.microsoft.com](https://copilotstudio.microsoft.com) |
| **Published** | Power Platform environment (live) | External clients — `/chat-with-agent`, `/run-tests`, DirectLine, Teams, and any channel or API consumer |

**Key rule**: Pushing with the VS Code Extension uploads changes as a **draft**. The user can test drafts in the Copilot Studio **Test** tab, but Claude and external testing tools (`/chat-with-agent`, `/run-tests`) can only interact with **published** content. Publishing is a separate step that must be done in the Copilot Studio UI.

### Workflow

1. **Clone** the agent with the Copilot Studio VS Code Extension
2. **Author** changes in YAML (this is what Claude does)
3. **Push** changes with the VS Code Extension → agent is now in **draft** state
4. _(Optional)_ **Test draft** in the Copilot Studio UI Test tab at [copilotstudio.microsoft.com](https://copilotstudio.microsoft.com)
5. **Publish** in Copilot Studio UI → agent is now **published** and reachable by `/chat-with-agent`, `/run-tests`, and all external channels

**Important**: After making YAML changes, always remind the user that they need to **push AND publish** before testing with `/chat-with-agent` or `/run-tests`. Pushing alone is not enough — only published content is visible to external clients.
