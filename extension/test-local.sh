#!/usr/bin/env bash
# Build and locally install the Copilot Studio Skills extension for testing.
# Usage: ./extension/test-local.sh [--package-only]
#
# Environment variables:
#   CODE_CMD        Path to the VS Code CLI (default: auto-detected)
#   EXTENSIONS_DIR  Custom extensions directory for install (optional)
set -euo pipefail

PACKAGE_ONLY=false
[[ "${1:-}" == "--package-only" ]] && PACKAGE_ONLY=true

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXT_DIR="$REPO_ROOT/extension"
STAGE_DIR="$EXT_DIR/.staging"

# On Windows (Git Bash / MSYS2), convert Unix paths to Windows paths for Node.js.
# Node on Windows cannot resolve /d/source/... and produces D:\d\source\... instead.
# Use cygpath -m for forward-slash Windows paths (D:/source/...) which Node handles
# correctly and which survive bash double-quote expansion in node -e strings.
if command -v cygpath &>/dev/null; then
  STAGE_DIR_NODE="$(cygpath -m "$STAGE_DIR")"
  EXT_DIR_NODE="$(cygpath -m "$EXT_DIR")"
else
  STAGE_DIR_NODE="$STAGE_DIR"
  EXT_DIR_NODE="$EXT_DIR"
fi

# Clean and create staging directory
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"

echo "==> Staging artifacts..."

