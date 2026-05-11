const fs = require('fs');
const path = require('path');

const os = require('os');
const envFile = process.env.CLAUDE_ENV_FILE;
const stateFile = path.join(os.homedir(), '.copilot-studio-cli', 'agent-type.json');
const debug = (msg) => process.stderr.write(`[detect-agent-type] ${msg}\n`);

debug(`CLAUDE_ENV_FILE: ${envFile || '(not set)'}`);

// Scan for settings.mcs.yml starting from the working directory
const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
debug(`Scanning from: ${cwd}`);

function findSettingsFile(dir, depth) {
  if (depth > 4) return null;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'settings.mcs.yml' && entry.isFile()) {
        return path.join(dir, entry.name);
      }
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const found = findSettingsFile(path.join(dir, entry.name), depth + 1);
        if (found) return found;
      }
    }
  } catch { /* permission errors, etc. */ }
  return null;
}

const settingsPath = findSettingsFile(cwd, 0);
if (!settingsPath) {
  debug('No settings.mcs.yml found — no agent');
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify({ agentType: '', blockedSkills: [] }));
  if (envFile) fs.appendFileSync(envFile, 'export MCS_AGENT_TYPE=""\nexport MCS_BLOCKED_SKILLS=""\n');
  process.exit(0);
}

debug(`Found: ${settingsPath}`);
const content = fs.readFileSync(settingsPath, 'utf8');

// Detect modern (CLI/Dracarys) agent
const isModern =
  /template:\s*cliagent-/.test(content) ||
  /\$kind:\s*CLICopilotRecognizer/.test(content) ||
  /kind:\s*CLICopilotRecognizer/.test(content) ||
  /kind:\s*CLIAgentRecognizer/.test(content);

const CLASSIC_ONLY_SKILLS = [
  'new-topic',
  'add-node',
  'add-action',
  'edit-action',
  'add-adaptive-card',
  'add-generative-answers',
  'edit-triggers',
  'add-global-variable',
  'list-topics',
];

const MODERN_ONLY_SKILLS = [
  'new-skill',
  'list-skills',
  'edit-agent-modern',
  'add-tool',
  'edit-tool',
  'add-knowledge-modern',
  'add-other-agents-modern',
];

const agentType = isModern ? 'modern' : 'classic';
const blocked = isModern ? CLASSIC_ONLY_SKILLS : MODERN_ONLY_SKILLS;

debug(`Agent type: ${agentType} — blocking: ${blocked.join(', ')}`);

// Write to state file (always available, read by filter-skills.js)
fs.mkdirSync(path.dirname(stateFile), { recursive: true });
fs.writeFileSync(stateFile, JSON.stringify({ agentType, blockedSkills: blocked }));

// Also write to CLAUDE_ENV_FILE if available
if (envFile) {
  fs.appendFileSync(
    envFile,
    `export MCS_AGENT_TYPE="${agentType}"\nexport MCS_BLOCKED_SKILLS="${blocked.join(',')}"\n`
  );
}
