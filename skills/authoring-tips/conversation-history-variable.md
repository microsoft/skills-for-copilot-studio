# Conversation History as a Variable

Capture the full conversation transcript at runtime by asking the orchestrator to dump it into a topic variable on demand. Enables summarization, live-agent handoff, ticket attachments, emailing a recap, or passing context to a downstream tool — all without rebuilding history turn-by-turn.

> **Important:** This is a **best-effort transcript** reconstructed from the orchestrator's context window, not a verbatim record. Great for summarization, escalation, and contextual handoffs. For compliance-grade audit logs, use a dedicated logging solution.

## When to Use This Pattern

- The user needs to capture conversation context for escalation to a live agent
- A downstream tool or connector requires conversation history as input
- The user wants to log conversations to Dataverse, a ticketing system, or email
- The agent needs to pass conversational context to another agent or flow

## When NOT to Use

- **Compliance-grade transcripts** — use a dedicated logging solution; this is not verbatim
- **Very long conversations** — the transcript is bounded by the orchestrator's context window; capture incrementally or use a summary format

## How It Works

The orchestrator reads an input variable's `description` to decide what data to pass in — the same trick used in the [Chain of Thought Logging](chain-of-thought-logging.md) tip. The description tells the model "fill this with the full conversation in this format." The topic can either send the transcript as a message (useful for debugging or user-requested dumps) or store it as a variable to pass downstream.

## YAML Example

Create a topic named **Save Conversation History** and paste into the Code editor view. This version sends the history as a message:

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

## Variations

**Store as a variable instead of sending** — replace the `SendActivity` with a `SetVariable` that writes `Topic.ConversationHistory` to a global (or topic) variable. Pass that variable as input to a connector action, MCP server, or child agent.

**Customize the format** — edit the `description` string. The orchestrator is flexible; ask for:
- A summary instead of a full transcript
- Specific speaker labels (or none)
- Only the last N turns
- A structured format for downstream processing (JSON-like, key/value, etc.)

## Trigger Patterns

- **Manual** — user types "save conversation history" or similar and the orchestrator routes via trigger phrases
- **Automatic** — at end-of-conversation, escalation, or before ticket creation, call the topic with a **Recognize intent** node whose input text is `save conversation history`. The Recognize intent node programmatically invokes the orchestrator at any point in a flow

## Key Points

| Element | Purpose |
|---|---|
| `AutomaticTaskInput.description` | Instructs the orchestrator what to write into the variable (format + content) |
| `shouldPromptUser: false` | Orchestrator fills the value automatically — no user prompt |
| `modelDescription` | Helps the orchestrator identify when to call this topic |
| `<br /><br />` in the format string | Produces line breaks between turns when rendered in chat (see [Line Breaks in Messages](line-breaks-in-messages.md)) |

## Privacy and Security

Transcripts can contain PII. When implementing:

- Ensure you have proper user consent before capturing and storing transcripts
- Send only what's needed — a summary is often sufficient and reduces PII exposure
- Use secure storage with retention policies for anything persisted
- Scope permissions so only authorized apps/people can access stored transcripts
- When chaining to external tools (email, Dataverse, MCP), treat the full transcript as sensitive data
