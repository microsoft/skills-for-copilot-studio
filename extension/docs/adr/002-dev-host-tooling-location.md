---
title: "ADR-002: Dev Host Tooling Location"
description: "Architecture decision record for where to place the VS Code self-hosted build tooling and documentation"
author: "@coatsy"
ms.date: 2026-03-28
ms.topic: concept
---

## Status

Accepted

## Context

Issue #14 introduces documentation and a helper script for building VS Code from source and using it as an isolated extension debug host. The issue itself raised the question of where this tooling should live:

- A separate repository (for example, `skills-for-copilot-studio-devhost`) with its own build scripts and a submodule reference to VS Code.
- A `dev/` or `tools/` directory in this repository with helper scripts and documentation.
- The existing `extension/` directory tree, colocated with the packaging and build workflow.

## Decision

Keep the dev host tooling in the `extension/` directory of this repository.

## Options Considered

### Option A: Separate repository

Create a new `skills-for-copilot-studio-devhost` repository containing the VS Code clone instructions, build scripts, and debug configurations.

**Advantages:**

- Clean separation of concerns; the main repo stays focused on skills and agents
- Independent versioning and CI for the devhost setup
- Contributors who only author skills never see devhost files

**Disadvantages:**

- Introduces a second repo to clone, sync, and maintain
- Debug configurations (launch.json) reference paths in both repos, creating fragile cross-repo dependencies
- Higher friction for new contributors: two repos to discover, clone, and coordinate
- The devhost setup is tightly coupled to the extension's `test-local.sh` and `CODE_CMD` mechanism, making cross-repo references unavoidable

**Risk:** Medium. The coupling between the devhost setup and the extension build process means a separate repo would require constant cross-referencing, negating the isolation benefit.

### Option B: Top-level `dev/` or `tools/` directory

Place scripts and documentation under a new top-level directory such as `dev/` or `tools/`.

**Advantages:**

- Visible at the repo root; easy to discover
- Keeps `extension/` focused on packaging artifacts

**Disadvantages:**

- Introduces a new top-level directory with a narrow purpose (one script, two docs)
- Debug configurations and the helper script need to reference `extension/test-local.sh` with relative paths that cross directory boundaries
- Inconsistent with the existing pattern where extension-related files live under `extension/`

**Risk:** Low, but adds organizational noise for a small number of files.

### Option C: Inside `extension/` (selected)

Place documentation under `extension/docs/` (where ADRs already live) and the helper script at `extension/setup-devhost.sh` alongside `extension/test-local.sh`.

**Advantages:**

- Colocated with the build script it complements (`test-local.sh`)
- Follows the existing pattern: extension docs are in `extension/docs/`, extension scripts are in `extension/`
- No new top-level directories; minimal change to repo structure
- Cross-references between the devhost script and `test-local.sh` use simple sibling paths
- Debug configurations naturally live in the repo's `.vscode/launch.json`

**Disadvantages:**

- Extension directory grows slightly (one script, two docs)
- Contributors browsing `extension/` see devhost files even if they will not use them

**Risk:** Low. The additional files are small and clearly named.

## Analysis

The dev host setup is a direct extension of the existing `test-local.sh` workflow. It shares the same `CODE_CMD` mechanism, processes the same `.staging/` output, and targets the same VSIX. Separating it into a different location would create cross-cutting references without meaningful isolation.

The `extension/docs/` directory already holds architecture decision records, making it a natural home for setup guides. The helper script (`setup-devhost.sh`) is analogous to `test-local.sh` and belongs alongside it.

The file count is small (two markdown files, one shell script), so a dedicated directory or repository would be over-engineering.

## Consequences

- `extension/docs/LOCAL_DEV_HOST.md` and `extension/docs/DEBUG_CONFIG.md` live alongside ADRs
- `extension/setup-devhost.sh` sits next to `extension/test-local.sh`
- `.gitignore` entries cover the default dev host isolation directories (`.vscode-dev-data/`, `.vscode-dev-extensions/`, `vscode/`)
- If the dev host tooling grows significantly in the future (multiple scripts, platform-specific installers), this decision should be revisited in a follow-up ADR
