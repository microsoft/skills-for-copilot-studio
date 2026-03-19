---
user-invocable: false
description: Modify topic triggers — trigger phrases and model description. Use when the user asks to add, remove, or change trigger phrases, or edit a topic's model description.
argument-hint: <topic-name>
allowed-tools: Read, Edit, Glob
context: fork
agent: copilot-studio-author
---

# Edit Topic Triggers

Modify how a topic gets triggered: **trigger phrases** (`triggerQueries`) and **model description** (`modelDescription`).

## Instructions

1. **Auto-discover the agent directory**:
   ```
   Glob: **/agent.mcs.yml
   ```
   NEVER hardcode an agent name.

2. **Find the target topic**:
   ```
   Glob: <agent-dir>/topics/*.topic.mcs.yml
   ```
   If `$ARGUMENTS` specifies a topic name, match it. Otherwise, list all topics and ask which one.

3. **Read the topic file** and identify what to change.

4. **Check the agent's settings.mcs.yml** for `GenerativeActionsEnabled`. This determines which trigger mechanism matters most.

5. **Make the requested changes** using the Edit tool.

## Model Description (`modelDescription`)

The `modelDescription` is a natural language description at the root of an `AdaptiveDialog` that tells the generative orchestrator **when to route to this topic**. When `GenerativeActionsEnabled: true`, this is the **primary way the agent decides which topic to trigger** — even more important than trigger phrases.

```yaml
kind: AdaptiveDialog
modelDescription: This topic helps users order a pizza by collecting their preferred size, toppings, and delivery address.
beginDialog:
  kind: OnRecognizedIntent
  id: main
  ...
```

### Best Practices for Model Description

- Write a **clear, specific sentence** describing what the topic does and when it should be used
- Focus on the **user's intent**: "Use this topic when the user asks for information about our perfumes" rather than "This topic sends a message"
- Include **key scenarios** the topic covers: "This topic handles billing inquiries, refund requests, and payment issues"
- Keep it **concise but complete** — the orchestrator reads this to decide routing
- Avoid vague descriptions like "This topic handles requests" — be specific about *which* requests

### Examples from Real Topics

```yaml
# Good — specific about what the topic does and when to use it
modelDescription: Use this topic when the user asks for help or needs assistance with something. Search the SharePoint knowledge base to find relevant information.

# Good — describes the full flow
modelDescription: This topic takes the user's favorite color, generates a word by concatenating the color with four random digits, and returns the generated word. If the color is white, it also provides information about the wavelength.

# Good — describes the computation
modelDescription: This sample topic performs the sum between the two numbers in input
```

### When to Add/Edit Model Description

- **Always add** a `modelDescription` to topics with `OnRecognizedIntent` when the agent has `GenerativeActionsEnabled: true`
- **Update it** when the topic's purpose or scope changes
- Topics with system triggers (OnError, OnUnknownIntent, OnConversationStart) don't need a `modelDescription` — they're triggered automatically

## Trigger Phrases (`triggerQueries`)

Trigger phrases are used for intent recognition. They live inside `beginDialog.intent.triggerQueries`.

**Only topics with `OnRecognizedIntent` triggers have editable trigger phrases.** Other trigger types (OnConversationStart, OnUnknownIntent, etc.) are system-triggered and don't use phrases.

### Operations

- **Add phrases**: Append new entries to `triggerQueries`
- **Remove phrases**: Delete entries from `triggerQueries`
- **Replace phrases**: Swap old entries for new ones
- **Rewrite all**: Replace the entire `triggerQueries` array

### Best Practices for Trigger Phrases

- Use **5-10 phrases** per topic for good recognition
- Cover **synonyms and variations** (e.g., "help", "assist", "support", "I need help")
- Include **different sentence structures** (questions, statements, keywords)
- **Avoid overlap** — don't use the same phrases in multiple topics
- Keep phrases **short and natural** (how users actually type/speak)
- Mix **formal and informal** phrasing

### Example Structure

```yaml
kind: AdaptiveDialog
modelDescription: This topic helps users with greeting and introduction.
beginDialog:
  kind: OnRecognizedIntent
  id: main
  intent:
    displayName: Greeting
    triggerQueries:
      - Hello
      - Hi
      - Hey
      - Good morning
      - Good afternoon
```

## What This Skill Cannot Do

- Cannot change the trigger **type** (e.g., from OnRecognizedIntent to OnConversationStart) — this requires recreating the topic.
- Cannot add triggers to system topics that don't use OnRecognizedIntent.
