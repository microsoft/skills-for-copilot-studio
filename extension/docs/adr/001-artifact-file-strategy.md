---
title: "ADR-001: Shared vs VS Code-Specific Artifact Files"
description: "Architecture decision record evaluating whether to create VS Code-specific versions of agent and skill files or share them with the Claude Code plugin"
author: @coatsy
ms.date: 2026-03-27
ms.topic: concept
---

## Status

Accepted

## Context

The repository contains 4 agent files and 24 skill files originally authored for the
Claude Code plugin. A VS Code extension (issue #1) must register these same artifacts
as `contributes.chatAgents` and `contributes.chatSkills` entries.

The agent and skill files contain platform-specific constructs at two levels:

### Frontmatter divergence

| Field | Occurrence | Platform |
|-------|-----------|----------|
| `name` | 4 agents, 3 skills | Both (portable) |
| `description` | All | Both (portable) |
| `skills` | 4 agents | Both (portable) |
| `user-invocable` | 24 skills | Unknown — all set to `false` |
| `allowed-tools` | 21/24 skills | Claude Code only (e.g., `Bash(node *schema-lookup.bundle.js *)`) |
| `context: fork` | 18/24 skills | Claude Code only (subprocess isolation) |
| `agent` | 18/24 skills | Claude Code only (agent routing) |
| `argument-hint` | 17/24 skills | Unknown |

### Body divergence

* 19/24 skills reference `${CLAUDE_SKILL_DIR}` (a Claude Code path variable) in
  bash code blocks to locate bundled scripts. Total: 76 references across all files.
* 18/24 skills contain bash command patterns (```` ```bash ````) that invoke
  Node.js scripts via Claude Code's `Bash()` tool.
* Agent bodies are fully portable — zero Claude Code-specific constructs.

### File extension requirement

VS Code `contributes.chatAgents` requires `.agent.md` file extensions. Current agent
files use plain `.md`.

## Decision

We need to determine the artifact file strategy for dual-platform support.

## Options Considered

### Option A: Single shared files (current approach)

Keep one set of agent and skill files. Rename agents from `.md` to `.agent.md`.
Rely on each platform ignoring unknown frontmatter fields.

**Advantages:**

* Single source of truth — no sync or drift risk
* Minimal file count (4 agents + 24 skills unchanged)
* Simple build pipeline — discover and register as-is
* Agent files are already fully portable

**Disadvantages:**

* Assumes VS Code ignores unknown frontmatter fields (`allowed-tools`,
  `context: fork`, `agent`) — untested
* `${CLAUDE_SKILL_DIR}` references in 19 skill bodies won't resolve in VS Code
* If VS Code errors on unknown frontmatter, all 21 affected skills break
* Renaming `.md` → `.agent.md` may break Claude Code plugin (needs testing)
* No opportunity to tailor instructions per platform

**Risk:** Medium — hinges on the untested assumption that VS Code silently ignores
unknown YAML frontmatter fields.

### Option B: VS Code-specific copies at build time

Maintain the original files for Claude Code. At build time, generate VS Code-specific
copies that strip incompatible frontmatter and replace `${CLAUDE_SKILL_DIR}` paths.

**Advantages:**

* Zero risk to Claude Code — originals untouched
* Clean VS Code experience — no unknown frontmatter noise
* Can tailor instructions per platform (e.g., replace `Bash()` tool references
  with VS Code tool equivalents)
* Agent `.md` → `.agent.md` copy happens only in the build output

**Disadvantages:**

* Two versions of every file — drift risk if the transform is incomplete or buggy
* Build script complexity — must parse frontmatter, strip fields, rewrite paths
* 24 skill files + 11 supporting files + 4 agent files to transform (39 files)
* Transform logic must be maintained as new frontmatter fields are added
* Developers must remember to edit the source files, not the generated copies

**Risk:** Medium — the transform script becomes a maintenance burden and a source
of subtle bugs.

### Option C: VS Code-specific files maintained in parallel

Create a separate `extension/agents/` and `extension/skills/` directory tree with
hand-maintained VS Code-specific versions of each file.

**Advantages:**

* Full control over each platform's experience
* Can optimize instructions, examples, and tool references per platform
* No build-time transform — files are ready to package

**Disadvantages:**

* 39+ files duplicated and maintained in parallel
* High drift risk — changes to skill logic must be applied in two places
* Doubles the review surface for every skill change
* 2,774 lines of skill content (plus 11 supporting files) to keep synchronized
* No automation to detect when files diverge

**Risk:** High — parallel maintenance of ~40 files with no sync mechanism virtually
guarantees divergence.

### Option D: Shared files with platform overrides

Keep shared files as the single source. Create a small set of VS Code-specific
override files only where the platforms genuinely diverge. The build script merges
overrides into the shared base.

**Advantages:**

* Single source of truth for the 95% of content that is portable
* Override files are small — only the delta (frontmatter patches, path rewrites)
* Lower drift risk than full copies — overrides are explicit and reviewable
* Scales well — only files with actual incompatibilities need overrides
* Agent files need zero overrides (already portable)

**Disadvantages:**

* Requires a merge mechanism in the build script
* Override format must be well-defined and documented
* Adds conceptual complexity — contributors must understand the override system
* Still needs testing to confirm VS Code handles the merged output correctly

**Risk:** Low-medium — more engineering than Option A, but much less maintenance
than Options B or C.

### Option E: Shared files with frontmatter-only stripping

Keep shared files as the single source. At build time, strip only the known
incompatible frontmatter fields. Leave body content (including `${CLAUDE_SKILL_DIR}`)
unchanged and document it as a known limitation.

**Advantages:**

* Simplest build transform — a frontmatter-only pass, no body rewriting
* Single source of truth for all content
* Agent files need no transform (already portable)
* Only 5 frontmatter fields to strip: `allowed-tools`, `context`, `agent`,
  `argument-hint`, `user-invocable`
* `${CLAUDE_SKILL_DIR}` limitation is acceptable short-term — VS Code Copilot Chat
  doesn't execute bash commands directly from skill files anyway

**Disadvantages:**

* Skill bodies still contain Claude Code-specific bash patterns — may confuse
  VS Code users reading skill instructions
* `${CLAUDE_SKILL_DIR}` paths are visible but non-functional in VS Code
* Still requires a build step (though minimal)

**Risk:** Low — the transform is simple enough to be reliable, and the body content
limitation is acceptable for the initial release.

## Analysis

The key factors are:

1. **Agent files are portable today** — all 4 files have zero Claude Code-specific
   constructs. Only the file extension (`.md` → `.agent.md`) needs to change.

2. **Skill frontmatter is the main incompatibility** — 21/24 skills use Claude
   Code-specific fields. Whether VS Code ignores them is untested.

3. **Skill body content is informational** — VS Code Copilot Chat reads skill bodies
   as context/instructions for the LLM, but doesn't execute bash commands directly.
   The `${CLAUDE_SKILL_DIR}` references are guidance for the AI, not runtime code.
   They may confuse the model, but they won't cause errors.

4. **Maintenance cost dominates** — Options B and C create ongoing sync burdens
   that outweigh the cleanliness benefit. The team is small and changes to skills
   are frequent.

5. **Incremental approach is safest** — start with the lowest-risk option, validate
   assumptions, and escalate only if problems emerge.

## Recommendation

**Option E: Shared files with frontmatter-only stripping.**

This provides the best balance of safety, simplicity, and maintainability:

1. **Copy and rename** agent files from `.md` to `.agent.md` at build time into a
   transient staging directory. Source files remain `.md` in the repository,
   preserving Claude Code compatibility without any testing or risk.

2. **Build script strips** these frontmatter fields from skill file copies when
   packaging for VS Code: `allowed-tools`, `context`, `agent`, `argument-hint`,
   `user-invocable`. Source skill files are never modified.

3. **Document** `${CLAUDE_SKILL_DIR}` in skill bodies as a known limitation.
   The VS Code Copilot Chat LLM will see these references but they serve as
   documentation of what scripts exist — the LLM can still use this context
   to guide users, even if it cannot execute the commands directly.

4. **Revisit** if VS Code introduces its own tool-restriction or execution model
   that requires body-level changes — at that point, upgrade to Option D
   (platform overrides) for the affected skills only.

## Consequences

* The build script uses a transient staging directory for all transformations —
  source files are never modified
* Agent `.md` → `.agent.md` renaming happens only in the staging copy
* Skill frontmatter stripping happens only in the staging copy (~20 lines of Node.js)
* All skill and agent content is maintained in one place
* Contributors edit files in `agents/` and `skills/` only — never in build output
* `${CLAUDE_SKILL_DIR}` references remain in VS Code skill files until a VS Code
  equivalent exists or the body divergence justifies per-file overrides
