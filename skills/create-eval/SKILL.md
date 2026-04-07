---
user-invocable: true
description: Create plugin development eval scenarios (JSON files with natural prompts and deterministic checks for testing plugin skills). NOT for Copilot Studio in-product evaluation — use /copilot-studio:create-eval-set for that.
argument-hint: <scenario name>
allowed-tools: Read, Write, Glob
context: fork
---

# Create Scenario Eval

Guide the user through creating eval test cases for a Copilot Studio plugin scenario. Evals test end-to-end scenarios with natural prompts — the request routes through sub-agents (e.g., Author agent) which invoke skills internally.

## How the eval system works

The eval harness (`evals/evaluate.py`) works by:
1. Copying a **fixture agent** into a temp workspace
2. Running `claude -p "<prompt>"` with a PreToolUse hook that traces skill invocations inside sub-agents
3. Checking **routing** (which agents and skills were invoked), **output files**, and **response text** against deterministic checks
4. Producing a JSON results file and HTML report

## What can be tested right now

**Authoring scenarios** that produce YAML files (topics, agents, knowledge sources, etc.) are the best candidates. The harness supports these check types:

| Check | What it validates | Use for |
|-------|------------------|---------|
| `agent_invoked` | Expected sub-agent was dispatched (e.g., Author agent) | Routing verification |
| `agent_not_invoked` | Unwanted sub-agents were NOT dispatched | Routing verification |
| `skill_invoked` | Expected skill was invoked (traced inside sub-agents via hook) | Skill routing |
| `skill_not_invoked` | Unwanted skills were NOT invoked | Skill routing |
| `files_created` | Expected files were created/modified (glob pattern) | All authoring scenarios |
| `schema_validate` | Full Copilot Studio schema validation (kind, required fields, IDs, Power Fx, scopes) | All YAML-producing scenarios |
| `yaml_structure` | Specific YAML path has expected value, min array length, or contains string | Structural assertions |
| `content_contains` | Keywords from prompt appear in output files | Domain relevance |
| `no_placeholders` | No `_REPLACE`, `TODO`, or `FIXME` markers left | Template completion |
| `stdout_contains` | CLI response text contains expected strings | Reference/info scenarios |
| `stdout_not_contains` | CLI response does NOT contain error strings | Error absence |
| `exit_code` | CLI exited with expected code | All scenarios |
| `yaml_unchanged` | Specific file or YAML path was NOT modified | Preservation testing |

Note: `no_placeholders` runs automatically when any `.mcs.yml` file is changed, unless explicitly set to `false`.

**Not yet testable**: Integration scenarios that call external APIs (chat-directline, manage-agent) — these need script mocking which isn't implemented yet.

## Available fixtures

Fixtures are pre-built agent directories in `evals/fixtures/`:

- **basic-agent** — Minimal agent with `GenerativeActionsEnabled: false`, one Greeting topic. Use for most authoring evals.
- **agent-with-mcp-action** — Same as basic-agent plus two MCP action files. Use for action-editing evals.
- **empty-workspace** — No agent files. Use for negative-path testing.

If the scenario needs a richer agent (e.g., existing topics to modify, knowledge sources, actions), note that the fixture would need to be created first.

## Instructions

1. **Identify the target scenario.** If `$ARGUMENTS` is provided, use it as the scenario name. Otherwise ask the user what scenario they want to test (e.g., "topic creation", "agent settings", "knowledge sources").

2. **Read relevant skill SKILL.md files** to understand what the scenario covers:
   ```
   Glob: skills/*/SKILL.md
   ```
   Understand: What skills are involved? What YAML kinds? What files get created/modified?

3. **Check if evals already exist:**
   ```
   Glob: evals/scenarios/<scenario-name>.json
   ```
   If yes, read them and offer to add more test cases. Note the highest existing eval ID.

4. **Guide the user through creating test cases.** For each eval, gather:

   - **name**: Short descriptive title (e.g., "IT support topic with OnRecognizedIntent trigger")
   - **prompt**: A natural language prompt — what a real user would say. Do NOT prefix with "Use the X skill to...".
   - **fixture**: Which fixture agent to use (default: `basic-agent`)
   - **checks**: What to validate about the routing and output

5. **Help the user define checks.** Based on the scenario type:

   For **topic-creation scenarios**:
   ```json
   {
     "agent_invoked": "copilot-studio:Copilot Studio Author",
     "skill_invoked": "copilot-studio:new-topic",
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

   For **agent-settings scenarios**:
   ```json
   {
     "agent_invoked": "copilot-studio:Copilot Studio Author",
     "skill_invoked": "copilot-studio:edit-agent",
     "files_created": [{"pattern": "agent.mcs.yml", "min_count": 1}],
     "schema_validate": true,
     "yaml_structure": [
       {"path": "kind", "equals": "GptComponentMetadata"}
     ],
     "content_contains": ["<expected content>"],
     "no_placeholders": true
   }
   ```

   For **knowledge-source scenarios**:
   ```json
   {
     "agent_invoked": "copilot-studio:Copilot Studio Author",
     "skill_invoked": "copilot-studio:add-knowledge",
     "files_created": [{"pattern": "knowledge/*.knowledge.mcs.yml", "min_count": 1}],
     "schema_validate": true,
     "no_placeholders": true
   }
   ```

   For **reference/query scenarios**:
   ```json
   {
     "stdout_contains": ["<expected content in response>"],
     "exit_code": 0
   }
   ```

6. **Recommend at least 3 test cases** that cover different possibilities within the scenario. For example, for topic-creation:
   - Different trigger types (OnRecognizedIntent, OnConversationStart, OnUnknownIntent)
   - Different complexity levels (simple message, multi-step with questions, branching)
   - Edge cases (empty workspace refusal)

7. **Write the scenario JSON file:**
   ```
   Write: evals/scenarios/<scenario-name>.json
   ```

   Format:
   ```json
   {
     "scenario_name": "<scenario-name>",
     "evals": [
       {
         "id": 1,
         "name": "<short descriptive title>",
         "prompt": "<natural language request — what a user would say>",
         "fixture": "basic-agent",
         "mock_scripts": [],
         "checks": { ... }
       }
     ]
   }
   ```

8. **Tell the user how to run the evals:**
   ```
   python3 evals/evaluate.py --scenario <scenario-name> --verbose
   ```
   Or for all scenarios: `node evals/run.js`

   To generate the HTML report: `python3 evals/report.py evals/results/<timestamp>/`

## Important guidelines

- Prompts must be **natural language** — write what a real user would say, not "Use the X skill to..."
- Include `agent_invoked` and `skill_invoked` checks to verify correct routing
- Keep prompts specific enough that checks can be deterministic (mention exact names, values, counts)
- Use `schema_validate: true` for ALL scenarios that produce YAML — it's the most powerful check
- `content_contains` keywords should come directly from the prompt to verify domain relevance
- Don't create evals for deprecated skills (chat-with-agent, directline-chat)
- Eval IDs must be unique integers within a scenario's JSON
