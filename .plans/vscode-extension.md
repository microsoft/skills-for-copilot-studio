# Plan: VS Code Extension for Copilot Studio Skills

_Issue: #1 — Create a VS Code extension_

## TL;DR

Create a VS Code extension in the same repo (`extension/` directory) that packages the 4 agents, 28+ skills, scripts, templates, and reference files as a declarative Copilot Chat extension — following the HVE Core pattern. The extension should coexist with the existing Claude Code plugin support. The approach is: rename/symlink agent files to `.agent.md`, create a packaging pipeline that discovers artifacts and generates `package.json` contributes entries, and set up CI/CD for Marketplace publishing.

## Key findings from discovery

### Current repo structure (Claude Code plugin)

- **4 agents** in `agents/*.md` — YAML frontmatter with `name`, `description`, `skills` fields
- **28+ skills** in `skills/*/SKILL.md` — frontmatter with `user-invocable`, `description`, `allowed-tools`, `context`, `agent`
- **Scripts** in `scripts/` — esbuild bundles (Node 18 CommonJS), referenced by skills via `${CLAUDE_SKILL_DIR}/../../scripts/`
- **Templates** in `templates/` — YAML recipes for topics, actions, knowledge, variables
- **Reference** in `reference/` — JSON schemas + connector YAML definitions
- **Hooks** in `hooks/hooks.json` — Claude Code session hooks for auto-delegation
- **Claude plugin metadata** in `.claude-plugin/` — `plugin.json` + `marketplace.json`

### HVE Core extension pattern (target)

- **100% declarative** — no runtime code, no `main` entry, no `extension.js`
- **`contributes` fields** in `package.json`: `chatAgents` (path to `.agent.md`), `chatSkills` (path to `SKILL.md`), `chatInstructions`, `chatPromptFiles`
- **File conventions**: agents must be `.agent.md`, skills must be `SKILL.md`
- **Extension kind**: `["workspace", "ui"]` for local + remote support
- **Category**: `["Chat"]`
- **Packaging**: PowerShell scripts discover artifacts, generate `package.json` contributes, copy files, run `vsce package`
- **`.vscodeignore`**: controls what goes into the VSIX

### Compatibility challenges

1. **Agent file extension**: Current `.md` needs to become `.agent.md` for VS Code chatAgents
2. **Tool references**: `allowed-tools: Bash, Read, Edit` are Claude Code tools — VS Code Copilot Chat uses different tool model
3. **Script paths**: Skills use `${CLAUDE_SKILL_DIR}/../../scripts/` (Claude variable) — need equivalent for VS Code
4. **Hooks**: `hooks.json` is Claude-specific — VS Code uses `chatAgents` registration for auto-delegation
5. **Frontmatter fields**: `context: fork`, `agent: copilot-studio-author` may not apply in VS Code

## Decisions

- **Same repo**: Extension lives in `extension/` directory alongside existing Claude Code plugin
- **Both platforms**: Maintain Claude Code plugin + add VS Code extension
- **Publisher**: Need to create a VS Code Marketplace publisher account
- **Agent files**: Rename from `.md` to `.agent.md` (update Claude plugin references if needed, or maintain both)

## Steps

### Phase 1: Agent file compatibility (prerequisite)

1. **Rename agent files** from `agents/*.md` to `agents/*.agent.md` — VS Code chatAgents contribution point requires `.agent.md` extension. Verify Claude Code still works with the new extension. *If Claude Code requires `.md`, create symlinks or copy during packaging instead.*
2. **Audit frontmatter fields** across all agents and skills — identify which fields are Claude-specific vs VS Code-compatible. Document any needed adaptations.

### Phase 2: Extension scaffold

3. **Create `extension/` directory** with:
   - `package.json` template (or `templates/package.template.json` like HVE Core)
   - `.vscodeignore` — exclude dev files, node_modules, src/, tests/
   - `README.md` — Marketplace description
   - `LICENSE` — copy of root LICENSE
   - `icon.png` — extension icon (to be designed)
   - `PACKAGING.md` — developer docs for the packaging process

4. **Design `package.json` manifest** with:
   - `name`, `displayName`: e.g. `copilot-studio-skills` / `Copilot Studio Skills`
   - `publisher`: TBD (new Marketplace publisher)
   - `extensionKind`: `["workspace", "ui"]`
   - `engines.vscode`: `"^1.106.1"` (or current minimum)
   - `categories`: `["Chat"]`
   - `contributes.chatAgents`: 4 agents
   - `contributes.chatSkills`: 28+ skills
   - No `main`, no activation — purely declarative

### Phase 3: Packaging pipeline

