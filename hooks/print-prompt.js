const path = require('path');
const fs = require('fs');

const text = fs.readFileSync(path.join(__dirname, 'system-prompt.md'), 'utf8');

// Copilot CLI (v1.0.11+) injects additionalContext from JSON output.
// Claude Code captures raw stdout as context.
// Detect runtime and output the appropriate format.
if (process.env.COPILOT_CLI) {
  process.stdout.write(JSON.stringify({ additionalContext: text }));
} else {
  process.stdout.write(text);
}
