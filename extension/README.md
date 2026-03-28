---
title: Copilot Studio Skills
description: "Copilot Studio YAML authoring, testing, and management skills for GitHub Copilot Chat"
---

## Copilot Studio Skills for GitHub Copilot

Author, test, troubleshoot, and manage [Microsoft Copilot Studio](https://aka.ms/CopilotStudio) agents directly from VS Code using GitHub Copilot Chat.

This extension provides **4 specialized agents** and **24 skills** that enable YAML-based authoring of Copilot Studio agents without leaving your editor.

## Features

### Agents

Use these agents in Copilot Chat to get specialized help:

* **Copilot Studio Author** — Create and edit topics, actions, knowledge sources, child agents, and global variables
* **Copilot Studio Manage** — Clone, push, pull, and sync agent content between local YAML files and the Power Platform cloud
* **Copilot Studio Test** — Test published agents with point-tests, batch test suites, DirectLine, or evaluation analysis
* **Copilot Studio Troubleshoot** — Debug issues including wrong topic routing, validation errors, and unexpected behavior

### Skills

The extension includes 24 skills covering the full agent development lifecycle:

| Category | Skills |
|----------|--------|
| **Authoring** | new-topic, add-action, add-node, add-knowledge, add-adaptive-card, add-generative-answers, add-global-variable, add-other-agents |
| **Editing** | edit-agent, edit-action, edit-triggers |
| **Validation** | validate, lookup-schema, list-kinds, list-topics |
| **Testing** | chat-with-agent, directline-chat, run-tests |
| **Management** | manage-agent, clone-agent |
| **Best practices** | best-practices (JIT glossary, user context, topic redirects, orchestrator patterns) |
| **Troubleshooting** | known-issues |

## Prerequisites

* [VS Code](https://code.visualstudio.com/) 1.106.1 or later
* [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) extension
* [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat) extension
* [Copilot Studio VS Code Extension](https://marketplace.visualstudio.com/items?itemName=ms-copilotstudio.vscode-copilotstudio) (required for push/pull/clone operations)
* [Node.js](https://nodejs.org/) 22+

## Quick start

1. Install the extension
2. Open a workspace containing a Copilot Studio agent (or clone one using the Manage agent)
3. Open Copilot Chat and ask a question about your agent

```text
@copilot-studio-author Create a topic that handles IT service requests
@copilot-studio-manage Clone an agent from my environment
@copilot-studio-test Send "How do I request a new laptop?" to the published agent
@copilot-studio-troubleshoot The agent is not using data from our knowledge base
```

## Disclaimer

This extension is an experimental research project, not an officially supported Microsoft product. The Copilot Studio YAML schema may change without notice. Always review and validate generated YAML before pushing to your environment.

## License

[MIT](LICENSE)
