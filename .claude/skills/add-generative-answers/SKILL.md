---
description: Add generative answer nodes (SearchAndSummarizeContent) to a Copilot Studio topic. Use when the user asks to add grounded answers, knowledge search, or generative answers to a topic.
argument-hint: <topic-name or "new">
allowed-tools: Bash(python *), Read, Write, Edit, Glob
---

# Add Generative Answers

Add `SearchAndSummarizeContent` nodes to generate responses grounded in the agent's knowledge sources.

## Instructions

1. **Auto-discover the agent directory**:
   ```
   Glob: src/**/agent.mcs.yml
   ```
   NEVER hardcode an agent name.

2. **Determine the approach**:
   - **Add to existing topic**: Read the target topic and insert a SearchAndSummarizeContent node
   - **Create new search topic**: Generate a complete topic with the search pattern

3. **Look up the schema**:
   ```bash
   python scripts/schema-lookup.py resolve SearchAndSummarizeContent
   ```

4. **Use the proven pattern** from the agent's Search topic:

```yaml
kind: AdaptiveDialog
beginDialog:
  kind: OnUnknownIntent
  id: main
  priority: -1
  actions:
    - kind: SearchAndSummarizeContent
      id: search-content_<random>
      variable: Topic.Answer
      userInput: =System.Activity.Text

    - kind: ConditionGroup
      id: conditionGroup_<random>
      conditions:
        - id: conditionItem_<random>
          condition: =!IsBlank(Topic.Answer)
          actions:
            - kind: EndDialog
              id: endDialog_<random>
              clearTopicQueue: true
```

5. **Always include the ConditionGroup follow-up** to check if an answer was found. This is critical — without it, the topic can't gracefully handle cases where no knowledge matches.

6. **Generate unique IDs** for all nodes (format: `<nodeType>_<6-8 random alphanumeric>`).

## SearchAndSummarizeContent vs AnswerQuestionWithAI

| Node | Use When | Data Source |
|------|----------|-------------|
| `SearchAndSummarizeContent` | You want answers grounded in the agent's knowledge sources (websites, SharePoint, Dataverse) | Agent's configured knowledge |
| `AnswerQuestionWithAI` | You want a response based only on conversation history and general model knowledge | No external data |

**Use `SearchAndSummarizeContent`** for the vast majority of cases (what people call "generative answers"). Use `AnswerQuestionWithAI` only when you explicitly want the model to respond without consulting knowledge sources.

## Pattern: Add Search to Existing Topic

When adding to an existing topic (not creating a new one), insert this block into the actions array:

```yaml
- kind: SearchAndSummarizeContent
  id: search-content_<random>
  variable: Topic.Answer
  userInput: =System.Activity.Text

- kind: ConditionGroup
  id: conditionGroup_<random>
  conditions:
    - id: conditionItem_<random>
      condition: =!IsBlank(Topic.Answer)
      actions:
        - kind: EndDialog
          id: endDialog_<random>
          clearTopicQueue: true
```

## Pattern: Standalone Search Topic (Fallback)

For a standalone search topic that acts as a fallback (tries knowledge before giving up):

```yaml
# Name: Knowledge Search
kind: AdaptiveDialog
beginDialog:
  kind: OnUnknownIntent
  id: main
  priority: -1
  actions:
    - kind: SearchAndSummarizeContent
      id: search-content_<random>
      variable: Topic.Answer
      userInput: =System.Activity.Text

    - kind: ConditionGroup
      id: conditionGroup_<random>
      conditions:
        - id: conditionItem_<random>
          condition: =!IsBlank(Topic.Answer)
          actions:
            - kind: EndDialog
              id: endDialog_<random>
              clearTopicQueue: true
```

The `priority: -1` ensures this runs before the standard fallback, giving knowledge sources a chance to answer before the "I don't understand" message.
