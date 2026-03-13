# Prevent Child Agents from Responding Directly to Users

When using child agents (connected agents), you may want the **parent agent** to control all communication with the user, while the child agent only returns data via output variables. This is a common requirement for orchestration patterns where the parent formats, filters, or enriches the child's output before presenting it.

## Common Misconception: The Completion Setting

The **completion setting** on a child agent is frequently misunderstood. It does **not** control whether the child agent sends messages to the user. It only determines what the **parent agent should do after the child agent finishes** (e.g., continue the conversation, end it, or return to the calling topic).

Setting the completion behavior will not prevent the child agent from sending messages directly to the user during execution.

## How to Prevent Direct Responses

To stop a child agent from messaging the user, you must include explicit instructions in the **child agent's system instructions** that prohibit it from using the message tool. Add the following to the child agent's instructions:

```
CRITICAL - DO NOT MESSAGE USERS
- DO NOT respond directly to the user
- DO NOT call SendMessageTool or send any messages
- ONLY populate the output variables with your response
- Let the parent orchestrator deliver the response to the user
```

## Why This Works

The child agent's orchestrator respects its system instructions. By explicitly forbidding `SendMessageTool` usage, the agent will place its response into the designated output variables instead of sending messages. The parent agent then reads those output variables and decides how to present the information to the user.

## Implementation Steps

1. **Define output variables on the child agent** — create the output variables (e.g., `AgentOutput`) that will carry the child's response back to the parent
2. **Add the no-messaging instructions** — paste the instruction block above into the child agent's instructions field
3. **Read output variables in the parent** — after the `BeginDialog` call to the child agent, use the returned output variables to craft the response in the parent agent's flow

## When to Use This Pattern

- The parent agent needs to format or enrich the child's response before showing it to the user
- Multiple child agents contribute partial answers that the parent combines
- The parent agent applies business logic or filtering to the child's output
- You want a consistent tone/format across all responses, regardless of which child agent produced the content
