# Claude Code CLI Setup for Copilot Studio YAML Development

## Complete Step-by-Step Configuration and Testing Guide

This guide walks you through setting up Claude Code CLI to work with Microsoft Copilot Studio YAML files. The setup enables Claude Code to generate and update agent YAML while using a schema lookup tool to validate syntax without loading the large schema file into context memory.

---

## Prerequisites

Before starting, ensure you have the following installed and configured:

| Requirement | Version | Verification Command |
|-------------|---------|---------------------|
| Node.js | 18+ | `node --version` |
| Python | 3.8+ | `python --version` |
| Claude Code CLI | Latest | `claude --version` |
| Copilot Studio VS Code Extension | Latest | Install via VS Code marketplace |
| Visual Studio Code | Latest | `code --version` |

You also need access to a Power Platform environment with Copilot Studio and an existing agent to test with.

---

## Part 1: Initial Setup

### Step 1.1: Create Project Directory

Create a new directory for your Copilot Studio development project. This will be your working directory for all Claude Code operations.

**Windows (PowerShell):**
```powershell
mkdir C:\Projects\copilot-studio-dev
cd C:\Projects\copilot-studio-dev
```

**Mac/Linux:**
```bash
mkdir -p ~/Projects/copilot-studio-dev
cd ~/Projects/copilot-studio-dev
```

### Step 1.2: Copy the Claude Code Setup Files

Copy the provided setup files into your project directory. The folder structure should look like this:

```
copilot-studio-dev/
├── CLAUDE.md                           # Project instructions for Claude Code
├── REFERENCE.md                        # Reference tables
├── .claude/
│   └── skills/                         # Skills (slash commands)
│       ├── lookup-schema/SKILL.md
│       ├── new-topic/SKILL.md
│       ├── add-action/SKILL.md
│       ├── validate/SKILL.md
│       ├── list-topics/SKILL.md
│       ├── list-kinds/SKILL.md
│       ├── add-knowledge/SKILL.md
│       ├── edit-agent/SKILL.md
│       ├── edit-triggers/SKILL.md
│       ├── add-child-agent/SKILL.md
│       └── add-generative-answers/SKILL.md
├── reference/
│   └── bot.schema.yaml-authoring.json  # YOUR schema file goes here
├── scripts/
│   └── schema-lookup.py                # Schema lookup helper
└── templates/                          # YAML templates
    ├── actions/
    ├── agents/
    ├── knowledge/
    └── topics/
```

**Checkpoint 1:** Verify the structure is correct:

**Windows:**
```powershell
Get-ChildItem -Recurse -Name
```

**Mac/Linux:**
```bash
find . -type f -name "*.md" -o -name "*.py" -o -name "*.yml" | head -20
```

### Step 1.3: Place Your Schema File

Copy your `bot.schema.yaml-authoring.json` file into the `reference/` directory.

**Windows:**
```powershell
Copy-Item "C:\Path\To\bot.schema.yaml-authoring.json" -Destination ".\reference\"
```

**Mac/Linux:**
```bash
cp /path/to/bot.schema.yaml-authoring.json ./reference/
```

### Step 1.4: Install Python Dependencies

```bash
pip install -r requirements.txt
```

**Checkpoint 2:** Verify the schema file is in place and readable:

```bash
python scripts/schema-lookup.py list | head -20
```

Expected output: A list of definition names from your schema file.

---

## Part 2: Install the VS Code Copilot Studio Extension

Follow these steps: https://github.com/microsoft/vscode-copilotstudio

---

## Part 3: Clone an Existing Agent

### Step 3.1: Clone the Agent

Clone the agent via the VS Code Copilot Studio Extension.

The guideline is to put the agent folder into the `src/` directory with the unpacked YAML files.

**Checkpoint 3:** Verify the clone was successful:

**Windows:**
```powershell
Get-ChildItem -Path .\src -Recurse -Filter "*.mcs.yml" | Select-Object -First 10
```

