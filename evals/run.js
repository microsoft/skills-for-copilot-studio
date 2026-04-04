#!/usr/bin/env node
/**
 * Run scenario-based evals for Copilot Studio skills.
 * Cross-platform (Node.js) — works on macOS, Windows, and Linux.
 *
 * Usage:
 *   node evals/run.js                              # All scenarios
 *   node evals/run.js --scenario edit-agent         # Single scenario
 *   node evals/run.js --cli copilot                 # Use Copilot CLI
 *   node evals/run.js --verbose                     # Verbose output
 *   node evals/run.js --parallel 5                  # Run 5 evals concurrently (default: 3)
 */

const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const EVALS_SCENARIOS_DIR = path.join(REPO_ROOT, "evals", "scenarios");
const RESULTS_DIR = path.join(REPO_ROOT, "evals", "results");

// Resolve Python 3 binary — cross-platform (Windows has python/py, not python3)
function findPython() {
  const candidates = process.env.PYTHON
    ? [process.env.PYTHON]
    : process.platform === "win32"
      ? ["python3", "python", "py"]
      : ["python3", "python"];
  for (const cmd of candidates) {
    try {
      const pyArgs = cmd === "py" ? ["-3", "--version"] : ["--version"];
      const out = execFileSync(cmd, pyArgs, { stdio: "pipe" }).toString();
      if (out.includes("Python 3")) return cmd === "py" ? "py" : cmd;
    } catch {}
  }
  console.error("Error: Python 3 not found. Install Python 3 or set the PYTHON env var.");
  process.exit(1);
}
const pythonBin = findPython();
const pythonArgs = pythonBin === "py" ? ["-3"] : [];

// Parse args
let cli = "claude";
let scenario = "";
let verbose = false;
let parallel = 3;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--cli" && args[i + 1]) cli = args[++i];
  else if (args[i] === "--scenario" && args[i + 1]) scenario = args[++i];
  else if (args[i] === "--parallel" && args[i + 1]) parallel = parseInt(args[++i], 10) || 3;
  else if (args[i] === "--verbose") verbose = true;
}

// Create timestamped results directory
const timestamp = new Date().toISOString().replace(/[T:]/g, "-").replace(/\..+/, "");
const runDir = path.join(RESULTS_DIR, timestamp);
fs.mkdirSync(runDir, { recursive: true });

// Find scenario eval definitions
const scenarioNames = fs.existsSync(EVALS_SCENARIOS_DIR)
  ? fs.readdirSync(EVALS_SCENARIOS_DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""))
  : [];
const names = scenarioNames.filter((name) => !scenario || name === scenario);

if (names.length === 0) {
  console.error(scenario ? `No evals found for scenario '${scenario}'` : "No eval files found in evals/scenarios/");
  process.exit(1);
}

// Run a single skill's evals as a promise
function runSkill(name) {
  return new Promise((resolve) => {
    const outputFile = path.join(runDir, `${name}.json`);
    const evalArgs = [
      path.join(REPO_ROOT, "evals", "evaluate.py"),
      "--skill", name,
      "--cli", cli,
      "--output", outputFile,
      "--parallel", String(parallel),
    ];
    if (verbose) evalArgs.push("--verbose");

    const proc = spawn(pythonBin, [...pythonArgs, ...evalArgs], {
      stdio: verbose ? "inherit" : ["pipe", "pipe", "pipe"],
      cwd: REPO_ROOT,
    });

    proc.on("close", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`  Error running evals for ${name} (exit ${code})`);
        resolve({ name, error: true });
        return;
      }

      if (fs.existsSync(outputFile)) {
        try {
          const results = JSON.parse(fs.readFileSync(outputFile, "utf8"));
          const summary = results.summary ?? {};
          const passed = summary.total_checks_passed ?? 0;
          const failed = summary.total_checks_failed ?? 0;
          const total = summary.total_checks ?? 0;
          console.log(`  ${name}: ${passed}/${total} checks passed`);
          resolve({ name, passed, failed });
        } catch {
          console.error(`  Warning: could not read results from ${outputFile}`);
          resolve({ name, error: true });
        }
      } else {
        resolve({ name, error: true });
      }
    });

    proc.on("error", (err) => {
      console.error(`  Error spawning evals for ${name}: ${err.message}`);
      resolve({ name, error: true });
    });
  });
}

// Main async runner
async function main() {
  const startTime = Date.now();
  console.log(`Running evals for ${names.length} scenario(s) with ${parallel} worker(s)...\n`);

  // Run all skills in parallel
  const promises = names.map((name) => runSkill(name));
  const results = await Promise.all(promises);

  let totalPass = 0;
  let totalFail = 0;
  let totalErrors = 0;

  for (const r of results) {
    if (r.error) {
      totalErrors++;
    } else {
      totalPass += r.passed ?? 0;
      totalFail += r.failed ?? 0;
    }
  }

  // Generate HTML report
  console.log("\nGenerating report...");
  try {
    execFileSync(pythonBin, [...pythonArgs, path.join(REPO_ROOT, "evals", "report.py"), runDir], {
      stdio: "inherit",
      cwd: REPO_ROOT,
    });
  } catch (e) {
    console.error(`Warning: Report generation failed: ${e.message}`);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("");
  console.log("=== Summary ===");
  console.log(`Scenarios tested: ${names.length}`);
  console.log(`Total checks: ${totalPass + totalFail}`);
  console.log(`Passed: ${totalPass}`);
  console.log(`Failed: ${totalFail}`);
  if (totalErrors > 0) console.log(`Errors: ${totalErrors} skill(s) failed to run`);
  console.log(`Duration: ${durationSec}s (${parallel} worker(s))`);
  console.log(`Results: ${runDir}/`);

  process.exit((totalFail > 0 || totalErrors > 0) ? 1 : 0);
}

main();
