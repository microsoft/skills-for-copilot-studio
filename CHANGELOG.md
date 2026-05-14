# Changelog

All notable changes to **Skills for Copilot Studio** are documented in this file.

This file mirrors the per-release notes on [GitHub Releases](https://github.com/microsoft/skills-for-copilot-studio/releases). Section headings (`New Features`, `Bug Fixes`, `Documentation`, `Infrastructure & Evals`, `Refactoring`, `Other Changes`) match the `type/*` PR labels configured in [`.github/release.yml`](./.github/release.yml), so each release here reflects the same grouping shown on GitHub.

The format follows the spirit of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) as described in [`RELEASE_PLAN.md`](./RELEASE_PLAN.md).

## [Unreleased]

Tracks work on `release/2026-W20`, slated to ship as **v1.0.12** on Wednesday 2026-05-20. See [open PRs](https://github.com/microsoft/skills-for-copilot-studio/pulls) for what's in flight.

### Documentation

- Add `CHANGELOG.md` mirroring GitHub Releases ([#168](https://github.com/microsoft/skills-for-copilot-studio/issues/168))

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

First tagged release, establishing a baseline for the weekly release process. Captures all functionality already on `main` as of 2026-04-07, including:

- MCP server action support
- Scenario-based eval framework with parallel execution
- Cross-platform hook fixes (Windows / VS Code)
- LSP-based YAML validation
- Agent management (push / pull / clone)
- Issue templates

See [`RELEASE_PLAN.md`](./RELEASE_PLAN.md) for the weekly release process going forward.

[Unreleased]: https://github.com/microsoft/skills-for-copilot-studio/compare/v1.0.11...HEAD
[1.0.11]: https://github.com/microsoft/skills-for-copilot-studio/releases/tag/v1.0.11
[1.0.9]: https://github.com/microsoft/skills-for-copilot-studio/releases/tag/v1.0.9
[1.0.8]: https://github.com/microsoft/skills-for-copilot-studio/releases/tag/v1.0.8
[1.0.7]: https://github.com/microsoft/skills-for-copilot-studio/releases/tag/v1.0.7
