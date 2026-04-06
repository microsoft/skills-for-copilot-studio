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

Run evaluations against a Copilot Studio agent using the Power Platform Evaluation API.

## Key capability: draft testing

This skill tests the **current draft** — the version you just pushed with manage-agent push.
**No publish step is needed.** `runOnPublishedBot` defaults to `false`.

## Phase 0: Authentication Setup

The Evaluation API requires an **App Registration** with the `CopilotStudio.MakerOperations.Read` delegated permission.

### If `--client-id` was not provided

Ask the user:

> **App Registration Required**
>
> The Evaluation API requires an Azure App Registration with specific permissions.
> Please provide your App Registration Client ID.
>
> **Setup instructions:**
> 1. Go to [Azure Portal > App Registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
> 2. Create or select an app registration
> 3. Under **API permissions**, add the delegated permission: `CopilotStudio.MakerOperations.Read`
> 4. Under **Authentication**, add platform **Mobile and desktop applications** with redirect URI `http://localhost`
> 5. Grant admin consent for the permission
> 6. Copy the **Application (client) ID**

Store the client ID for all subsequent `eval-api.bundle.js` calls in this session.

### First run authentication

On the first call, the script will initiate a **device code flow**. Present the device code prompt to the user:

> **Authentication Required**
>
> Open your browser to: https://microsoft.com/devicelogin
> Enter the code: **XXXXXXXXX**

After authentication, the token is cached and subsequent calls are silent.

## Test Set CSV Format (for import into Copilot Studio)

Test sets **cannot** be created via the API — they must be imported through the Copilot Studio UI
(agent > **Evaluate** tab > **New test set** > **Import**).

If the user needs help creating a test set CSV, generate one in this format:

```csv
"# Test set name: <name>"
"# Test methods: GeneralQuality"
"#"
"question","expectedResponse"
"User question 1","Expected agent response 1"
"User question 2","Expected agent response 2"
"User question without expected response",
```

### CSV rules
- **Columns**: `question` (required), `expectedResponse` (optional — leave empty after the comma if not needed)
- **Max 100 questions** per test set
- **Max 500 characters** per question (including spaces)
- **Max 1000 characters** per expected response
- **Header comments** (lines starting with `#`) are metadata — the `# Test methods:` line sets the default grading method
- **Test methods** are configured in the UI after import, not in the CSV. Available methods:
  - `GeneralQuality` — AI-graded quality (relevance, completeness, groundedness, abstention)
  - `ExactMatch` — Exact string match against expected response
  - `CompareMeaning` — AI-graded semantic similarity
  - `TextSimilarity` — Text similarity score (0.0–1.0)
  - `AllKeywordMatch` — All expected keywords must appear in response
  - `AnyKeywordMatch` — At least one expected keyword must appear
  - `CapabilityUse` — Validates expected tool/topic invocations
  - `CustomLabels` — Custom label-based grading
- **Expected responses** are required for ExactMatch, CompareMeaning, TextSimilarity, and keyword methods. GeneralQuality and CapabilityUse work without them.

### When the user asks to create a test set

1. Help them write the CSV (use the Edit or Write tool to create it)
2. Tell them to import it: agent > **Evaluate** tab > **New test set** > **Import** > select the CSV
3. After import, configure test methods in the UI if the defaults aren't sufficient
4. Then proceed with running the evaluation

## Phase 1: Resolve Configuration

Find `conn.json` by searching for `.mcs/conn.json` under the workspace.
Extract `environmentId`, `agentId`, `tenantId`. Pass `--workspace` to the script.

If no `conn.json` found: ask the user for `--environment-id`, `--agent-id`, `--tenant-id` directly.

## Phase 2: List Test Sets

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/eval-api.bundle.js list-testsets --workspace <path> --client-id <id>
```

Parse the `testsets` array from the JSON output.

- **If empty**: Tell the user:
  > No test sets found. Create test sets in the Copilot Studio UI:
  > Open your agent > **Evaluate** tab > **New test set**.
  STOP here — this skill cannot create test sets.

- **If one test set**: Auto-select it. Tell the user which one you're using.
- **If multiple**: Present a numbered list, ask the user to pick.

## Phase 3: Start Run

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/eval-api.bundle.js start-run --workspace <path> --client-id <id> --testset-id <id>
```

Add `--run-name "Draft eval <date>"` or a user-supplied name.
Add `--published` **only** if the user explicitly asked for published-bot testing.

The output includes `runId`, `state` (Queued), `totalTestCases`.

Tell the user:
> Started evaluation run `{runId}` — {totalTestCases} test cases queued.

## Phase 4: Poll for Completion

Poll using:
```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/eval-api.bundle.js get-run --workspace <path> --client-id <id> --run-id <runId>
```

**Poll interval**: Start at 15 seconds. For test sets with >20 cases, use 30 seconds.

Show progress after each poll:
> `executionState`: ProcessingRunContent (3/10 processed)

Continue until `state` is one of: `Completed`, `Failed`, `Abandoned`, `Cancelled`.

- **Completed**: Proceed to Phase 5.
- **Failed/Abandoned/Cancelled**: Report the state and stop.
- **Timeout**: If still running after 20 minutes, tell the user to check the Copilot Studio UI.

## Phase 5: Fetch Full Results

```bash
node ${CLAUDE_SKILL_DIR}/../../scripts/eval-api.bundle.js get-results --workspace <path> --client-id <id> --run-id <runId>
```

Parse `testCasesResults`. Each result has `testCaseId` + `metricsResults[]`.

## Phase 6: Analyze Results

Present a summary table: total, passed, failed, errors.

For each **failure**, analyze using `metricsResults`:

| Metric Type | What to check |
|-------------|---------------|
| `GeneralQuality` Fail | `data.relevance`, `data.completeness`, `data.groundedness`, `data.abstention` — each is `Yes`/`No`/`NA` |
| `ExactMatch` Fail | `data.score` is 0.0–1.0, response didn't match expected |
| `CompareMeaning` Fail | Semantic similarity too low |
| `AllKeywordMatch` / `AnyKeywordMatch` Fail | `data.matchedTermCount` vs `data.totalTermCount`, `data.matchedTerms` |
| `CapabilityUse` Fail | `data.missingInvocationSteps` shows which tools/topics weren't called |
| `Error` status | Check `errorReason` — many are config issues (e.g., `ExpectedOutputIsNullOrEmpty`) not YAML failures. Tell user what to fix in the test set UI |

### Common error reasons (not YAML issues — tell user to fix in test set)

- `ExpectedOutputIsNullOrEmpty` — No expected response set for this test case
- `ExpectedKeywordsAreNullOrEmpty` — No keywords defined for keyword match metric
- `ExpectedInvocationStepsAreNullOrEmpty` — No expected invocation steps defined
- `AgentResponseIsNullOrEmpty` — Bot returned nothing (may be a runtime issue, retry)

## Phase 7: Propose Fixes

For failures that are YAML authoring issues (not test set config issues):

1. Find the agent: `Glob: **/agent.mcs.yml`
2. Find the relevant topic by matching the test query against trigger phrases and model descriptions
3. Read the topic file
4. Propose specific YAML edits
5. Wait for user decision, then apply with the Edit tool

After applying fixes:
> Changes applied locally. Push to test again:
> - To push: I can push for you now, or you can do it manually
> - After pushing, re-run the evaluation to verify the fixes

## Push + Re-eval Loop

If the user asks to "push and re-run" or "test again":

1. Push local changes:
   ```bash
   node ${CLAUDE_SKILL_DIR}/../../scripts/manage-agent.bundle.js push --workspace <path> --tenant-id <id> --environment-id <id> --environment-url <url> --agent-mgmt-url <url>
   ```
   (Read all required values from `.mcs/conn.json`)

2. After push succeeds, go back to **Phase 3** (start a new run).

Do **NOT** publish between iterations. Publish only when the user is satisfied.
