---
description: Run tests against a published Copilot Studio agent and analyze results. Use when the user asks to test the agent, run tests, validate published changes, or check if the agent works correctly. The agent must have been pushed and published in Copilot Studio first.
allowed-tools: Bash(node tests/run-tests.js), Bash(npm install --prefix tests), Read, Write, Glob, Grep, Edit
---

# Run Tests

Run Copilot Studio agent tests via Dataverse API, download results, and analyze failures to propose YAML fixes.

## Prerequisites

The user must have:
1. **Pushed and published** their agent to Copilot Studio (via VS Code Extension)
2. **Created a test set** in Copilot Studio (Tests tab in the UI)

## Instructions

### Phase 0: Configure Settings

1. **Try to read `tests/settings.json`**.

2. **If the file doesn't exist or contains `YOUR_` placeholder values**, ask the user for each missing value. Explain where to find each one:

   - **Environment URL** (`dataverse.environmentUrl`): "What is your Dataverse environment URL? Find it in Power Platform admin center or Copilot Studio > Settings > Session Details. It looks like `https://orgXXXXXX.crm.dynamics.com`"
   - **Tenant ID** (`dataverse.tenantId`): "What is your Azure tenant ID? Find it in Azure Portal > Microsoft Entra ID > Overview. It's a GUID like `c87f36f7-fc65-453c-9019-0d724f21bc42`"
   - **Client ID** (`dataverse.clientId`): "What is your App Registration client ID? Find it in Azure Portal > App Registrations > your app > Application (client) ID. It's a GUID."
   - **Agent Configuration ID** (`testRun.agentConfigurationId`): "What is your agent configuration ID? In Copilot Studio, go to your agent > Tests tab. The ID is a GUID found in the URL or test configuration."
   - **Test Set ID** (`testRun.agentTestSetId`): "What is your test set ID? In Copilot Studio, go to your agent > Tests tab > select your test set. The ID is a GUID found in the URL."

   Ask for ALL missing values at once (don't ask one at a time).

3. **Write `tests/settings.json`** with the collected values:
   ```json
   {
     "dataverse": {
       "environmentUrl": "<value>",
       "tenantId": "<value>",
       "clientId": "<value>"
     },
     "testRun": {
       "agentConfigurationId": "<value>",
       "agentTestSetId": "<value>"
     }
   }
   ```

4. If all values are already configured and valid, skip to Phase 1.

### Phase 1: Run the Tests

1. **Install dependencies** if `tests/node_modules/` doesn't exist:
   ```bash
   npm install --prefix tests
   ```

2. **Run the test script in the background** with a 100-minute timeout (6000000ms):
   ```bash
   node tests/run-tests.js
   ```
   Use `run_in_background: true` for this command. Save the returned task ID.

3. **Wait 10 seconds**, then check the background task output (non-blocking check).

4. **Detect the authentication state** from the output:

   - If the output contains **"Using cached token"**: Authentication succeeded automatically. Tell the user: "Authentication successful (cached credentials). Tests are running, this may take several minutes..."

   - If the output contains **"use a web browser to open the page"**: Extract the URL and device code from the message. **Present this prominently to the user**:

     > **Authentication Required**
     >
     > Open your browser to: https://microsoft.com/devicelogin
     > Enter the code: **XXXXXXXXX** (extract the actual code from the output)
     >
     > After signing in, the tests will continue automatically.

   - If the output contains an **error**: Report the error to the user and stop.

   - If the output is empty or incomplete: Wait another 10 seconds and check again (retry up to 3 times).

5. **Wait for the background task to complete** (blocking). The script polls every 20 seconds until all tests finish and downloads results as a CSV.

6. **Read the final output** to get the success rate and CSV filename.

### Phase 2: Analyze Results

7. **Find and read the results CSV**:
   ```
   Glob: tests/test-results-*.csv
   ```
   Read the most recent CSV file (newest by modification time).

8. **Parse the CSV columns**:
   | Column | Meaning |
   |--------|---------|
   | Test Utterance | The user message that was tested |
   | Expected Response | What the test expected |
   | Response | What the agent actually responded |
   | Latency (ms) | Response time |
   | Result | `Success`, `Failed`, `Unknown`, `Error`, or `Pending` |
   | Test Type | `Response Match`, `Topic Match`, `Generative Answers`, `Multi-turn`, `Plan Validation`, or `Attachments` |
   | Result Reason | Why the test passed or failed |

9. **Focus on failed tests** (Result = `Failed` or `Error`). For each failure, analyze:
   - **Test Type = Topic Match**: The wrong topic was triggered, or no topic matched. Check trigger phrases and model descriptions in the relevant topics.
   - **Test Type = Response Match**: The response didn't match the expected response. Check the topic's `SendActivity` messages, instructions, or generative answer configuration.
   - **Test Type = Generative Answers**: The generative answer was incorrect or missing. Check knowledge sources, `SearchAndSummarizeContent` configuration, and agent instructions.
   - **Test Type = Plan Validation**: The orchestrator's plan was wrong. Check topic descriptions, model descriptions, and agent-level instructions.
   - **Test Type = Multi-turn**: A multi-turn conversation failed at some step. Check topic flow, variable handling, and conditions.

### Phase 3: Propose Fixes

10. **For each failure, identify the relevant YAML file(s)**:
    - Auto-discover the agent: `Glob: src/**/agent.mcs.yml`
    - Find the relevant topic by matching the test utterance against trigger phrases and model descriptions
    - Read the topic file to understand the current flow

11. **Propose specific YAML changes** to fix each failure. Present them to the user as a summary:
    - Which test(s) failed and why
    - Which file(s) need changes
    - What the proposed change is (show the diff)

12. **Wait for user decision**. The user can:
    - **Accept all** — apply all proposed changes
    - **Accept partially** — apply only some changes (ask which ones)
    - **Reject** — discard proposed changes and discuss alternative approaches

13. **Apply accepted changes** using the Edit tool. After applying, remind the user to push and publish again before re-running tests.

## Test Result Codes Reference

```
Result: 1=Success, 2=Failed, 3=Unknown, 4=Error, 5=Pending
Test Type: 1=Response Match, 2=Topic Match, 3=Attachments, 4=Generative Answers, 5=Multi-turn, 6=Plan Validation
Run Status: 1=Not Run, 2=Running, 3=Complete, 4=Not Available, 5=Pending, 6=Error
```
