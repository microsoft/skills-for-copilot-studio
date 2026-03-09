# Copilot Studio Plugin for Claude Code

A **Claude Code plugin** for Microsoft Copilot Studio YAML authoring. Create, edit, validate, and test Copilot Studio agents using YAML files — from any project directory.

## Installation

### From GitHub (recommended)

```bash
# Add the marketplace
/plugin marketplace add microsoft/skills-for-copilot-studio

# Install the plugin
/plugin install copilot-studio@microsoft/skills-for-copilot-studio
```

### From a local clone (development / testing)

```bash
# One-off session — load the plugin without installing
claude --plugin-dir /path/to/skills-for-copilot-studio

# Or install persistently (available in every project)
claude plugin install /path/to/skills-for-copilot-studio --scope user
```

Once installed, the plugin is available globally — no need to `cd` into this repo.

## Quick Start — End-to-End Example

Suppose you cloned a Copilot Studio agent to `C:\Users\you\CopilotStudio\MyAgent1`:

```bash
# 1. Start Claude Code in your agent's directory
cd C:\Users\you\CopilotStudio\MyAgent1
claude --plugin-dir C:\Users\you\ClaudeCodeProj\agents-build-agents

# 2. Ask the author agent to design and create an agent
@copilot-studio:author I need to solve this problem [...], can you please design and implement a Copilot Studio agent that does that, in this folder?

# 3. Ask the author agent to add a node to it
@copilot-studio:author Add a question node to the ReturnPolicy topic asking for the order number

# 4. After pushing & publishing in Copilot Studio, test it
@copilot-studio:test The agent has always failed responding that we have 30-days return window when asked about the return policy. I made some changes and published, can you please test?

# 5. If something is wrong, troubleshoot
@copilot-studio:troubleshoot The ReturnPolicy topic isn't triggering when I ask about it, instead I get Conversation Boosting. Why?
```

That's it. The plugin auto-discovers your agent's YAML files via `**/agent.mcs.yml`.

## Three Specialized Agents

Always interact with the plugin through its agents. Each agent has the domain context, reference material, and skills it needs to handle your request end-to-end.

| Agent | Use When | Invoke |
|-------|----------|--------|
| **author** | Building or modifying YAML files (topics, actions, knowledge, triggers, settings, nodes, child agents, global variables, generative answers, best practices) | `@copilot-studio:author` |
| **test** | Testing published agents, sending test messages, analyzing results | `@copilot-studio:test` |
| **troubleshoot** | Debugging issues — wrong topic triggered, validation errors, unexpected behavior | `@copilot-studio:troubleshoot` |

> **How it works**: You talk to the agents in natural language. Each agent has internal skills (schema lookup, YAML generation, validation, test execution, etc.) that it uses automatically — you don't need to invoke them yourself.

### Chaining agents

For multi-step workflows, Claude will chain agents automatically:

```
# Claude delegates to author, then to test
"Create a PTO topic and then test it with 'How do I request time off?'"

# Claude delegates to troubleshoot, then to author
"The greeting topic has a validation error — fix it"
```

## Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed
- [VS Code](https://code.visualstudio.com/) with the [Copilot Studio Extension](https://github.com/microsoft/vscode-copilotstudio)

## Workflow

1. **Clone** the agent with the Copilot Studio VS Code Extension into any directory
2. **Start Claude Code** in that directory with the plugin loaded
3. **Author** changes via `@copilot-studio:author`
4. **Push** changes with the VS Code Extension (creates a draft)
5. **Publish** in Copilot Studio UI (makes changes live)
6. **Test** via `@copilot-studio:test`

## Plugin Management

```bash
# Install persistently (user-wide)
claude plugin install /path/to/copilot-studio --scope user

# Install for a specific project (shared via version control)
claude plugin install /path/to/copilot-studio --scope project

# Check installed plugins
claude plugin list

# Temporarily disable without uninstalling
claude plugin disable copilot-studio

# Re-enable
claude plugin enable copilot-studio

# Uninstall
claude plugin uninstall copilot-studio
```

## Key Resources

- [SETUP_GUIDE.md](SETUP_GUIDE.md) — Detailed step-by-step setup and testing guide
- `skills/_reference/SKILL.md` — YAML reference tables (triggers, actions, variables, Power Fx)