5. **Create packaging script** (shell or PowerShell) that:
   - Discovers all agent files in `agents/`
   - Discovers all skill folders in `skills/`
   - Generates `contributes.chatAgents` and `contributes.chatSkills` arrays
   - Writes/updates `extension/package.json`
   - *Depends on step 3*

6. **Create build script** that:
   - Copies agents, skills, scripts, templates, reference into `extension/` (or subdirectory)
   - Copies agent `.md` → `.agent.md` if rename approach isn't taken
   - Runs `vsce package --no-dependencies` to produce `.vsix`
   - Cleans up temporary copies afterward
   - *Depends on step 5*

7. **Handle script path resolution** — skills reference scripts via `${CLAUDE_SKILL_DIR}/../../scripts/`. Determine how VS Code Copilot resolves script paths from skills bundled in an extension. Options: (a) adjust paths during packaging, (b) bundle scripts adjacent to skills, (c) use a VS Code-specific path variable if available. *Parallel with step 5*

### Phase 4: Testing and validation

8. **Local install test** — build VSIX, install via `code --install-extension`, verify agents and skills appear in Copilot Chat. *Depends on step 6*
9. **Remote environment test** — test in Codespaces or WSL to verify `extensionKind: ["workspace", "ui"]` works. *Depends on step 8*
10. **Claude Code regression test** — verify the Claude Code plugin still works with any file renames or restructuring. *Parallel with step 8*

### Phase 5: CI/CD

11. **Create GitHub Actions workflow** for extension packaging:
    - Trigger on push to main (or release tags)
    - Run prepare + package scripts
    - Upload `.vsix` as artifact
    - *Depends on step 6*

12. **Create Marketplace publishing workflow**:
    - Manual trigger or on release
    - Publish `.vsix` to VS Code Marketplace via `vsce publish`
    - Requires `VSCE_PAT` secret
    - *Depends on step 11*

### Phase 6: Publisher and Marketplace setup

13. **Create VS Code Marketplace publisher** account at <https://marketplace.visualstudio.com/manage>
14. **Configure publisher ID** in `package.json`
15. **Design extension icon** (`icon.png`)
16. **Write Marketplace README** for `extension/README.md`

### Phase 7: Documentation

17. **Write `extension/PACKAGING.md`** — developer guide for building and publishing
18. **Update root `README.md`** — add VS Code extension installation instructions alongside Claude Code plugin instructions
19. **Update `CONTRIBUTING.md`** — add extension development section

## Relevant files

- `agents/copilot-studio-author.md` — agent to register (rename to `.agent.md`)
- `agents/copilot-studio-manage.md` — agent to register
- `agents/copilot-studio-test.md` — agent to register
- `agents/copilot-studio-troubleshoot.md` — agent to register
- `skills/*/SKILL.md` — 28+ skills to register via `contributes.chatSkills`
- `scripts/*.bundle.js` — bundled scripts referenced by skills
- `scripts/package.json` — existing build configuration for scripts
- `templates/` — YAML templates used by authoring skills
- `reference/` — schemas and connector definitions used by skills
- `.claude-plugin/plugin.json` — existing Claude plugin metadata (must not break)
- `hooks/hooks.json` — Claude-specific hooks (not applicable to extension)

## Verification

1. Build VSIX locally: run packaging script, confirm `.vsix` file is produced
2. Install locally: `code --install-extension <file>.vsix`, open Copilot Chat, verify all 4 agents appear with correct names/descriptions
3. Invoke skills: select an agent, confirm it can find and invoke its linked skills
4. Script execution: test a skill that runs a bundled script (e.g., `lookup-schema`) — verify script path resolves correctly
5. Claude Code validation: run `claude --plugin-dir .` and confirm existing plugin still works
6. CI check: push to branch, verify GitHub Actions workflow builds the VSIX successfully
7. Remote test: open in Codespaces, verify extension activates and agents/skills are available

## Further considerations

1. **Script path resolution in VS Code Copilot Chat**: The biggest unknown — how does VS Code Copilot resolve paths like `${CLAUDE_SKILL_DIR}/../../scripts/` from bundled skills? Recommendation: investigate HVE Core's `pr-reference` skill (which also uses scripts) to see the pattern, and experiment with a single skill first before packaging all 28.

2. **Agent file naming**: Renaming `agents/*.md` → `agents/*.agent.md` is clean but may break Claude Code. Recommendation: test Claude Code with `.agent.md` first; if it fails, copy files during packaging instead.

3. **Minimum VS Code version**: HVE Core requires `^1.106.1`. The `chatSkills` contribution point may have been introduced in a specific version. Recommendation: check VS Code release notes for the minimum version that supports all needed contribution points.
