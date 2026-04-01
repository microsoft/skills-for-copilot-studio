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
evals/                   # Skill eval framework (harness, report, fixtures)
hooks/                   # Session hooks (agent routing)
skills/                  # Skill definitions (entry points + internal skills)
scripts/                 # Bundled tools (schema lookup, chat-with-agent)
  src/                   # Source code
reference/               # Copilot Studio YAML schema
templates/               # YAML templates for common patterns
tests/                   # Test runner for Copilot Studio Kit integration
```

## Skill evals

The plugin includes a testing framework for validating that skills produce correct output. These are **unit tests** — each eval explicitly invokes a specific skill and checks the output with deterministic validators (schema validation, YAML structure, content assertions).

### What's tested

Evals exist for skills that produce YAML files:

| Skill | Evals | What's checked |
|-------|-------|----------------|
| `new-topic` | 3 | Topic creation with different trigger types (OnRecognizedIntent, OnConversationStart, OnUnknownIntent) |
| `edit-agent` | 3 | Instruction changes, display name + conversation starters, generative actions toggle |
| `add-knowledge` | 3 | Public website, SharePoint, and custom-named knowledge sources |

### Available checks

| Check | What it validates |
|-------|------------------|
| `files_created` | Expected output files exist (glob pattern, min count) |
| `schema_validate` | Full Copilot Studio schema validation (kind, required fields, unique IDs, Power Fx, variable scopes) |
| `yaml_structure` | YAML path equals value, min array length, or contains string |
| `content_contains` | Domain keywords from the prompt appear in output files |
| `no_placeholders` | No `_REPLACE`, `TODO`, `FIXME` markers remain |
| `stdout_contains` / `stdout_not_contains` | CLI response text assertions |
| `exit_code` | CLI exit code matches expected |

### Running evals

```bash
# Run evals for a single skill
python3 evals/evaluate.py --skill new-topic --verbose

# Run all skills and generate HTML report
node evals/run.js

# Run with GitHub Copilot CLI instead of Claude Code
node evals/run.js --cli copilot

# Run a specific eval by ID
python3 evals/evaluate.py --skill new-topic --eval-id 1 --verbose
```

### Viewing results

Each run creates a timestamped directory under `evals/results/` with:

```
evals/results/2026-04-01-143000/
├── new-topic.json           # Results JSON
├── edit-agent.json
├── add-knowledge.json
├── new-topic/               # Generated artifacts
│   ├── eval-1/topics/ITSupport.topic.mcs.yml
│   ├── eval-2/topics/WelcomeNewUser.topic.mcs.yml
│   └── eval-3/topics/Fallback.topic.mcs.yml
├── edit-agent/
│   └── ...
└── report.html              # Self-contained HTML report
```

Open `report.html` in a browser to see the interactive report with:
- Dashboard with pass/fail rates
- Sidebar navigation between skills
- Expandable eval cards with prompt, response, generated file links, and check results
- Keyboard shortcuts: `j`/`k` to navigate, `Enter` to expand, `Esc` to collapse
- All / Passed / Failed filters

To regenerate the report from existing results:

```bash
python3 evals/report.py evals/results/<timestamp>/
```

### Creating evals for your skill

**Option 1: Use the `/create-eval` skill** (recommended)

```
/create-eval <skill-name>
```

This walks you through the process — reads your skill, suggests test cases, and writes the `evals.json` file.

**Option 2: Create manually**

Create `skills/<your-skill>/evals/evals.json`:

```json
{
  "skill_name": "your-skill",
  "evals": [
    {
      "id": 1,
      "name": "Short descriptive title",
      "prompt": "Use the your-skill skill to <specific task with concrete details>",
      "fixture": "basic-agent",
      "mock_scripts": [],
      "checks": {
        "files_created": [
          {"pattern": "knowledge/*.knowledge.mcs.yml", "min_count": 1}
        ],
        "schema_validate": true,
        "yaml_structure": [
          {"path": "kind", "equals": "KnowledgeSourceConfiguration"}
        ],
        "content_contains": ["expected keyword"],
        "no_placeholders": true
      }
    }
  ]
}
```

**Guidelines:**
- Each prompt **must** start with "Use the \<skill-name\> skill to..." to ensure the correct skill is invoked
- Include at least 3 test cases covering different scenarios
- Use `schema_validate: true` for all YAML-producing skills
- Keep prompts specific (mention exact names, values) so checks can be deterministic
- `content_contains` keywords should come directly from the prompt
