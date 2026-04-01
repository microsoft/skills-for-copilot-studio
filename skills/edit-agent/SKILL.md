---
user-invocable: false
description: Edit Copilot Studio agent settings, instructions, or configuration. Use when the user asks to change agent instructions, display name, conversation starters, AI settings, or generative actions toggle.
argument-hint: <what to change>
allowed-tools: Bash(node *schema-lookup.bundle.js *), Read, Edit, Glob
context: fork
agent: copilot-studio-author
---

# Edit Agent Settings/Instructions

Modify agent metadata (`agent.mcs.yml`) or configuration (`settings.mcs.yml`).

## Instructions

1. **Auto-discover the agent directory**:
   ```
   Glob: **/agent.mcs.yml
   ```
   NEVER hardcode an agent name. If multiple agents found, ask which one.

2. **Identify what the user wants to change** and read the appropriate file:
   - **Instructions, display name, conversation starters, AI settings** → `agent.mcs.yml`
   - **GenerativeActionsEnabled, authentication, recognizer, capabilities** → `settings.mcs.yml`

3. **If the user wants to change the AI model**, run the schema lookup tool first:
   ```bash
   node ${CLAUDE_SKILL_DIR}/../../scripts/schema-lookup.bundle.js models
   ```
   Use the output to determine the correct `modelNameHint` and `provider` values.
   **CRITICAL:** Do NOT include `kind` in the model block — the agent-level schema uses `CurrentModelsNoKind`.

4. **Read the current file** before making any changes.

5. **Make the requested changes** using the Edit tool.

## Editable Fields in `agent.mcs.yml`

| Field | Description | Example |
|-------|-------------|---------|
| `displayName` | Agent's display name | `displayName: My Agent` |
| `instructions` | System prompt / personality | Multi-line YAML with `\|` |
| `conversationStarters` | Suggested conversation starters | Array of `{title, text}` |
| `aISettings.model.modelNameHint` | Model hint (run `models` command for convention) | `Sonnet46`, `GPT5Chat` |
| `aISettings.model.provider` | Model provider (required for non-OpenAI) | `Anthropic` |

## Editable Fields in `settings.mcs.yml`

| Field | Description | Example |
|-------|-------------|---------|
| `GenerativeActionsEnabled` | Enable generative orchestration | `true` / `false` |
| `authenticationMode` | Auth mode | `Integrated`, `None` |
| `authenticationTrigger` | When to auth | `Always`, `AsNeeded` |
| `accessControlPolicy` | Access control | `ChatbotReaders` |
| `configuration.aISettings.*` | AI capabilities | Various booleans |
| `configuration.settings.*.content.capabilities.webBrowsing` | Web browsing | `true` / `false` |

## Writing Effective Instructions

For detailed guidance on writing knowledge-aware instructions, grounding directives, citation control, and scope enforcement, see [instructions-guide.md](instructions-guide.md).

## Fields to NEVER Modify

- `schemaName` — This is the internal Power Platform identifier. Changing it breaks the agent.
- `publishedOn` — Managed by the platform.
- `template` — Managed by the platform.
- `language` — Changing this can corrupt the agent.

If the user asks to change any of these, warn them.

## Example: Update Instructions

```yaml
instructions: |
  You are a customer support agent for Contoso Ltd.

  Guidelines:
  - Be professional and empathetic
  - Always verify the customer's identity first
  - Escalate billing issues to a human agent
```
