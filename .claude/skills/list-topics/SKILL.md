---
description: List all topics in the Copilot Studio agent with their trigger types, phrases, and action counts. Use when the user wants to see what topics exist.
allowed-tools: Read, Glob, Grep
---

# List Topics in Solution

List all topics in the current agent with their trigger types and details.

## Instructions

1. **Auto-discover the agent directory** — find all agents via:
   ```
   Glob: src/**/agent.mcs.yml
   ```
   - If multiple agents found, list them and ask which one to inspect.
   - NEVER hardcode an agent name or path.

2. Find all topic files in the discovered agent directory:
   ```
   Glob: src/<discovered-agent>/topics/*.topic.mcs.yml
   ```

3. For each topic file, read it and extract:
   - Topic name (from the `# Name:` comment or filename)
   - Trigger type (from `beginDialog.kind`)
   - Trigger phrases (if `OnRecognizedIntent`, from `triggerQueries`)
   - Number of actions in the `actions` array
   - Dialog references (any `BeginDialog` or `ReplaceDialog` calls)

4. Present results in a table:

   ```
   | # | Topic Name | Trigger | Phrases | Actions | Calls |
   |---|------------|---------|---------|---------|-------|
   | 1 | Greeting   | OnRecognizedIntent | Hello, Hi, Hey | 2 | - |
   | 2 | Fallback   | OnUnknownIntent | - | 4 | Escalate |
   ```

5. Note any system topics (OnError, OnSelectIntent, OnSignIn) that should be modified with care.
