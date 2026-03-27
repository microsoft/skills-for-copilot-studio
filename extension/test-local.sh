#!/usr/bin/env bash
# Build and locally install the Copilot Studio Skills extension for testing.
# Usage: ./extension/test-local.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXT_DIR="$REPO_ROOT/extension"

echo "==> Generating package.json from template..."
cp "$EXT_DIR/templates/package.template.json" "$EXT_DIR/package.json"

# Populate contributes with discovered agents and skills
node -e "
const fs = require('fs');
const path = require('path');
const pkg = JSON.parse(fs.readFileSync('$EXT_DIR/package.json', 'utf8'));

const agents = fs.readdirSync('$REPO_ROOT/agents')
  .filter(f => f.endsWith('.md'))
  .map(f => ({ path: './agents/' + f }));

const skills = fs.readdirSync('$REPO_ROOT/skills')
  .filter(d => fs.existsSync(path.join('$REPO_ROOT/skills', d, 'SKILL.md')))
  .map(d => ({ path: './skills/' + d + '/SKILL.md' }));

pkg.contributes = {};
if (agents.length) pkg.contributes.chatAgents = agents;
if (skills.length) pkg.contributes.chatSkills = skills;

fs.writeFileSync('$EXT_DIR/package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('   ' + agents.length + ' agents, ' + skills.length + ' skills');
"

# Ensure a README exists for vsce
if [ ! -f "$EXT_DIR/README.md" ]; then
  echo "# Copilot Studio Skills" > "$EXT_DIR/README.md"
  echo "   (created placeholder README.md)"
fi

# Remove icon field if icon.png doesn't exist
if [ ! -f "$EXT_DIR/icon.png" ]; then
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$EXT_DIR/package.json', 'utf8'));
    delete pkg.icon;
    fs.writeFileSync('$EXT_DIR/package.json', JSON.stringify(pkg, null, 2) + '\n');
  "
  echo "   (removed icon field — no icon.png found)"
fi

echo "==> Packaging extension..."
cd "$EXT_DIR"
npx --yes @vscode/vsce package --no-dependencies --allow-missing-repository 2>&1

VSIX=$(ls -t *.vsix 2>/dev/null | head -1)
if [ -z "$VSIX" ]; then
  echo "ERROR: No .vsix file produced"
  exit 1
fi

echo ""
echo "==> Installing $VSIX..."
CODE_CMD="${CODE_CMD:-$(command -v code 2>/dev/null || echo "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code")}"
"$CODE_CMD" --install-extension "$EXT_DIR/$VSIX"

echo ""
echo "==> Done! Reload VS Code to activate the extension."
echo "    To uninstall: $CODE_CMD --uninstall-extension TBD.copilot-studio-skills"
