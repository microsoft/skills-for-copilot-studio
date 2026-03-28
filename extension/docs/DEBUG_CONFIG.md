---
title: "Debug Configuration Reference"
description: "VS Code launch.json configurations for debugging the Copilot Studio Skills extension in a self-hosted dev build"
author: Microsoft
ms.date: 2026-03-28
ms.topic: reference
---

This document provides `launch.json` configurations for debugging the Copilot Studio Skills extension using a self-hosted VS Code build. For instructions on building VS Code from source, see [LOCAL_DEV_HOST.md](LOCAL_DEV_HOST.md).

> [!NOTE]
> The Copilot Studio Skills extension contributes chat agents and skills. To test chat functionality in the Extension Development Host, install [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) and [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat) in the dev host's extensions directory. See [required extensions](LOCAL_DEV_HOST.md#required-extensions-for-chat-integration) for details.

## Launch configurations

Add these entries to `.vscode/launch.json` in the `skills-for-copilot-studio` repository.

### Launch Extension Development Host (self-hosted)

This configuration launches the Extension Development Host using the locally built VS Code instance with isolated user data and extensions directories:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Extension (Dev Host)",
      "type": "extensionHost",
      "request": "launch",
      "runtimeExecutable": "${env:VSCODE_DEV_PATH}/scripts/code-cli.sh",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}/extension/.staging",
        "--user-data-dir=${workspaceFolder}/.vscode-dev-data",
        "--extensions-dir=${workspaceFolder}/.vscode-dev-extensions"
      ],
      "outFiles": [
        "${workspaceFolder}/extension/.staging/**/*.js"
      ],
      "preLaunchTask": "Package Extension"
    }
  ]
}
```

Set the `VSCODE_DEV_PATH` environment variable to the absolute path of your local VS Code clone (for example, `~/repos/vscode` or `C:\repos\vscode`).

> [!TIP]
> On Windows, replace `code-cli.sh` with `code-cli.bat` in the `runtimeExecutable` path.

### Attach to Extension Host process

Use this configuration to attach the debugger to an already-running Extension Development Host:

```json
{
  "name": "Attach to Extension Host",
  "type": "node",
  "request": "attach",
  "port": 5870,
  "restart": true,
  "outFiles": [
    "${workspaceFolder}/extension/.staging/**/*.js"
  ]
}
```

To use this, launch the dev host with the `--inspect-extensions=5870` flag:

```bash
bash scripts/code.sh --user-data-dir .vscode-dev-data \
         --extensions-dir .vscode-dev-extensions \
         --inspect-extensions=5870
```

### Launch with stable VS Code (no dev build)

For quick testing without a self-hosted build, this configuration uses the standard VS Code binary:

```json
{
  "name": "Launch Extension (Stable)",
  "type": "extensionHost",
  "request": "launch",
  "args": [
    "--extensionDevelopmentPath=${workspaceFolder}/extension/.staging",
    "--user-data-dir=${workspaceFolder}/.vscode-dev-data",
    "--extensions-dir=${workspaceFolder}/.vscode-dev-extensions"
  ],
  "outFiles": [
    "${workspaceFolder}/extension/.staging/**/*.js"
  ],
  "preLaunchTask": "Package Extension"
}
```

Both launch configurations reference the "Package Extension" task defined in `.vscode/tasks.json`, which runs `test-local.sh --package-only` to stage the extension before the debug session starts.

## Setting breakpoints

### Skill and agent resolution

The extension resolves skills and agents at startup by scanning the `skills/` and `agents/` directories. To debug resolution:

1. Open the bundled script files under `extension/.staging/scripts/`.
2. Set breakpoints on file-system read operations that scan for `SKILL.md` or `.agent.md` files.
3. Launch the Extension Development Host and trigger agent discovery by opening Copilot Chat.

### Copilot Chat integration

To inspect how the extension registers participants with GitHub Copilot Chat:

1. Set breakpoints in the `package.json` generation logic in `test-local.sh` (the Node.js inline scripts).
2. After installing, set breakpoints in the staged extension code that handles chat participant registration.
3. Open Copilot Chat and type `@` to trigger participant enumeration.

## Tips

- Use `--disable-extensions` in launch args to run without other extensions, isolating the debug session to only the Copilot Studio Skills extension.
- The `--user-data-dir` and `--extensions-dir` flags prevent the debug session from interfering with your primary VS Code configuration.
- When debugging native module issues, add `"env": {"NODE_DEBUG": "module"}` to the launch configuration to trace module resolution.
