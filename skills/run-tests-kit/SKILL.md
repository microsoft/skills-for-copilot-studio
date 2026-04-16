---
user-invocable: false
description: >
  Run a batch test suite via the Copilot Studio Kit (Dataverse API).
  Uses the Power CAT Copilot Studio Kit to execute test cases against a published agent
  and produces pass/fail results with latencies. Requires the Kit installed in the
  environment, an App Registration with Dataverse permissions, and a published agent.
allowed-tools: Bash(node *run-tests.js *), Bash(npm install *), Read, Write, Glob, Grep, Edit
context: fork
agent: copilot-studio-test
---

# Run Tests via Copilot Studio Kit

Run a batch test suite against a **published** Copilot Studio agent using the [Power CAT Copilot Studio Kit](https://github.com/microsoft/Power-CAT-Copilot-Studio-Kit).

## Prerequisites

The user must have:
1. The **[Copilot Studio Kit](https://github.com/microsoft/Power-CAT-Copilot-Studio-Kit)** installed in their Power Platform environment
2. **Published** their agent in the Copilot Studio UI
3. **Created a test set** in the Copilot Studio Kit
4. An **Azure App Registration** with Dataverse permissions

## Phase 1: Configure Settings

1. **Read `tests/settings.json`** (relative to the user's project CWD) and check for missing or placeholder values (containing `YOUR_`).

2. **If the file doesn't exist**, create it from the template:
   ```bash
   cp ${CLAUDE_SKILL_DIR}/../../tests/settings-example.json ./tests/settings.json
   ```

3. **If values are missing**, ask the user for each missing value. Explain where to find each one:

   - **Environment URL** (`dataverse.environmentUrl`): "What is your Dataverse environment URL? Find it in Power Platform admin center or Copilot Studio > Settings > Session Details. It looks like `https://orgXXXXXX.crm.dynamics.com`"
   - **Tenant ID** (`dataverse.tenantId`): "What is your Azure tenant ID? Find it in Azure Portal > Microsoft Entra ID > Overview. It's a GUID like `c87f36f7-fc65-453c-9019-0d724f21bc42`"
   - **Client ID** (`dataverse.clientId`): "What is your App Registration client ID? Find it in Azure Portal > App Registrations > your app > Application (client) ID. It's a GUID."
   - **Agent Configuration ID** (`testRun.agentConfigurationId`): "What is your agent configuration ID? In Copilot Studio, go to your agent > Tests tab. The ID is a GUID found in the URL or test configuration."
   - **Test Set ID** (`testRun.agentTestSetId`): "What is your test set ID? In Copilot Studio, go to your agent > Tests tab > select your test set. The ID is a GUID found in the URL."

   Ask for ALL missing values at once (don't ask one at a time).

4. **Write `tests/settings.json`** with the collected values:
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

5. If all values are already configured and valid, proceed to Phase 2.

## Phase 2: Run Tests

1. **Ensure `tests/package.json` exists** in the user's project. If not, copy it:
   ```bash
   cp ${CLAUDE_SKILL_DIR}/../../tests/package.json ./tests/package.json
   ```

2. **Install dependencies** if `tests/node_modules/` doesn't exist:
   ```bash
   npm install --prefix tests
   ```

3. **Run the test script in the background** with a 100-minute timeout (6000000ms):
   ```bash
   node ${CLAUDE_SKILL_DIR}/../../tests/run-tests.js --config-dir ./tests
   ```
   Use `run_in_background: true` for this command. Save the returned task ID.

4. **Wait 10 seconds**, then check the background task output (non-blocking check).

5. **Detect the authentication state** from the output:

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

6. **Wait for the background task to complete** (blocking). The script polls every 20 seconds until all tests finish and downloads results as a CSV.

7. **Read the final output** to get the success rate and CSV filename.

8. Proceed to **Phase 3**.

## Phase 3: Analyze Results

1. **Get the results**: `Glob: tests/test-results-*.csv` — read the most recent CSV file (newest by modification time).

2. **Parse the CSV columns**:
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
   - **Test Type = Topic Match**: The wrong topic was triggered, or no topic matched. Check trigger phrases and model descriptions.
   - **Test Type = Response Match**: The response didn't match expected. Check `SendActivity` messages, instructions, or generative answer config.
   - **Test Type = Generative Answers**: The generative answer was incorrect or missing. Check knowledge sources, `SearchAndSummarizeContent`, and agent instructions.
   - **Test Type = Plan Validation**: The orchestrator's plan was wrong. Check topic descriptions and agent-level instructions.
   - **Test Type = Multi-turn**: A multi-turn conversation failed. Check topic flow, variable handling, and conditions.

4. Proceed to **Phase 4** (Propose Fixes).

## Phase 4: Propose Fixes

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

4. **Apply accepted changes** using the Edit tool. After applying, remind the user to push and publish again before re-running tests.

## Test Result Codes Reference

```
Result: 1=Success, 2=Failed, 3=Unknown, 4=Error, 5=Pending
Test Type: 1=Response Match, 2=Topic Match, 3=Attachments, 4=Generative Answers, 5=Multi-turn, 6=Plan Validation
Run Status: 1=Not Run, 2=Running, 3=Complete, 4=Not Available, 5=Pending, 6=Error
```
