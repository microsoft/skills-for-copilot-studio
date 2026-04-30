# Deterministic MCP Server Tool Calls

Force an MCP server tool to fire reliably for a specific intent. MCP tools are generative actions — the orchestrator decides if and when to call them. Two platform limitations prevent true deterministic invocation today; this tip gives you the two available workarounds.

## Current Platform Limitations

- **No `/` syntax for MCP tools in instructions** — unlike topics and built-in actions, you cannot prefix an MCP tool name with `/` in agent instructions to force invocation
- **No MCP tool nodes in topics** — topics can call connector actions and child agents, but MCP tools are only available to the orchestrator as generative actions

Because of these, MCP tool calls are non-deterministic by default. Use Option 1 for a quick nudge, Option 2 for near-deterministic behavior.

## When to Use This Pattern

- A specific MCP tool must fire every time for a given user intent (compliance, data accuracy, business-critical workflows)
- You've observed the orchestrator skipping the tool when you need it
- You want to guarantee invocation rather than hoping the orchestrator picks the right tool

## Option 1 — Name the Tool in Agent Instructions

The simplest nudge: reference the MCP tool by name in the agent's overview instructions, mapping the intent to the tool explicitly.

### YAML Example

```yaml
settings:
  instructions: |
    ## Tool Usage Rules

    When the user asks about <specific intent>, you MUST call the
    <MCP Tool Name> tool to retrieve the answer.
    Do not attempt to answer from your own knowledge — always use the tool
    for this type of request.

    Examples of when to call <MCP Tool Name>:
    - <Example user utterance 1>
    - <Example user utterance 2>
    - <Example user utterance 3>
```

### Trade-offs

- **Pros:** no extra components, edit one instruction block to tune behavior
- **Cons:** still relies on the orchestrator interpreting instructions — not truly deterministic; may miss on ambiguous utterances, especially when many tools compete

**Use when:** the intent is broad and well-defined, and occasional misses are acceptable.

## Option 2 — Child Agent with Dedicated Intent

For near-deterministic behavior, wrap the MCP tool in a child agent whose only purpose is to call that tool. The parent routes to the child via trigger phrases; the child's narrow scope + explicit instructions force the tool call on every invocation.

### How It Works

1. Create a child agent with the MCP tool as its only generative action
2. The child's instructions require the MCP tool to be called on every request
3. Add trigger phrases (and a clear model description) so the parent orchestrator routes matching intents to the child
4. Parent orchestrator detects the intent → `BeginDialog` to the child → child calls the MCP tool deterministically

### YAML Example

**Child agent** (`agents/MyMcpChild.agent.mcs.yml`):

```yaml
kind: AgentDialog
beginDialog:
  kind: OnToolSelected
  id: main
  description: Specialized agent for <domain term> lookups — always calls the <MCP Tool Name> tool.
  intent:
    triggerQueries:
      - Look up <domain term>
      - Find <domain term>
      - What is the <domain term> for ...

settings:
  instructions: |
    You are a specialized agent that answers <specific domain> questions.

    CRITICAL: You MUST call the <MCP Tool Name> tool for EVERY request you receive.
    Never answer from your own knowledge. Always use the tool and return its results.
```

Then connect the child agent to the parent as a connected agent.

### Trade-offs

- **Pros:** most reliable approach — narrow scope + explicit instruction = consistent tool calls; intent routing is deterministic; encapsulates MCP logic cleanly
- **Cons:** extra component to maintain; one additional hop (parent → child → MCP tool); trigger phrases must not clash with other topics or agents

**Use when:** the tool must fire every time with no exceptions, and the intent is narrow enough to justify its own agent.

## Optional: Combine With Prevent-Child-Agent-Responses

If the parent should control the final response format, have the child populate output variables instead of messaging the user directly — see the [`prevent-child-agent-responses`](prevent-child-agent-responses.md) tip.

## Choosing Between Options

| | Option 1 (Instructions) | Option 2 (Child Agent) |
|---|---|---|
| **Reliability** | High but not guaranteed | Near-deterministic |
| **Complexity** | Low (edit one block) | Medium (new child + connection) |
| **Best for** | Broad intents, quick setup | Narrow intents, critical workflows |
| **Fallback risk** | Orchestrator may skip the tool | Orchestrator routes to child reliably |

Start with Option 1. If the orchestrator inconsistently invokes the tool, escalate to Option 2.
