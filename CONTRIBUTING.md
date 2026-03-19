# Contributing

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

```
.claude-plugin/          # Plugin manifest and marketplace config
.github/plugin/          # GitHub Copilot Plugin manifest to speedup discovery  
agents/                  # Sub-agent definitions (author, test, troubleshoot)
hooks/                   # Session hooks (agent routing)
skills/                  # Skill definitions (entry points + internal skills)
scripts/                 # Bundled tools (schema lookup, chat-with-agent)
  src/                   # Source code
reference/               # Copilot Studio YAML schema
templates/               # YAML templates for common patterns
tests/                   # Test runner for Copilot Studio Kit integration
```
