const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const os = require('os');

const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..');
const pluginData = process.env.CLAUDE_PLUGIN_DATA;
const envFile = process.env.CLAUDE_ENV_FILE;

if (!pluginRoot || !pluginData) {
  process.exit(0);
}

const src = path.join(pluginRoot, 'scripts', 'native-deps.json');
const dst = path.join(pluginData, 'package.json');

try {
  if (fs.readFileSync(src, 'utf8') !== fs.readFileSync(dst, 'utf8')) throw 0;
} catch {
  fs.mkdirSync(pluginData, { recursive: true });
  fs.copyFileSync(src, dst);
  cp.execSync('npm install --no-audit --no-fund', { cwd: pluginData, stdio: 'inherit' });
}

const pd = path.join(os.homedir(), '.copilot-studio-cli');
fs.mkdirSync(pd, { recursive: true });
fs.writeFileSync(
  path.join(pd, 'plugin-paths.json'),
  JSON.stringify({ pluginData, pluginRoot })
);

if (envFile) {
  fs.appendFileSync(
    envFile,
    'export CLAUDE_PLUGIN_DATA="' + pluginData + '"\nexport CLAUDE_PLUGIN_ROOT="' + pluginRoot + '"\n'
  );
}
