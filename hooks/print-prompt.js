const path = require('path');
const fs = require('fs');

const text = fs.readFileSync(path.join(__dirname, 'system-prompt.md'), 'utf8');

// Output as JSON with additionalContext for Copilot CLI (v1.0.11+)
// and Claude Code (which captures raw stdout as context).
// Both formats are handled: Copilot CLI parses the JSON and injects
// additionalContext; Claude Code captures the entire stdout.
process.stdout.write(JSON.stringify({ additionalContext: text }));
