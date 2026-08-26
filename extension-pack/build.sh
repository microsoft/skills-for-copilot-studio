#!/usr/bin/env bash
# Build and optionally install the Copilot Studio Development Bundle extension pack.
# Usage: ./extension-pack/build.sh [--package-only]
#
# Environment variables:
#   CODE_CMD        Path to the VS Code CLI (default: auto-detected)
#   EXTENSIONS_DIR  Custom extensions directory for install (optional)
set -euo pipefail

PACKAGE_ONLY=false
[[ "${1:-}" == "--package-only" ]] && PACKAGE_ONLY=true

PACK_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Validating extension pack..."

# Verify required files exist
for f in package.json README.md icon.png LICENSE; do
  if [ ! -f "$PACK_DIR/$f" ]; then
    echo "ERROR: Missing required file: $f"
    exit 1
  fi
done

# Validate package.json has extensionPack field
node -e "
const pkg = JSON.parse(require('fs').readFileSync('$(cygpath -m "$PACK_DIR" 2>/dev/null || echo "$PACK_DIR")/package.json', 'utf8'));
if (!pkg.extensionPack || !pkg.extensionPack.length) {
  console.error('ERROR: package.json missing extensionPack array');
  process.exit(1);
}
console.log('   Extension pack: ' + pkg.displayName + ' v' + pkg.version);
console.log('   Bundled extensions: ' + pkg.extensionPack.join(', '));
"

echo "==> Packaging extension pack..."
cd "$PACK_DIR"
npx --yes @vscode/vsce package --no-dependencies --allow-missing-repository 2>&1

VSIX=$(ls -t *.vsix 2>/dev/null | head -1)
if [ -z "$VSIX" ]; then
  echo "ERROR: No .vsix file produced"
  exit 1
fi

if [ "$PACKAGE_ONLY" = true ]; then
  echo ""
  echo "==> Done! VSIX built at extension-pack/$VSIX"
  exit 0
fi

echo ""
echo "==> Installing $VSIX..."
CODE_CMD="${CODE_CMD:-$(command -v code 2>/dev/null || echo "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code")}"

INSTALL_ARGS=(--install-extension "$PACK_DIR/$VSIX")
if [ -n "${EXTENSIONS_DIR:-}" ]; then
  INSTALL_ARGS=(--extensions-dir "$EXTENSIONS_DIR" "${INSTALL_ARGS[@]}")
fi

"$CODE_CMD" "${INSTALL_ARGS[@]}"

echo ""
echo "==> Done! Reload VS Code to activate the extension pack."
echo "    To uninstall: $CODE_CMD --uninstall-extension coatsy.copilot-studio-development-bundle"
