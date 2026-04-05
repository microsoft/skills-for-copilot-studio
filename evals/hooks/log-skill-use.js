#!/usr/bin/env node
/**
 * PreToolUse hook that logs Skill invocations to a file.
 * Used by the eval harness to trace skills invoked inside sub-agents.
 *
 * Reads the tool input from stdin (Claude Code hook protocol),
 * writes the skill name to the file at EVAL_SKILL_LOG (one per line).
 * Only logs Skill tool uses; ignores everything else.
 */
const fs = require("fs");

const logFile = process.env.EVAL_SKILL_LOG;
if (!logFile) process.exit(0);

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(input);
    if (data.tool_name === "Skill") {
      const skillName = data.tool_input?.skill || "";
      if (skillName) {
        fs.appendFileSync(logFile, skillName + "\n");
      }
    }
  } catch {}
});
