/**
 * msal-cache.js — Shared MSAL cache plugin using OS-native secure storage.
 *
 * Uses @azure/msal-node-extensions to persist MSAL's token cache via the
 * platform's credential manager (Keychain on macOS, DPAPI on Windows,
 * libsecret on Linux).
 *
 * The cache file lives at ~/.copilot-studio-cli/<account>.cache.json.
 */

const { PersistenceCreator, PersistenceCachePlugin, DataProtectionScope } = require("@azure/msal-node-extensions");
const path = require("path");
const os = require("os");

const CACHE_DIR = path.join(os.homedir(), ".copilot-studio-cli");
const SERVICE_NAME = "copilot-studio-cli";

async function createCachePlugin(accountName) {
  const cachePath = path.join(CACHE_DIR, `${accountName}.cache.json`);
  const persistence = await PersistenceCreator.createPersistence({
    cachePath,
    dataProtectionScope: DataProtectionScope.CurrentUser,
    serviceName: SERVICE_NAME,
    accountName,
    usePlaintextFileOnLinux: true,
  });
  return new PersistenceCachePlugin(persistence);
}

module.exports = { createCachePlugin };
