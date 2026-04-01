#!/usr/bin/env node
/**
 * Run skill evals for all skills or a specific skill.
 * Cross-platform (Node.js) — works on macOS, Windows, and Linux.
 *
 * Usage:
 *   node evals/run.js                          # All skills
 *   node evals/run.js --skill new-topic        # Single skill
 *   node evals/run.js --cli copilot            # Use Copilot CLI
 *   node evals/run.js --cli amp                # Use Amp CLI
 *   node evals/run.js --verbose                # Verbose output
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const EVALS_SKILLS_DIR = path.join(REPO_ROOT, "evals", "skills");
const RESULTS_DIR = path.join(REPO_ROOT, "evals", "results");

// Resolve Python 3 binary — cross-platform
function findPython() {
  const candidates = process.env.PYTHON
    ? [process.env.PYTHON]
    : process.platform === "win32"
      ? ["python3", "python", "py"]
      : ["python3", "python"];
  for (const cmd of candidates) {
    try {
      const args = cmd === "py" ? ["-3", "--version"] : ["--version"];
      const out = execFileSync(cmd, args, { stdio: "pipe" }).toString();
      if (out.includes("Python 3")) return cmd === "py" ? "py" : cmd;
    } catch {}
  }
  console.error("Error: Python 3 not found. Install Python 3 or set the PYTHON env var.");
  process.exit(1);
}

const pythonBin = findPython();

// Parse args
let cli = "claude";
let skill = "";
let verbose = false;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--cli" && args[i + 1]) cli = args[++i];
  else if (args[i] === "--skill" && args[i + 1]) skill = args[++i];
  else if (args[i] === "--verbose") verbose = true;
}

// Create timestamped results directory
const timestamp = new Date().toISOString().replace(/[T:]/g, "-").replace(/\..+/, "");
const runDir = path.join(RESULTS_DIR, timestamp);
fs.mkdirSync(runDir, { recursive: true });

// Find skills with evals (from evals/skills/<name>.json)
const skillNames = fs.readdirSync(EVALS_SKILLS_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""))
  .filter((name) => !skill || name === skill);

if (skillNames.length === 0) {
  console.error(skill ? `No evals found for skill '${skill}'` : "No eval files found in evals/skills/");
  process.exit(1);
}

let totalPass = 0;
let totalFail = 0;
let totalInvalid = 0;
let totalErrors = 0;

for (const name of skillNames) {
  console.log(`=== ${name} ===`);
  const outputFile = path.join(runDir, `${name}.json`);
  const evalArgs = [
    path.join(REPO_ROOT, "evals", "evaluate.py"),
    "--skill", name,
    "--cli", cli,
    "--output", outputFile,
  ];
  if (verbose) evalArgs.push("--verbose");

  try {
    execFileSync(pythonBin, [...(pythonBin === "py" ? ["-3"] : []), ...evalArgs], {
      stdio: verbose ? "inherit" : ["pipe", "pipe", "pipe"],
      cwd: REPO_ROOT,
    });
  } catch (e) {
    console.error(`  Error running evals for ${name}: ${e.message}`);
    totalErrors++;
    continue;
  }

  // Read results
  if (fs.existsSync(outputFile)) {
    try {
      const results = JSON.parse(fs.readFileSync(outputFile, "utf8"));
      const summary = results.summary ?? {};
      const passed = summary.total_checks_passed ?? 0;
      const failed = summary.total_checks_failed ?? 0;
      const total = summary.total_checks ?? 0;
      // Count invalid evals (wrong skill routed)
      const invalidCount = (results.results ?? []).filter(r => r.summary?.status === "invalid").length;
      if (invalidCount > 0) {
        console.log(`  ${passed}/${total} checks passed (${invalidCount} invalid — wrong skill routed)`);
      } else {
        console.log(`  ${passed}/${total} checks passed`);
      }
      totalPass += passed;
      totalFail += failed;
      totalInvalid += invalidCount;
    } catch {
      console.error(`  Warning: could not read results from ${outputFile}`);
    }
  }
}

// Generate HTML report
console.log("");
console.log("Generating report...");
try {
  execFileSync(pythonBin, [...(pythonBin === "py" ? ["-3"] : []), path.join(REPO_ROOT, "evals", "report.py"), runDir], {
    stdio: "inherit",
    cwd: REPO_ROOT,
  });
} catch (e) {
  console.error(`Warning: Report generation failed: ${e.message}`);
}

console.log("");
console.log("=== Summary ===");
console.log(`Skills tested: ${skillNames.length}`);
console.log(`Total checks: ${totalPass + totalFail}`);
console.log(`Passed: ${totalPass}`);
console.log(`Failed: ${totalFail}`);
if (totalInvalid > 0) console.log(`Invalid: ${totalInvalid} eval(s) — wrong skill routed`);
if (totalErrors > 0) console.log(`Errors: ${totalErrors} skill(s) failed to run`);
console.log(`Results: ${runDir}/`);

process.exit((totalFail > 0 || totalErrors > 0) ? 1 : 0);
