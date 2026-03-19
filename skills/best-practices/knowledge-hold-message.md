# Hold Message During Knowledge Search

When a user asks a question that triggers a knowledge search, there can be a noticeable pause while the agent retrieves and summarizes results. This best practice sends a randomized "please hold" message to the user during that wait, creating a more natural conversational experience instead of leaving them staring at a blank screen.

## The Challenge

Knowledge searches take time — the agent must query sources, retrieve relevant content, and generate a summarized answer. During this process:

- The user sees no feedback and may think the agent is unresponsive
- The silence feels unnatural compared to a human conversation where someone would say "let me check on that"
- Users may resend their question or abandon the conversation

## The Solution

Create a custom **On Knowledge Requested** topic that fires automatically whenever the orchestrator triggers a knowledge search. The topic picks a random friendly message from a predefined list and sends it before the search runs.

The user experience becomes:

1. User asks a question
2. Agent sends a random hold message (e.g., "Let me dig into that for you...")
3. Knowledge search runs and the summarized answer follows

## Implementation

### Step 1 — Create the On Knowledge Requested Topic

In the Copilot Studio portal, create a new topic and switch to the **Code editor** view. Replace the contents with the following YAML:

```yaml
kind: AdaptiveDialog
beginDialog:
  kind: OnKnowledgeRequested
  id: main
  actions:
    - kind: SetVariable
      id: setVariable_hM7xQ2
      variable: init:Topic.HoldMessages
      value: "=Table({Value: \"Let me dig into that for you...\"}, {Value: \"One moment while I look that up!\"}, {Value: \"Searching my knowledge base now...\"}, {Value: \"Give me just a sec to find that...\"}, {Value: \"On it! Let me check my sources...\"}, {Value: \"Hang tight, I'm pulling up the details...\"}, {Value: \"Great question! Let me research that...\"}, {Value: \"Looking into that right now...\"}, {Value: \"Let me find the best answer for you...\"}, {Value: \"Just a moment while I search for that information...\"}, {Value: \"I'm on the case! One moment please...\"}, {Value: \"Allow me to look that up for you...\"}, {Value: \"Checking my resources now...\"}, {Value: \"Let me see what I can find...\"}, {Value: \"Searching for the most relevant information...\"}, {Value: \"One sec while I hunt that down...\"}, {Value: \"Let me consult my knowledge sources...\"}, {Value: \"Working on finding that answer for you...\"}, {Value: \"Hold on while I track down those details...\"}, {Value: \"Researching that as we speak...\"}, {Value: \"Let me fetch that information for you...\"}, {Value: \"Give me a moment to pull that together...\"}, {Value: \"Scanning my knowledge base for you...\"}, {Value: \"I'll have that info in just a moment...\"}, {Value: \"Diving into the details now...\"}, {Value: \"Rummaging through my notes for you...\"}, {Value: \"Let me look into that for you right away...\"}, {Value: \"Checking on that now, one moment...\"}, {Value: \"Querying my sources for the best answer...\"}, {Value: \"Let me do a quick search on that...\"}, {Value: \"Pulling up the relevant info now...\"}, {Value: \"Bear with me while I find that...\"}, {Value: \"Sifting through the knowledge base...\"}, {Value: \"Let me round up the details for you...\"}, {Value: \"Looking that up right now, hang on...\"}, {Value: \"Just a sec, I want to give you a solid answer...\"}, {Value: \"Let me see what the docs say about that...\"}, {Value: \"Gathering the relevant information...\"}, {Value: \"Almost there, just searching for the best answer...\"}, {Value: \"On the hunt for that info now...\"})"

    - kind: SetVariable
      id: setVariable_rP4kN8
      variable: init:Topic.SelectedMessage
      value: =Index(Topic.HoldMessages, RoundDown(Rand() * CountRows(Topic.HoldMessages), 0) + 1).Value

    - kind: SendActivity
      id: sendActivity_wK9mT3
      activity: "{Topic.SelectedMessage}"
```

