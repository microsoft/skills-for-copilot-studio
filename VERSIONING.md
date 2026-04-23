# Versioning Policy

This document defines the version synchronization between this fork's VS Code
extension releases and the upstream
[microsoft/skills-for-copilot-studio](https://github.com/microsoft/skills-for-copilot-studio)
releases.

## Synchronized Versioning

This fork's extension version **matches the upstream release version**. When
upstream publishes `v1.0.8`, this fork's extension is also released as `v1.0.8`.

The version is maintained in two places:

- `extension/templates/package.template.json` — VS Code skills extension
- `extension-pack/package.json` — VS Code extension pack bundle

Both must always match the upstream version tracked in `upstream-version.json`.

## Upstream Version Tracking

The current upstream version is stored in `upstream-version.json` at the
repository root:

```json
{
  "upstream_repo": "microsoft/skills-for-copilot-studio",
  "upstream_version": "v1.0.8",
  "last_checked": "2026-04-23"
}
```

## Release Workflow Guards

The following guards enforce the versioning policy:

1. **Version match** — The `publish-extension.yml` workflow validates that the
   extension version matches the upstream version in `upstream-version.json`
   before publishing. A release will fail if versions are out of sync.

2. **Release notes** — Every release includes the upstream version reference
   so users can identify compatibility.

3. **Daily monitor** — The `check-upstream-release.yml` workflow detects new
   upstream releases and opens a proposal issue with the recommended action.

## How to Update When a New Upstream Release Is Detected

When the daily monitor detects a new upstream release (e.g. `v1.0.9`):

1. Review the upstream release notes and assess impact.
2. Sync upstream changes using the `sync-upstream.yml` workflow or manually.
3. Update `upstream-version.json` with the new version and date.
4. Update `extension/templates/package.template.json` version to `1.0.9`.
5. Update `extension-pack/package.json` version to `1.0.9`.
6. Test the build locally with `bash extension/test-local.sh --package-only`.
7. Create a release tagged `v1.0.9`.
