---
user-invocable: false
agent-types: modern
description: Edit modern (CLI) Copilot Studio agent settings — instructions, output format, model, conversation starters. Use when the user asks to change agent behavior, instructions, or configuration.
allowed-tools: Read, Edit, Glob
context: fork
agent: copilot-studio-author
---

# Edit modern agent settings

## Pre-checks

1. Run `Glob: **/settings.mcs.yml` to find the agent workspace.
2. Read `settings.mcs.yml` and confirm it's a modern agent (look for `template: cliagent-1.0.0` or `$kind: CLICopilotRecognizer`).
3. If this is NOT a modern agent, STOP and tell the user this skill is for modern agents only. Suggest `/copilot-studio:edit-agent` for classic agents.

## What can be edited

All agent settings live in `settings.mcs.yml` under `configuration.agentSettings`. The structure uses `$kind:` discriminators.

### Instructions

Instructions are in `agentSettings.instructions.segments[]`. Each segment is a `StaticSegment` with a `value` field:

```yaml
configuration:
  recognizer:
    $kind: CLICopilotRecognizer

  agentSettings:
    $kind: AgentSettings
    instructions:
      $kind: Instructions
      segments:
        - $kind: StaticSegment
          value: You are a helpful assistant.
        - $kind: StaticSegment
          value: Always be concise.
```

To edit instructions:
- Replace the `value` field of existing `StaticSegment` entries
- Add new segments to the `segments[]` array
- Can also use `ReferenceSegment` to reference system properties:

```yaml
        - $kind: ReferenceSegment
          reference:
            $kind: SystemReference
            property: currentDateAndTime
```

### Output format

Set under `agentSettings.output`:

**Free-form text (default):**
```yaml
    output:
      $kind: TextAgentOutput
```

**JSON Schema-constrained:**
```yaml
    output:
      $kind: StructuredAgentOutput
      schema: '{"type":"object","properties":{"answer":{"type":"string"}},"required":["answer"]}'
```

### Conversation starters

Suggested prompt buttons at conversation start:

```yaml
    conversationStarters:
      - $kind: ConversationStarter
        title: Get Started
        text: How can you help me?
      - $kind: ConversationStarter
        title: FAQ
        text: What questions can you answer?
```

### Model selection

Set the LLM model series:

```yaml
    model:
      $kind: ModelConfig
      series: Sonnet46
```

Available series values: `Sonnet46`, `GPT4o`, `GPT5` (check with schema-lookup for current list).

## NEVER modify

These fields must NOT be changed — they will break the agent:

- `schemaName` — Dataverse entity identifier
- `publishedOn` — managed by publish system
- `template` — must stay `cliagent-1.0.0`
- `language` — locale code
- `configuration.recognizer` — must stay `CLICopilotRecognizer`
- `displayName` — can be changed but only if user explicitly asks

## What is NOT available in modern agents

If the user asks for any of these, explain they are not available and suggest alternatives:

| Request | Why not | Alternative |
|---------|---------|-------------|
| Add a topic | Modern agents don't have topics | Create a skill with `/copilot-studio:new-skill` |
| Add Adaptive Cards | Output is text/JSON only | Use `StructuredAgentOutput` for structured responses |
| Add variables | `AgentVariable` is not yet supported at runtime | The LLM tracks state within the conversation naturally |
| Add entities | No entity system | The LLM extracts information from natural language |
| Use Power Fx | No expression engine | Describe logic in instructions |
| Add voice/IVR | Not supported | Stay on classic if voice is required |

## After editing

Tell the user to push changes with `/copilot-studio:manage-agent` and test in the CPS Preview tab.
