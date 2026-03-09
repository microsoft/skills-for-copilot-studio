# Skills for Copilot Studio — Setup Guide

## Complete Step-by-Step Configuration and Testing Guide

This guide walks you through setting up the Copilot Studio plugin for your AI coding agent (Claude Code, GitHub Copilot CLI, or any compatible agent). The plugin enables your agent to generate and update Copilot Studio YAML while using a schema lookup tool to validate syntax.

---

## Prerequisites

Before starting, ensure you have the following installed and configured:

| Requirement | Version | Verification Command |
|-------------|---------|---------------------|
| Node.js | 18+ | `node --version` |
| AI coding agent CLI | Latest | `claude --version` or equivalent |
| Copilot Studio VS Code Extension | Latest | Install via VS Code marketplace |
| Visual Studio Code | Latest | `code --version` |

You also need access to a Power Platform environment with Copilot Studio and an existing agent to test with.

---

## Part 1: Install the Plugin

### Step 1.1: Install from GitHub (recommended)

```bash
/plugin marketplace add microsoft/skills-for-copilot-studio
/plugin install copilot-studio@microsoft/skills-for-copilot-studio
```

### Step 1.2: Or install from a local clone

```bash
# For local development/testing without installing:
claude --plugin-dir /path/to/skills-for-copilot-studio

# Or install persistently:
claude plugin install /path/to/skills-for-copilot-studio --scope user
```

### Step 1.3: Verify Installation

Start your AI coding agent and check that the plugin is loaded:

```
What copilot-studio skills are available?
```

The agent should list the available skills prefixed with `copilot-studio:`.

**Checkpoint 1:** All skills should be listed and the schema lookup script should be accessible.

---

## Part 2: Install the VS Code Copilot Studio Extension

Follow these steps: https://github.com/microsoft/vscode-copilotstudio

---

## Part 3: Clone an Existing Agent

### Step 3.1: Create Your Project Directory

```bash
mkdir my-copilot-project
cd my-copilot-project
```

### Step 3.2: Clone the Agent

Use the **Copilot Studio VS Code Extension** to clone your agent into your project directory. The cloned agent will have YAML files for topics, actions, knowledge, and settings.

**Checkpoint 2:** Verify the clone was successful:

```bash
find . -name "*.mcs.yml" | head -10
```

You should see YAML files for your agent's topics, actions, and configuration.

---

## Part 4: Test the Plugin

### Step 4.1: Start Your AI Coding Agent

Open your AI coding agent CLI in the project directory.

### Step 4.2: Test Schema Lookup

```
/copilot-studio:lookup-schema SendActivity
```

The agent should run the schema lookup script and explain the `SendActivity` definition.

### Step 4.3: Test List Topics

```
/copilot-studio:list-topics
```

The agent should find and list all topics in your cloned agent.

### Step 4.4: Test Validation

```
/copilot-studio:validate <path-to-a-topic-file>
```

The agent should validate the YAML against the schema.

**Checkpoint 3:** All skills should work and the agent should use the schema lookup script from the plugin.

---

## Part 5: Test YAML Generation

### Step 5.1: Create a New Topic

Ask the author agent to create a new topic:

```
@copilot-studio:author Create a new topic called "Product Information" that responds to questions about our products.
```

The agent should:
1. Use the schema lookup to verify the correct structure
2. Generate a valid YAML file with unique IDs
3. Save it to the appropriate location in your agent's `topics/` directory

### Step 5.2: Validate the Generated Topic

```
/copilot-studio:validate <path-to-generated-file>
```

**Checkpoint 4:** The generated YAML should pass validation with no errors.

---

## Part 6: Push Changes to Environment

After making changes, push them back using the **Copilot Studio VS Code Extension**:

1. Open the VS Code Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Search for "Copilot Studio: Push" or use the extension's push functionality
3. Select the agent and confirm the push
4. Open Copilot Studio in your browser to verify the changes

**Checkpoint 5:** The agent should load correctly in Copilot Studio with all your changes visible.

---

## Part 7: Set Up Testing (Optional)

To use `/copilot-studio:chat-with-agent` or `/copilot-studio:run-tests`, you need:

1. **Publish** your agent in the Copilot Studio UI (pushing creates a draft; publishing makes it live)
2. **Create an Azure App Registration** with:
   - Platform: Public client / Native
   - Redirect URI: `http://localhost`
   - API permissions: `CopilotStudio.Copilots.Invoke`

3. **Create a `tests/` directory** in your project for configuration files:
   ```bash
   mkdir tests
   ```

4. **Test a single utterance**:
   ```
   /copilot-studio:chat-with-agent Hello
   ```

The skill will guide you through configuring the agent connection on first use.

---

## Troubleshooting

### Common Issues and Solutions

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| Schema lookup returns "not found" | Definition name case mismatch | Use `search` to find the correct name |
| YAML parse error on import | Invalid YAML syntax | Check for indentation issues, missing colons |
| Topic doesn't render in canvas | Complex YAML not supported | Simplify the structure, use portal for complex edits |
| Duplicate ID error | Non-unique node IDs | Regenerate IDs for copied nodes |
| Power Fx error | Missing `=` prefix | Ensure expressions start with `=` |
| Plugin not found | Not installed or wrong path | Run `/plugin list` to verify |

### Reverting Changes

If something goes wrong, you can re-clone the original agent using the VS Code Extension.

---

## Summary Checklist

Use this checklist to verify your setup is complete:

- [ ] Plugin installed from GitHub or loaded locally
- [ ] VS Code Copilot Studio Extension installed
- [ ] Agent cloned into project directory
- [ ] AI coding agent started and plugin skills available
- [ ] Schema lookup tested
- [ ] YAML generation tested
- [ ] Changes pushed via VS Code Extension and verified in Copilot Studio