**Mac/Linux:**
```bash
find ./src -name "*.mcs.yml" | head -10
```

You should see YAML files for your agent's topics, actions, and configuration.

### Step 3.2: Understand the Solution Structure

After cloning, your project structure should look like this:

```
copilot-studio-dev/
├── CLAUDE.md
├── .claude/skills/
├── reference/
│   └── bot.schema.yaml-authoring.json
├── scripts/
│   └── schema-lookup.py
├── templates/
└── src/
    └── <your-agent-name>/
        ├── agent.mcs.yml           # Agent metadata
        ├── settings.mcs.yml        # Agent settings
        ├── connectionreferences.mcs.yml
        ├── topics/                 # Topic YAML files
        │   ├── Greeting.mcs.yml
        │   ├── Fallback.mcs.yml
        │   └── ...
        ├── actions/                # Connector actions
        ├── knowledge/              # Knowledge sources
        └── agents/                 # Child agents
```

---

## Part 4: Initialize Claude Code

### Step 4.1: Open in VS Code

Open your project directory in Visual Studio Code:

```bash
code .
```

### Step 4.2: Start Claude Code

In the VS Code terminal, start Claude Code:

```bash
claude
```

Claude Code will automatically read the `CLAUDE.md` file and understand the project context.

**Checkpoint 4:** Verify Claude Code loaded the project instructions:

In Claude Code, type:
```
What skills are available in this project?
```

Claude should list the available skills.

---

## Part 5: Test the Schema Lookup

### Step 5.1: Test Basic Lookup

Test that the schema lookup script works with your actual schema file:

```bash
python scripts/schema-lookup.py lookup SendActivity
```

Expected output: The JSON schema definition for `SendActivity`.

### Step 5.2: Test Search

```bash
python scripts/schema-lookup.py search trigger
```

Expected output: A list of definitions containing "trigger" in their name.

### Step 5.3: Test Resolve (with $ref expansion)

```bash
python scripts/schema-lookup.py resolve Question
```

Expected output: The fully resolved schema for `Question` with all `$ref` references expanded.

### Step 5.4: Test Kinds List

```bash
python scripts/schema-lookup.py kinds
```

Expected output: All available `kind` discriminator values from your schema.

### Step 5.5: Test Validation

```bash
python scripts/schema-lookup.py validate src/<your-agent-name>/topics/Greeting.mcs.yml
```

Expected output: A `[PASS]`/`[WARN]`/`[FAIL]` validation report.

**Checkpoint 5:** All five commands should execute without errors and return meaningful data from your schema file.

---

## Part 6: Test Claude Code Skills

### Step 6.1: Test Lookup Schema Skill

In Claude Code, type:
```
/lookup-schema SendActivity
```

Claude should run the schema lookup script and explain the `SendActivity` definition.

### Step 6.2: Test List Topics Skill

```
/list-topics
```

Claude should find and list all topics in your cloned agent.

### Step 6.3: Test List Kinds Skill

```
/list-kinds
```

Claude should display all available `kind` values from the schema.

**Checkpoint 6:** All skills should work and Claude should use the schema lookup script instead of loading the schema into context.

---

## Part 7: Test YAML Generation

### Step 7.1: Create a New Topic

Ask Claude to create a new topic:

```
Create a new topic called "Product Information" that responds to questions about our products.
It should ask the user which product they're interested in and then provide information.
```

Claude should:
1. Use the schema lookup to verify the correct structure
2. Generate a valid YAML file with unique IDs
3. Save it to the appropriate location in `src/<your-agent-name>/topics/`

### Step 7.2: Validate the Generated Topic

```
/validate src/<your-agent-name>/topics/ProductInformation.topic.mcs.yml
```

Claude should validate the generated YAML against the schema.

**Checkpoint 7:** The generated YAML should pass validation with no errors.

---

## Part 8: Test YAML Modification

### Step 8.1: Add an Action to an Existing Topic

Ask Claude to modify an existing topic:

```
Add a Question action to the greeting topic that asks for the user's name and stores it in Topic.UserName
```

