# Skills for Copilot Studio

An **AI coding agent plugin** for Microsoft Copilot Studio YAML authoring. Create, edit, validate, and test Copilot Studio agents using YAML files — from any project directory.

Compatible with **Claude Code** and **GitHub Copilot CLI** (any agent that supports the plugin format).

## Installation

```bash
# Add the marketplace
/plugin marketplace add microsoft/skills-for-copilot-studio

# Install the plugin
/plugin install copilot-studio@microsoft/skills-for-copilot-studio
```

Once installed, the plugin is available globally — no need to `cd` into this repo.

## Prerequisites

- An AI coding agent CLI that supports plugins ([Claude Code](https://docs.anthropic.com/en/docs/claude-code) or [GitHub Copilot CLI](https://docs.github.com/en/copilot))
- [VS Code](https://code.visualstudio.com/) with the [Copilot Studio Extension](https://github.com/microsoft/vscode-copilotstudio)

## Usage

The plugin provides three specialized agents: **author**, **test**, and **troubleshoot**. The recommended way to interact is by tagging the agent directly:

```
@copilot-studio:author Create a new topic for handling return requests
@copilot-studio:test Run my test set and analyze failures
@copilot-studio:troubleshoot The greeting topic isn't triggering — why?
```

You can also just describe what you need in plain language — both Claude Code and GitHub Copilot CLI are capable of routing your request to the correct agent automatically. However, **tagging the agent explicitly is advised** as it ensures the right agent is activated immediately with the proper domain context, avoiding any ambiguity.

## Quick Start — End-to-End Example

Suppose you cloned a Copilot Studio agent to `C:\Users\you\CopilotStudio\MyAgent1`:

```bash
# 1. Start your AI coding agent in your agent's directory
cd C:\Users\you\CopilotStudio\MyAgent1

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

## Workflow
1. **Clone** the agent with the Copilot Studio VS Code Extension into any directory
2. **Start** your AI coding agent in that directory with the plugin loaded
3. **Author** changes via `@copilot-studio:author`
4. **Push** changes with the VS Code Extension (creates a draft)
5. **Publish** in Copilot Studio UI (makes changes live)
6. **Test** via `@copilot-studio:test`

## Three Specialized Agents

Always interact with the plugin through its agents. Each agent has the domain context, reference material, and skills it needs to handle your request end-to-end.

| Agent | Use When | Invoke |
|-------|----------|--------|
| **author** | Building or modifying YAML files (topics, actions, knowledge, triggers, settings, nodes, child agents, global variables, generative answers, best practices) | `@copilot-studio:author` |
| **test** | Testing published agents, sending test messages, analyzing results | `@copilot-studio:test` |
| **troubleshoot** | Debugging issues — wrong topic triggered, validation errors, unexpected behavior | `@copilot-studio:troubleshoot` |

> **How it works**: You talk to the agents in natural language. Each agent has internal skills (schema lookup, YAML generation, validation, test execution, etc.) that it uses automatically — you don't need to invoke them yourself.

### Chaining agents

For multi-step workflows, the AI will chain agents automatically:

```
# Delegates to author, then to test
"Create a PTO topic and then test it with 'How do I request time off?'"

# Delegates to troubleshoot, then to author
"The greeting topic has a validation error — fix it"
```

## Plugin Management

```bash
# Install persistently (user-wide)
/plugin install copilot-studio@microsoft/skills-for-copilot-studio --scope user

# Install for a specific project (shared via version control)
/plugin install copilot-studio@microsoft/skills-for-copilot-studio --scope project

# Check installed plugins
/plugin list

# Temporarily disable without uninstalling
/plugin disable copilot-studio

# Re-enable
/plugin enable copilot-studio

# Uninstall
/plugin uninstall copilot-studio
```

## Key Resources

- [SETUP_GUIDE.md](SETUP_GUIDE.md) — Detailed step-by-step setup and testing guide
- `skills/_reference/SKILL.md` — YAML reference tables (triggers, actions, variables, Power Fx)

## Disclaimer

> **This plugin is an experimental research project and is not an officially supported Microsoft product.** It is provided "as-is" without warranty of any kind. Use at your own risk.
>
> - The Copilot Studio YAML schema is subject to change without notice. We'll do our best to keep this tool updated with the latest schema, but allow some processing time.
> - **Always review and validate all outputs** produced by this tool before pushing changes to your environment. Even if optimized for best-practices adherence, AI-generated YAML may contain errors, hallucinations, or unsupported patterns.
> - This plugin does not guarantee compatibility with all Copilot Studio features or configurations.
> - The authors and contributors are not responsible for any issues, data loss, or service disruptions caused by the use of this plugin.
>
> By using this plugin, you acknowledge these limitations and accept full responsibility for validating its outputs.

## Contributing

### Local development setup

```bash
# Clone the repo
git clone https://github.com/microsoft/skills-for-copilot-studio.git
cd skills-for-copilot-studio

# Load the plugin from your local clone (one-off session)
claude --plugin-dir /path/to/skills-for-copilot-studio

# Or install persistently from your local clone
claude plugin install /path/to/skills-for-copilot-studio --scope user
```

### Rebuilding the schema lookup script

The schema lookup tool is a Node.js script bundled with [esbuild](https://esbuild.github.io/). The source is in `scripts/src/`, the bundle is `scripts/schema-lookup.bundle.js`.

```bash
cd scripts
npm install
npm run build
```

### Project structure

```
.claude-plugin/          # Plugin manifest and marketplace config
agents/                  # Sub-agent definitions (author, test, troubleshoot)
hooks/                   # Session hooks (routing instructions)
skills/                  # Skill definitions (YAML authoring, validation, testing)
scripts/                 # Schema lookup tool (source + bundled)
  src/                   # Source code (dev only, gitignored)
  schema-lookup.bundle.js  # Bundled script (ships with plugin)
reference/               # Copilot Studio YAML schema
templates/               # YAML templates for common patterns
tests/                   # Test runner and chat scripts
```