> **Note:** The `OnKnowledgeRequested` trigger fires automatically whenever the orchestrator determines it needs to search knowledge sources. You do not need to add trigger phrases. The knowledge search itself is handled automatically by the orchestrator after this topic completes — you do not need to add a search node.

### Step 2 — Test

1. Open the **Test your agent** panel
2. Ask a question that would trigger a knowledge search
3. Verify that:
   - A random hold message appears before the answer
   - The knowledge search result follows after the hold message
   - Asking the same question multiple times produces different hold messages

## How It Works

The topic uses three nodes that execute in sequence each time a knowledge search is triggered:

**Node 1 — Load the message table (`SetVariable: Topic.HoldMessages`)**

The Power Fx `Table()` function creates an in-memory table of 40 records, each with a `Value` field containing a different hold message. This table is created fresh each time the topic fires — it uses no external data sources, connectors, or storage.

**Node 2 — Pick a random message (`SetVariable: Topic.SelectedMessage`)**

The formula `Index(Topic.HoldMessages, RoundDown(Rand() * CountRows(Topic.HoldMessages), 0) + 1).Value` does the following:
- `Rand()` generates a random decimal between 0 and 1
- Multiplying by `CountRows(Topic.HoldMessages)` (40) gives a number between 0 and 40
- `RoundDown(..., 0) + 1` converts it to an integer between 1 and 40
- `Index(...)` retrieves the message at that position in the table

**Node 3 — Send the message (`SendActivity`)**

Sends the randomly selected message to the user. After this topic completes, the orchestrator proceeds with the knowledge search and returns the summarized answer as usual.

```
User asks a question
        |
        v
Agent decides a knowledge search is needed
        |
        v
On Knowledge Requested topic fires
        |
        v
Table of 40 messages loaded into Topic.HoldMessages
        |
        v
Random index generated, message selected into Topic.SelectedMessage
        |
        v
Selected message sent to user ("Let me dig into that for you...")
        |
        v
Knowledge search runs and returns summarized answer
```

## Alternative Approaches

### Option A — Use a Single Static Message

If you don't need variety and just want a consistent hold message, simplify the topic to a single `SendActivity` node:

```yaml
    - kind: SendActivity
      id: sendActivity_wK9mT3
      activity: "One moment while I search for that information..."
```

No variables, no formulas. Every knowledge search shows the same message.

### Option B — Use an AI Prompt to Generate Messages

Replace the two `SetVariable` nodes with an AI Builder prompt node configured with instructions like:

> *"Generate a single short, friendly message (under 80 characters) telling the user you are searching for information. Be creative and vary the tone. Output only the message text, nothing else."*

Map the prompt output to `Topic.SelectedMessage` and keep the `SendActivity` node as-is. This gives unlimited variety but adds AI Builder latency and token cost.

## Adding a Delay Before the Hold Message

If you want to add a short delay (e.g., 2 seconds) before the hold message is sent:

1. Create a new **Agent Flow** with a single **Delay** action set to your desired duration
2. In the On Knowledge Requested topic, add a **Call an action** node between the random selection and the send message node
3. Point the action to your delay flow

This introduces a pause so the hold message arrives after a brief moment rather than instantly.

## Customizing the Messages

You can customize the 40 hold messages to match your organization's tone:

- **Formal/corporate:** "Please allow me a moment to locate the relevant information for you."
- **Casual/friendly:** "One sec, let me grab that for you!"
- **Brand-specific:** "Hang tight while [Agent Name] searches the knowledge base..."

To edit the messages, modify the `Table()` formula in the first `SetVariable` node. Each message is wrapped in `{Value: "your message here"}` and separated by commas.

## When to Use This Pattern

- Your agent relies heavily on knowledge search and users experience noticeable wait times
- You want a more conversational, human-like experience during knowledge retrieval
- Users are abandoning conversations or resending questions during search delays
- Your organization wants to maintain engagement during backend processing
