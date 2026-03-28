---
title: "Skills for Copilot Studio: Setup Guide"
description: "End-to-end walkthrough for installing the toolkit, cloning an agent, authoring changes, pushing, testing, and troubleshooting"
---

This guide walks you through setting up the toolkit and using it end-to-end: install, clone an agent, author changes, push, test, and troubleshoot.

The toolkit is available in two forms:

* **VS Code extension** for GitHub Copilot Chat (recommended for VS Code users)
* **Claude Code plugin** for terminal-based workflows

---

## Prerequisites

| Requirement                         | Version | Verification                                                                                   |
|-------------------------------------|---------|------------------------------------------------------------------------------------------------|
| Node.js                             | 22+     | `node --version`                                                                               |
| VS Code                             | 1.106.1+| Required for the extension; also provides the LSP binary for push/pull/clone                   |
| Copilot Studio VS Code Extension    | Latest  | [Install from marketplace](https://github.com/microsoft/vscode-copilotstudio)                  |
| GitHub Copilot + Copilot Chat       | Latest  | Required for the VS Code extension path                                                        |
| Claude Code or GitHub Copilot CLI   | Latest  | Required for the Claude Code plugin path; `claude --version`                                   |

You also need access to a Power Platform environment with Copilot Studio and an existing agent.

---

## 1. Install the Toolkit

### Option A: VS Code extension (recommended)

Install from the VS Code Marketplace:

[Install Copilot Studio Skills](https://marketplace.visualstudio.com/items?itemName=TBD.copilot-studio-skills)

Or from the command line:

```bash
code --install-extension TBD.copilot-studio-skills
```

After installing, reload VS Code. The agents and skills appear in GitHub Copilot Chat.

### Option B: Claude Code plugin from marketplace

```bash
/plugin marketplace add microsoft/skills-for-copilot-studio
/plugin install copilot-studio@skills-for-copilot-studio
```

Once installed, the plugin is available globally.

### Option C: Claude Code plugin from a local clone

```bash
git clone https://github.com/microsoft/skills-for-copilot-studio.git

# Load for a single session:
claude --plugin-dir /path/to/skills-for-copilot-studio

# Or install persistently from the clone:
claude plugin install /path/to/skills-for-copilot-studio --scope user
```

### Verify installation

* **VS Code extension**: Open Copilot Chat and type `@`. You should see the Copilot Studio agents (Author, Manage, Test, Troubleshoot) in the list.
* **Claude Code plugin**: Type `/` in the input. You should see `copilot-studio:copilot-studio-manage`, `copilot-studio:copilot-studio-author`, `copilot-studio:copilot-studio-test`, and `copilot-studio:copilot-studio-troubleshoot` in the autocomplete menu.

---

## 2. Clone an Agent

### Option A: Clone via the Manage agent

In Copilot Chat (VS Code) or Claude Code, ask the Manage agent to clone an agent:

```text
Clone an agent from Copilot Studio
```

This walks you through environment selection, agent selection, and downloads the agent files with interactive browser auth (no app registration needed).

### Option B: Clone via VS Code

Use the **Copilot Studio VS Code Extension** to clone your agent into a project directory.

After cloning, you should see `agent.mcs.yml`, `settings.mcs.yml`, and directories like `topics/`, `actions/`, and `knowledge/`.

---

## 3. Author Changes

Open VS Code (or Claude Code) in the cloned agent's directory.

### Explore the agent

Ask the Author agent to describe the agent:

```text
What topics does this agent have? Give me an overview.
```

### Create a new topic

```text
Create a new topic called "Product Information" that responds to questions about our products with a message listing our top 3 products.
```

The Author agent generates a valid YAML file with unique IDs and saves it to the `topics/` directory.

### Validate your changes

Ask the Troubleshoot agent to validate:

```text
Validate all topics in my agent
```

---

## 4. Push and Publish

### Push via the Manage agent (recommended)

Ask the Manage agent to push:

```text
Push my changes to Copilot Studio
```

A browser window may open for sign-in on first use. Tokens are cached after that.

### Push via VS Code

Alternatively, use the Copilot Studio VS Code Extension:
- Open the VS Code Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
- Search for "Copilot Studio: Push"
- Select the agent and confirm

### Publish

After pushing, **publish** in the Copilot Studio UI at [copilotstudio.microsoft.com](https://copilotstudio.microsoft.com):
- Open your agent and click **Publish**

> [!IMPORTANT]
> Pushing creates a **draft**. You must also **publish** to make changes live and testable.

---

## 5. Test the Published Agent

The Test agent supports three ways to test:

### Option A: Send a test message (point-test)

Send a single utterance directly to the published agent and see its full response. Requires an **Azure App Registration**:

* **Platform**: Public client / Native (Mobile and desktop applications)
* **Redirect URI**: `http://localhost` (HTTP, not HTTPS)
* **API permissions**: Add a permission, then APIs my organization uses, search **Power Platform API**, Delegated permissions, expand CopilotStudio, check `CopilotStudio.Copilots.Invoke` (optionally grant admin consent)

```text
Send "What products do you offer?" to the published agent
```

The Test agent asks for your App Registration Client ID on first use, authenticates via device code flow, and returns the agent's full response. Multi-turn is supported; the agent reuses the conversation automatically.

### Option B: Run a batch test suite (Copilot Studio Kit)

If you have the [Power CAT Copilot Studio Kit](https://github.com/microsoft/Power-CAT-Copilot-Studio-Kit) installed in your environment, you can run pre-defined test sets with expected responses and pass/fail scoring. Requires an Azure App Registration with Dataverse permissions.

```text
Run my test suite
```

The Test agent walks you through configuring the Dataverse connection on first use.

### Option C: Analyze evaluation results

Run evaluations in the Copilot Studio UI, export the results as CSV, and have the agent analyze failures and propose fixes:

```text
Analyze my evaluation results from ~/Downloads/Evaluate MyAgent.csv
```

---

## 6. Troubleshoot and Fix

If the agent responds with incorrect or outdated information:

```text
The agent is making up product details that aren't accurate. It seems to be hallucinating instead of using real data.
```

The Troubleshoot agent diagnoses the issue. In this case, the agent is generating ungrounded responses because it has no knowledge source to draw from. Fix it by asking the Author agent:

```text
Add a knowledge source pointing to our product catalog at https://contoso.com/products
```

Then push, publish, and test again to verify the agent now responds with grounded information.

---

## Advanced Debugging with a Self-Hosted VS Code Build

For extension development and deep integration debugging, you can build VS Code from source and use it as an isolated debug host. This avoids cross-contamination with your primary VS Code installation and lets you step through extension host internals.

See [extension/docs/LOCAL_DEV_HOST.md](extension/docs/LOCAL_DEV_HOST.md) for the full setup guide and [extension/docs/DEBUG_CONFIG.md](extension/docs/DEBUG_CONFIG.md) for sample launch.json configurations.

---

## Troubleshooting

| Issue                                  | Possible cause                                    | Solution                                                                        |
|----------------------------------------|---------------------------------------------------|---------------------------------------------------------------------------------|
| Schema lookup returns "not found"      | Definition name case mismatch                     | Use `search` to find the correct name                                           |
| YAML parse error on import             | Invalid YAML syntax                               | Check for indentation issues, missing colons                                    |
| Topic doesn't render in canvas         | Complex YAML not supported                        | Simplify the structure, use portal for complex edits                            |
| Duplicate ID error                     | Non-unique node IDs                               | Regenerate IDs for copied nodes                                                 |
| Power Fx error                         | Missing `=` prefix                                | Ensure expressions start with `=`                                               |
| Plugin not found                       | Not installed or wrong path                       | Run `/plugin list` to verify                                                    |
| Agents not visible in Copilot Chat     | Extension not installed or not activated          | Install the extension and reload VS Code                                        |
| Extension not found (clone/push/pull)  | Copilot Studio VS Code Extension not installed    | [Install from marketplace](https://github.com/microsoft/vscode-copilotstudio)  |
| ConcurrencyVersionMismatch on push     | Stale row versions                                | Pull first, then push                                                           |

If something goes wrong, you can always re-clone the original agent using the Manage agent or the Copilot Studio VS Code Extension.

---

## Summary Checklist

* [ ] Toolkit installed (VS Code extension or Claude Code plugin)
* [ ] Copilot Studio VS Code Extension installed (provides the LSP binary for push/pull/clone)
* [ ] Agent cloned using the Manage agent or VS Code Extension
* [ ] Agents visible in Copilot Chat (`@` menu) or Claude Code (`/` autocomplete)
* [ ] Created a topic with the Author agent
* [ ] Validated with the Troubleshoot agent
* [ ] Pulled, pushed, and published
* [ ] Tested published agent with the Test agent
