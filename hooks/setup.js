const fs = require('fs');
const cp = require('child_process');
const p = require('path');
const os = require('os');

// __dirname is the hooks/ directory; the plugin root is one level up
const r = p.resolve(__dirname, '..');
const d = process.env.CLAUDE_PLUGIN_DATA || process.env.COPILOT_PLUGIN_DATA;
const e = process.env.CLAUDE_ENV_FILE;

if (!r || !d) {
  process.exit(0);
}

const src = p.join(r, 'scripts', 'native-deps.json');
const dst = p.join(d, 'package.json');

try {
  if (fs.readFileSync(src, 'utf8') !== fs.readFileSync(dst, 'utf8')) throw 0;
} catch {
  fs.mkdirSync(d, { recursive: true });
  fs.copyFileSync(src, dst);
  cp.execSync('npm install --no-audit --no-fund', { cwd: d, stdio: 'inherit' });
}

var pd = p.join(os.homedir(), '.copilot-studio-cli');
fs.mkdirSync(pd, { recursive: true });
fs.writeFileSync(
  p.join(pd, 'plugin-paths.json'),
  JSON.stringify({ pluginData: d, pluginRoot: r })
);

if (e) {
  fs.appendFileSync(
    e,
    'export CLAUDE_PLUGIN_DATA="' + d + '"\nexport CLAUDE_PLUGIN_ROOT="' + r + '"\n'
  );
}
