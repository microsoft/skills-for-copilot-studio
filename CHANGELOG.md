# Changelog

All notable changes to **Skills for Copilot Studio** are documented in this file.

This file mirrors the per-release notes on [GitHub Releases](https://github.com/microsoft/skills-for-copilot-studio/releases). Section headings (`New Features`, `Bug Fixes`, `Documentation`, `Infrastructure & Evals`, `Refactoring`, `Other Changes`) match the `type/*` PR labels configured in [`.github/release.yml`](./.github/release.yml), so each release here reflects the same grouping shown on GitHub.

The format follows the spirit of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) as described in [`RELEASE_PLAN.md`](./RELEASE_PLAN.md).

Versions earlier than `1.0.7` were never tagged on GitHub Releases — they were marked only by `plugin.json` bumps — so their entries here are reconstructed from merged PR history. Versions `1.0.5` and `1.0.10` were skipped during the bump cadence and have no entries.

## [Unreleased]

Tracks work on `release/2026-W20`, slated to ship as **v1.0.12** on Wednesday 2026-05-20. See [open PRs](https://github.com/microsoft/skills-for-copilot-studio/pulls) for what's in flight.

### Documentation

- Add `CHANGELOG.md` covering every release to date ([#168](https://github.com/microsoft/skills-for-copilot-studio/issues/168))

## [1.0.11] — 2026-05-13

### Bug Fixes

- Fix release branch creation to target next week ([#145](https://github.com/microsoft/skills-for-copilot-studio/pull/145), [@ChrisGarty](https://github.com/ChrisGarty))

### Infrastructure & Evals

- Add lookup-schema eval test cases ([#121](https://github.com/microsoft/skills-for-copilot-studio/pull/121), [@GiorgioUghini](https://github.com/GiorgioUghini))

### Other Changes

- Updating knowledge-guide to fix incorrect content about SharePoint permissions ([#156](https://github.com/microsoft/skills-for-copilot-studio/pull/156), [@lewisdoesdev](https://github.com/lewisdoesdev))
- Replace best-practices and known-issues with pattern library and Advisor agent ([#159](https://github.com/microsoft/skills-for-copilot-studio/pull/159), [@adilei](https://github.com/adilei))
- Update MCP action metadata ([#163](https://github.com/microsoft/skills-for-copilot-studio/pull/163), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Add 7 new patterns to be used by the Advisor agent ([#162](https://github.com/microsoft/skills-for-copilot-studio/pull/162), [@CATDAB](https://github.com/CATDAB))
- Add Channel-Aware Behavior pattern ([#166](https://github.com/microsoft/skills-for-copilot-studio/pull/166), [@Roelzz](https://github.com/Roelzz))
- Add release branch workflow to release plan ([#142](https://github.com/microsoft/skills-for-copilot-studio/pull/142), [@ChrisGarty](https://github.com/ChrisGarty))

### New Contributors

- [@lewisdoesdev](https://github.com/lewisdoesdev) made their first contribution in [#156](https://github.com/microsoft/skills-for-copilot-studio/pull/156)
- [@Roelzz](https://github.com/Roelzz) made their first contribution in [#166](https://github.com/microsoft/skills-for-copilot-studio/pull/166)

**Full diff:** [`v1.0.9...v1.0.11`](https://github.com/microsoft/skills-for-copilot-studio/compare/v1.0.9...v1.0.11)

## [1.0.9] — 2026-04-29

### New Features

- Identify agent from Copilot Studio URL (`--url` flag) ([#149](https://github.com/microsoft/skills-for-copilot-studio/pull/149), [@GiorgioUghini](https://github.com/GiorgioUghini))

### Refactoring

- Remove "Best practices" and move content to patterns & tips ([#147](https://github.com/microsoft/skills-for-copilot-studio/pull/147), [@ericsche](https://github.com/ericsche))
- Rationalize best-practice skill descriptions ([#150](https://github.com/microsoft/skills-for-copilot-studio/pull/150), [@GiorgioUghini](https://github.com/GiorgioUghini))

**Full diff:** [`v1.0.8...v1.0.9`](https://github.com/microsoft/skills-for-copilot-studio/compare/v1.0.8...v1.0.9)

## [1.0.8] — 2026-04-16

### New Features

- SPO action guidance ([#137](https://github.com/microsoft/skills-for-copilot-studio/pull/137), [@ericsche](https://github.com/ericsche))
- Add eval API harness and restructure test agent skills ([#135](https://github.com/microsoft/skills-for-copilot-studio/pull/135), [@adilei](https://github.com/adilei))

### Documentation

- Weekly release plan ([#134](https://github.com/microsoft/skills-for-copilot-studio/pull/134), [@ChrisGarty](https://github.com/ChrisGarty))

### Other Changes

- Add weekly release branch workflow ([#139](https://github.com/microsoft/skills-for-copilot-studio/pull/139), [@adilei](https://github.com/adilei))
- Move release branch cron to Thursday ([#140](https://github.com/microsoft/skills-for-copilot-studio/pull/140), [@adilei](https://github.com/adilei))
- Eval API harness and test agent improvements ([#141](https://github.com/microsoft/skills-for-copilot-studio/pull/141), [@adilei](https://github.com/adilei))
- Connection ID support for authenticated eval runs ([#143](https://github.com/microsoft/skills-for-copilot-studio/pull/143), [@adilei](https://github.com/adilei))

**Full diff:** [`v1.0.7...v1.0.8`](https://github.com/microsoft/skills-for-copilot-studio/compare/v1.0.7...v1.0.8)

## [1.0.7] — 2026-04-07

First tagged GitHub Release, establishing the baseline for the weekly release process. At a high level, this release captures:

- MCP server action support
- Scenario-based eval framework with parallel execution
- Cross-platform hook fixes (Windows / VS Code)
- LSP-based YAML validation
- Agent management (push / pull / clone)
- Issue templates

### Merged PRs (since v1.0.6)

- Update bot schema ([#105](https://github.com/microsoft/skills-for-copilot-studio/pull/105), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Schema-driven validation for inputs placement and action kinds ([#106](https://github.com/microsoft/skills-for-copilot-studio/pull/106), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Atomic chat skills: decouple protocol choice from script ([#102](https://github.com/microsoft/skills-for-copilot-studio/pull/102), [@adilei](https://github.com/adilei))
- Replace bash-specific hook commands with cross-platform node scripts ([#103](https://github.com/microsoft/skills-for-copilot-studio/pull/103), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Skill eval framework with test harness, HTML report, and self-service eval authoring ([#107](https://github.com/microsoft/skills-for-copilot-studio/pull/107), [@adilei](https://github.com/adilei))
- Centralize eval definitions under `evals/skills/` ([#111](https://github.com/microsoft/skills-for-copilot-studio/pull/111), [@adilei](https://github.com/adilei))
- Use absolute plugin paths in hooks for installed plugins ([#112](https://github.com/microsoft/skills-for-copilot-studio/pull/112), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Use absolute plugin paths and VS Code-compatible hook output ([#114](https://github.com/microsoft/skills-for-copilot-studio/pull/114), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Fix sub-agent invocation syntax from `/` to `@` in setup guide ([#115](https://github.com/microsoft/skills-for-copilot-studio/pull/115), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Add VS Code compatibility note to setup guide ([#117](https://github.com/microsoft/skills-for-copilot-studio/pull/117), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Bump version to 1.0.7 ([#118](https://github.com/microsoft/skills-for-copilot-studio/pull/118), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Fail early when user requests agent creation in empty workspace ([#119](https://github.com/microsoft/skills-for-copilot-studio/pull/119), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Add general bug report template and refine issue templates ([#120](https://github.com/microsoft/skills-for-copilot-studio/pull/120), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Add MCP server action support to add-action and edit-action skills ([#113](https://github.com/microsoft/skills-for-copilot-studio/pull/113), [@adilei](https://github.com/adilei))
- Run evals in parallel (`--parallel N`, default 3) ([#125](https://github.com/microsoft/skills-for-copilot-studio/pull/125), [@adilei](https://github.com/adilei))
- Eval improvements: Windows fixes, `yaml_unchanged`, SHA-256 snapshots ([#126](https://github.com/microsoft/skills-for-copilot-studio/pull/126), [@adilei](https://github.com/adilei))
- Refactor evals: scenario-based testing instead of skill isolation ([#130](https://github.com/microsoft/skills-for-copilot-studio/pull/130), [@adilei](https://github.com/adilei))
- Extract shared auth and utilities from script code ([#133](https://github.com/microsoft/skills-for-copilot-studio/pull/133), [@adilei](https://github.com/adilei))

## [1.0.6] — 2026-03-31

> Pre-tagged release — internal `plugin.json` bump only. Versions earlier than 1.0.7 were not published as GitHub Releases.

- Rename agents to a more specific name ([#77](https://github.com/microsoft/skills-for-copilot-studio/pull/77), [@ericsche](https://github.com/ericsche))
- Update Critical Guideline for a corner case in user input ([#78](https://github.com/microsoft/skills-for-copilot-studio/pull/78), [@ericsche](https://github.com/ericsche))
- Fix API permission search term in setup docs ([#79](https://github.com/microsoft/skills-for-copilot-studio/pull/79), [@adilei](https://github.com/adilei))
- Update README ([#84](https://github.com/microsoft/skills-for-copilot-studio/pull/84), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Add native dependency management and refactor MSAL + JSON-RPC ([#81](https://github.com/microsoft/skills-for-copilot-studio/pull/81), [@adilei](https://github.com/adilei))
- Session start hook updates ([#86](https://github.com/microsoft/skills-for-copilot-studio/pull/86), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Test agent: auto-detect auth mode, atomic skills ([#92](https://github.com/microsoft/skills-for-copilot-studio/pull/92), [@adilei](https://github.com/adilei))
- Add LSP-based validation and pre-push validation gate ([#88](https://github.com/microsoft/skills-for-copilot-studio/pull/88), [@adilei](https://github.com/adilei))
- Add publish support to manage-agent prompt ([#93](https://github.com/microsoft/skills-for-copilot-studio/pull/93), [@adilei](https://github.com/adilei))
- README updates ([#95](https://github.com/microsoft/skills-for-copilot-studio/pull/95), [@ericsche](https://github.com/ericsche))
- Add missing image ([#96](https://github.com/microsoft/skills-for-copilot-studio/pull/96), [@ericsche](https://github.com/ericsche))
- Improve guidance for GitHub Copilot CLI ([#97](https://github.com/microsoft/skills-for-copilot-studio/pull/97), [@ericsche](https://github.com/ericsche))
- Add model reference to schema-lookup and edit-agent skill ([#101](https://github.com/microsoft/skills-for-copilot-studio/pull/101), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Bump version to 1.0.6 ([#104](https://github.com/microsoft/skills-for-copilot-studio/pull/104), [@GiorgioUghini](https://github.com/GiorgioUghini))

## [1.0.4] — 2026-03-17

> Pre-tagged release — internal `plugin.json` bump only. (Version 1.0.5 was skipped.)

- Initialize placeholder for topic redirection with variable best practices ([#63](https://github.com/microsoft/skills-for-copilot-studio/pull/63), [@CATDAB](https://github.com/CATDAB))
- Document non-functional triggers and YAML-only features ([#69](https://github.com/microsoft/skills-for-copilot-studio/pull/69), [@adilei](https://github.com/adilei))
- Reconcile version-bump history from 1.0.0 ([#70](https://github.com/microsoft/skills-for-copilot-studio/pull/70), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Add manage-agent: push/pull/clone via LSP binary ([#71](https://github.com/microsoft/skills-for-copilot-studio/pull/71), [@adilei](https://github.com/adilei))
- Bump version to 1.0.4 ([#72](https://github.com/microsoft/skills-for-copilot-studio/pull/72), [@GiorgioUghini](https://github.com/GiorgioUghini))

## [1.0.3] — 2026-03-13

> Pre-tagged release — internal `plugin.json` bump only.

- Knowledge skill improvements ([#65](https://github.com/microsoft/skills-for-copilot-studio/pull/65), [@ericsche](https://github.com/ericsche))
- Bump version to 1.0.3 ([#66](https://github.com/microsoft/skills-for-copilot-studio/pull/66), [@ericsche](https://github.com/ericsche))

## [1.0.2] — 2026-03-12

> Pre-tagged release — internal `plugin.json` bump only.

- Fix installation command for `copilot-studio` plugin ([#60](https://github.com/microsoft/skills-for-copilot-studio/pull/60), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Fix internal skill names — leading underscores not supported ([#61](https://github.com/microsoft/skills-for-copilot-studio/pull/61), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Bump version to 1.0.2 ([#62](https://github.com/microsoft/skills-for-copilot-studio/pull/62), [@GiorgioUghini](https://github.com/GiorgioUghini))

## [1.0.1] — 2026-03-11

> Pre-tagged release — internal `plugin.json` bump only. This is the first version after the initial commit and represents the bulk of the plugin's foundational work.

- Add Microsoft `SECURITY.md` ([#2](https://github.com/microsoft/skills-for-copilot-studio/pull/2), microsoft-github-policy-service)
- Add run-tests skill for testing published agents ([#5](https://github.com/microsoft/skills-for-copilot-studio/pull/5), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Authoring improvements ([#7](https://github.com/microsoft/skills-for-copilot-studio/pull/7), [@ericsche](https://github.com/ericsche))
- Rationalize best-practices structure ([#8](https://github.com/microsoft/skills-for-copilot-studio/pull/8), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Trim content from `REFERENCE.md` and only keep reference ([#9](https://github.com/microsoft/skills-for-copilot-studio/pull/9), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Improve robustness for SharePoint knowledge bases ([#10](https://github.com/microsoft/skills-for-copilot-studio/pull/10), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Add support for actions ([#6](https://github.com/microsoft/skills-for-copilot-studio/pull/6), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Make `SetTextVariable` explicit for type coercion ([#11](https://github.com/microsoft/skills-for-copilot-studio/pull/11), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Add `/chat-with-agent` skill and shared agent registry ([#13](https://github.com/microsoft/skills-for-copilot-studio/pull/13), [@adilei](https://github.com/adilei))
- Rename `src/` to `agents/` and include directory in repo ([#14](https://github.com/microsoft/skills-for-copilot-studio/pull/14), [@adilei](https://github.com/adilei))
- Clarify agent lifecycle: local vs pushed (draft) vs published ([#17](https://github.com/microsoft/skills-for-copilot-studio/pull/17), [@adilei](https://github.com/adilei))
- Implement `add-adaptive-card` skill ([#18](https://github.com/microsoft/skills-for-copilot-studio/pull/18), [@purnananda](https://github.com/purnananda))
- Plugin migration ([#24](https://github.com/microsoft/skills-for-copilot-studio/pull/24), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Authoring improvements ([#25](https://github.com/microsoft/skills-for-copilot-studio/pull/25), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Add GitHub issue templates ([#26](https://github.com/microsoft/skills-for-copilot-studio/pull/26), [@ChrisGarty](https://github.com/ChrisGarty))
- Encourage Claude to review issues ([#27](https://github.com/microsoft/skills-for-copilot-studio/pull/27), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Add `marketplace.json` ([#28](https://github.com/microsoft/skills-for-copilot-studio/pull/28), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Update README ([#29](https://github.com/microsoft/skills-for-copilot-studio/pull/29), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Authoring improvements ([#30](https://github.com/microsoft/skills-for-copilot-studio/pull/30), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Update `marketplace.json` with required fields ([#31](https://github.com/microsoft/skills-for-copilot-studio/pull/31), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Update README ([#32](https://github.com/microsoft/skills-for-copilot-studio/pull/32), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Replace Python `chat-with-agent` with bundled Node.js script ([#33](https://github.com/microsoft/skills-for-copilot-studio/pull/33), [@adilei](https://github.com/adilei))
- Hide all skills from direct user invocation ([#34](https://github.com/microsoft/skills-for-copilot-studio/pull/34), [@adilei](https://github.com/adilei))
- Polish README, add entry-point commands for sub-agents ([#35](https://github.com/microsoft/skills-for-copilot-studio/pull/35), [@adilei](https://github.com/adilei))
- Rename `add-child-agent` to `add-other-agents`, add connected agent pattern ([#36](https://github.com/microsoft/skills-for-copilot-studio/pull/36), [@adilei](https://github.com/adilei))
- Remove Python `schema-lookup.py`, fix `add-adaptive-card` references ([#37](https://github.com/microsoft/skills-for-copilot-studio/pull/37), [@adilei](https://github.com/adilei))
- Add Adaptive Cards v1.6 schema with `ac-*` lookup commands ([#38](https://github.com/microsoft/skills-for-copilot-studio/pull/38), [@adilei](https://github.com/adilei))
- Add connector definitions, lookup script, and `edit-action` skill ([#39](https://github.com/microsoft/skills-for-copilot-studio/pull/39), [@adilei](https://github.com/adilei))
- Final improvements on Knowledge and Authoring ([#43](https://github.com/microsoft/skills-for-copilot-studio/pull/43), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Fix marketplace name ([#46](https://github.com/microsoft/skills-for-copilot-studio/pull/46), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Update `global-variable.variable.mcs.yml` with instructions ([#47](https://github.com/microsoft/skills-for-copilot-studio/pull/47), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Add `known-issues` skill and KB issue template ([#49](https://github.com/microsoft/skills-for-copilot-studio/pull/49), [@adilei](https://github.com/adilei))
- Add DirectLine v3 chat skill for testing bots ([#55](https://github.com/microsoft/skills-for-copilot-studio/pull/55), [@adilei](https://github.com/adilei))
- Authoring fixes ([#57](https://github.com/microsoft/skills-for-copilot-studio/pull/57), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Update SessionStart hook message for clarity on delegation ([#58](https://github.com/microsoft/skills-for-copilot-studio/pull/58), [@GiorgioUghini](https://github.com/GiorgioUghini))
- Bump version to 1.0.1 ([#59](https://github.com/microsoft/skills-for-copilot-studio/pull/59), [@GiorgioUghini](https://github.com/GiorgioUghini))

## [1.0.0] — 2026-01-13

Initial repository scaffolding.

- First commit: README, setup instructions, and Microsoft mandatory compliance files

[Unreleased]: https://github.com/microsoft/skills-for-copilot-studio/compare/v1.0.11...HEAD
[1.0.11]: https://github.com/microsoft/skills-for-copilot-studio/releases/tag/v1.0.11
[1.0.9]: https://github.com/microsoft/skills-for-copilot-studio/releases/tag/v1.0.9
[1.0.8]: https://github.com/microsoft/skills-for-copilot-studio/releases/tag/v1.0.8
[1.0.7]: https://github.com/microsoft/skills-for-copilot-studio/releases/tag/v1.0.7
[1.0.6]: https://github.com/microsoft/skills-for-copilot-studio/pull/104
[1.0.4]: https://github.com/microsoft/skills-for-copilot-studio/pull/72
[1.0.3]: https://github.com/microsoft/skills-for-copilot-studio/pull/66
[1.0.2]: https://github.com/microsoft/skills-for-copilot-studio/pull/62
[1.0.1]: https://github.com/microsoft/skills-for-copilot-studio/pull/59
[1.0.0]: https://github.com/microsoft/skills-for-copilot-studio/commit/d187ab5
