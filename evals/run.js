#!/usr/bin/env node
/**
 * Run skill evals for all skills or a specific skill.
 * Cross-platform (Node.js) — works on macOS, Windows, and Linux.
 *
 * Usage:
 *   node evals/run.js                          # All skills
 *   node evals/run.js --skill new-topic        # Single skill
 *   node evals/run.js --cli copilot            # Use Copilot CLI
 *   node evals/run.js --verbose                # Verbose output
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const SKILLS_DIR = path.join(REPO_ROOT, "skills");
const RESULTS_DIR = path.join(REPO_ROOT, "evals", "results");

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

// Find skills with evals
const skillDirs = fs.readdirSync(SKILLS_DIR).filter((name) => {
  if (skill && name !== skill) return false;
  const evalsFile = path.join(SKILLS_DIR, name, "evals", "evals.json");
  return fs.existsSync(evalsFile);
});

if (skillDirs.length === 0) {
  console.error(skill ? `No evals found for skill '${skill}'` : "No skills with evals found");
  process.exit(1);
}

let totalPass = 0;
let totalFail = 0;

for (const name of skillDirs) {
  console.log(`=== ${name} ===`);
  const outputFile = path.join(runDir, `${name}.json`);
  const evalCmd = [
    "python3",
    path.join(REPO_ROOT, "evals", "evaluate.py"),
    "--skill", name,
    "--cli", cli,
    "--output", outputFile,
  ];
  if (verbose) evalCmd.push("--verbose");

  try {
    execSync(evalCmd.join(" "), {
      stdio: verbose ? "inherit" : ["pipe", "pipe", "pipe"],
      cwd: REPO_ROOT,
    });
  } catch (e) {
    console.error(`  Error running evals for ${name}: ${e.message}`);
    continue;
  }

  // Read results
  if (fs.existsSync(outputFile)) {
    const results = JSON.parse(fs.readFileSync(outputFile, "utf8"));
    const { total_checks_passed: passed, total_checks_failed: failed, total_checks: total } = results.summary;
    console.log(`  ${passed}/${total} checks passed`);
    totalPass += passed;
    totalFail += failed;
  }
}

console.log("");
console.log("=== Summary ===");
console.log(`Skills tested: ${skillDirs.length}`);
console.log(`Total checks: ${totalPass + totalFail}`);
console.log(`Passed: ${totalPass}`);
console.log(`Failed: ${totalFail}`);
console.log(`Results: ${runDir}/`);

process.exit(totalFail > 0 ? 1 : 0);
