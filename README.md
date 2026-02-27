# Build Agents with Claude Code

Use **Claude Code** to author Microsoft Copilot Studio agents via YAML — create topics, add actions, configure settings, and more, all from the CLI.

## Quick Start

### 1. Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed
- [Python 3.8+](https://www.python.org/) with `pip install -r requirements.txt`
- [VS Code](https://code.visualstudio.com/) with the [Copilot Studio Extension](https://github.com/microsoft/vscode-copilotstudio)

### 2. Clone this repo

```bash
git clone <this-repo-url>
cd agents-build-agents
pip install -r requirements.txt
```

### 3. Add your schema file

Place your `bot.schema.yaml-authoring.json` in the `reference/` directory.

### 4. Clone your Copilot Studio agent

Use the **Copilot Studio VS Code Extension** to clone your agent into the `src/` directory. This downloads your agent's YAML files (topics, actions, knowledge, settings).

### 5. Start Claude Code

```bash
claude
```

That's it. Claude Code reads `CLAUDE.md` automatically and all skills are available immediately.

## How to Use

### Slash commands

Invoke any skill directly with `/<skill-name>`:

```
/new-topic A FAQ topic that answers questions about our return policy
/add-action SendActivity to Greeting topic
/edit-triggers Greeting
/validate src/My Agent/topics/Greeting.mcs.yml
/list-topics
```

### Natural language

Skills also activate automatically when you ask naturally:

```
Create a new greeting topic that welcomes users
Add a question to the FAQ topic asking for the order number
What schema properties does SendActivity have?
List all topics in my agent
```

### Publishing changes

After making changes, push them back using the **Copilot Studio VS Code Extension** in VS Code.

## Available Skills

| Skill | Description |
|-------|-------------|
| `/lookup-schema` | Query schema definitions |
| `/new-topic` | Create a new topic |
| `/add-action` | Add or modify actions in a topic |
| `/validate` | Validate YAML structure |
| `/add-knowledge` | Add public website knowledge source |
| `/list-topics` | List all topics in the agent |
| `/list-kinds` | List available YAML kind values |
| `/edit-agent` | Edit agent settings or instructions |
| `/edit-triggers` | Modify topic trigger phrases |
| `/add-child-agent` | Add/configure child agents |
| `/add-generative-answers` | Add generative answer nodes |

## Key Resources

- [CLAUDE.md](CLAUDE.md) — Project instructions (loaded automatically by Claude Code)
- [REFERENCE.md](REFERENCE.md) — YAML reference tables (triggers, actions, variables, entities, templates)
- [SETUP_GUIDE.md](SETUP_GUIDE.md) — Detailed step-by-step setup and testing guide
