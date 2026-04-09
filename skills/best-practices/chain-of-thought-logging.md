# Chain of Thought (CoT) Logging

When an agent uses many tools, child agents, MCP servers, or complex orchestration, the user may experience long periods of silence while the orchestrator runs a "plan -> execute -> adjust" loop behind the scenes. This best practice surfaces intermediate reasoning steps as messages in the chat, giving the user a real-time "thinking" stream that shows what the agent is doing and why.

> **For pure knowledge agents** (agents that primarily search and summarize from knowledge sources), use the [Hold Message During Knowledge Search](knowledge-hold-message.md) best practice instead. CoT logging is designed for agents with complex multi-step orchestration, not simple knowledge retrieval.

## The Challenge

In Copilot Studio, the orchestrator may chain multiple tool calls, topic redirects, and reasoning steps before producing a final answer. From the end user's perspective:

- The agent disappears into a black box with no feedback
- Long-running MCP tool chains or multi-agent orchestration can take 10–30+ seconds
- There is no native streaming UI in most channels to show planner actions or intermediate steps
- Users lose confidence in the agent and may resend their question or abandon the conversation

## The Solution

Create a lightweight "logger" topic that the orchestrator calls after each step to surface its intermediate reasoning as a chat message. The key insight is that **the orchestrator reads input variable descriptions to decide what data to pass in**, so the description doubles as an instruction telling the model what to log.

For models that don't have built-in reasoning tokens (like GPT-4.1 or GPT-5 Chat), this elicits chain-of-thought that you wouldn't otherwise get. For reasoning models with native reasoning steps (GPT-5 Reasoning, Claude Opus), the orchestrator provides a self-narrated version rather than the raw internal trace — but the end-user experience is similar: the agent explains what it's doing and why, step by step.

> **Tested with:** GPT-4.1, GPT-5 Chat, GPT-5 Auto, GPT-5 Reasoning, and Claude (Sonnet + Opus).

### How It Looks

Each reasoning step surfaces in the chat as an italicized "Thinking: ..." message before the agent proceeds to its next action:

```
User: "What's the latest status on Project Alpha?"

Agent: _Thinking: Looking up Project Alpha in the project tracker..._
Agent: _Thinking: Found 3 recent updates. Checking team assignments..._
Agent: _Thinking: Cross-referencing with the deadline calendar..._
Agent: Here's the latest on Project Alpha: [final answer]
```

## Implementation

### Step 1 — Create the Log Chain of Thoughts Topic

Create a new topic named **Log Chain of Thoughts** and paste the following YAML in the Code editor view:

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

Key elements of this YAML:

| Element | Purpose |
|---|---|
| `AutomaticTaskInput` with `description` | Tells the orchestrator exactly what data to pass into the topic — the description acts as both documentation and an instruction to the model |
| `shouldPromptUser: false` | Ensures the orchestrator provides the CoT value automatically rather than prompting the end user |
| `modelDescription: log chain of thoughts` | Helps the orchestrator identify when to call this topic |
| `SendActivity` with italicized output | Renders the reasoning step as an italicized message so it reads like a trace, not the agent's "official" answer |
| `inputType.properties.CoT.description` | Reinforces the instruction — excludes system prompts, secrets, PII, or raw chain-of-thought from being surfaced |

### Step 2 — Add the Instruction to Your Agent

Add the following instruction to your agent's overview instructions. **You must reference the topic using the `/` syntax** in the Copilot Studio instructions editor (a dropdown will appear with your topics) so it resolves to the exact topic name:

```
After every tool, topic, or step you take (except when you are already
calling /Log Chain of Thoughts or other debug/logging topics), log your
intermediate reasoning by calling /Log Chain of Thoughts.
```

The recursion guard in the instruction ("except when you are already calling...") is best-effort since it's a natural language instruction, not a hard stop. If you notice looping, adjust the wording or add a condition node in the topic as a harder guard.

### Step 3 — Test

1. Open the **Test your agent** panel or test in Teams
2. Ask a question that triggers multi-step orchestration (e.g., a question requiring multiple tool calls or child agent invocations)
3. Verify that:
   - Italicized "Thinking: ..." messages appear between steps
   - The final answer still arrives after all reasoning steps
   - The agent does not enter an infinite loop calling the logger topic

## Trade-offs and Considerations

| Consideration | Detail |
|---|---|
| **Additional credit cost** | Each CoT log is an extra orchestrator call, increasing Copilot credit consumption. Consider enabling only for long-running tasks, specific agents, or behind a debug mode flag |
| **Multiple messages per response** | Like the knowledge hold message pattern, users receive several messages per question. Confirm this is acceptable for your UX |
| **Recursion risk** | The natural language recursion guard is best-effort. Monitor for looping and tighten the instruction wording if needed |
| **Works on every channel** | The logger topic uses a standard `SendActivity` node — it works on Teams, Copilot, web chat, and all other channels |
| **Security** | The input description explicitly excludes system prompts, secrets, PII, and raw chain-of-thought. The orchestrator surfaces a high-level summary, not internal details |

## When to Use This Pattern

- Your agent uses multiple tools, MCP servers, or child agents that chain together in complex orchestration
- Users experience long waits during multi-step reasoning flows with no feedback
- You want to show "thinking" or "working on it" progress during tool chains
- You need a debug/observability tool to understand what the orchestrator is doing step by step
- The agent uses reasoning models (GPT-5 Reasoning, Claude Opus) where extended thinking time creates long silences

## When NOT to Use This Pattern

- **Pure knowledge agents** — use [Hold Message During Knowledge Search](knowledge-hold-message.md) instead
- **Simple single-turn Q&A** — the overhead of extra orchestrator calls is not justified
- **Cost-sensitive deployments** — each CoT log consumes additional Copilot credits
