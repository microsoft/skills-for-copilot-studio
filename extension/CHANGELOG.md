# Changelog

## 0.1.3

### Fixed

- Build script now resolves skill-local `${CLAUDE_SKILL_DIR}/` path references (not just `../../` patterns), fixing CI validation failures after upstream merges

### Added

- Upstream sync workflow (`sync-upstream.yml`) that runs weekly to auto-merge changes from `microsoft/skills-for-copilot-studio` main, creating draft PRs or warning on conflicts
- Dedicated `CLAUDE_SKILL_DIR` resolution check in CI that validates all staged files, not just skills

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
