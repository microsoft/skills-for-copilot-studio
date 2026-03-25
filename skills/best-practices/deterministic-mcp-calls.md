# Deterministic MCP Server Tool Calls

When you need an MCP server tool to be called reliably for a specific intent — not left to the orchestrator's discretion — you must work around current platform limitations. This best practice covers two approaches for ensuring MCP tools fire deterministically.

## Current Limitations

Copilot Studio does not yet support deterministic MCP tool invocation through the standard mechanisms you might expect:

1. **No `/` syntax in instructions** — MCS does not currently support using the `/` prefix to directly call an MCP server or action from within the agent instructions. Unlike topics or built-in actions, MCP tools cannot be invoked by name with a slash command in the instruction block.
2. **No MCP tool nodes in topics** — You cannot add MCP server tools as action nodes within topic flows. Topics can call connector actions and child agents, but MCP tools are only available to the orchestrator as generative actions — meaning the orchestrator decides if and when to call them.

Because of these limitations, MCP tool calls are non-deterministic by default — the orchestrator may or may not invoke them depending on its interpretation of the user's intent. If your scenario requires a specific MCP tool to fire every time for a given intent, use one of the options below.

## Option 1: Name the Tool in Plain Text in Agent Instructions

The simplest approach is to explicitly reference the MCP tool by name in the agent's overview instructions, telling the orchestrator when it must be used.

### How It Works

Add a clear directive in the agent instructions that maps a user intent to the specific MCP tool. The orchestrator reads these instructions on every turn and will follow explicit tool-use directives.

### Implementation

In your agent's instructions, add a section like:

```yaml
instructions: |
  ## Tool Usage Rules

  When the user asks about [specific intent], you MUST call the [MCP Tool Name] tool to retrieve the answer.
  Do not attempt to answer from your own knowledge — always use the tool for this type of request.

  Examples of when to call [MCP Tool Name]:
  - [Example user utterance 1]
  - [Example user utterance 2]
  - [Example user utterance 3]
```

### Pros and Cons

**Pros:**
- Simple to implement — no additional components needed
- Works within the existing agent without architectural changes
- Easy to update the trigger criteria by editing instructions

**Cons:**
- Still relies on the orchestrator interpreting the instructions correctly — not truly deterministic
- May not fire consistently for ambiguous or edge-case utterances
- Harder to enforce when the agent has many tools and the orchestrator must choose between them

### When to Use

- The MCP tool maps to a broad, well-defined intent that the orchestrator can reliably identify
- You need a quick solution without adding child agents
- The tool should fire for most requests matching the intent, but occasional misses are acceptable

## Option 2: Child Agent with Dedicated Intent

For truly deterministic behavior, wrap the MCP tool in a child agent that has a specific trigger intent. The parent agent routes to the child agent based on the intent, and the child agent always calls the MCP tool as part of its execution.

### How It Works

1. Create a **child agent** with the MCP tool added as a generative action
2. The child agent's instructions explicitly require it to call the MCP tool for every request it receives
3. Connect the child agent to the parent agent with **trigger phrases** that match the target intent
4. When the parent orchestrator detects the intent, it routes to the child agent via `BeginDialog`, which then deterministically calls the MCP tool

Because the child agent has a narrow scope (only the one MCP tool) and explicit instructions to always use it, the orchestrator within the child agent will reliably call the tool on every invocation.

### Implementation

**Step 1 — Create the child agent**

Create a child agent with the MCP tool as its only generative action. In the child agent's instructions, require the tool to be called:

```yaml
instructions: |
  You are a specialized agent that answers [specific domain] questions.

  CRITICAL: You MUST call the [MCP Tool Name] tool for EVERY request you receive.
  Never answer from your own knowledge. Always use the tool and return its results.
```

**Step 2 — Add trigger phrases to the child agent**

Configure the child agent with trigger phrases that match the target intent so the parent orchestrator knows when to route to it:

```
- "Look up [domain term]"
- "Find [domain term]"
- "What is the [domain term] for..."
- "[Other common utterances for this intent]"
```

**Step 3 — Connect the child agent to the parent**

Add the child agent as a connected agent in the parent. The parent orchestrator will route matching intents to the child agent automatically based on the trigger phrases and model description.

**Step 4 — (Optional) Control response delivery**

If you want the parent agent to control how the response is presented to the user, follow the [Prevent Child Agent Responses](prevent-child-agent-responses.md) best practice — have the child agent populate output variables instead of messaging the user directly.

### Pros and Cons

**Pros:**
- Most reliable approach — the child agent has a single purpose and always calls the tool
- Intent routing through trigger phrases is deterministic
- Clean separation of concerns — the MCP tool logic is encapsulated in the child agent
- Can combine with output variable patterns for full control over response formatting

**Cons:**
- More components to build and maintain (child agent + connection)
- Adds a hop in the conversation flow (parent -> child -> MCP tool)
- Requires managing trigger phrases to avoid intent conflicts with other topics or agents

### When to Use

- The MCP tool must fire every time for a specific intent — no exceptions
- Option 1 is not reliable enough because the orchestrator sometimes skips the tool
- You need to guarantee tool invocation for compliance, data accuracy, or business-critical workflows
- The intent is narrow and well-defined, making it a good candidate for a dedicated child agent

## Choosing Between Options

| Consideration | Option 1 (Instructions) | Option 2 (Child Agent) |
|---|---|---|
| **Reliability** | High but not guaranteed | Near-deterministic |
| **Complexity** | Low — edit instructions only | Medium — new child agent + connection |
| **Best for** | Broad intents, quick setup | Critical workflows, narrow intents |
| **Maintenance** | Edit one instruction block | Manage child agent + trigger phrases |
| **Fallback risk** | Orchestrator may skip the tool | Orchestrator routes to child reliably |

Start with **Option 1** for simplicity. If you observe the orchestrator inconsistently calling the tool, escalate to **Option 2** with a dedicated child agent.
