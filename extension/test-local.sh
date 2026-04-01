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

# Auto-discover skill references in agent body text and add them to frontmatter.
# Agents reference skills as /copilot-studio:<skill-name> in their body but may
# not declare them in the skills: frontmatter array. VS Code requires skills to
# be listed in frontmatter, so we scan and inject missing ones automatically.
echo "==> Auto-discovering skill references in agents..."
node -e "
const fs = require('fs');
const path = require('path');
const agentsDir = path.join('$STAGE_DIR_NODE', 'agents');
const skillsDir = path.join('$STAGE_DIR_NODE', 'skills');

// Build set of valid skill names (directories with SKILL.md)
const validSkills = new Set(
  fs.readdirSync(skillsDir).filter(d =>
    fs.existsSync(path.join(skillsDir, d, 'SKILL.md'))
  )
);

let totalAdded = 0;

fs.readdirSync(agentsDir)
  .filter(f => f.endsWith('.agent.md'))
  .forEach(f => {
    const filePath = path.join(agentsDir, f);
    const content = fs.readFileSync(filePath, 'utf8');

    // Split frontmatter from body
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!fmMatch) return;

    const fmText = fmMatch[1];
    const body = fmMatch[2];

    // Parse existing skills from frontmatter
    const existingSkills = new Set();
    const skillsLineMatch = fmText.match(/^skills:\s*$/m);
    if (skillsLineMatch) {
      const afterSkills = fmText.slice(fmText.indexOf(skillsLineMatch[0]) + skillsLineMatch[0].length);
      for (const line of afterSkills.split(/\r?\n/)) {
        const itemMatch = line.match(/^\s+-\s+(.+)$/);
        if (itemMatch) existingSkills.add(itemMatch[1].trim());
        else if (line.match(/^\S/)) break; // next top-level key
      }
    }

    // Scan body for /copilot-studio:<skill-name> references
    const refPattern = /\/copilot-studio:([a-z][a-z0-9-]*)/g;
    const referencedSkills = new Set();
    let match;
    while ((match = refPattern.exec(body)) !== null) {
      const skillName = match[1];
      if (validSkills.has(skillName) && !existingSkills.has(skillName)) {
        referencedSkills.add(skillName);
      }
    }

    if (referencedSkills.size === 0) return;

    // Rebuild frontmatter with merged skills list
    const allSkills = [...existingSkills, ...referencedSkills];
    const skillsYaml = 'skills:\n' + allSkills.map(s => '  - ' + s).join('\n');

    let newFm;
    if (skillsLineMatch) {
      // Replace existing skills block
      const lines = fmText.split(/\r?\n/);
      const newLines = [];
      let inSkills = false;
      for (const line of lines) {
        if (line.match(/^skills:\s*$/)) {
          inSkills = true;
          newLines.push(skillsYaml);
          continue;
        }
        if (inSkills) {
          if (line.match(/^\s+-\s+/)) continue; // skip old items
          inSkills = false;
        }
        newLines.push(line);
      }
      newFm = newLines.join('\n');
    } else {
      // No skills key yet — append before closing ---
      newFm = fmText + '\n' + skillsYaml;
    }

    const newContent = '---\n' + newFm + '\n---\n' + body;
    fs.writeFileSync(filePath, newContent);
    totalAdded += referencedSkills.size;
    console.log('   ' + f + ': added ' + referencedSkills.size + ' skills (' + [...referencedSkills].join(', ') + ')');
  });

console.log('   Total: ' + totalAdded + ' skill declarations added');
"

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

# Populate contributes with discovered agents and skills (including name/description)
node -e "
const fs = require('fs');
const path = require('path');
const pkg = JSON.parse(fs.readFileSync('$STAGE_DIR_NODE/package.json', 'utf8'));

// Extract name and description from YAML frontmatter
function parseFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const fm = {};
  let currentKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-z][a-z0-9-]*):\s*(.*)$/i);
    if (kv) {
      currentKey = kv[1];
      const val = kv[2].replace(/^>/, '').trim();
      if (val) fm[currentKey] = val;
      else fm[currentKey] = '';
    } else if (currentKey && line.match(/^\s+\S/)) {
      fm[currentKey] = ((fm[currentKey] || '') + ' ' + line.trim()).trim();
    }
  }
  return fm;
}

const agents = fs.readdirSync('$STAGE_DIR_NODE/agents')
  .filter(f => f.endsWith('.agent.md'))
  .map(f => {
    const fm = parseFrontmatter(path.join('$STAGE_DIR_NODE/agents', f));
    const entry = { path: './agents/' + f };
    if (fm.name) entry.name = fm.name;
    if (fm.description) entry.description = fm.description;
    return entry;
  });

const skills = fs.readdirSync('$STAGE_DIR_NODE/skills')
  .filter(d => fs.existsSync(path.join('$STAGE_DIR_NODE/skills', d, 'SKILL.md')))
  .map(d => {
    const fm = parseFrontmatter(path.join('$STAGE_DIR_NODE/skills', d, 'SKILL.md'));
    const entry = { path: './skills/' + d + '/SKILL.md' };
    entry.name = d;
    if (fm.description) entry.description = fm.description;
    return entry;
  });

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
    const stripped = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n+/, '');
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
echo "    To uninstall: $CODE_CMD --uninstall-extension coatsy.copilot-studio-skills"
