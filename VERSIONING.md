# Versioning Policy

This document defines the version mapping between this fork's VS Code extension
releases and the upstream [microsoft/skills-for-copilot-studio](https://github.com/microsoft/skills-for-copilot-studio) releases.

## Extension Versioning

The VS Code extension uses its own independent semver version (MAJOR.MINOR.PATCH)
defined in `extension/templates/package.template.json` and `extension-pack/package.json`.

| Bump      | When                                                      |
|-----------|-----------------------------------------------------------|
| **Patch** | Bug fixes, docs, dependency updates, upstream sync        |
| **Minor** | New extension features, new skills, new agent definitions |
| **Major** | Breaking changes to extension API or skill interface       |

## Upstream Version Tracking

Each release of this extension tracks which upstream release it aligns with.
The tracked upstream version is stored in `upstream-version.json` at the
repository root.

```json
{
  "upstream_repo": "microsoft/skills-for-copilot-studio",
  "upstream_version": "v1.0.8",
  "last_checked": "2026-04-23"
}
```

## Version Mapping

This fork's version numbers are **independent** from upstream. The mapping is:

| This Fork | Upstream | Relationship |
|-----------|----------|--------------|
| `v0.1.x`  | `v1.0.x`  | Fork extension built on upstream skills content |

The `upstream-version.json` file provides the authoritative mapping between
any fork release and the upstream version it incorporates.

## Release Workflow Guards

The following guards enforce the versioning policy:

1. **Upstream version reference** — The `publish-extension.yml` workflow
   validates that `upstream-version.json` exists and contains a valid upstream
   version before publishing.

2. **Release notes** — Every release includes the upstream version reference
   so users can identify compatibility.

3. **Daily monitor** — The `check-upstream-release.yml` workflow detects new
   upstream releases and opens a proposal issue with the recommended action.

## How to Update the Upstream Version

When a new upstream release is detected (via the daily monitor or manual check):

1. Review the upstream release notes and assess impact.
2. Sync upstream changes using the `sync-upstream.yml` workflow or manually.
3. Update `upstream-version.json` with the new upstream version and date.
4. Bump the extension version as appropriate (patch for upstream sync, minor
   for new features).
5. Create a release following the normal release process.
