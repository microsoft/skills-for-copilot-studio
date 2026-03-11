---
sidebar_position: 2
title: YAML Schema Reference
---

# YAML Schema Reference

The plugin validates all YAML output against the official Copilot Studio authoring schema (`bot.schema.yaml-authoring.json`). This page documents the schema structure and key definitions.

## Schema Location

The schema file is located at:

```
reference/bot.schema.yaml-authoring.json
```

## Looking Up Definitions

Use the schema lookup skill to find specific definitions:

```
/copilot-studio:troubleshoot Look up the schema for SendActivity
```

Or list all valid kind values:

```
/copilot-studio:author What node kinds are available?
```

## Core Concepts

### Kinds

Every YAML node has a `kind` field that determines its type. Valid kinds include:

- **AdaptiveDialog** -- Top-level topic container
- **OnRecognizedIntent** -- Trigger for intent-based topics
- **OnUnknownIntent** -- Fallback trigger
- **OnConversationStart** -- Conversation initialization trigger
- **SendActivity** -- Send a message to the user
- **Question** -- Ask the user a question
- **ConditionGroup** -- Conditional branching
- **SetVariable** -- Set a variable value
- **HttpRequest** -- Make an HTTP request
- **SearchAndSummarizeContent** -- Generative answers with RAG
- **RedirectToTopic** -- Redirect to another topic
- **EndConversation** -- End the current conversation

Use `/copilot-studio:list-kinds` for the complete list.

### Topic Structure

A typical topic YAML file:

```yaml
kind: AdaptiveDialog
modelDescription: Handles IT service requests
beginDialog:
  kind: OnRecognizedIntent
  id: main
  intent:
    triggerQueries:
      - I need IT help
      - IT service request
      - computer problem
  actions:
    - kind: SendActivity
      id: sendMsg1
      activity:
        text:
          - I can help with IT service requests. What do you need?
    - kind: Question
      id: question1
      interruptionPolicy:
        allowInterruption: true
      variable: init.issueType
      prompt: What type of issue are you experiencing?
      entity:
        kind: EmbeddedEntity
        definition:
          kind: ClosedListEntity
          items:
            - id: hardware
              displayName: Hardware
            - id: software
              displayName: Software
            - id: network
              displayName: Network
```

### Node IDs

Every node in a topic must have a unique `id` field. The plugin generates unique IDs automatically when creating content. Duplicate IDs cause errors on push.

### Power Fx Expressions

Power Fx expressions in YAML must be prefixed with `=`:

```yaml
- kind: SetVariable
  id: setVar1
  variable: Topic.fullName
  value: =Concatenate(Topic.firstName, " ", Topic.lastName)
```

### Variables

Variables are scoped to either the topic (`Topic.varName`) or the entire agent (`Global.varName`):

```yaml
# Topic-scoped variable
variable: Topic.userChoice

# Global variable
variable: Global.UserDepartment
```

## Adaptive Card Schema

Adaptive cards follow the [Adaptive Cards schema](https://adaptivecards.io/explorer/). The plugin includes the schema at:

```
reference/adaptive-card.schema.json
```

## Connector Definitions

Connector definitions for actions (Teams, Outlook, SharePoint, etc.) are in:

```
reference/connectors/
```

## Validation

All validation is performed by the `/copilot-studio:validate` skill, which checks YAML files against these schemas. Validation runs automatically after any authoring operation and can be invoked directly via the troubleshoot agent.
