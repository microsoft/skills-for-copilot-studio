const fs = require('fs');
const path = require('path');

function shellQuote(value) {
  if (typeof value !== 'string' || value.includes('\0')) {
    throw new Error('Plugin paths must be strings without NUL characters.');
  }
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

function persistEnvironment(envFile, pluginData, pluginRoot) {
  if (!path.isAbsolute(envFile) || envFile.includes('\0')) {
    throw new Error('CLAUDE_ENV_FILE must be an absolute file path.');
  }
  const content = '\nexport CLAUDE_PLUGIN_DATA=' + shellQuote(pluginData) +
    '\nexport CLAUDE_PLUGIN_ROOT=' + shellQuote(pluginRoot) + '\n';
  const existing = fs.lstatSync(envFile, { throwIfNoEntry: false });
  if (existing && !existing.isFile()) {
    throw new Error('CLAUDE_ENV_FILE must be a regular file, not a symlink.');
  }
  const flags = fs.constants.O_WRONLY | fs.constants.O_APPEND |
    fs.constants.O_CREAT | fs.constants.O_NONBLOCK | fs.constants.O_NOFOLLOW;
  const fd = fs.openSync(envFile, flags, 0o600);
  try {
    const opened = fs.fstatSync(fd);
    const entry = fs.lstatSync(envFile);
    if (!opened.isFile() || entry.isSymbolicLink() ||
        opened.dev !== entry.dev || opened.ino !== entry.ino) {
      throw new Error('CLAUDE_ENV_FILE must be a regular file, not a symlink.');
    }
    fs.writeFileSync(fd, content);
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = { shellQuote, persistEnvironment };
