---
user-invocable: false
description: >
  Run evaluations against a Copilot Studio agent via the Power Platform Evaluation API.
  Works on DRAFT agents — no publish step required. Lists test sets, starts a run,
  polls until complete, fetches results, and proposes YAML fixes for failures.
  Use when the user wants to test agent changes without publishing.
allowed-tools: Bash(node *eval-api.bundle.js *), Bash(node *manage-agent.bundle.js push *), Bash(node *manage-agent.bundle.js pull *), Read, Glob, Grep, Edit
context: fork
agent: copilot-studio-test
---

# Run Evaluation (PPAPI)

Run evaluations against a Copilot Studio agent's **draft** — no publish needed.

The caller (test agent) must provide `--client-id` and `--workspace`. If you don't have the client ID, return immediately and tell the caller to run `test-auth` first.

All eval-api commands run in the **foreground**. NEVER use `run_in_background`.

## Step 1: List test sets and let the user choose

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/eval-api.bundle.js list-testsets --workspace <path> --client-id <id>
```

- **No test sets found**: Tell the user to create one in Copilot Studio (Evaluate tab > New evaluation). Stop.
- **One test set**: Tell the user which one you're using and proceed.
- **Multiple test sets**: Show them all and ask the user to pick. Do not proceed until they answer.

## Step 2: Start the run

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/eval-api.bundle.js start-run --workspace <path> --client-id <id> --testset-id <id> --run-name "Draft eval <date>"
```

Add `--published` only if the user explicitly asked for published-bot testing.

## Step 3: Poll until complete

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/eval-api.bundle.js get-run --workspace <path> --client-id <id> --run-id <runId>
```

Poll every 15-30 seconds. Report progress: "Processing: 3/10 test cases..."

Stop when `state` is `Completed`, `Failed`, `Abandoned`, or `Cancelled`.

## Step 4: Fetch and analyze results

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/eval-api.bundle.js get-results --workspace <path> --client-id <id> --run-id <runId>
```

Present a summary table (total, passed, failed, errors). For failures:

| Metric | What to check |
|--------|---------------|
| `GeneralQuality` Fail | Which of relevance/completeness/groundedness/abstention failed |
| `ExactMatch` Fail | Score 0.0–1.0 |
| `CapabilityUse` Fail | `missingInvocationSteps` |
| `Error` status | `errorReason` — often a test set config issue, not a YAML issue |

## Step 5: Propose fixes (if failures found)

For YAML authoring failures: find the relevant topic, read it, propose specific edits. Wait for user approval before applying.

After applying: offer to push and re-run (go back to Step 2).
