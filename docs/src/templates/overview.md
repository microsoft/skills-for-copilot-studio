---
sidebar_position: 1
title: YAML Templates
---

# YAML Templates

The plugin includes a library of YAML templates for common Copilot Studio patterns. These templates are used by the [author agent](../agents/author.md) when creating new content.

## Available Templates

### Topic Templates

| Template | File | Description |
|----------|------|-------------|
| Greeting | `greeting.topic.mcs.yml` | Welcome message topic with common greetings |
| Fallback | `fallback.topic.mcs.yml` | Default fallback for unrecognized utterances |
| Error Handler | `error-handler.topic.mcs.yml` | Error handling topic |
| Conversation Init | `conversation-init.topic.mcs.yml` | Conversation initialization |
| Disambiguation | `disambiguation.topic.mcs.yml` | Topic disambiguation when multiple matches occur |
| Question Topic | `question-topic.topic.mcs.yml` | Topic with a question node for collecting user input |
| Search Topic | `search-topic.topic.mcs.yml` | Topic with search and summarize for grounded answers |
| Custom Knowledge | `custom-knowledge-source.topic.mcs.yml` | Topic with custom knowledge source configuration |
| Remove Citations | `remove-citations.topic.mcs.yml` | Topic that strips citation markers from responses |
| Arithmetic Sum | `arithmeticsum.topic.mcs.yml` | Example topic demonstrating Power Fx expressions |
| Auth Topic | `auth-topic.topic.mcs.yml` | Topic with authentication flow |

### Template Categories

Templates are organized by functional area:

- **`templates/topics/`** -- Topic YAML templates
- **`templates/actions/`** -- Action templates
- **`templates/agents/`** -- Agent configuration templates
- **`templates/knowledge/`** -- Knowledge source templates
- **`templates/variables/`** -- Variable definition templates

## Using Templates

Templates are used automatically by the author agent when creating new content. You do not need to reference them directly -- the agent selects the appropriate template based on your request.

For example:

```
/copilot-studio:author Create a greeting topic
```

The agent uses the `greeting.topic.mcs.yml` template as a base, customizes it for your agent, generates unique IDs, and saves the result.

## Template Structure

Each topic template follows this general structure:

```yaml
kind: AdaptiveDialog
modelDescription: Description of what the topic does
beginDialog:
  kind: OnRecognizedIntent
  intent:
    triggerQueries:
      - trigger phrase 1
      - trigger phrase 2
  actions:
    - kind: SendActivity
      activity:
        text:
          - Response text
```

Templates use placeholder values that the author agent replaces with context-specific content.
