---
title: Contributing
description: "Local development setup, building scripts, and extension development for Skills for Copilot Studio"
---

## Local development

```bash
# Clone the repo
git clone https://github.com/microsoft/skills-for-copilot-studio.git
cd skills-for-copilot-studio

# Load the plugin from your local clone (one-off session)
claude --plugin-dir /path/to/skills-for-copilot-studio

# Or install persistently from your local clone
claude plugin install /path/to/skills-for-copilot-studio --scope user
```

## Rebuilding bundled scripts

The plugin includes bundled Node.js scripts (schema lookup, chat-with-agent) built with [esbuild](https://esbuild.github.io/). Source is in `scripts/src/`, bundles are in `scripts/`.

```bash
cd scripts
npm install
npm run build
```

## VS Code extension development

The VS Code extension packages the same agents, skills, and scripts into a `.vsix` for GitHub Copilot Chat. See [extension/PACKAGING.md](extension/PACKAGING.md) for the complete packaging guide.

### Adding a new agent

1. Create a new `.md` file in `agents/` (e.g., `agents/copilot-studio-myagent.md`)
2. Include YAML frontmatter with `name`, `description`, and `skills` fields
3. Add agent instructions in the Markdown body

The packaging script discovers all `.md` files in `agents/` automatically. Each file is renamed to `.agent.md` during staging (VS Code requires this suffix for `contributes.chatAgents`).

### Adding a new skill

1. Create a new directory under `skills/` (e.g., `skills/my-skill/`)
2. Add a `SKILL.md` file with YAML frontmatter containing `name` and `description`
3. Optionally add supporting Markdown files in the same directory

The packaging script discovers all directories under `skills/` that contain a `SKILL.md` file and registers them as `contributes.chatSkills` entries. Claude Code-specific frontmatter fields (`allowed-tools`, `context`, `agent`, `argument-hint`, `user-invocable`) are stripped automatically during staging.

### How artifact discovery works

The packaging script (`extension/test-local.sh`) dynamically builds `package.json` at staging time:

1. Scans `agents/` for `.md` files and registers each as a `chatAgents` entry
2. Scans `skills/` for subdirectories containing `SKILL.md` and registers each as a `chatSkills` entry
3. Writes the populated `contributes` section into the staged `package.json`

No manual registration is needed. Add a file in the correct location and the build picks it up.

### Testing extension changes locally

```bash
# Build and install in one step
bash extension/test-local.sh

# Or package only (no install)
bash extension/test-local.sh --package-only
```

After installing, reload VS Code and open Copilot Chat to verify your agents and skills appear.

### Running the CI pipeline locally

The CI workflow runs the same packaging script. To reproduce locally:

```bash
CODE_CMD="true" bash extension/test-local.sh --package-only
```

Setting `CODE_CMD="true"` skips the VS Code install step, matching the CI environment.

### Shell scripts

Shell scripts under `extension/` are linted by [ShellCheck](https://www.shellcheck.net/) in CI. The repo includes a `.shellcheckrc` that sets `shell=bash` and `severity=warning` so local runs match CI.

To lint locally (requires ShellCheck installed):

```bash
shellcheck extension/*.sh
```

Or install via npm:

```bash
npm install -g shellcheck
shellcheck extension/*.sh
```

Script conventions:

- Use `#!/usr/bin/env bash` and `set -euo pipefail`
- Shell files must use LF line endings (enforced by `.gitattributes`)
- Quote all variable expansions: `"${var}"` not `$var`
- Use `[[ ... ]]` for conditionals, not `[ ... ]`

## Plugin management

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

## Project structure

```text
.claude-plugin/          # Plugin manifest and marketplace config
.github/plugin/          # GitHub Copilot Plugin manifest to speedup discovery
.github/workflows/       # CI/CD (build-extension.yml)
agents/                  # Sub-agent definitions (author, test, troubleshoot, manage)
extension/               # VS Code extension packaging (test-local.sh, templates, docs)
hooks/                   # Session hooks (agent routing)
skills/                  # Skill definitions (entry points + internal skills)
scripts/                 # Bundled tools (schema lookup, chat-with-agent)
  src/                   # Source code
reference/               # Copilot Studio YAML schema
templates/               # YAML templates for common patterns
tests/                   # Test runner for Copilot Studio Kit integration
```
