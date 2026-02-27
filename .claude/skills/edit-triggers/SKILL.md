---
description: Modify trigger phrases for Copilot Studio topics. Use when the user asks to add, remove, or change trigger phrases for a topic.
argument-hint: <topic-name>
allowed-tools: Read, Edit, Glob
---

# Edit Trigger Phrases

Add, remove, or replace trigger phrases for existing topics.

## Instructions

1. **Auto-discover the agent directory**:
   ```
   Glob: src/**/agent.mcs.yml
   ```
   NEVER hardcode an agent name.

2. **Find the target topic**:
   ```
   Glob: src/<agent-name>/topics/*.topic.mcs.yml
   ```
   If `$ARGUMENTS` specifies a topic name, match it. Otherwise, list all topics with `OnRecognizedIntent` triggers and ask which one.

3. **Read the topic file** and locate the `triggerQueries` array.

4. **Only topics with `OnRecognizedIntent` triggers have editable trigger phrases.** Other trigger types (OnConversationStart, OnUnknownIntent, etc.) are system-triggered and don't use phrases.

5. **Make the requested changes**:
   - **Add phrases**: Append new entries to `triggerQueries`
   - **Remove phrases**: Delete entries from `triggerQueries`
   - **Replace phrases**: Swap old entries for new ones
   - **Rewrite all**: Replace the entire `triggerQueries` array

6. **Use the Edit tool** to modify the file.

## Best Practices for Trigger Phrases

- Use **5-10 phrases** per topic for good recognition
- Cover **synonyms and variations** (e.g., "help", "assist", "support", "I need help")
- Include **different sentence structures** (questions, statements, keywords)
- **Avoid overlap** — don't use the same phrases in multiple topics
- Keep phrases **short and natural** (how users actually type/speak)
- Mix **formal and informal** phrasing

## Example: triggerQueries Structure

```yaml
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