Claude should:
1. Read the existing topic file
2. Look up the Question schema
3. Generate a new Question node with a unique ID
4. Insert it at the appropriate location

### Step 8.2: Verify the Modification

Open the modified file and verify:
- The new action has a unique ID
- All required properties are present
- The file still has valid YAML syntax

**Checkpoint 8:** The modified topic should be valid and include the new action.

---

## Part 9: Push Changes to Environment

After making changes, push them back using the **Copilot Studio VS Code Extension**:

1. Open the VS Code Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Search for "Copilot Studio: Push" or use the extension's push functionality
3. Select the agent and confirm the push
4. Open Copilot Studio in your browser to verify the changes

**Checkpoint 9:** The agent should load correctly in Copilot Studio with all your changes visible.

---

## Part 10: Troubleshooting

### Common Issues and Solutions

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| Schema lookup returns "not found" | Definition name case mismatch | Use `search` to find the correct name |
| YAML parse error on import | Invalid YAML syntax | Check for indentation issues, missing colons |
| Topic doesn't render in canvas | Complex YAML not supported | Simplify the structure, use portal for complex edits |
| Duplicate ID error | Non-unique node IDs | Regenerate IDs for copied nodes |
| Power Fx error | Missing `=` prefix | Ensure expressions start with `=` |
| Validation script fails | PyYAML not installed | Run `pip install -r requirements.txt` |

### Reverting Changes

If something goes wrong, you can re-clone the original agent using the VS Code Extension.

---

## Quick Reference: Available Commands

### Schema Lookup Script

| Command | Description |
|---------|-------------|
| `python scripts/schema-lookup.py lookup <name>` | Look up a specific definition |
| `python scripts/schema-lookup.py search <keyword>` | Search for definitions |
| `python scripts/schema-lookup.py resolve <name>` | Resolve with $ref expansion |
| `python scripts/schema-lookup.py list` | List all definitions |
| `python scripts/schema-lookup.py kinds` | List all kind values |
| `python scripts/schema-lookup.py summary <name>` | Get a compact summary |
| `python scripts/schema-lookup.py validate <file>` | Validate a YAML file |

### Claude Code Skills

| Skill | Description |
|-------|-------------|
| `/lookup-schema <name>` | Look up and explain a schema definition |
| `/new-topic <description>` | Create a new topic |
| `/add-action <type> to <topic>` | Add an action to a topic |
| `/validate <path>` | Validate a YAML file |
| `/list-topics` | List all topics in the solution |
| `/list-kinds` | List all available kind values |
| `/add-knowledge <url>` | Add a public website knowledge source |
| `/edit-agent <what to change>` | Edit agent settings or instructions |
| `/edit-triggers <topic>` | Modify topic trigger phrases |
| `/add-child-agent <description>` | Add a child agent |
| `/add-generative-answers <topic>` | Add generative answer nodes |

---

## Summary Checklist

Use this checklist to verify your setup is complete:

- [ ] Project directory created with correct structure
- [ ] `bot.schema.yaml-authoring.json` placed in `reference/`
- [ ] Python dependencies installed (`pip install -r requirements.txt`)
- [ ] Schema lookup script tested and working
- [ ] VS Code Copilot Studio Extension installed
- [ ] Existing agent cloned to `src/`
- [ ] Claude Code initialized and reading `CLAUDE.md`
- [ ] Skills tested and working
- [ ] YAML generation tested
- [ ] YAML modification tested
- [ ] Changes pushed via VS Code Extension and verified in Copilot Studio

---

## Next Steps

After completing this setup:

1. **Explore the templates** in the `templates/` directory for common patterns
2. **Review the CLAUDE.md** file to understand the limitations and guidelines
3. **Practice with low-risk changes** like trigger phrases and knowledge URLs first
4. **Always test in a development environment** before production
5. **Use version control** (Git) to track your changes

For more information on Copilot Studio YAML syntax, refer to the official Microsoft documentation.
