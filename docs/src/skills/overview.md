---
sidebar_position: 1
title: Skills Overview
---

# Skills Overview

Skills are the building blocks of the plugin. Each skill is a focused, purpose-built tool that handles a specific task. The three agents (author, test, troubleshoot) delegate to skills rather than performing tasks manually.

## All Skills

| Skill | Category | Description |
|-------|----------|-------------|
| `/copilot-studio:new-topic` | Authoring | Create a new topic from scratch |
| `/copilot-studio:add-node` | Authoring | Add or modify a node in an existing topic |
| `/copilot-studio:add-action` | Authoring | Add a connector action (Teams, Outlook, etc.) |
| `/copilot-studio:edit-action` | Authoring | Edit an existing connector action |
| `/copilot-studio:add-knowledge` | Authoring | Add a knowledge source |
| `/copilot-studio:add-generative-answers` | Authoring | Add SearchAndSummarize generative answers |
| `/copilot-studio:add-other-agents` | Authoring | Add child or connected agents |
| `/copilot-studio:add-global-variable` | Authoring | Add a global variable |
| `/copilot-studio:edit-agent` | Authoring | Edit agent settings or instructions |
| `/copilot-studio:edit-triggers` | Authoring | Modify trigger phrases or model description |
| `/copilot-studio:add-adaptive-card` | Authoring | Add an adaptive card to a topic |
| `/copilot-studio:chat-with-agent` | Testing | Send a test message to a published agent |
| `/copilot-studio:run-tests` | Testing | Run batch test suites or analyze evaluations |
| `/copilot-studio:validate` | Utility | Validate a YAML file against the schema |
| `/copilot-studio:lookup-schema` | Utility | Look up a specific schema definition |
| `/copilot-studio:list-kinds` | Utility | List all valid kind values |
| `/copilot-studio:list-topics` | Utility | List all topics in the agent |
| `/copilot-studio:known-issues` | Utility | Search known issues for a symptom or error |
| `/copilot-studio:best-practices` | Utility | Get best practices, glossary, and user context |

## Skill Categories

### Authoring Skills

Skills that create or modify YAML content. Used primarily by the [author agent](../agents/author.md). See [Authoring Skills](./authoring.md) for details.

### Testing Skills

Skills that interact with published agents or test infrastructure. Used primarily by the [test agent](../agents/test.md). See [Testing Skills](./testing.md) for details.

### Utility Skills

Skills that validate, inspect, or provide reference information. Used by all three agents. See [Utility Skills](./utilities.md) for details.
