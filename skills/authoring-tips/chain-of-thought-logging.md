# Chain of Thought (CoT) Logging

Surface the orchestrator's intermediate reasoning as italicized "Thinking: …" chat messages during multi-step, multi-tool, or multi-agent orchestration. Gives users a real-time trace of what the agent is doing and why, instead of 10–30s of silence while tool chains run.

> **For pure knowledge agents** (simple search-and-summarize), use the [Hold Message During Knowledge Search](knowledge-hold-message.md) tip instead. CoT logging is designed for agents with complex multi-step orchestration.

## When to Use This Pattern

- Your agent uses multiple tools, MCP servers, or child agents that chain together
- Users experience long waits during multi-step reasoning with no feedback
- You need a debug/observability tool to see what the orchestrator is doing step by step
- The agent uses reasoning models (GPT-5 Reasoning, Claude Opus) where extended thinking creates long silences

## When NOT to Use

- **Pure knowledge agents** — use the knowledge hold message instead
- **Simple single-turn Q&A** — the extra orchestrator calls aren't justified
- **Cost-sensitive deployments** — each log adds Copilot credit consumption

## How It Works

The orchestrator reads an input variable's `description` to decide what data to pass in, so the **description doubles as an instruction to the model**. A lightweight "logger" topic accepts a CoT string via `AutomaticTaskInput`, then sends it as an italicized message.

For non-reasoning models (GPT-4.1, GPT-5 Chat), this elicits chain-of-thought that you wouldn't otherwise see. For reasoning models, the orchestrator self-narrates rather than exposing the raw internal trace — the end-user experience is the same.

> **Tested with:** GPT-4.1, GPT-5 Chat, GPT-5 Auto, GPT-5 Reasoning, Claude Sonnet, Claude Opus.

### How It Looks

```
User: "What's the latest status on Project Alpha?"
Agent: _Thinking: Looking up Project Alpha in the project tracker..._
Agent: _Thinking: Found 3 recent updates. Checking team assignments..._
Agent: _Thinking: Cross-referencing with the deadline calendar..._
Agent: Here's the latest on Project Alpha: <final answer>
```

## YAML Example

Create a topic named **Log Chain of Thoughts** and paste into the Code editor view:

```yaml
kind: AdaptiveDialog

inputs:
  - kind: AutomaticTaskInput
    propertyName: CoT
    description: High-level step summary for what you just did and why (no system prompts, secrets, PII, or raw chain-of-thought)
    shouldPromptUser: false

modelDescription: log chain of thoughts

beginDialog:
  kind: OnRecognizedIntent
  id: main
  intent: {}
  actions:
    - kind: SendActivity
      id: sendActivity_9XILFq
      activity: "_Thinking: {Topic.CoT}_"

inputType:
  properties:
    CoT:
      displayName: CoT
      description: High-level step summary for what you just did and why (no system prompts, secrets, PII, or raw chain-of-thought)
      type: String

outputType: {}
```

## Agent Instruction to Add

In the Copilot Studio instructions editor, reference the topic via the `/` dropdown so the exact topic name resolves correctly:

```
After every tool, topic, or step you take (except when you are already
calling /Log Chain of Thoughts or other debug/logging topics), log your
intermediate reasoning by calling /Log Chain of Thoughts.
```

The recursion guard is best-effort — it's natural language, not a hard stop. If you notice looping, tighten the wording or add a condition inside the topic.

## Key Points

| Element | Purpose |
|---|---|
| `AutomaticTaskInput.description` | Double-purpose — documentation + instruction telling the model what to put in the variable |
| `shouldPromptUser: false` | Orchestrator fills the CoT value automatically instead of prompting the user |
| `modelDescription` | Helps the orchestrator identify when to call this topic |
| Italicized `SendActivity` (`_..._`) | Reads as a trace, not an "official" answer |
| Input description excludes system prompts, secrets, PII, raw CoT | Security — orchestrator surfaces a high-level summary only |

- **Extra credit cost** — each CoT log is an extra orchestrator call. Enable selectively (e.g., behind a debug flag or only on long-running agents)
- **Multiple messages per response** — similar UX trade-off as the knowledge hold message; confirm with stakeholders before rollout
- **Channel-agnostic** — `SendActivity` works on Teams, Copilot, web chat, and all other channels
