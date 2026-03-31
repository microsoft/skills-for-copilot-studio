const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const file = path.join(root, 'CLAUDE.md');
const text = fs.readFileSync(file, 'utf8');

const output = JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: text
  }
});

process.stdout.write(output);
