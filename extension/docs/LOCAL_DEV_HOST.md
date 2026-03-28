---
title: "Local Dev Host Setup Guide"
description: "Build VS Code from source and use it as an isolated extension debug host for the Copilot Studio Skills extension"
author: Microsoft
ms.date: 2026-03-28
ms.topic: how-to
---

This guide walks you through building VS Code from source and using that self-hosted instance as an isolated debug environment for the Copilot Studio Skills extension.

A self-hosted build avoids cross-contamination with your primary VS Code installation. Extension state, settings, and other extensions remain separate, giving you a clean environment for reproducing issues and stepping through integration code.

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Git         | 2.x+    | `git --version` |
| Node.js     | 22+     | `node --version` |
| Python      | 3.11+   | Required by native module compilation (node-gyp) |
| C++ toolchain | Platform-specific | See [platform notes](#platform-notes) |
| Disk space  | ~10 GB  | VS Code source, dependencies, and build output |

## Platform notes

### Windows

Install the "Desktop development with C++" workload from Visual Studio Build Tools (or full Visual Studio). This provides `cl.exe`, `msbuild`, and the Windows SDK that node-gyp needs for native modules.

```powershell
# Optional: configure node-gyp to use the installed toolchain
npm config set msvs_version 2022
```

### macOS

Install Xcode Command Line Tools:

```bash
xcode-select --install
```

### Linux (Debian/Ubuntu)

```bash
sudo apt-get install -y build-essential g++ libx11-dev \
  libxkbfile-dev libsecret-1-dev libkrb5-dev
```

See the VS Code [build prerequisites wiki page](https://github.com/microsoft/vscode/wiki/How-to-Contribute#prerequisites) for the full list.

## Step-by-step setup

### 1. Clone VS Code

```bash
git clone https://github.com/microsoft/vscode.git
cd vscode
```

> [!TIP]
> Use `--depth 1` for a shallow clone if you only need the latest commit and want a faster download.

### 2. Install dependencies

```bash
npm install
```

This can take several minutes on first run. If native module compilation fails, check the [troubleshooting](#troubleshooting) section.

### 3. Build in watch mode

```bash
npm run watch
```

Leave this running in a separate terminal. It recompiles automatically when VS Code source files change.

### 4. Launch the dev instance

Open a new terminal and run:

```bash
bash scripts/code.sh
```

This starts a self-hosted VS Code instance built from your local source.

### 5. Isolate user data

To keep the dev instance completely separate from your primary VS Code, specify custom directories:

```bash
bash scripts/code.sh --user-data-dir .vscode-dev-data \
         --extensions-dir .vscode-dev-extensions
```

This prevents the dev instance from reading or modifying any settings, state, or extensions from your primary installation.

## Loading the extension in the dev host

### Option A: Build and install with test-local.sh

Use the `CODE_CMD` environment variable to point `test-local.sh` at the dev build's CLI. When using a custom `--extensions-dir`, also set `EXTENSIONS_DIR` so the extension installs into the same directory the dev host reads from:

```bash
# From the skills-for-copilot-studio repo root
CODE_CMD="/path/to/vscode/scripts/code-cli.sh" \
  EXTENSIONS_DIR=".vscode-dev-extensions" \
  bash extension/test-local.sh
```

On Windows (Git Bash):

```bash
CODE_CMD="/c/path/to/vscode/scripts/code-cli.bat" \
  EXTENSIONS_DIR=".vscode-dev-extensions" \
  bash extension/test-local.sh
```

The dev instance's `code` CLI is located at:

| Platform       | Path                            |
|----------------|---------------------------------|
| macOS / Linux  | `<vscode-repo>/scripts/code-cli.sh` |
| Windows        | `<vscode-repo>/scripts/code-cli.bat` |

> [!IMPORTANT]
> The dev build CLI resolves relative paths from the `vscode/` directory, not from your working directory. Use **absolute paths** for both `CODE_CMD` and the VSIX file, or set `EXTENSIONS_DIR` to let `test-local.sh` handle path resolution.
>
> Without `EXTENSIONS_DIR`, the extension installs to `~/.vscode-oss-dev/extensions/` — which is ignored when the dev host is launched with a custom `--extensions-dir`.

### Required extensions for chat integration

The Copilot Studio Skills extension contributes chat agents and skills that require GitHub Copilot Chat to be present. Install these extensions in the dev host before testing chat functionality:

* [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot)
* [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat)

You can install them via the dev host CLI:

```bash
/path/to/vscode/scripts/code-cli.sh \
  --extensions-dir .vscode-dev-extensions \
  --install-extension GitHub.copilot \
  --install-extension GitHub.copilot-chat
```

### Option B: Launch via launch.json (F5)

See [DEBUG_CONFIG.md](DEBUG_CONFIG.md) for launch configurations that start an Extension Development Host backed by the self-hosted VS Code build.

## Using the automated setup script

A helper script automates the clone, dependency install, build, and launch steps:

```bash
bash extension/setup-devhost.sh
```

The script is idempotent. If the VS Code repo already exists and dependencies are installed, it skips those steps and goes straight to launching the dev instance. Use `--help` for available flags:

```bash
bash extension/setup-devhost.sh --help
```

See [setup-devhost.sh](../setup-devhost.sh) for the full source.

## Troubleshooting

| Issue | Possible cause | Solution |
|-------|----------------|----------|
| `gyp ERR! find Python` | Python not found or wrong version | Install Python 3.11+ and ensure it is on your PATH |
| `gyp ERR! find VS` (Windows) | Missing C++ build tools | Install "Desktop development with C++" from Visual Studio Build Tools |
| `node-gyp` compilation errors (macOS) | Missing Xcode tools | Run `xcode-select --install` |
| `ENOMEM` or out-of-memory during build | Not enough RAM | Close other applications or increase swap space |
| `npm run watch` never finishes | Expected behavior | `npm run watch` runs continuously; open a new terminal for `bash scripts/code.sh` |
| Extension not visible after install | Dev instance not using the right extensions dir | Pass `EXTENSIONS_DIR` to `test-local.sh` or use `--extensions-dir` with `code-cli.sh`; see [Loading the extension](#loading-the-extension-in-the-dev-host) |
| Agents not visible in Copilot Chat | GitHub Copilot Chat not installed in the dev host | Install Copilot and Copilot Chat extensions in the dev host; see [required extensions](#required-extensions-for-chat-integration) |
| `code-cli.sh: command not found` | Wrong path to the dev build CLI | Check that the path points to the `scripts/` directory inside the VS Code repo |
