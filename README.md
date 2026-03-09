# Skills for Copilot Studio

A plugin for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and [GitHub Copilot CLI](https://docs.github.com/en/copilot) that enables authoring, testing, and troubleshooting [Microsoft Copilot Studio](https://aka.ms/CopilotStudio) agents through YAML files — directly from your terminal.

## Installation

```bash
# Add the marketplace
/plugin marketplace add microsoft/skills-for-copilot-studio

# Install the plugin
/plugin install copilot-studio@microsoft/skills-for-copilot-studio
```

Once installed, the plugin is available globally — no need to `cd` into this repo.

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) or [GitHub Copilot CLI](https://docs.github.com/en/copilot)
- [VS Code](https://code.visualstudio.com/) with the [Copilot Studio Extension](https://github.com/microsoft/vscode-copilotstudio)

## Usage

The plugin provides three commands, each backed by a specialized agent:

```
/copilot-studio:author Create a new topic for handling return requests
/copilot-studio:test Run my test set and analyze failures
/copilot-studio:troubleshoot The greeting topic isn't triggering — why?
```

You can also describe what you need in plain language — the plugin will route your request to the correct agent automatically.

## Quick Start

After cloning a Copilot Studio agent with the VS Code extension:

```bash
# 1. Open your agent's directory
cd ~/CopilotStudio/MyAgent

# 2. Design and build topics
/copilot-studio:author I need an agent that handles IT service requests and PTO inquiries. Can you design and implement the topics?

# 3. Add nodes to existing topics
/copilot-studio:author Add a question node to the ReturnPolicy topic asking for the order number

# 4. Push & publish in Copilot Studio, then test
/copilot-studio:test I published changes to the return policy topic. Can you test it with "What is the return policy?"

# 5. Troubleshoot issues
/copilot-studio:troubleshoot The ReturnPolicy topic isn't triggering — I get Conversation Boosting instead. Why?
```

The plugin auto-discovers your agent's YAML files via `**/agent.mcs.yml`.

## Workflow

1. **Clone** the agent with the Copilot Studio VS Code Extension
2. **Start** Claude Code (or your preferred tool) in the agent's directory
3. **Author** changes via `/copilot-studio:author`
4. **Push** changes with the VS Code Extension (creates a draft)
5. **Publish** in the Copilot Studio UI (makes changes live)
6. **Test** via `/copilot-studio:test`

## Three Specialized Agents

Each command delegates to a specialized agent with the domain context, reference material, and internal skills it needs to handle your request end-to-end.

| Command | Use When |
|---------|----------|
| `/copilot-studio:author` | Building or modifying YAML files (topics, actions, knowledge, triggers, settings, nodes, child agents, global variables, generative answers) |
| `/copilot-studio:test` | Testing published agents, sending test messages, analyzing evaluation results |
| `/copilot-studio:troubleshoot` | Debugging issues — wrong topic triggered, validation errors, unexpected behavior |

> **How it works**: You talk to the agents in natural language. Each agent has internal skills (schema lookup, YAML generation, validation, test execution) that it uses automatically — you don't need to invoke them yourself.

### Chaining agents

For multi-step workflows, agents are chained automatically:

```
# Author, then test
"Create a PTO topic and then test it with 'How do I request time off?'"

# Troubleshoot, then fix
"The greeting topic has a validation error — fix it"
```

## Plugin Management

```bash
# Install (user-wide)
/plugin install copilot-studio@microsoft/skills-for-copilot-studio --scope user

# Install for a specific project (shared via version control)
/plugin install copilot-studio@microsoft/skills-for-copilot-studio --scope project

# Check installed plugins
/plugin list

# Temporarily disable
/plugin disable copilot-studio

# Re-enable
/plugin enable copilot-studio

# Uninstall
/plugin uninstall copilot-studio
```

## Key Resources

- [SETUP_GUIDE.md](SETUP_GUIDE.md) — Step-by-step setup and configuration guide
- `skills/_reference/SKILL.md` — YAML reference tables (triggers, actions, variables, Power Fx)

## Disclaimer

> **This plugin is an experimental research project and is not an officially supported Microsoft product.** It is provided "as-is" without warranty of any kind. Use at your own risk.
>
> - The Copilot Studio YAML schema is subject to change without notice. We'll do our best to keep this tool updated, but allow some processing time.
> - **Always review and validate all outputs** before pushing changes to your environment. AI-generated YAML may contain errors or unsupported patterns.
> - This plugin does not guarantee compatibility with all Copilot Studio features or configurations.
> - The authors and contributors are not responsible for any issues, data loss, or service disruptions caused by the use of this plugin.
>
> By using this plugin, you acknowledge these limitations and accept full responsibility for validating its outputs.

## Contributing

### Local development

```bash
# Clone the repo
git clone https://github.com/microsoft/skills-for-copilot-studio.git
cd skills-for-copilot-studio

# Load the plugin from your local clone (one-off session)
claude --plugin-dir /path/to/skills-for-copilot-studio

# Or install persistently from your local clone
claude plugin install /path/to/skills-for-copilot-studio --scope user
```

### Rebuilding bundled scripts

The plugin includes bundled Node.js scripts (schema lookup, chat-with-agent) built with [esbuild](https://esbuild.github.io/). Source is in `scripts/src/`, bundles are in `scripts/`.

```bash
cd scripts
npm install
npm run build
```

### Project structure

```
.claude-plugin/          # Plugin manifest and marketplace config
agents/                  # Sub-agent definitions (author, test, troubleshoot)
hooks/                   # Session hooks (agent routing)
skills/                  # Skill definitions (entry points + internal skills)
scripts/                 # Bundled tools (schema lookup, chat-with-agent)
  src/                   # Source code
reference/               # Copilot Studio YAML schema
templates/               # YAML templates for common patterns
tests/                   # Test runner for Copilot Studio Kit integration
```
