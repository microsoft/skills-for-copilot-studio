# Changelog

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
