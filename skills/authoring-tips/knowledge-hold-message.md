# Hold Message During Knowledge Search

Send a randomized "please hold" message during knowledge search so the user gets immediate feedback instead of staring at a silent screen while the orchestrator retrieves and summarizes results. Works on all channels (Teams, Copilot, web chat, custom) — the `OnKnowledgeRequested` trigger fires regardless of channel.

## When to Use This Pattern

- Your agent relies heavily on knowledge search and users experience noticeable wait times
- You want a more conversational, human-like experience during knowledge retrieval
- Users are abandoning conversations or resending questions during search delays
- The model or channel doesn't support streaming — the user has no visual cue that work is happening

## Trade-off: Two Messages per Response

This pattern sends an **additional** message before the knowledge answer — users get two messages per question (hold + answer). Some organizations may dislike this chattiness. Confirm with stakeholders that the perceived-latency win is worth the extra message before rolling out.

## How It Works

1. A custom `OnKnowledgeRequested` topic fires automatically when the orchestrator decides to search knowledge
2. A Power Fx `Table()` of ~40 hold messages is built inline (no external storage, no connector calls — runs in milliseconds)
3. `Rand()` + `Index()` picks a random row
4. `SendActivity` sends the chosen message
5. The orchestrator then proceeds with its usual knowledge search and summarization

## YAML Example

Create a new topic and paste into the Code editor view:

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

> **Note:** `OnKnowledgeRequested` fires automatically when the orchestrator needs to search — no trigger phrases needed. You also do not add a search node; the orchestrator handles the search itself after this topic completes.

## Alternative: Single Static Message

If variety doesn't matter, strip the table and random-index logic and send one fixed string:

```yaml
- kind: SendActivity
  id: sendActivity_wK9mT3
  activity: "One moment while I search for that information..."
```

## Key Points

- **Do not use an AI Builder prompt to generate messages** — the topic runs sequentially before the search, and an AI prompt adds ~4–6s of real latency on top of a ~7s search (nearly 80% slower). This defeats the purpose
- **Customize the 40 messages** to match your brand tone — just edit the entries inside the `Table(...)` formula
- **Channel-scoped hold message** — to show it only on specific channels (e.g., Teams), wrap the `SendActivity` in a `ConditionGroup` that checks `System.Activity.ChannelId`
- **Optional delay** — to pause briefly before the hold message, build a tiny Agent Flow with a `Delay` action and call it between the random selection and the `SendActivity` node