# Copy agents, renaming .md → .agent.md for VS Code chatAgents compatibility
mkdir -p "$STAGE_DIR/agents"
for f in "$REPO_ROOT/agents"/*.md; do
  base="$(basename "$f" .md)"
  cp "$f" "$STAGE_DIR/agents/${base}.agent.md"
done

# Copy skills (will strip frontmatter below)
cp -R "$REPO_ROOT/skills" "$STAGE_DIR/skills"

# Copy scripts, templates, and reference files
cp -R "$REPO_ROOT/scripts" "$STAGE_DIR/scripts"
cp -R "$REPO_ROOT/templates" "$STAGE_DIR/templates"
cp -R "$REPO_ROOT/reference" "$STAGE_DIR/reference"

# Copy extension metadata
cp "$EXT_DIR/templates/package.template.json" "$STAGE_DIR/package.json"
cp "$EXT_DIR/LICENSE" "$STAGE_DIR/LICENSE" 2>/dev/null || cp "$REPO_ROOT/LICENSE" "$STAGE_DIR/LICENSE"

# Generate .vscodeignore to control what goes into the VSIX
cat > "$STAGE_DIR/.vscodeignore" << 'IGNORE'
# Exclude everything by default
**

# Include extension essentials
!package.json
!README.md
!LICENSE
!icon.png

# Include agents
!agents/**

# Include skills
!skills/**

# Include bundled scripts (not source)
!scripts/*.bundle.js

# Include templates
!templates/**

# Include reference files
!reference/**

# Exclude dev/build artifacts from included directories
**/node_modules/**
**/package-lock.json
**/*.map
IGNORE

echo "==> Generating package.json with discovered agents and skills..."

# Populate contributes with discovered agents and skills
node -e "
const fs = require('fs');
const path = require('path');
const pkg = JSON.parse(fs.readFileSync('$STAGE_DIR_NODE/package.json', 'utf8'));

const agents = fs.readdirSync('$STAGE_DIR_NODE/agents')
  .filter(f => f.endsWith('.agent.md'))
  .map(f => ({ path: './agents/' + f }));

const skills = fs.readdirSync('$STAGE_DIR_NODE/skills')
  .filter(d => fs.existsSync(path.join('$STAGE_DIR_NODE/skills', d, 'SKILL.md')))
  .map(d => ({ path: './skills/' + d + '/SKILL.md' }));

pkg.contributes = {};
if (agents.length) pkg.contributes.chatAgents = agents;
if (skills.length) pkg.contributes.chatSkills = skills;

fs.writeFileSync('$STAGE_DIR_NODE/package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('   ' + agents.length + ' agents, ' + skills.length + ' skills');
"

# Strip Claude Code-specific frontmatter fields from staged skill files
# (per ADR-001: shared files with frontmatter-only stripping)
echo "==> Stripping Claude Code-specific frontmatter from skills..."
node -e "
const fs = require('fs');
const path = require('path');
const stripFields = new Set(['allowed-tools', 'context', 'agent', 'argument-hint', 'user-invocable']);
const skillsDir = '$STAGE_DIR_NODE/skills';
let stripped = 0;

fs.readdirSync(skillsDir).forEach(d => {
  const skillFile = path.join(skillsDir, d, 'SKILL.md');
  if (!fs.existsSync(skillFile)) return;

  const content = fs.readFileSync(skillFile, 'utf8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fmMatch) return;

  const fmLines = fmMatch[1].split('\n');
  const filtered = [];
  let skipMultiline = false;
  for (const line of fmLines) {
    const fieldMatch = line.match(/^([a-z][a-z0-9-]*):/i);
    if (fieldMatch && stripFields.has(fieldMatch[1])) {
      skipMultiline = true;
      stripped++;
      continue;
    }
    if (skipMultiline) {
      if (line.match(/^  /) || line.match(/^$/)) continue;
      skipMultiline = false;
    }
    filtered.push(line);
  }

  const newFm = '---\n' + filtered.join('\n') + '\n---\n';
  const newContent = newFm + content.slice(fmMatch[0].length);
  fs.writeFileSync(skillFile, newContent);
});
console.log('   Stripped ' + stripped + ' fields across skill files');
"

# Replace ${CLAUDE_SKILL_DIR}/../../ with ../../ in staged skill files
# In the VSIX, skills/<name>/SKILL.md is two levels deep, so ../../ resolves
# to the extension root — the same layout as the source repo.
echo "==> Resolving script paths in skills..."
node -e "
const fs = require('fs');
const path = require('path');
const skillsDir = '$STAGE_DIR_NODE/skills';
let replaced = 0;

fs.readdirSync(skillsDir).forEach(d => {
  const dir = path.join(skillsDir, d);
  if (!fs.statSync(dir).isDirectory()) return;

  fs.readdirSync(dir).filter(f => f.endsWith('.md')).forEach(f => {
    const filePath = path.join(dir, f);
    const content = fs.readFileSync(filePath, 'utf8');
    const updated = content.replace(/\\$\\{CLAUDE_SKILL_DIR\\}\\/\\.\\.\\/\\.\\.\\//g, '../../');
    if (updated !== content) {
      fs.writeFileSync(filePath, updated);
      replaced++;
    }
  });
});
console.log('   Resolved paths in ' + replaced + ' files');
"

# Ensure a README exists for vsce, stripping YAML frontmatter
# (VS Code extension view renders frontmatter as visible text)
if [ -f "$EXT_DIR/README.md" ]; then
  node -e "
    const fs = require('fs');
    const content = fs.readFileSync('$EXT_DIR_NODE/README.md', 'utf8');
    const stripped = content.replace(/^---\n[\s\S]*?\n---\n+/, '');
    fs.writeFileSync('$STAGE_DIR_NODE/README.md', stripped);
  "
elif [ ! -f "$STAGE_DIR/README.md" ]; then
  echo "# Copilot Studio Skills" > "$STAGE_DIR/README.md"
  echo "   (created placeholder README.md)"
fi

# Remove icon field if icon.png doesn't exist
if [ -f "$EXT_DIR/icon.png" ]; then
  cp "$EXT_DIR/icon.png" "$STAGE_DIR/icon.png"
else
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$STAGE_DIR_NODE/package.json', 'utf8'));
    delete pkg.icon;
    fs.writeFileSync('$STAGE_DIR_NODE/package.json', JSON.stringify(pkg, null, 2) + '\n');
  "
  echo "   (removed icon field — no icon.png found)"
fi

echo "==> Packaging extension..."
cd "$STAGE_DIR"
npx --yes @vscode/vsce package --no-dependencies --allow-missing-repository 2>&1

VSIX=$(ls -t *.vsix 2>/dev/null | head -1)
if [ -z "$VSIX" ]; then
  echo "ERROR: No .vsix file produced"
  exit 1
fi

# Move VSIX to extension directory
mv "$STAGE_DIR/$VSIX" "$EXT_DIR/$VSIX"

if [ "$PACKAGE_ONLY" = true ]; then
  echo ""
  echo "==> Done! VSIX built at extension/$VSIX"
  exit 0
fi

echo ""
echo "==> Installing $VSIX..."
CODE_CMD="${CODE_CMD:-$(command -v code 2>/dev/null || echo "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code")}"

INSTALL_ARGS=(--install-extension "$EXT_DIR/$VSIX")
if [ -n "${EXTENSIONS_DIR:-}" ]; then
  INSTALL_ARGS=(--extensions-dir "$EXTENSIONS_DIR" "${INSTALL_ARGS[@]}")
fi

"$CODE_CMD" "${INSTALL_ARGS[@]}"

echo ""
echo "==> Done! Reload VS Code to activate the extension."
echo "    To uninstall: $CODE_CMD --uninstall-extension TBD.copilot-studio-skills"
