const fs = require('fs');
const path = require('path');
const os = require('os');

// Try env var first, fall back to state file
let blockedSkills = process.env.MCS_BLOCKED_SKILLS || '';
let agentType = process.env.MCS_AGENT_TYPE || '';

if (!blockedSkills) {
  try {
    const stateFile = path.join(os.homedir(), '.copilot-studio-cli', 'agent-type.json');
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    blockedSkills = (state.blockedSkills || []).join(',');
    agentType = state.agentType || '';
  } catch { /* no state file */ }
}

if (!blockedSkills) process.exit(0);

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    // PreToolUse for the Skill tool — input has tool_input.skill
    // e.g. { tool_name: "Skill", tool_input: { skill: "copilot-studio:new-skill" } }
    const skillField = (data.tool_input && data.tool_input.skill) || '';

    // Extract the short name: "copilot-studio:new-skill" → "new-skill"
    const command = skillField.includes(':') ? skillField.split(':').pop() : skillField;

    if (!command) process.exit(0);

    const blockedList = blockedSkills.split(',');
    if (blockedList.includes(command)) {
      const opposite = agentType === 'modern' ? 'classic' : 'modern';
      process.stdout.write(JSON.stringify({
        decision: 'block',
        reason: `The "${command}" skill is for ${opposite} agents only. This workspace contains a ${agentType} agent.`
      }));
    }
  } catch { /* allow */ }
});
