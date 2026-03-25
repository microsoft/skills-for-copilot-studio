# Conversation History as a Variable

Captures the full conversation history at runtime by asking the orchestrator to dump the transcript into an input variable on demand. This enables use cases like summarizing a conversation, handing context to a live agent, attaching notes to a support ticket, or passing conversation context as input to a tool.

> **Important:** Since the orchestrator reconstructs the conversation from its context window, this is a **best-effort transcript**, not a verbatim record. It is great for summarization, escalation, and contextual handoffs. For compliance-grade transcripts, use a dedicated logging solution instead.

## The Challenge

There is no official "give me the transcript" node in Copilot Studio. Common workarounds include:

- Rebuilding history turn-by-turn with variables — gets messy fast and doesn't scale
- Relying on external logging solutions — adds complexity and may not be available at runtime
- Manually copying chat content — not feasible for automated workflows

Meanwhile, many real-world scenarios need access to the conversation history at a specific point in the flow: escalation to a live agent, ticket creation, email summaries, or passing context to downstream tools.

## The Solution

Create a lightweight topic with an input variable whose **description tells the orchestrator what to provide**. The same trick used in the [Chain of Thought Logging](chain-of-thought-logging.md) pattern applies here — the orchestrator reads input variable descriptions to decide what data to pass in, so the description doubles as an instruction.

The topic can either:
- **Send the conversation history as a message** to the user (useful for debugging or user-requested transcripts)
- **Store the conversation history as a variable** to pass as input to a tool, connector, or child agent

## Implementation

### Step 1 — Create the Save Conversation History Topic

Create a new topic named **Save Conversation History** and paste the following YAML in the Code editor view. This version sends the history as a message to the user:

```yaml
kind: AdaptiveDialog
inputs:
  - kind: AutomaticTaskInput
    propertyName: ConversationHistory
    description: "Entire conversation history in the format \"User: question <br /><br /> Agent : response <br /><br /> User: Question <br /><br /> Agent: response"
    shouldPromptUser: false

modelDescription: save the conversation history
beginDialog:
  kind: OnRecognizedIntent
  id: main
  intent: {}
  actions:
    - kind: SendActivity
      id: sendActivity_gDSbH3
      activity: "Here is your saved conversation history: {Topic.ConversationHistory}"

inputType:
  properties:
    ConversationHistory:
      displayName: ConversationHistory
      description: "Entire conversation history in the format \"User: question <br /><br /> Agent : response <br /><br /> User: Question <br /><br /> Agent: response"
      type: String

outputType: {}
```

Key elements of this YAML:

| Element | Purpose |
|---|---|
| `AutomaticTaskInput` with `description` | The description tells the orchestrator to fill this variable with the full conversation history in the specified format |
| `shouldPromptUser: false` | The orchestrator provides the value automatically — the user is not prompted |
| `modelDescription: save the conversation history` | Helps the orchestrator identify when to call this topic |
| `<br /><br />` in the format | Ensures line breaks between turns when rendered in chat (see [Line Breaks in Messages](line-breaks-in-messages.md)) |

### Step 2 — Modify for Your Use Case

**To store as a variable instead of sending a message**, replace the `SendActivity` node with a `SetVariable` node that maps `Topic.ConversationHistory` to a global or topic variable. You can then pass that variable as input to a tool, connector action, or child agent.

**To customize the format**, modify the description string. The orchestrator is flexible — you can ask for:
- A summary instead of a full transcript
- Specific speaker labels or no labels
- Only the last N turns
- A structured format for downstream processing

### Step 3 — Choose a Trigger Pattern

There are two common ways to trigger this topic:

**Manual — User invokes the topic from chat**

The user says something like "save conversation history" or "show me our conversation" and the orchestrator routes to the topic via trigger phrases. Add trigger phrases to the topic if you want this behavior.

**Automatic — Called at a specific point in a flow**

At the end of a conversation, during escalation, or before ticket creation, call the topic using a **Recognize intent** node with input text like `save conversation history`. The Recognize intent node passes the text to the orchestrator, which then invokes the Save Conversation History topic.

The Recognize intent node is one of the most powerful nodes in Copilot Studio — it lets you programmatically trigger the orchestrator on demand at any point in a flow.

Example flow for automatic capture:

```
End of Conversation topic
        |
        v
SendActivity: "Ok, goodbye."
        |
        v
Recognize intent node (input: "save conversation history")
        |
        v
Orchestrator invokes Save Conversation History topic
        |
        v
ConversationHistory variable is populated
        |
        v
Pass to tool / save to Dataverse / email to user
```

## Common Use Cases

Once you've captured the transcript, you can:

- **Pass to a tool** — send `ConversationHistory` as input to an MCP server, connector action, or Power Automate flow
- **Save to Dataverse** — log the conversation against a case, ticket, or customer record
- **Email the transcript** — chain with an Outlook MCP server or Send Email connector to email the history to the user or an agent
- **Escalation handoff** — pass the conversation context to a live agent so they have full background
- **Summarization** — modify the input description to ask for a summary instead of the full history, then attach to a ticket

## Privacy and Security

Conversation transcripts can contain PII and sensitive data. When implementing this pattern:

- Ensure you have proper user consent before capturing and storing transcripts
- Only send what's needed — a summary is often sufficient and reduces PII exposure
- Use secure storage with retention policies for any persisted transcripts
- Scope permissions so only authorized apps and people can access stored transcripts
- If chaining with external tools (email, Dataverse, MCP servers), treat the full conversation history as sensitive data and design the flow accordingly

## When to Use This Pattern

- The user needs to capture conversation context for escalation to a live agent
- A downstream tool or connector requires conversation history as input
- The user wants to log conversations to Dataverse, a ticketing system, or email
- The user asks about saving, exporting, or accessing the conversation transcript at runtime
- The agent needs to pass conversational context to another agent or flow

## When NOT to Use This Pattern

- **Compliance-grade transcripts** — this is a best-effort reconstruction from the orchestrator's context window, not a verbatim audit log. Use a dedicated logging solution for compliance
- **Very long conversations** — the transcript is limited by the orchestrator's context window. For extended conversations, capture incrementally or use a summary format
