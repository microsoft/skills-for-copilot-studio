---
description: Run tests against a published Copilot Studio agent and analyze results. Use when the user asks to test the agent, run tests, validate published changes, or check if the agent works correctly. The agent must have been pushed and published in Copilot Studio first.
allowed-tools: Bash(node tests/run-tests.js), Bash(npm install --prefix tests), Read, Write, Glob, Grep, Edit
---

# Run Tests

Run Copilot Studio agent tests, download results, and analyze failures to propose YAML fixes. Supports two modes:
- **Automatic**: Run tests via Dataverse API (requires Azure app registration and credentials)
- **Manual**: User runs tests in Copilot Studio UI and shares results with Claude for analysis

## Prerequisites

The user must have:
1. **Pushed and published** their agent to Copilot Studio (via VS Code Extension)
2. **Created a test set** in Copilot Studio (Tests tab in the UI)

## Instructions

### Phase 0: Detect Mode

1. **Try to read `tests/settings.json`**.

2. **Check for the `mode` field**:

   - If `mode` is `"automatic"`: proceed to **Phase 1** (Configure Settings)
   - If `mode` is `"manual"`: skip to **Phase 2M** (Run Tests — Manual)
   - If `mode` is missing or the file doesn't exist: **ask the user to choose** using AskUserQuestion:

     > **How would you like to run tests?**
     >
     > - **Automatic** — Tests run via Dataverse API. Requires an Azure app registration, environment URL, tenant ID, and client ID. Best for repeated/CI testing.
     > - **Manual** — You run tests in the Copilot Studio UI and share results here. No Azure setup needed. Best for quick one-off testing.

3. **Persist the choice** to `tests/settings.json`:
   - If the file already exists with other settings (e.g., `dataverse`, `testRun`), add/update only the `mode` field, preserving existing values.
   - If the file doesn't exist, create it with just the mode:
     - For automatic: use the full template from `tests/settings-example.json` (includes `mode`, `dataverse`, `testRun`)
     - For manual: write `{ "mode": "manual" }`

4. **Mode switching**: If at any point the user asks to "switch to manual mode" or "switch to automatic mode", update the `mode` field in `tests/settings.json` and restart from the appropriate phase.

---

### Phase 1: Configure Settings (Automatic mode only)

Only runs when `mode` = `"automatic"`. Skip this phase entirely for manual mode.

1. **Read `tests/settings.json`** and check for missing or placeholder values (containing `YOUR_`).

