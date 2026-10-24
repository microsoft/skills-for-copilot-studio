/**
 * Tests for evaluation sync detection in manage-agent and schema-lookup.
 *
 * Verifies that:
 * 1. detectUnsyncedComponents identifies EvaluationSet/EvaluationData kinds.
 * 2. Standard agents without evaluation kinds report 0 unsynced components.
 * 3. schema-lookup validate outputs an informational note for unsynced kinds.
 *
 * Run: node tests/eval-sync-detection.test.js
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

// Extract detectUnsyncedComponents and UNSYNCED_KINDS from manage-agent.js source
// to run in standalone test runner without requiring native MSAL modules.
const srcPath = path.join(__dirname, "..", "scripts", "src", "manage-agent.js");
const src = fs.readFileSync(srcPath, "utf8");

// Extract findMcsYmlFiles, UNSYNCED_KINDS, and detectUnsyncedComponents
const findMcsRegex = /function findMcsYmlFiles[\s\S]*?^}/m;
const unsyncedKindsRegex = /const UNSYNCED_KINDS = {[\s\S]*?^};/m;
const detectRegex = /function detectUnsyncedComponents[\s\S]*?^}/m;

const findMcsMatch = src.match(findMcsRegex);
const unsyncedKindsMatch = src.match(unsyncedKindsRegex);
const detectMatch = src.match(detectRegex);

if (!findMcsMatch || !unsyncedKindsMatch || !detectMatch) {
  throw new Error("Could not extract detectUnsyncedComponents logic from manage-agent.js");
}

eval(findMcsMatch[0]);
eval(unsyncedKindsMatch[0].replace(/^const\s+UNSYNCED_KINDS/, "var UNSYNCED_KINDS"));
eval(detectMatch[0]);

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`PASS: ${label}`);
  } else {
    failed++;
    console.error(`FAIL: ${label}`);
  }
}

// ---------------------------------------------------------------------------
// 1. detectUnsyncedComponents on standard agent
// ---------------------------------------------------------------------------

const basicAgentDir = path.join(__dirname, "..", "evals", "fixtures", "basic-agent");
const standardResults = detectUnsyncedComponents(basicAgentDir);
assert(
  Array.isArray(standardResults) && standardResults.length === 0,
  "Standard agent has 0 unsynced components"
);

// ---------------------------------------------------------------------------
// 2. detectUnsyncedComponents on workspace with EvaluationSet & EvaluationData
// ---------------------------------------------------------------------------

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcs-eval-test-"));

try {
  // Create mock agent structure
  fs.mkdirSync(path.join(tempDir, "evaluations"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "topics"), { recursive: true });

  fs.writeFileSync(
    path.join(tempDir, "topics", "Greeting.topic.mcs.yml"),
    "kind: AdaptiveDialog\nbeginDialog:\n  kind: OnRecognizedIntent\n  id: root\n"
  );

  fs.writeFileSync(
    path.join(tempDir, "evaluations", "test-cases.eval.mcs.yml"),
    "kind: EvaluationSet\ngraders:\n  - kind: GeneralQualityGrader\n"
  );

  fs.writeFileSync(
    path.join(tempDir, "evaluations", "knowledge-cases.eval.mcs.yml"),
    "kind: EvaluationData\ncases:\n  - input: hello\n"
  );

  const detected = detectUnsyncedComponents(tempDir);
  assert(detected.length === 2, "Detected exactly 2 unsynced evaluation components");

  const kinds = detected.map((d) => d.kind).sort();
  assert(
    kinds[0] === "EvaluationData" && kinds[1] === "EvaluationSet",
    "Identified EvaluationData and EvaluationSet kinds"
  );

  assert(
    detected.every((d) => typeof d.message === "string" && d.message.includes("portal Evaluate tab")),
    "Every detected item includes helpful guidance message"
  );

  // ---------------------------------------------------------------------------
  // 3. schema-lookup validate emits [NOTE] on EvaluationSet
  // ---------------------------------------------------------------------------

  const schemaLookupPath = path.join(__dirname, "..", "scripts", "src", "schema-lookup.js");
  const evalFilePath = path.join(tempDir, "evaluations", "test-cases.eval.mcs.yml");

  try {
    const stdout = execSync(
      `node "${schemaLookupPath}" validate "${evalFilePath}"`,
      { encoding: "utf8" }
    );
    assert(
      stdout.includes("[NOTE] Kind 'EvaluationSet' is valid in the schema, but is not synchronized"),
      "schema-lookup validate outputs [NOTE] on EvaluationSet"
    );
  } catch (err) {
    // If exit code != 0, still check stdout
    const out = (err.stdout || "") + (err.stderr || "");
    assert(
      out.includes("[NOTE] Kind 'EvaluationSet' is valid in the schema, but is not synchronized"),
      "schema-lookup validate outputs [NOTE] on EvaluationSet"
    );
  }

} finally {
  // Clean up temp dir
  fs.rmSync(tempDir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
