---
user-invocable: true
description: Create eval test cases for a Copilot Studio skill. Guides through writing evals.json with prompts and deterministic checks for YAML-producing skills.
argument-hint: <skill name>
allowed-tools: Read, Write, Glob
context: fork
---

# Create Skill Eval

Guide the user through creating eval test cases for a Copilot Studio plugin skill. Evals test that a skill produces correct output when invoked.

## How the eval system works

The eval harness (`evals/evaluate.py`) works by:
1. Copying a **fixture agent** into a temp workspace
2. Running `claude -p "<prompt>"` (or `copilot -p`) which invokes the skill
3. Checking the **output files and response text** against deterministic checks
4. Producing a JSON results file and HTML report

## What can be tested right now

**Authoring skills** that produce YAML files (topics, agents, knowledge sources, etc.) are the best candidates. The harness supports these check types:

| Check | What it validates | Use for |
|-------|------------------|---------|
| `files_created` | Expected files were created/modified (glob pattern) | All authoring skills |
| `schema_validate` | Full Copilot Studio schema validation (kind, required fields, IDs, Power Fx, scopes) | All YAML-producing skills |
| `yaml_structure` | Specific YAML path has expected value, min array length, or contains string | Structural assertions |
| `content_contains` | Keywords from prompt appear in output files | Domain relevance |
| `no_placeholders` | No `_REPLACE`, `TODO`, or `FIXME` markers left | Template completion |
| `stdout_contains` | CLI response text contains expected strings | Reference/info skills |
| `stdout_not_contains` | CLI response does NOT contain error strings | Error absence |
| `exit_code` | CLI exited with expected code | All skills |
| `yaml_unchanged` | Specific file or YAML path was NOT modified by the skill | Preservation testing |

**Not yet testable**: Integration skills that call external APIs (chat-directline, manage-agent) — these need script mocking which isn't implemented yet.

## Available fixtures

Fixtures are pre-built agent directories in `evals/fixtures/`:

- **basic-agent** — Minimal agent with `GenerativeActionsEnabled: false`, one Greeting topic. Use for most authoring skill evals.
- **agent-with-mcp-action** — Same as basic-agent plus two MCP action files (`SearchDocs.mcs.yml` in Invoker mode, `CustomMCP.mcs.yml` in Maker mode with ManualTaskInput). Use for action-editing skill evals.
- **empty-workspace** — No agent files (just `.gitkeep`). Use for negative-path testing (e.g., skill should refuse to run without an agent).

If the skill being tested needs a richer agent (e.g., existing topics to modify, knowledge sources), note that the fixture would need to be created first.

## Instructions

1. **Identify the target skill.** If `$ARGUMENTS` is provided, use it as the skill name. Otherwise ask the user which skill they want to create evals for.

2. **Read the skill's SKILL.md** to understand what it does:
   ```
   Glob: skills/<skill-name>/SKILL.md
   ```
   Understand: What does the skill produce? What YAML kinds? What files does it create/modify?

3. **Check if evals already exist:**
   ```
   Glob: evals/skills/<skill-name>.json
   ```
   If yes, read them and offer to add more test cases. Note the highest existing eval ID.

4. **Guide the user through creating test cases.** For each eval, gather:

   - **name**: Short descriptive title (e.g., "IT support topic with OnRecognizedIntent trigger")
   - **prompt**: The full prompt that will be sent to `claude -p`. IMPORTANT: The prompt MUST explicitly reference the skill name (e.g., "Use the new-topic skill to...") so that the CLI invokes the correct skill.
   - **fixture**: Which fixture agent to use (default: `basic-agent`)
   - **checks**: What to validate about the output

