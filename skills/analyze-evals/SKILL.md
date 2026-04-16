---
user-invocable: false
description: >
  Analyze exported evaluation results from Copilot Studio's Evaluate tab.
  The user provides a CSV file exported from the Copilot Studio UI; this skill
  parses it, identifies failures, and proposes YAML fixes. No API access or
  published agent required — just the exported CSV.
allowed-tools: Read, Glob, Grep, Edit
context: fork
agent: copilot-studio-test
---

# Analyze Copilot Studio Evaluation Results

Analyze evaluation results exported from the Copilot Studio UI as CSV.

## Phase 1: Get Results

1. **Ask the user for the CSV file path** if not already provided. The file is typically exported from Copilot Studio's Evaluate tab and named `Evaluate <agent name> <date>.csv` in their Downloads folder.

2. **Read the CSV file**. The in-product evaluation CSV has these columns:

   | Column | Meaning |
   |--------|---------|
   | `question` | The test utterance |
   | `expectedResponse` | Expected response (may be empty) |
   | `actualResponse` | What the agent responded |
   | `testMethodType_1` | Eval method (e.g., `GeneralQuality`) |
   | `result_1` | `Pass` or `Fail` |
   | `passingScore_1` | Score threshold (may be empty) |
   | `explanation_1` | Why it passed/failed (e.g., "Seems relevant; Seems incomplete; Knowledge sources not cited") |

   The `_1` suffix indicates the first eval method. There may be additional methods (`_2`, `_3`, etc.) with the same column pattern.

## Phase 2: Analyze Results

1. **Focus on failed evaluations** (`result_1` = `Fail`, or any `result_N` = `Fail`).

2. For each failure, use the `explanation` column to understand the issue:
   - **"Question not answered"** — The agent couldn't handle the question. Check if there's a matching topic or knowledge source.
   - **"Knowledge sources not cited"** — The agent responded but didn't cite sources. Check knowledge source configuration and `SearchAndSummarizeContent` nodes.
   - **"Seems incomplete"** — The response was partial. Check topic flow for early exits, missing branches, or incomplete `SendActivity` messages.
   - Error messages in `actualResponse` (e.g., `GenAIToolPlannerRateLimitReached`) — These are runtime errors, not authoring issues. Flag them to the user as transient failures to retry.

## Phase 3: Propose Fixes

1. **For each failure, identify the relevant YAML file(s)**:
   - Auto-discover the agent: `Glob: **/agent.mcs.yml`
   - Find the relevant topic by matching the test utterance against trigger phrases and model descriptions
   - Read the topic file to understand the current flow

2. **Propose specific YAML changes** to fix each failure. Present them to the user as a summary:
   - Which test(s) failed and why
   - Which file(s) need changes
   - What the proposed change is (show the diff)

3. **Wait for user decision**. The user can:
   - **Accept all** — apply all proposed changes
   - **Accept partially** — apply only some changes (ask which ones)
   - **Reject** — discard proposed changes and discuss alternative approaches

4. **Apply accepted changes** using the Edit tool. After applying, remind the user to push and publish again before re-running evaluations.
