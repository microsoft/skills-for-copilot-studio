---
sidebar_position: 2
title: Authoring Skills
---

# Authoring Skills

Authoring skills create and modify Copilot Studio YAML files. They are the primary tools used by the [author agent](../agents/author.md).

## new-topic

Creates a new topic YAML file with valid structure, unique node IDs, and proper schema compliance.

**Usage:**
```
/copilot-studio:author Create a new topic called "Product Information"
```

**What it does:**
- Generates a complete topic YAML file
- Creates unique node IDs
- Sets up trigger phrases
- Saves to the `topics/` directory
- Validates against the schema

## add-node

Adds or modifies a node within an existing topic.

**Usage:**
```
/copilot-studio:author Add a question node to the IT request topic
```

**Supported node types:** Message, Question, Condition, Action, Redirect, GoTo, SetVariable, and more. Use `/copilot-studio:list-kinds` to see all valid node kinds.

## add-action

Adds a connector action to a topic (Teams, Outlook, SharePoint, Dataverse, etc.).

**Usage:**
```
/copilot-studio:author Add a Teams notification action to the alert topic
```

## edit-action

Modifies an existing connector action configuration.

**Usage:**
```
/copilot-studio:author Update the Outlook action to include CC recipients
```

## add-knowledge

Adds a knowledge source for grounded responses. Copilot Studio automatically queries knowledge sources -- no additional topic with `SearchAndSummarizeContent` is needed for basic scenarios.

**Usage:**
```
/copilot-studio:author Add a knowledge source pointing to https://contoso.com/docs
```

## add-generative-answers

Adds a `SearchAndSummarizeContent` node for explicit control over generative answers. Use this only when you need to manipulate the query sent to the RAG engine.

**Usage:**
```
/copilot-studio:author Add generative answers with a custom search query to the FAQ topic
```

## add-other-agents

Adds child agents or connected agent references.

**Usage:**
```
/copilot-studio:author Add the HR bot as a connected agent
```

## add-global-variable

Creates a global variable accessible across topics.

**Usage:**
```
/copilot-studio:author Add a global variable called "UserDepartment" of type string
```

## edit-agent

Modifies agent-level settings and instructions.

**Usage:**
```
/copilot-studio:author Update the agent instructions to always respond in formal English
```

## edit-triggers

Modifies trigger phrases or the model description for a topic.

**Usage:**
```
/copilot-studio:author Add "billing inquiry" and "invoice question" as triggers for the billing topic
```

## add-adaptive-card

Adds an adaptive card to a topic response.

**Usage:**
```
/copilot-studio:author Add an adaptive card showing order status with tracking number and delivery date
```
