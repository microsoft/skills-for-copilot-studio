/**
 * Tests for SKILL.md / agent frontmatter — name, description and argument-hint
 * must not start with an unquoted "[" or "{".
 *
 * An unquoted value starting with "[" or "{" is parsed by YAML as an array or
 * object, and Claude Code then refuses to load the skill
 * ("argument-hint must be a string").
 *
 * Run: node tests/skill-frontmatter.test.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const STRING_FIELDS = ["name", "description", "argument-hint"];

function listFiles() {
  const files = [];
  for (const dir of fs.readdirSync(path.join(ROOT, "skills"))) {
    const file = path.join(ROOT, "skills", dir, "SKILL.md");
    if (fs.existsSync(file)) files.push(file);
  }
  for (const file of fs.readdirSync(path.join(ROOT, "agents"))) {
    if (file.endsWith(".md")) files.push(path.join(ROOT, "agents", file));
  }
  return files;
}

function frontmatterLines(text) {
  // A UTF-8 BOM (Windows editors) must not hide the opening "---".
  const match = text.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1].split(/\r?\n/) : null;
}

let passed = 0;
let failed = 0;

for (const file of listFiles()) {
  const rel = path.relative(ROOT, file);
  const lines = frontmatterLines(fs.readFileSync(file, "utf8"));
  if (!lines) {
    console.error(`FAIL ${rel}: missing frontmatter`);
    failed++;
    continue;
  }
  for (const line of lines) {
    const m = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!m || !STRING_FIELDS.includes(m[1])) continue;
    if (/^[[{]/.test(m[2])) {
      console.error(`FAIL ${rel}: "${m[1]}" starts with an unquoted "${m[2][0]}" (YAML flow ${m[2][0] === "[" ? "sequence" : "mapping"}: loads as an array/object or is a syntax error) — quote the value`);
      failed++;
    } else {
      passed++;
    }
  }
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
