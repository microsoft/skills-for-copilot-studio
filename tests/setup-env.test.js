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

test("setup supports Antigravity PLUGIN_DATA and emits valid JSON stdout", (t) => {
  const directory = tempDirectory(t);
  const data = path.join(directory, "agy-plugin-data");
  fs.mkdirSync(data);
  fs.copyFileSync(path.join(__dirname, "../scripts/native-deps.json"), path.join(data, "package.json"));
  const repoRoot = path.resolve(__dirname, "..");

  const withData = spawnSync(process.execPath, [path.join(__dirname, "../hooks/setup.js"), "--antigravity"], {
    env: {
      ...process.env,
      HOME: directory,
      USERPROFILE: directory,
      CLAUDE_PLUGIN_DATA: "",
      CLAUDE_PLUGIN_ROOT: "",
      COPILOT_PLUGIN_DATA: "",
      COPILOT_CLI: "",
      CLAUDE_ENV_FILE: "",
      PLUGIN_DATA: data,
      PLUGIN_ROOT: repoRoot,
    },
    encoding: "utf8",
  });
  assert.equal(withData.status, 0, withData.stderr);
  assert.deepEqual(JSON.parse(withData.stdout), {});
  const registry = JSON.parse(fs.readFileSync(path.join(directory, ".copilot-studio-cli/plugin-paths.json"), "utf8"));
  assert.equal(registry.pluginData, data);
  assert.equal(registry.pluginRoot, repoRoot);

  const emptyHome = tempDirectory(t);
  const withoutData = spawnSync(process.execPath, [path.join(__dirname, "../hooks/setup.js"), "--antigravity"], {
    env: {
      ...process.env,
      HOME: emptyHome,
      USERPROFILE: emptyHome,
      CLAUDE_PLUGIN_DATA: "",
      CLAUDE_PLUGIN_ROOT: "",
      COPILOT_PLUGIN_DATA: "",
      COPILOT_CLI: "",
      CLAUDE_ENV_FILE: "",
      PLUGIN_DATA: "",
      PLUGIN_ROOT: repoRoot,
    },
    encoding: "utf8",
  });
  assert.equal(withoutData.status, 0, withoutData.stderr);
  assert.deepEqual(JSON.parse(withoutData.stdout), {});
  assert.equal(fs.existsSync(path.join(emptyHome, ".copilot-studio-cli/plugin-paths.json")), false);
});

test("print-prompt outputs host-appropriate formats for Claude Code, Copilot CLI, and Antigravity", () => {
  const script = path.join(__dirname, "../hooks/print-prompt.js");
  const systemPrompt = fs.readFileSync(path.join(__dirname, "../hooks/system-prompt.md"), "utf8");
  const baseEnv = {
    ...process.env,
    CLAUDE_PLUGIN_ROOT: "",
    COPILOT_CLI: "",
    PLUGIN_ROOT: "",
  };

  const claude = spawnSync(process.execPath, [script], { env: baseEnv, encoding: "utf8" });
  assert.equal(claude.status, 0, claude.stderr);
  assert.equal(claude.stdout, systemPrompt);

  const claudeWithStrayPluginRoot = spawnSync(process.execPath, [script], {
    env: { ...baseEnv, PLUGIN_ROOT: "/stray/path" },
    encoding: "utf8",
  });
  assert.equal(claudeWithStrayPluginRoot.status, 0, claudeWithStrayPluginRoot.stderr);
  assert.equal(claudeWithStrayPluginRoot.stdout, systemPrompt);

  const copilot = spawnSync(process.execPath, [script], {
    env: { ...baseEnv, COPILOT_CLI: "1" },
    encoding: "utf8",
  });
  assert.equal(copilot.status, 0, copilot.stderr);
  assert.deepEqual(JSON.parse(copilot.stdout), { additionalContext: systemPrompt });

  const customRoot = path.join(os.tmpdir(), "agy-root-example");
  const agy = spawnSync(process.execPath, [script, "--antigravity"], {
    env: { ...baseEnv, PLUGIN_ROOT: customRoot },
    encoding: "utf8",
  });
  assert.equal(agy.status, 0, agy.stderr);
  const payload = JSON.parse(agy.stdout);
  assert.ok(Array.isArray(payload.injectSteps) && payload.injectSteps.length === 1);
  const msg = payload.injectSteps[0]?.systemMessage?.systemMessage;
  assert.equal(typeof msg, "string");
  assert.ok(msg.startsWith(systemPrompt));
  assert.ok(msg.includes(customRoot));
  assert.ok(!msg.includes("{{PLUGIN_ROOT}}"));
  assert.ok(msg.includes("CLAUDE_SKILL_DIR"));
  assert.ok(msg.includes('TypeName: "self"'));
  assert.ok(msg.includes("agents/copilot-studio-<role>.md"));
});

test("Antigravity manifest and root hooks stay aligned", () => {
  const repoRoot = path.resolve(__dirname, "..");
  const agyManifest = JSON.parse(fs.readFileSync(path.join(repoRoot, ".antigravity-plugin/plugin.json"), "utf8"));
  const claudeManifest = JSON.parse(fs.readFileSync(path.join(repoRoot, ".claude-plugin/plugin.json"), "utf8"));
  const marketplace = JSON.parse(fs.readFileSync(path.join(repoRoot, ".claude-plugin/marketplace.json"), "utf8"));

  assert.equal(agyManifest.name, claudeManifest.name);
  assert.equal(agyManifest.version, claudeManifest.version);
  assert.equal(agyManifest.version, marketplace.plugins[0].version);

  const rootHooks = JSON.parse(fs.readFileSync(path.join(repoRoot, "hooks.json"), "utf8"));
  const sessionStart = rootHooks["copilot-studio"]?.SessionStart;
  assert.ok(Array.isArray(sessionStart) && sessionStart.length === 2);
  for (const handler of sessionStart) {
    assert.equal(handler.type, "command");
    assert.equal(typeof handler.command, "string");
  }
});
