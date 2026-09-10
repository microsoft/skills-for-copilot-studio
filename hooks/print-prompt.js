const path = require('path');
const fs = require('fs');

// Only inject the Copilot Studio system prompt when this session is actually a
// Copilot Studio project — i.e. an `agent.mcs.yml` exists in the working
// directory or a subdirectory. This is the plugin's own definition of a CS
// project (see system-prompt.md: "already inside a Copilot Studio project ...
// there is an agent.mcs.yml file in the current directory or any subdirectory").
//
// A SessionStart hook runs before any user message, so it cannot read user
// intent; the project marker is the only reliable signal. Without this gate the
// hook fires on every session and injects the ~11KB prompt into unrelated work.
function hasCopilotStudioProject(root, maxDepth, maxDirs) {
  const skip = new Set([
    'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out',
    '.next', '.cache', '.turbo', 'coverage', 'vendor', 'target',
  ]);
  const stack = [[root, 0]];
  let visited = 0;
  while (stack.length) {
    const [dir, depth] = stack.pop();
    if (++visited > maxDirs) return false; // bounded — never a long scan
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (ent.isFile() && ent.name === 'agent.mcs.yml') return true;
      if (
        ent.isDirectory() &&
        depth < maxDepth &&
        !skip.has(ent.name) &&
        !ent.name.startsWith('.')
      ) {
        stack.push([path.join(dir, ent.name), depth + 1]);
      }
    }
  }
  return false;
}

if (!hasCopilotStudioProject(process.cwd(), 4, 2000)) {
  process.exit(0); // not a Copilot Studio session — inject nothing
}

const text = fs.readFileSync(path.join(__dirname, 'system-prompt.md'), 'utf8');

// Copilot CLI (v1.0.11+) injects additionalContext from JSON output.
// Claude Code captures raw stdout as context.
// Detect runtime and output the appropriate format.
if (process.env.COPILOT_CLI) {
  process.stdout.write(JSON.stringify({ additionalContext: text }));
} else {
  process.stdout.write(text);
}
