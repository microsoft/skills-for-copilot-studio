# Release Plan — Skills for Copilot Studio

**Owner:** CAT-CAPE Copilot Acceleration Team
**Repo:** https://github.com/microsoft/skills-for-copilot-studio
**Current version:** 1.0.7
**Cadence:** Weekly (every Wednesday)
**Status:** Approved by team (2026-04-07)

---

## 1. Goals

- Ship a versioned release every week so users can pin to known-good versions.
- Auto-generate release notes from merged PRs using GitHub labels.
- Keep the process lightweight — no release branches, no manual changelogs.

## 2. Versioning

We use **semver** (MAJOR.MINOR.PATCH):

| Bump | When | Examples |
|------|------|----------|
| **Patch** (1.0.x) | Bug fixes, docs, infra, eval improvements | Fix YAML validation, update templates |
| **Minor** (1.x.0) | New skills, new agents, new capabilities | Add analytics agent, add AI Prompt skill |
| **Major** (x.0.0) | Breaking changes to plugin API or skill interface | Schema format change, removed skills |

The version lives in `.claude-plugin/plugin.json`. It is bumped as part of the release PR.

## 3. Labels

We use **6 labels** to classify PRs. Each PR should have exactly one `type/` label before merge.

| Label | Color | Description |
|-------|-------|-------------|
| `type/feature` | `#1d76db` | New skill, agent, or capability |
| `type/fix` | `#d73a4a` | Bug fix |
| `type/docs` | `#0075ca` | Documentation only |
| `type/infra` | `#e4e669` | Evals, hooks, CI, build, scripts |
| `type/refactor` | `#c5def5` | Code cleanup with no behavior change |
| `release/blocked` | `#b60205` | PR must NOT ship in next release |

> PRs without a `type/` label will appear under "Other Changes" in release notes.

## 4. Release Process (Weekly)

### Wednesday release checklist

1. **Check open PRs** — merge only PRs that are ready. PRs that are not ready must remain unmerged and should be labeled `release/blocked` for tracking and exclusion from generated release notes.
2. **Bump version** — update `version` in `.claude-plugin/plugin.json`.
3. **Tag and release** — create a GitHub Release from `main`:
   ```bash
   # Example for v1.1.0
   gh release create v1.1.0 --generate-notes --latest
   ```
   GitHub auto-generates notes from merged PRs using `.github/release.yml` categories.
4. **Write release summary** — draft a short, plain-language summary of what changed and why it matters (for non-technical audiences).
5. **Announce** — post the summary with a link to the release in Teams and on LinkedIn.

### Automation (future)

A GitHub Actions workflow can automate steps 3-4. For now, we do it manually.

## 5. GitHub Release Notes Configuration

The file `.github/release.yml` controls how merged PRs are grouped in auto-generated release notes:

```yaml
changelog:
  categories:
    - title: "New Features"
      labels: ["type/feature"]
    - title: "Bug Fixes"
      labels: ["type/fix"]
    - title: "Documentation"
      labels: ["type/docs"]
    - title: "Infrastructure & Evals"
      labels: ["type/infra"]
    - title: "Refactoring"
      labels: ["type/refactor"]
    - title: "Other Changes"
      labels: ["*"]
  exclude:
    labels: ["release/blocked"]
```

## 6. What Goes Into a Release

Everything merged to `main` since the last release tag is included in the release. The `release/blocked` label does **not** prevent code from shipping; it only excludes that PR from the auto-generated release notes.

There are no feature branches or release branches. `main` is always the release branch.

**Important:** The Claude plugin marketplace auto-pulls from `main`. PRs that are not ready for release must **NOT** be merged to `main` and must stay on feature branches until ready. Use `release/blocked` only to mark PRs that should be excluded from release notes; if a blocked PR is merged accidentally, revert it from `main` before the release.

## 7. Hotfix Process

If a critical bug is found after a release:

1. Fix it on `main` with a PR labeled `type/fix`.
2. Create an out-of-band patch release (e.g., v1.1.1) immediately — don't wait for Wednesday.

## 8. Implementation Checklist

To activate this release plan, the following one-time setup is needed:

- [x] Create the 6 labels on the GitHub repo
- [x] Create `.github/release.yml` with the config above
- [x] Label existing open PRs with appropriate `type/` labels
- [x] Create the first GitHub Release (v1.0.7) as the baseline — https://github.com/microsoft/skills-for-copilot-studio/releases/tag/v1.0.7
- [x] Share this plan with Giorgio, Adi, and Eric for feedback — PR #134

## 9. Resolved Questions

- [x] **Release day:** Wednesday.
- [x] **Announcements:** Teams and LinkedIn. Manual posting with a plain-language summary of each release.
- [x] **CI gate:** No eval or test gating yet. The team is actively building out evals and testing — this will be revisited.
- [x] **Marketplace sync:** The Claude plugin marketplace auto-pulls from `main`. This means `main` must always be release-ready — PRs that aren't ready must stay on feature branches.

---

*This plan is intentionally minimal. We can add automation (GitHub Actions for tagging, version bumping, eval gating) incrementally as the project matures.*
