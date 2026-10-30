/**
 * Tests for the file paths reported by formatValidationOutput in manage-agent:
 * diagnostics come back keyed by file:// URI and must be reported relative to
 * the agent directory (e.g. "topics/Greeting.topic.mcs.yml").
 *
 * Run: node tests/validate-output-path.test.js
 */

// formatValidationOutput lives in the manage-agent source, which runs main()
// on load, so pull the functions out of the source text instead of requiring it.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { fileURLToPath } = require("url");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "src", "manage-agent.js"), "utf8");

function extract(name) {
  const start = src.search(new RegExp(`^(?:async )?function ${name}\\(`, "m"));
  if (start === -1) throw new Error(`function ${name} not found in manage-agent.js`);
  const end = src.indexOf("\n}\n", start);
  return src.slice(start, end + 3);
}

const SEVERITY_NAMES = { 1: "error", 2: "warning", 3: "information", 4: "hint" };
eval(["toFileUri", "formatValidationOutput"].map(extract).join("\n"));

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`);
  }
}

const err = { severity: 1, message: "boom", code: "X" };

// Reported path for a single file whose diagnostics came back under `uri`
function reported(agentDir, uri) {
  return formatValidationOutput(new Map([[uri, [err]]]), agentDir).files.map((f) => f.file);
}

// ---------------------------------------------------------------------------
// Paths are relative to the agent directory, whatever the platform
// ---------------------------------------------------------------------------

const agentDir = path.resolve(os.tmpdir(), "my agent");
const rel = path.join("topics", "A b.topic.mcs.yml");

assertEqual(reported(agentDir, toFileUri(path.join(agentDir, rel))), [rel], "URI built by toFileUri");
assertEqual(reported(agentDir, toFileUri(path.join(agentDir, "agent.mcs.yml"))), ["agent.mcs.yml"], "file directly in the agent dir");

// Characters that are percent-encoded in a URI
const oddDir = path.resolve(os.tmpdir(), "100% #1 \u00e9 (x)");
const oddRel = path.join("topics", "caf\u00e9 & co.topic.mcs.yml");
assertEqual(reported(oddDir, toFileUri(path.join(oddDir, oddRel))), [oddRel], "%, #, &, parentheses and non-ASCII in the path");

// The server may spell the same URI differently than toFileUri does
assertEqual(
  reported(agentDir, toFileUri(path.join(agentDir, "topics", "(x).topic.mcs.yml")).replace(/[()]/g, (c) => (c === "(" ? "%28" : "%29"))),
  [path.join("topics", "(x).topic.mcs.yml")],
  "URI with extra percent-escapes"
);

// A URI that is not a file URI is reported as-is instead of throwing
assertEqual(reported(agentDir, "untitled:Untitled-1"), ["untitled:Untitled-1"], "non-file URI falls back to the raw URI");

// The relative path must stay inside the agent dir (regression: a dropped leading "/" gave "../../...")
assertEqual(reported(agentDir, toFileUri(path.join(agentDir, rel)))[0].startsWith(".."), false, "no ../ escape from the agent dir");

// ---------------------------------------------------------------------------
// Windows: drive-letter URIs as produced by toFileUri and by VS Code
// ---------------------------------------------------------------------------

if (process.platform === "win32") {
  const p = path.join(agentDir, rel);
  const [drive, ...rest] = p.split(path.sep);
  const tail = rest.map(encodeURIComponent).join("/");
  const variants = {
    "file:///C:/...": `file:///${drive}/${tail}`,
    "lowercase drive, percent-encoded colon (VS Code)": `file:///${drive[0].toLowerCase()}%3A/${tail}`,
    "uppercase drive, percent-encoded colon": `file:///${drive[0].toUpperCase()}%3A/${tail}`,
    "lowercase drive, literal colon": `file:///${drive[0].toLowerCase()}:/${tail}`,
  };
  for (const [label, uri] of Object.entries(variants)) {
    assertEqual(reported(agentDir, uri), [rel], `Windows ${label}`);
  }

  // UNC workspace: toFileUri gives file:////host/share/..., a server may send file://host/share/...
  // "localhost" needs care: the URL parser drops that host, so fileURLToPath alone cannot handle it.
  const uncTail = rel.split(path.sep).map(encodeURIComponent).join("/");
  for (const host of ["srv", "localhost", "127.0.0.1"]) {
    const uncDir = path.win32.join(`\\\\${host}`, "C$", "my agent");
    assertEqual(reported(uncDir, toFileUri(path.win32.join(uncDir, rel))), [rel], `Windows UNC path from toFileUri, host ${host}`);
    if (host !== "localhost") {
      assertEqual(reported(uncDir, `file://${host}/C%24/my%20agent/${uncTail}`), [rel], `Windows UNC path with host in the URI, host ${host}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