5. **Help the user define checks.** Based on the skill type:

   For **topic-creating skills** (new-topic, add-generative-answers):
   ```json
   {
     "files_created": [{"pattern": "topics/*.topic.mcs.yml", "min_count": 1}],
     "schema_validate": true,
     "yaml_structure": [
       {"path": "kind", "equals": "AdaptiveDialog"},
       {"path": "beginDialog.kind", "equals": "<trigger-type>"}
     ],
     "content_contains": ["<domain keywords>"],
     "no_placeholders": true
   }
   ```

   For **agent-editing skills** (edit-agent):
   ```json
   {
     "files_created": [{"pattern": "agent.mcs.yml", "min_count": 1}],
     "schema_validate": true,
     "yaml_structure": [
       {"path": "kind", "equals": "GptComponentMetadata"}
     ],
     "yaml_unchanged": [
       {"file": "topics/Greeting.topic.mcs.yml"}
     ],
     "content_contains": ["<expected content>"],
     "no_placeholders": true
   }
   ```

   For **node-adding skills** (add-node, add-adaptive-card):
   ```json
   {
     "files_created": [{"pattern": "topics/*.topic.mcs.yml", "min_count": 1}],
     "schema_validate": true,
     "content_contains": ["<node-specific keywords>"],
     "no_placeholders": true
   }
   ```

   For **knowledge/variable skills** (add-knowledge, add-global-variable):
   ```json
   {
     "files_created": [{"pattern": "knowledge/*.mcs.yml", "min_count": 1}],
     "schema_validate": true,
     "no_placeholders": true
   }
   ```

   For **reference/query skills** (lookup-schema, list-kinds, best-practices):
   ```json
   {
     "stdout_contains": ["<expected content in response>"],
     "exit_code": 0
   }
   ```

6. **Recommend at least 3 test cases** that cover different scenarios. For example, for new-topic:
   - Different trigger types (OnRecognizedIntent, OnConversationStart, OnUnknownIntent)
   - Different complexity levels (simple message, multi-step with questions, branching)
   - Edge cases relevant to the skill

7. **Write the evals.json file:**
   ```
   Write: evals/skills/<skill-name>.json
   ```

   Format:
   ```json
   {
     "skill_name": "<skill-name>",
     "evals": [
       {
         "id": 1,
         "name": "<short descriptive title>",
         "prompt": "Use the <skill-name> skill to <task description>",
         "fixture": "basic-agent",
         "mock_scripts": [],
         "checks": { ... }
       }
     ]
   }
   ```

8. **Tell the user how to run the evals:**
   ```
   python3 evals/evaluate.py --skill <skill-name> --verbose
   ```
   Or for all skills: `node evals/run.js`

   To generate the HTML report: `python3 evals/report.py evals/results/<timestamp>/`

## Important guidelines

- Each prompt MUST start with "Use the <skill-name> skill to..." to ensure the CLI invokes the right skill
- Keep prompts specific enough that checks can be deterministic (mention exact names, values, counts)
- Use `schema_validate: true` for ALL skills that produce YAML — it's the most powerful check
- `content_contains` keywords should come directly from the prompt to verify domain relevance
- Don't create evals for deprecated skills (chat-with-agent, directline-chat)
- Eval IDs must be unique integers within a skill's evals.json

## Advanced check features

### File selectors in yaml_structure
When a skill creates or modifies multiple YAML files, use the `file` field to target a specific file:
```json
{"file": "topics/*.topic.mcs.yml", "path": "beginDialog.kind", "equals": "OnRecognizedIntent"}
```

### Array-index navigation
Use numeric segments in dotted paths to index into arrays:
```json
{"path": "beginDialog.actions.0.kind", "equals": "SendActivity"}
{"path": "conversationStarters.1.title", "contains": "FAQ"}
```

### yaml_unchanged for preservation testing
Verify that editing one part of a file doesn't corrupt other parts:
```json
{
  "yaml_unchanged": [
    {"file": "agent.mcs.yml"},
    {"file": "actions/CustomMCP.mcs.yml", "path": "inputs"}
  ]
}
```
- Whole-file: omit `path` to assert the entire file is byte-identical to the fixture
- Path-level: include `path` to assert only that specific YAML value survived unchanged
