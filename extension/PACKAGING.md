---
title: Extension Packaging Guide
description: "How to build, package, test, and publish the Copilot Studio Skills VS Code extension"
author: Microsoft
ms.date: 2026-03-27
ms.topic: how-to
---

## Overview

The VS Code extension packages the same agents, skills, scripts, templates, and reference files used by the Claude Code plugin into a `.vsix` file for GitHub Copilot Chat.

The packaging pipeline is a single Bash script (`extension/test-local.sh`) that stages artifacts, transforms platform-specific constructs, generates `package.json`, and invokes `vsce` to produce the VSIX.

### Extension structure

```text
extension/
  .staging/             # Generated staging directory (git-ignored)
  docs/adr/             # Architecture decision records
  templates/
    package.template.json   # Base package.json for the extension
  icon.png              # Marketplace icon
  LICENSE               # Extension license
  README.md             # Marketplace README (rendered on the extension page)
  test-local.sh         # Build and install script
```

After packaging, the staging directory contains the final extension layout:

```text
.staging/
  agents/               # Agent files renamed to .agent.md
  skills/               # Skill files with Claude Code frontmatter stripped
  scripts/              # Bundled Node.js scripts (.bundle.js only)
  templates/            # YAML templates for common patterns
  reference/            # Schema and connector files
  package.json          # Generated with discovered agents and skills
  README.md             # Frontmatter-stripped copy of extension/README.md
  icon.png              # Marketplace icon
  LICENSE               # License file
```

### What the build script does

1. Copies agent files from `agents/`, renaming `.md` to `.agent.md` (VS Code requires this suffix)
2. Copies skill files from `skills/` and strips Claude Code-specific frontmatter fields (`allowed-tools`, `context`, `agent`, `argument-hint`, `user-invocable`)
3. Copies `scripts/`, `templates/`, and `reference/` directories
4. Generates `package.json` from the template, populating `contributes.chatAgents` and `contributes.chatSkills` by discovering staged files
5. Resolves `${CLAUDE_SKILL_DIR}/../../` path references to relative `../../` paths
6. Strips YAML frontmatter from the extension README (VS Code renders frontmatter as visible text)
7. Packages everything with `vsce` into a `.vsix` file

## Prerequisites

| Requirement | Version   | Installation                                       |
|-------------|-----------|----------------------------------------------------|
| Node.js     | 18+       | <https://nodejs.org/>                              |
| npm         | Bundled   | Included with Node.js                              |
| VS Code     | 1.106.1+  | <https://code.visualstudio.com/>                   |
| Bash        | 4+        | Pre-installed on macOS/Linux; use Git Bash on Windows |

The `vsce` CLI is fetched automatically via `npx` during packaging. No global install is needed.

## Build and package

### Package the extension

Run the build script with the `--package-only` flag to produce the VSIX without installing:

```bash
bash extension/test-local.sh --package-only
```

The VSIX file is written to `extension/copilot-studio-skills-<version>.vsix`.

### Build and install locally

Run the script without flags to package and install in one step:

```bash
bash extension/test-local.sh
```

This packages the extension and then runs `code --install-extension` to install it. Reload VS Code to activate.

> [!TIP]
> Set the `CODE_CMD` environment variable to point to a specific VS Code binary if `code` is not on your PATH:
>
> ```bash
> CODE_CMD="/path/to/code" bash extension/test-local.sh
> ```

### Uninstall

```bash
code --uninstall-extension TBD.copilot-studio-skills
```

## CI/CD pipeline

The GitHub Actions workflow at `.github/workflows/build-extension.yml` runs on every push and pull request that touches agent, skill, script, template, reference, or extension files.

The pipeline:

1. Checks out the repository
2. Sets up Node.js 20
3. Runs `bash extension/test-local.sh --package-only` (with `CODE_CMD=true` to skip VS Code install)
4. Verifies a VSIX file was produced
5. Uploads the VSIX as a build artifact (retained for 30 days)

## Publishing to the Marketplace

> [!IMPORTANT]
> The extension publisher is currently set to `TBD` in `extension/templates/package.template.json`. Update the `publisher` field before publishing.

### First-time setup

1. Create a publisher on the [VS Code Marketplace](https://marketplace.visualstudio.com/manage)
2. Generate a Personal Access Token (PAT) with the **Marketplace (Manage)** scope
3. Update `publisher` in `extension/templates/package.template.json` to match your publisher ID

### Publish

```bash
# Package first
bash extension/test-local.sh --package-only

# Publish the VSIX
cd extension/.staging
npx @vscode/vsce publish --pat <YOUR_PAT>
```

Alternatively, upload the VSIX manually through the [Marketplace management portal](https://marketplace.visualstudio.com/manage).

## Version management

The extension version is defined in `extension/templates/package.template.json` in the `version` field.

To bump the version:

1. Update the `version` field in `extension/templates/package.template.json`
2. Rebuild with `bash extension/test-local.sh --package-only`
3. Commit the template change

The version follows [SemVer](https://semver.org/):

* Increment the **major** version for breaking changes to agent or skill interfaces
* Increment the **minor** version when adding new agents, skills, or templates
* Increment the **patch** version for bug fixes and documentation updates

## Troubleshooting

| Issue                           | Cause                                      | Solution                                                                 |
|---------------------------------|--------------------------------------------|--------------------------------------------------------------------------|
| `No .vsix file produced`       | `vsce` packaging failed                    | Check the script output for errors; verify Node.js 18+ is installed      |
| Extension not visible in Chat   | Extension not activated after install      | Reload VS Code (`Developer: Reload Window`)                              |
| Agents or skills missing        | Files not discovered during staging        | Verify agent files exist in `agents/` and skill folders contain `SKILL.md` |
| `icon` field error from `vsce` | `icon.png` missing from `extension/`       | Add an `icon.png` or remove the `icon` field from the template          |
| Frontmatter visible in README   | YAML frontmatter not stripped              | Re-run `test-local.sh` to regenerate the staged README                  |
| `command not found: code`      | VS Code CLI not on PATH                    | Set `CODE_CMD` or install the `code` command from VS Code Command Palette |
| Publisher rejected              | `publisher` still set to `TBD`             | Update the publisher in `package.template.json` before publishing        |
