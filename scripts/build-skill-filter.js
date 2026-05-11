#!/usr/bin/env node
/**
 * Generates hooks/skill-types.json from SKILL.md frontmatter.
 *
 * Run after adding or changing skill agent-types:
 *   node scripts/build-skill-filter.js
 *
 * CI validates the committed JSON matches what this script generates.
 */

const fs = require('fs');
const path = require('path');

const skillsDir = path.join(__dirname, '..', 'skills');
const outputFile = path.join(__dirname, '..', 'hooks', 'skill-types.json');

const classic = [];
const modern = [];

for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  if (entry.name.startsWith('int-')) continue;

  const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
  if (!fs.existsSync(skillFile)) continue;

  const content = fs.readFileSync(skillFile, 'utf8');
  const match = content.match(/^agent-types:\s*(.+)$/m);
  if (!match) continue;

  const agentType = match[1].trim();
  if (agentType === 'classic') classic.push(entry.name);
  else if (agentType === 'modern') modern.push(entry.name);
}

classic.sort();
modern.sort();

fs.writeFileSync(outputFile, JSON.stringify({ classic, modern }, null, 2) + '\n');
console.log('Generated ' + path.relative(process.cwd(), outputFile));
console.log('  Classic-only: ' + classic.join(', '));
console.log('  Modern-only:  ' + modern.join(', '));
