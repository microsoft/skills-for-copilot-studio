const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");
const { shellQuote, persistEnvironment } = require("../hooks/setup-env");

function tempDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "setup-env-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test("shell literals quote every character rather than interpolating shell syntax", () => {
  assert.equal(shellQuote("a'b"), "'a'\\''b'");
  assert.equal(shellQuote('$(unexecuted) `unexecuted` "$HOME";\\\n'), '\'$(unexecuted) `unexecuted` "$HOME";\\\n\'');
  assert.throws(() => shellQuote("a\0b"), /NUL/);
});

test("environment file appends safely and shell sourcing preserves literal paths", (t) => {
  const directory = tempDirectory(t);
  const envFile = path.join(directory, "session.env");
  fs.writeFileSync(envFile, "export EXISTING=value");
  const data = "/tmp/data with spaces'and\"$HOME\\suffix\nnext-line";
  const root = "/tmp/plugin root;literal";
  persistEnvironment(envFile, data, root);
  assert.ok(fs.readFileSync(envFile, "utf8").startsWith("export EXISTING=value\n"));
  const result = spawnSync("/bin/sh", [
    "-c", '. "$1"; printf "%s\\000%s\\000%s" "$CLAUDE_PLUGIN_DATA" "$CLAUDE_PLUGIN_ROOT" "$EXISTING"',
    "sh", envFile,
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.split("\0"), [data, root, "value"]);
});

test("environment file can be created but cannot be relative, a directory, or a symlink", (t) => {
  const directory = tempDirectory(t);
  const envFile = path.join(directory, "new.env");
  persistEnvironment(envFile, "data", "root");
  assert.ok(fs.statSync(envFile).isFile());
  assert.throws(() => persistEnvironment("relative.env", "data", "root"), /absolute/);
  assert.throws(() => persistEnvironment(directory, "data", "root"));
  const link = path.join(directory, "link.env");
  fs.symlinkSync(envFile, link);
  const before = fs.readFileSync(envFile, "utf8");
  assert.throws(() => persistEnvironment(link, "other", "root"));
  assert.equal(fs.readFileSync(envFile, "utf8"), before);
  const missingTarget = path.join(directory, "must-not-create.env");
  const danglingLink = path.join(directory, "dangling.env");
  fs.symlinkSync(missingTarget, danglingLink);
  assert.throws(() => persistEnvironment(danglingLink, "other", "root"));
  assert.equal(fs.existsSync(missingTarget), false);
});

test("setup keeps Copilot data fallback, plugin-path registry, and optional persistence", (t) => {
  const directory = tempDirectory(t);
  const data = path.join(directory, "plugin data'$HOME");
  fs.mkdirSync(data);
  fs.copyFileSync(path.join(__dirname, "../scripts/native-deps.json"), path.join(data, "package.json"));
  const envFile = path.join(directory, "session.env");
  const environment = {
    ...process.env, HOME: directory, USERPROFILE: directory,
    CLAUDE_PLUGIN_DATA: "", COPILOT_PLUGIN_DATA: data, CLAUDE_ENV_FILE: envFile,
  };
  for (const persist of [true, false]) {
    const result = spawnSync(process.execPath, [path.join(__dirname, "../hooks/setup.js")], {
      env: { ...environment, CLAUDE_ENV_FILE: persist ? envFile : "" },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const registry = JSON.parse(fs.readFileSync(path.join(directory, ".copilot-studio-cli/plugin-paths.json"), "utf8"));
    assert.equal(registry.pluginData, data);
    assert.equal(registry.pluginRoot, path.resolve(__dirname, ".."));
  }
  assert.equal(fs.readFileSync(envFile, "utf8").split("export CLAUDE_PLUGIN_DATA=").length, 2);
});
