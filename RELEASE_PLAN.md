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
- Keep the process lightweight — weekly release branches, no manual changelogs.

## 2. Versioning

We use **semver** (MAJOR.MINOR.PATCH):

| Bump | When | Examples |
|------|------|----------|
| **Patch** (1.0.x) | Bug fixes, docs, infra, eval improvements | Fix YAML validation, update templates |
| **Minor** (1.x.0) | New skills, new agents, new capabilities | Add analytics agent, add AI Prompt skill |
| **Major** (x.0.0) | Breaking changes to plugin API or skill interface | Schema format change, removed skills |

The version lives in `.claude-plugin/plugin.json`. It is bumped on the release branch before merging to `main`.

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

### Branch workflow

Each week uses a release branch named `release/YYYY-WNN` (ISO week number):

1. **After Wednesday's release**, create the next week's branch from `main`:
   ```bash
   git checkout main && git pull
   git checkout -b release/2026-W17
   git push -u origin release/2026-W17
   ```
2. **During the week**, PRs target the current release branch (not `main`).
3. **On Wednesday**, the release branch merges to `main` and gets tagged.

### Wednesday release checklist

1. **Check open PRs** — merge remaining PRs into the release branch, or defer to next week. PRs not ready should be labeled `release/blocked` for tracking.
2. **Bump version** — update `version` in `.claude-plugin/plugin.json` on the release branch.
3. **Merge to main** — create a PR from `release/YYYY-WNN` → `main` and merge it.
4. **Tag and release** — create a GitHub Release from `main`:
   ```bash
   # Example for v1.1.0
   gh release create v1.1.0 --generate-notes --latest
   ```
   GitHub auto-generates notes from merged PRs using `.github/release.yml` categories.
5. **Write release summary** — draft a short, plain-language summary of what changed and why it matters (for non-technical audiences).
6. **Announce** — post the summary with a link to the release in Teams and on LinkedIn.
7. **Create next release branch** — branch `release/YYYY-WNN` from the newly updated `main`.

### Automation (future)

A GitHub Actions workflow can automate steps 4-5. For now, we do it manually.

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

Everything merged into the weekly `release/YYYY-WNN` branch is included when that branch merges to `main` on Wednesday.

**Important:** The Claude plugin marketplace auto-pulls from `main`. This is why PRs target the release branch — `main` only changes on release day when the release branch merges in. PRs that aren't ready for this week stay on their feature branches and target next week's release branch.

The `release/blocked` label excludes a PR from auto-generated release notes. It does **not** prevent code from shipping — if a blocked PR is merged into the release branch, it will still ship when the branch merges to `main`.

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
- [x] **Marketplace sync:** The Claude plugin marketplace auto-pulls from `main`. Weekly release branches gate what lands on `main`.

---

*This plan is intentionally minimal. We can add automation (GitHub Actions for tagging, version bumping, eval gating) incrementally as the project matures.*
