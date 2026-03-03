const fs = require("fs");
const path = require("path");
const { PublicClientApplication } = require("@azure/msal-node");
const settings = require("./settings.json");

const { environmentUrl, tenantId, clientId } = settings.dataverse;
const { agentConfigurationId, agentTestSetId } = settings.testRun;
const CACHE_PATH = path.join(__dirname, ".token_cache.json");
const API_BASE = `${environmentUrl}/api/data/v9.2`;

const cachePlugin = {
  beforeCacheAccess: async (context) => {
    if (fs.existsSync(CACHE_PATH)) {
      context.tokenCache.deserialize(fs.readFileSync(CACHE_PATH, "utf-8"));
    }
  },
  afterCacheAccess: async (context) => {
    if (context.cacheHasChanged) {
      fs.writeFileSync(CACHE_PATH, context.tokenCache.serialize());
    }
  },
};

const msalConfig = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
  },
  cache: { cachePlugin },
};

const scopes = [`${environmentUrl}/user_impersonation`];

function buildHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0",
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function generateTestRunName() {
  const now = new Date();
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const MM = String(now.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = now.getUTCFullYear();
  const HH = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  return `Agent Test ${dd}${MM}${yyyy} ${HH}${mm}${ss}`;
}

async function getAccessToken() {
  const app = new PublicClientApplication(msalConfig);

  const accounts = await app.getTokenCache().getAllAccounts();
  if (accounts.length > 0) {
    try {
      const result = await app.acquireTokenSilent({
        scopes,
        account: accounts[0],
      });
      console.log("Using cached token.");
      return result.accessToken;
    } catch {
      // Silent acquisition failed, fall through to interactive
    }
  }

  const result = await app.acquireTokenByDeviceCode({
    scopes,
    deviceCodeCallback: (response) => {
      console.log(response.message);
    },
  });

  return result.accessToken;
}

async function createTestRun(token) {
  const name = generateTestRunName();
  console.log(`Creating test run: "${name}"`);

  const body = {
    cat_name: name,
    "cat_CopilotConfigurationId@odata.bind": `/cat_copilotconfigurations(${agentConfigurationId})`,
    "cat_CopilotTestSetId@odata.bind": `/cat_copilottestsets(${agentTestSetId})`,
  };

  const response = await fetch(`${API_BASE}/cat_copilottestruns`, {
    method: "POST",
    headers: {
      ...buildHeaders(token),
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to create test run (HTTP ${response.status}): ${await response.text()}`
    );
  }

  const record = await response.json();
  const rowId = record.cat_copilottestrunid;
  console.log(`Test run created successfully. Row ID: ${rowId}`);
  return rowId;
}

async function runCopilotTests(token, rowId) {
  console.log(`Calling cat_RunCopilotTests for row ${rowId}...`);

  const response = await fetch(
    `${API_BASE}/cat_copilottestruns(${rowId})/Microsoft.Dynamics.CRM.cat_RunCopilotTests`,
    {
      method: "POST",
      headers: buildHeaders(token),
      body: JSON.stringify({
        CopilotConfigurationId: agentConfigurationId,
        CopilotTestRunId: rowId,
        CopilotTestSetId: agentTestSetId,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to run cat_RunCopilotTests (HTTP ${response.status}): ${await response.text()}`
    );
  }

  console.log("cat_RunCopilotTests executed successfully.");
}

const RESULT_CODE = {
  1: "Success",
  2: "Failed",
  3: "Unknown",
  4: "Error",
  5: "Pending",
};

const TEST_TYPE_CODE = {
  1: "Response Match",
  2: "Topic Match",
  3: "Attachments (Adaptive Cards, etc.)",
  4: "Generative Answers",
  5: "Multi-turn",
  6: "Plan Validation",
};

const RUN_STATUS = {
  3: "Complete",
  6: "Error",
  2: "Running",
  5: "Pending",
  1: "Not Run",
  4: "Not Available",
};

const POLL_INTERVAL_MS = 20_000;

async function waitForCompletion(token, rowId) {
  const url =
    `${API_BASE}/cat_copilottestruns(${rowId})` +
    `?$select=cat_runstatuscode,cat_generatedanswersanalysiscode,cat_successrate`;

  while (true) {
    const response = await fetch(url, {
      headers: buildHeaders(token),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to poll run status (HTTP ${response.status}): ${await response.text()}`
      );
    }

    const record = await response.json();
    const runCode = record.cat_runstatuscode;
    const analysisCode = record.cat_generatedanswersanalysiscode;
    const runLabel = RUN_STATUS[runCode] ?? `Unknown (${runCode})`;
    const analysisLabel = RUN_STATUS[analysisCode] ?? `Unknown (${analysisCode})`;

    console.log(`  Run Status: ${runLabel} | Generated Answers Analysis: ${analysisLabel}`);

    if (analysisCode === 3) {
      return { status: "Complete", successRate: record.cat_successrate };
    }

    if (analysisCode === 6) {
      return { status: "Error", successRate: record.cat_successrate };
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function main() {
  console.log("Authenticating...");
  const token = await getAccessToken();

  // Step 1: Create the Agent Test Run row
  console.log("\n--- Step 1: Create Agent Test Run ---");
  const rowId = await createTestRun(token);

  // Step 2: Call the bound action cat_RunCopilotTests
  console.log("\n--- Step 2: Run Copilot Tests ---");
  await runCopilotTests(token, rowId);

  // Step 3: Poll until complete
  console.log("\n--- Step 3: Waiting for completion ---");
  const result = await waitForCompletion(token, rowId);

  console.log(`\nSuccess Rate: ${result.successRate ?? "N/A"}%`);

  if (result.status === "Complete") {
    console.log("Test run completed successfully!");
  } else {
    console.error("Test run finished with errors.");
  }

  // Step 4: Download test results to CSV
  console.log("\n--- Step 4: Download Test Results ---");
  await downloadResults(token, rowId);

  if (result.status !== "Complete") {
    process.exit(1);
  }
}

function escapeCsv(value) {
  if (value == null) return "";
  const str = String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

async function downloadResults(token, rowId) {
  const fields = [
    "cat_testutterance",
    "cat_expectedresponse",
    "cat_response",
    "cat_latencyms",
    "cat_resultcode",
    "cat_testtypecode",
    "cat_resultreason",
  ];

  let allResults = [];
  let url =
    `${API_BASE}/cat_copilottestresults` +
    `?$filter=_cat_copilottestrunid_value eq ${rowId}` +
    `&$select=${fields.join(",")}` +
    `&$orderby=createdon asc`;

  // Page through all results
  while (url) {
    const response = await fetch(url, {
      headers: buildHeaders(token),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch test results (HTTP ${response.status}): ${await response.text()}`
      );
    }

    const data = await response.json();
    allResults = allResults.concat(data.value);
    url = data["@odata.nextLink"] || null;
  }

  console.log(`Fetched ${allResults.length} test result(s).`);

  if (allResults.length === 0) return;

  const headers = [
    "Test Utterance",
    "Expected Response",
    "Response",
    "Latency (ms)",
    "Result",
    "Test Type",
    "Result Reason",
  ];

  const rows = allResults.map((r) => [
    escapeCsv(r.cat_testutterance),
    escapeCsv(r.cat_expectedresponse),
    escapeCsv(r.cat_response),
    escapeCsv(r.cat_latencyms),
    escapeCsv(RESULT_CODE[r.cat_resultcode] ?? r.cat_resultcode),
    escapeCsv(TEST_TYPE_CODE[r.cat_testtypecode] ?? r.cat_testtypecode),
    escapeCsv(r.cat_resultreason),
  ]);

  const csv =
    headers.map(escapeCsv).join(",") +
    "\n" +
    rows.map((r) => r.join(",")).join("\n") +
    "\n";

  const filename = `test-results-${rowId}.csv`;
  const filepath = path.join(__dirname, filename);
  fs.writeFileSync(filepath, csv, "utf-8");
  console.log(`Results saved to tests/${filename}`);
}

main().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
