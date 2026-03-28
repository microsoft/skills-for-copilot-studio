#!/usr/bin/env bash
#
# setup-devhost.sh
# Clone, build, and launch a self-hosted VS Code dev instance for extension
# debugging. Idempotent: skips completed steps when re-run.
#
# Usage:
#   bash extension/setup-devhost.sh [OPTIONS]
#
# Options:
#   --vscode-dir <path>       VS Code clone location (default: ./vscode)
#   --user-data-dir <path>    Isolated user data directory
#                             (default: .vscode-dev-data)
#   --extensions-dir <path>   Isolated extensions directory
#                             (default: .vscode-dev-extensions)
#   --skip-launch             Clone and build without launching
#   --shallow                 Use --depth 1 for a faster initial clone
#   --help                    Show this help message

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────

VSCODE_DIR="./vscode"
USER_DATA_DIR=".vscode-dev-data"
EXTENSIONS_DIR=".vscode-dev-extensions"
SKIP_LAUNCH=false
SHALLOW=false

# ── Functions ─────────────────────────────────────────────────────────────

usage() {
  sed -n '/^# Usage:/,/^$/p' "$0" | sed 's/^# \?//'
  sed -n '/^# Options:/,/^[^#]/p' "$0" | sed 's/^# \?//'
  exit 0
}

log() {
  local message="$1"
  printf "==> %s\n" "$message"
}

err() {
  local message="$1"
  printf "ERROR: %s\n" "$message" >&2
  exit 1
}

check_prerequisites() {
  local missing=()

  if ! command -v git &>/dev/null; then
    missing+=("git")
  fi
  if ! command -v node &>/dev/null; then
    missing+=("node (Node.js 20+)")
  fi
  if ! command -v yarn &>/dev/null; then
    missing+=("yarn (npm install --global yarn)")
  fi

  if [[ ${#missing[@]} -gt 0 ]]; then
    err "Missing prerequisites: ${missing[*]}. \
See extension/docs/LOCAL_DEV_HOST.md for details."
  fi

  local node_major
  node_major="$(node --version | sed 's/v\([0-9]*\).*/\1/')"
  if (( node_major < 20 )); then
    err "Node.js 20+ required (found v${node_major}). \
See extension/docs/LOCAL_DEV_HOST.md for details."
  fi
}

clone_vscode() {
  if [[ -d "${VSCODE_DIR}/.git" ]]; then
    log "VS Code repo already cloned at ${VSCODE_DIR}, skipping clone."
    return
  fi

  log "Cloning VS Code into ${VSCODE_DIR}..."
  local clone_args=("https://github.com/microsoft/vscode.git" "${VSCODE_DIR}")
  if [[ "${SHALLOW}" == true ]]; then
    git clone --depth 1 "${clone_args[@]}"
  else
    git clone "${clone_args[@]}"
  fi
}

install_deps() {
  if [[ -d "${VSCODE_DIR}/node_modules" ]]; then
    log "Dependencies already installed, skipping yarn install."
    return
  fi

  log "Installing VS Code dependencies (this may take several minutes)..."
  (cd "${VSCODE_DIR}" && yarn)
}

launch_dev() {
  log "Launching self-hosted VS Code dev instance..."
  log "  User data dir:  ${USER_DATA_DIR}"
  log "  Extensions dir: ${EXTENSIONS_DIR}"

  (cd "${VSCODE_DIR}" && yarn dev \
    --user-data-dir "../${USER_DATA_DIR}" \
    --extensions-dir "../${EXTENSIONS_DIR}")
}

# ── Argument Parsing ──────────────────────────────────────────────────────

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --vscode-dir)
        VSCODE_DIR="$2"
        shift 2
        ;;
      --user-data-dir)
        USER_DATA_DIR="$2"
        shift 2
        ;;
      --extensions-dir)
        EXTENSIONS_DIR="$2"
        shift 2
        ;;
      --skip-launch)
        SKIP_LAUNCH=true
        shift
        ;;
      --shallow)
        SHALLOW=true
        shift
        ;;
      --help)
        usage
        ;;
      *)
        err "Unknown option: $1. Use --help for usage."
        ;;
    esac
  done
}

# ── Main ──────────────────────────────────────────────────────────────────

main() {
  parse_args "$@"

  log "Setting up VS Code dev host for extension debugging"
  check_prerequisites
  clone_vscode
  install_deps

  if [[ "${SKIP_LAUNCH}" == true ]]; then
    log "Setup complete. Run 'yarn dev' in ${VSCODE_DIR} to launch."
    log "  Example: cd ${VSCODE_DIR} && yarn dev \\"
    log "    --user-data-dir ../${USER_DATA_DIR} \\"
    log "    --extensions-dir ../${EXTENSIONS_DIR}"
    exit 0
  fi

  launch_dev
}

main "$@"