2. **If values are missing**, ask the user for each missing value. Explain where to find each one:

   - **Environment URL** (`dataverse.environmentUrl`): "What is your Dataverse environment URL? Find it in Power Platform admin center or Copilot Studio > Settings > Session Details. It looks like `https://orgXXXXXX.crm.dynamics.com`"
   - **Tenant ID** (`dataverse.tenantId`): "What is your Azure tenant ID? Find it in Azure Portal > Microsoft Entra ID > Overview. It's a GUID like `c87f36f7-fc65-453c-9019-0d724f21bc42`"
   - **Client ID** (`dataverse.clientId`): "What is your App Registration client ID? Find it in Azure Portal > App Registrations > your app > Application (client) ID. It's a GUID."
   - **Agent Configuration ID** (`testRun.agentConfigurationId`): "What is your agent configuration ID? In Copilot Studio, go to your agent > Tests tab. The ID is a GUID found in the URL or test configuration."
   - **Test Set ID** (`testRun.agentTestSetId`): "What is your test set ID? In Copilot Studio, go to your agent > Tests tab > select your test set. The ID is a GUID found in the URL."

   Ask for ALL missing values at once (don't ask one at a time).

3. **Write `tests/settings.json`** with the collected values:
   ```json
   {
     "mode": "automatic",
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

4. If all values are already configured and valid, proceed to Phase 2A.

---

### Phase 2A: Run Tests — Automatic

Only runs when `mode` = `"automatic"`.

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

7. Proceed to **Phase 3**.

---

### Phase 2M: Run Tests — Manual

Only runs when `mode` = `"manual"`.

1. **Provide step-by-step instructions** to the user:

   > **Run tests in Copilot Studio:**
   >
   > 1. Open [Copilot Studio](https://copilotstudio.microsoft.com)
   > 2. Navigate to your agent
   > 3. Go to the **Tests** tab
   > 4. Select your test set and click **Run**
   > 5. Wait for all tests to complete
   >
   > **Then share your results with me.** You can:
   > - **Export CSV**: Click the export/download button in the Tests tab and share the file path
   > - **Copy & paste**: Select the results table and paste it here
   > - **Describe verbally**: Tell me which tests failed and what the errors were

2. **Wait for the user to provide results.**

3. **Parse the results** based on the format provided:

   - **CSV file path**: Read the file. Handle column name variations — Copilot Studio exports may use different column headers than `run-tests.js` output. Map columns by matching semantically (e.g., "Utterance" / "Test Utterance", "Expected" / "Expected Response", "Actual" / "Response", "Status" / "Result").

   - **Pasted text/table**: Parse the tabular data. Identify columns by header names or position. Handle markdown tables, tab-separated, or comma-separated formats.

   - **Verbal description**: Ask targeted clarifying questions to understand the failures:
     - Which tests failed?
     - What was the test utterance / user message?
     - What was expected vs. what the agent actually responded?
     - What type of test was it (topic match, response match, generative answers)?

4. Proceed to **Phase 3**.

---

### Phase 3: Analyze Results

Works identically regardless of mode — only the data source differs.

1. **Get the results data**:
   - **Automatic mode**: `Glob: tests/test-results-*.csv` — read the most recent CSV file (newest by modification time).
   - **Manual mode**: Use the parsed results from Phase 2M.

2. **Parse the CSV columns** (for automatic mode or CSV-based manual results):
   | Column | Meaning |
   |--------|---------|
   | Test Utterance | The user message that was tested |
   | Expected Response | What the test expected |
   | Response | What the agent actually responded |
   | Latency (ms) | Response time |
   | Result | `Success`, `Failed`, `Unknown`, `Error`, or `Pending` |
   | Test Type | `Response Match`, `Topic Match`, `Generative Answers`, `Multi-turn`, `Plan Validation`, or `Attachments` |
   | Result Reason | Why the test passed or failed |

3. **Focus on failed tests** (Result = `Failed` or `Error`). For each failure, analyze:
   - **Test Type = Topic Match**: The wrong topic was triggered, or no topic matched. Check trigger phrases and model descriptions in the relevant topics.
   - **Test Type = Response Match**: The response didn't match the expected response. Check the topic's `SendActivity` messages, instructions, or generative answer configuration.
   - **Test Type = Generative Answers**: The generative answer was incorrect or missing. Check knowledge sources, `SearchAndSummarizeContent` configuration, and agent instructions.
   - **Test Type = Plan Validation**: The orchestrator's plan was wrong. Check topic descriptions, model descriptions, and agent-level instructions.
   - **Test Type = Multi-turn**: A multi-turn conversation failed at some step. Check topic flow, variable handling, and conditions.

---

### Phase 4: Propose Fixes

Mode-agnostic — works from analyzed failure data regardless of source.

1. **For each failure, identify the relevant YAML file(s)**:
   - Auto-discover the agent: `Glob: src/**/agent.mcs.yml`
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

4. **Apply accepted changes** using the Edit tool. After applying, remind the user to push and publish again before re-running tests.

## Test Result Codes Reference

```
Result: 1=Success, 2=Failed, 3=Unknown, 4=Error, 5=Pending
Test Type: 1=Response Match, 2=Topic Match, 3=Attachments, 4=Generative Answers, 5=Multi-turn, 6=Plan Validation
Run Status: 1=Not Run, 2=Running, 3=Complete, 4=Not Available, 5=Pending, 6=Error
```
