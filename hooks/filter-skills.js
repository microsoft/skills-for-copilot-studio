const fs = require('fs');
const path = require('path');

const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..');

// Detect agent type from settings.mcs.yml
function detectAgentType(cwd) {
  function findSettings(dir, depth) {
    if (depth > 4) return null;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name === 'settings.mcs.yml' && e.isFile()) return path.join(dir, e.name);
      }
      for (const e of entries) {
        if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
          const found = findSettings(path.join(dir, e.name), depth + 1);
          if (found) return found;
        }
      }
    } catch {}
    return null;
  }

  const settingsPath = findSettings(cwd, 0);
  if (!settingsPath) return '';

  const content = fs.readFileSync(settingsPath, 'utf8');
  if (/template:\s*cliagent-/.test(content) ||
      /\$kind:\s*CLICopilotRecognizer/.test(content) ||
      /kind:\s*CLICopilotRecognizer/.test(content) ||
      /kind:\s*CLIAgentRecognizer/.test(content)) {
    return 'modern';
  }
  return 'classic';
}

// Read agent-types from a skill's SKILL.md frontmatter
function getSkillAgentType(skillName) {
  const skillFile = path.join(pluginRoot, 'skills', skillName, 'SKILL.md');
  try {
    // Read just the frontmatter (first 20 lines is plenty)
    const content = fs.readFileSync(skillFile, 'utf8');
    const match = content.match(/^agent-types:\s*(.+)$/m);
    return match ? match[1].trim() : 'both';
  } catch {
    return 'both'; // Unknown skill — allow
  }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const skillField = (data.tool_input && data.tool_input.skill) || '';
    const command = skillField.includes(':') ? skillField.split(':').pop() : skillField;
    if (!command) process.exit(0);

    const skillType = getSkillAgentType(command);
    if (skillType === 'both') process.exit(0);

    const cwd = data.cwd || process.cwd();
    const agentType = detectAgentType(cwd);
    if (!agentType || agentType === skillType) process.exit(0);

    const labels = { modern: 'Modern Agents', classic: 'Generative Orchestration agents' };
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: 'The "' + command + '" skill is for ' + labels[skillType] + ' only. This workspace contains a ' + labels[agentType] + ' workspace.'
    }));
  } catch {}
});
