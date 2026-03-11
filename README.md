# Skills for Copilot Studio

A plugin for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and [GitHub Copilot CLI](https://docs.github.com/en/copilot) that enables authoring, testing, and troubleshooting [Microsoft Copilot Studio](https://aka.ms/CopilotStudio) agents through YAML files — directly from your terminal.

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) or [GitHub Copilot CLI](https://docs.github.com/en/copilot)
- [VS Code](https://code.visualstudio.com/) with the [Copilot Studio Extension](https://github.com/microsoft/vscode-copilotstudio)

## Installation

### From marketplace (recommended)

```bash
/plugin marketplace add microsoft/skills-for-copilot-studio
/plugin install copilot-studio@microsoft/skills-for-copilot-studio
```

> **Important: Enable automatic updates.** After installing, open your plugin/marketplace settings and turn on auto-updates for this plugin. The skills and schema references are updated frequently with new Copilot Studio features, best practices, and bug fixes. With auto-updates enabled, you always get the latest improvements without reinstalling. In Claude Code, type `/plugin`, navigate to "Skills for Copilot Studio", and enable the auto-update toggle.

### From a local clone

```bash
git clone https://github.com/microsoft/skills-for-copilot-studio.git

# Load for a single session
claude --plugin-dir /path/to/skills-for-copilot-studio

# Or install persistently (user-wide)
claude plugin install /path/to/skills-for-copilot-studio --scope user

# Or install for a specific project
claude plugin install /path/to/skills-for-copilot-studio --scope project
```

## Usage

The plugin provides three commands, each backed by a specialized agent:

```
/copilot-studio:author      Create and edit YAML (topics, actions, knowledge, triggers, variables)
/copilot-studio:test         Test published agents — point-tests, batch suites, or evaluation analysis
/copilot-studio:troubleshoot Debug issues — wrong topic routing, validation errors, unexpected behavior
```

## Quick Start

After cloning a Copilot Studio agent with the VS Code extension:

```bash
# Open your agent's directory
cd ~/CopilotStudio/MyAgent

# Design and build topics
/copilot-studio:author Create a topic that handles IT service requests

# Push & publish in Copilot Studio, then test
/copilot-studio:test Send "How do I request a new laptop?" to the published agent

# Troubleshoot and fix issues
/copilot-studio:troubleshoot The agent is hallucinating — it's not using real data from our knowledge base
```

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for a full end-to-end walkthrough including validation, testing options, and troubleshooting.

## Disclaimer

This plugin is an experimental research project, not an officially supported Microsoft product. The Copilot Studio YAML schema may change without notice. Always review and validate generated YAML before pushing to your environment — AI-generated output may contain errors or unsupported patterns.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local development setup, building bundled scripts, and project structure.
