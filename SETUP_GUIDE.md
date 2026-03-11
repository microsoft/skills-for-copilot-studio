# Skills for Copilot Studio — Setup Guide

This guide walks you through setting up the plugin and using it end-to-end: install, clone an agent, author changes, push, test, and troubleshoot.

---

## Prerequisites

| Requirement | Version | Verification |
|-------------|---------|-------------|
| Node.js | 18+ | `node --version` |
| Claude Code or GitHub Copilot CLI | Latest | `claude --version` or equivalent |
| VS Code | Latest | `code --version` |
| Copilot Studio VS Code Extension | Latest | [Install from marketplace](https://github.com/microsoft/vscode-copilotstudio) |

You also need access to a Power Platform environment with Copilot Studio and an existing agent.

---

## 1. Install the Plugin

### Option A: Install from marketplace (recommended)

```bash
/plugin marketplace add microsoft/skills-for-copilot-studio
/plugin install copilot-studio@microsoft/skills-for-copilot-studio
```

Once installed, the plugin is available globally.

> **Important: Enable automatic updates.** After installing, open your plugin/marketplace settings and turn on auto-updates for this plugin. The skills and schema references are updated frequently with new Copilot Studio features, best practices, and bug fixes. With auto-updates enabled, you always get the latest improvements without reinstalling. In Claude Code, type `/plugin`, navigate to "Skills for Copilot Studio", and enable the auto-update toggle.

### Option B: Run locally from a clone

```bash
git clone https://github.com/microsoft/skills-for-copilot-studio.git

# Load for a single session:
claude --plugin-dir /path/to/skills-for-copilot-studio

# Or install persistently from the clone:
claude plugin install /path/to/skills-for-copilot-studio --scope user
```

To verify, type `/` in the input — you should see `copilot-studio:author`, `copilot-studio:test`, and `copilot-studio:troubleshoot` in the autocomplete menu.

---

## 2. Clone an Agent

Use the **Copilot Studio VS Code Extension** to clone your agent into a project directory. After cloning, you should see `agent.mcs.yml`, `settings.mcs.yml`, and directories like `topics/`, `actions/`, and `knowledge/`.

---

## 3. Author Changes

Open Claude Code (or your preferred tool) in the cloned agent's directory.

### Explore the agent

```
/copilot-studio:author What topics does this agent have? Give me an overview.
```

### Create a new topic

```
/copilot-studio:author Create a new topic called "Product Information" that responds to questions about our products with a message listing our top 3 products.
```

The agent generates a valid YAML file with unique IDs and saves it to the `topics/` directory.

### Validate your changes

```
/copilot-studio:troubleshoot Validate all topics in my agent
```

---

## 4. Push and Publish

1. **Push** changes using the Copilot Studio VS Code Extension:
   - Open the VS Code Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
   - Search for "Copilot Studio: Push"
   - Select the agent and confirm

2. **Publish** in the Copilot Studio UI at [copilotstudio.microsoft.com](https://copilotstudio.microsoft.com):
   - Open your agent and click **Publish**

> **Important**: Pushing creates a **draft**. You must also **publish** to make changes live and testable via the plugin.

---

## 5. Test the Published Agent

The test agent (`/copilot-studio:test`) supports three ways to test:

### Option A: Send a test message (point-test)

Send a single utterance directly to the published agent and see its full response. Requires an **Azure App Registration**:
- **Platform**: Public client / Native (Mobile and desktop applications)
- **Redirect URI**: `http://localhost` (HTTP, not HTTPS)
- **API permissions**: `CopilotStudio.Copilots.Invoke` (granted by admin)

```
/copilot-studio:test Send "What products do you offer?" to the published agent
```

The test agent will ask for your App Registration Client ID on first use, authenticate via device code flow, and return the agent's full response. Multi-turn is supported — the agent reuses the conversation automatically.

### Option B: Run a batch test suite (Copilot Studio Kit)

If you have the [Power CAT Copilot Studio Kit](https://github.com/microsoft/Power-CAT-Copilot-Studio-Kit) installed in your environment, you can run pre-defined test sets with expected responses and pass/fail scoring. Requires an Azure App Registration with Dataverse permissions.

```
/copilot-studio:test Run my test suite
```

The agent walks you through configuring the Dataverse connection on first use.

### Option C: Analyze evaluation results

Run evaluations in the Copilot Studio UI, export the results as CSV, and have the agent analyze failures and propose fixes:

```
/copilot-studio:test Analyze my evaluation results from ~/Downloads/Evaluate MyAgent.csv
```

---

## 6. Troubleshoot and Fix

If the agent responds with incorrect or outdated information:

```
/copilot-studio:troubleshoot The agent is making up product details that aren't accurate. It seems to be hallucinating instead of using real data.
```

The troubleshoot agent will diagnose the issue — in this case, the agent is generating ungrounded responses because it has no knowledge source to draw from. Fix it by adding one:

```
/copilot-studio:author Add a knowledge source pointing to our product catalog at https://contoso.com/products
```

Then push, publish, and test again to verify the agent now responds with grounded information.

---

## Troubleshooting

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| Schema lookup returns "not found" | Definition name case mismatch | Use `search` to find the correct name |
| YAML parse error on import | Invalid YAML syntax | Check for indentation issues, missing colons |
| Topic doesn't render in canvas | Complex YAML not supported | Simplify the structure, use portal for complex edits |
| Duplicate ID error | Non-unique node IDs | Regenerate IDs for copied nodes |
| Power Fx error | Missing `=` prefix | Ensure expressions start with `=` |
| Plugin not found | Not installed or wrong path | Run `/plugin list` to verify |

If something goes wrong, you can always re-clone the original agent using the VS Code Extension.

---

## Summary Checklist

- [ ] Plugin installed from marketplace or loaded locally
- [ ] VS Code Copilot Studio Extension installed
- [ ] Agent cloned into project directory
- [ ] `/copilot-studio:author`, `:test`, `:troubleshoot` visible in `/` autocomplete
- [ ] Created a topic with `/copilot-studio:author`
- [ ] Validated with `/copilot-studio:troubleshoot`
- [ ] Pushed and published in Copilot Studio
- [ ] Tested published agent with `/copilot-studio:test`
