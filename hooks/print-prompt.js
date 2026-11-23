const path = require('path');
const fs = require('fs');

const text = fs.readFileSync(path.join(__dirname, 'system-prompt.md'), 'utf8');

// Antigravity expects SessionStart injectSteps JSON with a nested systemMessage object.
// Copilot CLI (v1.0.11+) injects additionalContext from JSON output.
// Claude Code captures raw stdout as context.
if (process.argv.includes('--antigravity')) {
  const pluginRoot = process.env.PLUGIN_ROOT || path.resolve(__dirname, '..');
  const agyNote = fs.readFileSync(path.join(__dirname, 'antigravity-prompt.md'), 'utf8')
    .replaceAll('{{PLUGIN_ROOT}}', () => pluginRoot);
  process.stdout.write(JSON.stringify({
    injectSteps: [{ systemMessage: { systemMessage: `${text}\n${agyNote}` } }],
  }));
} else if (process.env.COPILOT_CLI) {
  process.stdout.write(JSON.stringify({ additionalContext: text }));
} else {
  process.stdout.write(text);
}
