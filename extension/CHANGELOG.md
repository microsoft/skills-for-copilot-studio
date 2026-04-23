# Changelog

## 1.0.8

### Changed

- Synchronized extension version with upstream microsoft/skills-for-copilot-studio releases (previously independent at 0.1.x)
- Added daily upstream release monitoring workflow
- Added upstream version badge to README
- Added version synchronization guards to publish workflow

## 0.1.4

### Fixed

- Updated skills count from 24 to 28 in README, adding missing skills: `chat-directline`, `chat-sdk`, `create-eval`, `detect-mode`, `int-project-context`, `int-reference`

## 0.1.3

### Fixed

- Build script now resolves skill-local `${CLAUDE_SKILL_DIR}/` path references (not just `../../` patterns), fixing CI validation failures after upstream merges

### Added

- Upstream sync workflow (`sync-upstream.yml`) that runs weekly to auto-merge changes from `microsoft/skills-for-copilot-studio` main, creating draft PRs or warning on conflicts
- Dedicated `CLAUDE_SKILL_DIR` resolution check in CI that validates all staged files, not just skills

### Upstream Changes

#### Skills

- **`edit-action`** — now supports MCP server actions (`InvokeExternalAgentTaskAction`) in addition to connector actions; adds SharePoint-specific reference (`sharepoint-actions.md`) with OData filter syntax and quoting patterns
- **`add-action`** — adds MCP server action guidance explaining that MCP connections must be created in the Copilot Studio portal first, plus the new `mcp-action.mcs.yml` template reference
- **`create-eval`** — new skill for self-service eval authoring with scenario-based testing, SHA-256 snapshots, and HTML reports
- **`int-reference`** — adds documentation for `$`-prefixed OData property names (SharePoint `$filter`/`$orderby`) with correct quoting patterns for TaskDialog vs InvokeConnectorAction

#### Agents

- **`copilot-studio-author`** — stronger guardrails against creating agent projects from scratch; clearer messaging that `agent.mcs.yml` and `settings.mcs.yml` must not be created, only edited

#### Templates

- **`mcp-action.mcs.yml`** — new template for MCP server actions using `InvokeExternalAgentTaskAction` with `ModelContextProtocolMetadata`
- **`connector-action.mcs.yml`** — adds `mcs.metadata` format fields

#### Scripts

- Shared auth (`shared-auth.js`) and utilities (`shared-utils.js`) extracted from duplicated script code
- Updated bundles for `chat-with-agent`, `directline-chat`, and `manage-agent`

## 0.1.2

### Fixed

- Skills referenced in agent body text (e.g., `chat-directline`, `validate`) are now automatically discovered and added to the agent's `skills:` frontmatter during build, making them available in VS Code (#23)
- VS Code build tasks now use Git Bash instead of WSL bash, fixing `node: command not found` errors on Windows systems with WSL

### Added

- Build-time validation that warns when `/copilot-studio:*` references don't resolve to a valid skill directory or agent name
- Sub-command validation that checks `/copilot-studio:skill sub-command` patterns against the skill's `argument-hint` frontmatter
- Early exit with a helpful error message when `node` is not found in PATH

## 0.1.1

- Initial release with agents, skills, and extension packaging
