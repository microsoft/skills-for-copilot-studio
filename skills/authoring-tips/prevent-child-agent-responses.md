# Prevent Child Agents from Responding Directly to Users

Force a child agent (connected agent) to return data only through **output variables** instead of messaging the user directly. This lets the parent agent control all user-facing communication — formatting, filtering, or enriching the child's output before presenting it.

## When to Use This Pattern

- The parent agent needs to format or enrich the child's response before showing it to the user
- Multiple child agents contribute partial answers that the parent combines
- The parent applies business logic or filtering to the child's output
- You want a consistent tone/format across all responses, regardless of which child produced the content

## Common Misconception: The Completion Setting

The **completion setting** on a child agent does **not** control whether it messages the user. It only determines what the **parent** does after the child finishes (continue, end, or return to the calling topic). Setting completion behavior will not silence the child during execution — explicit instructions are required.

## How It Works

1. Define `outputType` properties on the child agent to carry its response back to the parent
2. Add an explicit "do not message" block to the child's `instructions` that forbids `SendMessageTool`
3. In the parent, read the output variables after `BeginDialog` and craft the user-facing response yourself

## YAML Example

**Child agent** (`agents/MyChildAgent.agent.mcs.yml`):

```yaml
kind: AgentDialog
beginDialog:
  kind: OnToolSelected
  id: main
  description: Handles <specialization area> — returns structured data only.

settings:
  instructions: |
    You are a specialist assistant that handles <specialization area>.

    CRITICAL - DO NOT MESSAGE USERS
    - DO NOT respond directly to the user
    - DO NOT call SendMessageTool or send any messages
    - ONLY populate the output variables with your response
    - Let the parent orchestrator deliver the response to the user

outputType:
  properties:
    AgentOutput:
      displayName: Agent Output
      description: Structured response for the parent to format and deliver.
      type: String
```

**Parent topic** — read the output variable after calling the child:

```yaml
- kind: BeginDialog
  id: callChild
  dialog: cat_MyBot.agent.MyChildAgent
  output:
    binding:
      AgentOutput: Topic.ChildResult

- kind: SendActivity
  id: formatAndSend
  activity: "Here's what I found: {Topic.ChildResult}"
```

## Key Points

- **Instructions, not settings, are what silence the child** — the orchestrator respects the child's system instructions and will choose output variables over `SendMessageTool` when explicitly forbidden
- **Output variables are required** — without them the child has nowhere to put its response; define at least one `outputType` property
- **Bind outputs in the parent's `BeginDialog`** — use the `output.binding` map to pull child output into a parent topic variable
- **Parent owns the final message** — use `SendActivity` (or an Adaptive Card) in the parent to deliver the formatted response
