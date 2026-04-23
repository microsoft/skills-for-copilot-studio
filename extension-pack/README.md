## Copilot Studio Development Bundle

One-click install of everything you need to author, test, and manage [Microsoft Copilot Studio](https://aka.ms/CopilotStudio) agents in VS Code.

## Included extensions

| Extension | Publisher | Purpose |
|-----------|-----------|---------|
| [Copilot Studio Skills](https://marketplace.visualstudio.com/items?itemName=coatsy.copilot-studio-skills) | coatsy | YAML authoring, testing, and management skills for GitHub Copilot Chat |
| [Copilot Studio](https://marketplace.visualstudio.com/items?itemName=ms-copilotstudio.vscode-copilotstudio) | Microsoft | Push, pull, clone agents; provides the LSP binary |

## Prerequisites

* [VS Code](https://code.visualstudio.com/) 1.106.1 or later
* [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) extension
* [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat) extension
* [Node.js](https://nodejs.org/) 22+

## Getting started

1. Install this extension pack from the Marketplace
2. Open a workspace containing a Copilot Studio agent (or clone one with `@copilot-studio-manage`)
3. Open Copilot Chat and start working with your agent

See [SETUP_GUIDE.md](https://github.com/microsoft/skills-for-copilot-studio/blob/main/SETUP_GUIDE.md) for a full end-to-end walkthrough.

## Disclaimer

This extension pack is an experimental research project, not an officially supported Microsoft product. The Copilot Studio YAML schema may change without notice. Always review and validate generated YAML before pushing to your environment.

## License

[MIT](LICENSE)
