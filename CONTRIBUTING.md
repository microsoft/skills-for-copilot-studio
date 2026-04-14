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

## Release workflow

The plugin follows a **weekly release branch** cadence. Release branches are merged to `main` on Wednesdays, and a new branch is created every Thursday automatically via GitHub Actions.

### How it works

1. **Every Thursday at 09:00 UTC**, the [`new-release`](.github/workflows/new-release.yml) workflow runs:
   - Creates a `release/YYYY-WNN` branch from `main` (e.g., `release/2026-W16`)
   - Bumps the patch version in `plugin.json` and `marketplace.json`
   - Commits and pushes the branch

2. **During the week**, fork feature branches from the release branch and PR back into it:
   ```bash
   git checkout release/2026-W16
   git checkout -b feature/my-change
   # ... make changes ...
   # PR into release/2026-W16
   ```

3. **When ready to ship**, open a PR from `release/YYYY-WNN` into `main`.

### Manual trigger

You can also create a release branch on demand from the [Actions tab](../../actions/workflows/new-release.yml) using **Run workflow**. Optionally provide a version override (e.g., `1.1.0` for a minor bump).

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
evals/                   # Scenario-based eval framework (harness, report, fixtures)
  scenarios/             # Eval definitions per scenario (<name>.json)
  hooks/                 # Eval-only hooks (skill tracing via PreToolUse)
hooks/                   # Session hooks (agent routing)
skills/                  # Skill definitions (entry points + internal skills)
scripts/                 # Bundled tools (schema lookup, chat-with-agent)
  src/                   # Source code
reference/               # Copilot Studio YAML schema
templates/               # YAML templates for common patterns
tests/                   # Test runner for Copilot Studio Kit integration
```

## Scenario evals

The plugin includes a testing framework for validating end-to-end scenarios. Evals use **natural language prompts** (what a real user would say) and verify both **routing** (correct agent and skill invoked) and **output** (files created, schema validation, content assertions).

Skills invoked inside sub-agents are traced via a `PreToolUse` hook injected at eval runtime — no plugin changes needed.

### What's tested

| Scenario | Evals | What's checked |
|----------|-------|----------------|
| `topic-creation` | 4 | Topic creation with different trigger types, empty workspace refusal |
| `agent-settings` | 3 | Instruction changes, display name + conversation starters, generative actions toggle |
| `knowledge-sources` | 3 | Public website, SharePoint, and custom-named knowledge sources |
| `action-creation` | 2 | MCP and connector action creation |
| `action-editing` | 3 | MCP action display name, connection mode, structure preservation |

### Available checks

| Check | What it validates |
|-------|------------------|
| `agent_invoked` | Expected sub-agent was dispatched (e.g., Author agent) |
| `agent_not_invoked` | Unwanted sub-agents were NOT dispatched |
| `skill_invoked` | Expected skill was invoked (traced inside sub-agents via hook) |
| `skill_not_invoked` | Unwanted skills were NOT invoked |
| `files_created` | Expected output files exist (glob pattern, min/max count) |
| `schema_validate` | Full Copilot Studio schema validation (kind, required fields, unique IDs, Power Fx, variable scopes) |
| `yaml_structure` | YAML path equals value, min array length, or contains string |
| `content_contains` | Domain keywords from the prompt appear in output files |
| `no_placeholders` | No `_REPLACE`, `TODO`, `FIXME` markers remain |
| `yaml_unchanged` | Specific file or YAML path was NOT modified |
| `stdout_contains` / `stdout_not_contains` | CLI response text assertions |
| `exit_code` | CLI exit code matches expected |

**Note:** `skill_invoked` and `skill_not_invoked` checks rely on a `PreToolUse` hook injected at runtime via `--settings`. This only works with Claude Code CLI. When using Copilot CLI (`--cli copilot`), skill tracing is not available — these checks will be skipped and a warning is emitted.

### Running evals

```bash
# Run evals for a single scenario
python3 evals/evaluate.py --scenario topic-creation --verbose

# Run all scenarios and generate HTML report
node evals/run.js

# Run with GitHub Copilot CLI instead of Claude Code
node evals/run.js --cli copilot

# Run a specific eval by ID
python3 evals/evaluate.py --scenario agent-settings --eval-id 1 --verbose
```

### Viewing results

Each run creates a timestamped directory under `evals/results/` with:

```
evals/results/2026-04-04-143000/
├── agent-settings.json      # Results JSON
├── topic-creation.json
├── knowledge-sources.json
├── agent-settings/          # Generated artifacts
│   ├── eval-1/agent.mcs.yml
│   └── eval-2/agent.mcs.yml
├── topic-creation/
│   ├── eval-1/topics/ITSupport.topic.mcs.yml
│   └── ...
└── report.html              # Self-contained HTML report
```

Open `report.html` in a browser to see the interactive report with:
- Dashboard with pass/fail rates
- Sidebar navigation between scenarios
- Expandable eval cards with prompt, routing info, response, generated file links, and check results
- Keyboard shortcuts: `j`/`k` to navigate, `Enter` to expand, `Esc` to collapse
- All / Passed / Failed filters

To regenerate the report from existing results:

```bash
python3 evals/report.py evals/results/<timestamp>/
```

### Creating evals for a new scenario

**Option 1: Use the `/create-eval` skill** (recommended)

```
/create-eval <scenario-name>
```

This walks you through the process — reads relevant skills, suggests test cases, and writes `evals/scenarios/<scenario-name>.json`.

**Option 2: Create manually**

Create `evals/scenarios/<scenario-name>.json`:

```json
{
  "scenario_name": "your-scenario",
  "evals": [
    {
      "id": 1,
      "name": "Short descriptive title",
      "prompt": "Add https://docs.contoso.com as a knowledge source for the agent.",
      "fixture": "basic-agent",
      "mock_scripts": [],
      "checks": {
        "agent_invoked": "copilot-studio:Copilot Studio Author",
        "skill_invoked": "copilot-studio:add-knowledge",
        "files_created": [
          {"pattern": "knowledge/*.knowledge.mcs.yml", "min_count": 1}
        ],
        "schema_validate": true,
        "content_contains": ["docs.contoso.com"],
        "no_placeholders": true
      }
    }
  ]
}
```

**Guidelines:**
- Prompts must be **natural language** — what a real user would say, not "Use the X skill to..."
- Include `agent_invoked` and `skill_invoked` checks to verify correct routing
- Include at least 3 test cases covering different possibilities
- Use `schema_validate: true` for all YAML-producing scenarios
- Keep prompts specific (mention exact names, values) so checks can be deterministic
- `content_contains` keywords should come directly from the prompt
