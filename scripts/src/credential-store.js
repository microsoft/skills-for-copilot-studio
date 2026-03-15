/**
 * credential-store.js — OS-native secure token storage.
 *
 * Stores/retrieves JSON blobs using the platform's credential manager:
 *   macOS  → Keychain (security CLI)
 *   Windows → DPAPI via PowerShell (encrypted file on disk)
 *   Linux  → secret-tool (libsecret) if available, else plaintext file with 0o600
 *
 * Falls back to file-based storage (0o600) if the OS backend fails.
 */

const { execFileSync, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const SERVICE_NAME = "copilot-studio-cli";

// Directory for fallback/DPAPI files — next to the bundle
const STORE_DIR = path.join(__dirname, "..");

function warn(msg) {
  process.stderr.write(`[credential-store] ${msg}\n`);
}

// ---------------------------------------------------------------------------
// macOS — Keychain via `security` CLI
// ---------------------------------------------------------------------------

function macSave(service, account, jsonString) {
  execFileSync("security", [
    "add-generic-password",
    "-s", service,
    "-a", account,
    "-w", jsonString,
    "-U", // update if exists
  ], { stdio: "ignore" });
}

function macLoad(service, account) {
  const result = execFileSync("security", [
    "find-generic-password",
    "-s", service,
    "-a", account,
    "-w",
  ], { stdio: ["ignore", "pipe", "ignore"] });
  return JSON.parse(result.toString().trim());
}

function macClear(service, account) {
  execFileSync("security", [
    "delete-generic-password",
    "-s", service,
    "-a", account,
  ], { stdio: "ignore" });
}

// ---------------------------------------------------------------------------
// Windows — DPAPI via PowerShell
// ---------------------------------------------------------------------------

function dpapiPath(account) {
  return path.join(STORE_DIR, `.token_cache_${account}.dpapi`);
}

function winSave(service, account, jsonString) {
  const encPath = dpapiPath(account);
  // Pipe JSON through PowerShell DPAPI encryption
  execSync(
    `powershell -NoProfile -NonInteractive -Command "` +
    `$s = [System.Management.Automation.PSCredential]::new('x',` +
    `(ConvertTo-SecureString -String $input -AsPlainText -Force)).Password; ` +
    `ConvertFrom-SecureString -SecureString $s | Set-Content -Path '${encPath}'"`,
    { input: jsonString, stdio: ["pipe", "ignore", "ignore"] }
  );
}

function winLoad(service, account) {
  const encPath = dpapiPath(account);
  if (!fs.existsSync(encPath)) return null;
  const result = execSync(
    `powershell -NoProfile -NonInteractive -Command "` +
    `$enc = Get-Content -Path '${encPath}' | ConvertTo-SecureString; ` +
    `$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($enc); ` +
    `[Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)"`,
    { stdio: ["ignore", "pipe", "ignore"] }
  );
  return JSON.parse(result.toString().trim());
}

function winClear(service, account) {
  const encPath = dpapiPath(account);
  try { fs.unlinkSync(encPath); } catch {}
}

// ---------------------------------------------------------------------------
// Linux — secret-tool (libsecret) if available, else plaintext file
// ---------------------------------------------------------------------------

function hasSecretTool() {
  try {
    execFileSync("which", ["secret-tool"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function linuxSave(service, account, jsonString) {
  if (hasSecretTool()) {
    try {
      execSync(
        `echo -n "${jsonString.replace(/"/g, '\\"')}" | secret-tool store --label="${service}" service "${service}" account "${account}"`,
        { stdio: "ignore" }
      );
      return;
    } catch {
      warn("secret-tool store failed, falling back to file");
    }
  }
  fileSave(account, jsonString);
}

function linuxLoad(service, account) {
  if (hasSecretTool()) {
    try {
      const result = execFileSync("secret-tool", [
        "lookup", "service", service, "account", account,
      ], { stdio: ["ignore", "pipe", "ignore"] });
      const text = result.toString().trim();
      if (text) return JSON.parse(text);
    } catch {
      // Fall through to file
    }
  }
  return fileLoad(account);
}

function linuxClear(service, account) {
  if (hasSecretTool()) {
    try {
      execFileSync("secret-tool", [
        "clear", "service", service, "account", account,
      ], { stdio: "ignore" });
    } catch {}
  }
  fileClear(account);
}

// ---------------------------------------------------------------------------
// File-based fallback (0o600)
// ---------------------------------------------------------------------------

function filePath(account) {
  return path.join(STORE_DIR, `.token_cache_${account}.json`);
}

function fileSave(account, jsonString) {
  fs.writeFileSync(filePath(account), jsonString, { mode: 0o600 });
}

function fileLoad(account) {
  try {
    return JSON.parse(fs.readFileSync(filePath(account), "utf8"));
  } catch {
    return null;
  }
}

function fileClear(account) {
  try { fs.unlinkSync(filePath(account)); } catch {}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const platform = os.platform();

/**
 * Load cached data from the credential store.
 * @param {string} serviceName — logical service (default: "copilot-studio-cli")
 * @param {string} accountName — cache partition key (e.g. "manage-agent", "chat")
 * @returns {object} parsed cache object, or {} if not found
 */
async function loadCache(serviceName = SERVICE_NAME, accountName = "default") {
  try {
    let data;
    if (platform === "darwin") {
      data = macLoad(serviceName, accountName);
    } else if (platform === "win32") {
      data = winLoad(serviceName, accountName);
    } else {
      data = linuxLoad(serviceName, accountName);
    }
    return data || {};
  } catch {
    // OS backend failed — try file fallback
    try {
      const fallback = fileLoad(accountName);
      return fallback || {};
    } catch {
      return {};
    }
  }
}

/**
 * Save data to the credential store.
 * @param {string} serviceName
 * @param {string} accountName
 * @param {object} data — JSON-serializable object
 */
async function saveCache(serviceName = SERVICE_NAME, accountName = "default", data = {}) {
  const jsonString = JSON.stringify(data);
  try {
    if (platform === "darwin") {
      macSave(serviceName, accountName, jsonString);
    } else if (platform === "win32") {
      winSave(serviceName, accountName, jsonString);
    } else {
      linuxSave(serviceName, accountName, jsonString);
    }
  } catch (e) {
    warn(`OS credential store failed (${e.message}), using file fallback`);
    fileSave(accountName, jsonString);
  }
}

/**
 * Clear cached data from the credential store.
 * @param {string} serviceName
 * @param {string} accountName
 */
async function clearCache(serviceName = SERVICE_NAME, accountName = "default") {
  try {
    if (platform === "darwin") {
      macClear(serviceName, accountName);
    } else if (platform === "win32") {
      winClear(serviceName, accountName);
    } else {
      linuxClear(serviceName, accountName);
    }
  } catch {
    // Ignore — nothing to clear
  }
  // Also clean up any fallback file
  fileClear(accountName);
}

/**
 * Migrate a legacy plaintext cache file into the credential store, then delete it.
 * @param {string} legacyPath — path to the old .token_cache.json
 * @param {string} serviceName
 * @param {string} accountName
 * @returns {boolean} true if migration occurred
 */
async function migrateLegacyCache(legacyPath, serviceName = SERVICE_NAME, accountName = "default") {
  try {
    if (!fs.existsSync(legacyPath)) return false;
    const data = JSON.parse(fs.readFileSync(legacyPath, "utf8"));
    await saveCache(serviceName, accountName, data);
    fs.unlinkSync(legacyPath);
    warn(`Migrated ${legacyPath} to secure credential store`);
    return true;
  } catch (e) {
    warn(`Migration failed: ${e.message}`);
    return false;
  }
}

module.exports = { loadCache, saveCache, clearCache, migrateLegacyCache };
