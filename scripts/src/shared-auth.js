/**
 * shared-auth.js — Shared MSAL authentication for Copilot Studio CLI scripts.
 *
 * Provides token acquisition (silent, interactive browser, device code) using the
 * VS Code first-party client ID. Tokens are cached via OS-native credential storage
 * in the "manage-agent" MSAL cache slot by default.
 *
 * An optional cacheSlot parameter allows scripts to use a different cache slot
 * (e.g., "chat" for the SDK chat path) without polluting the default singleton.
 */

const { log } = require("./shared-utils");
const { createCachePlugin } = require("./msal-cache");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// VS Code's first-party client ID — pre-authorized with the Island API gateway
// and Dataverse. No separate app registration needed.
const VSCODE_CLIENT_ID = "51f81489-12ee-4a9e-aaae-a2591f45987d";

// Azure PowerShell well-known client ID — pre-authorized for the Island API
// gateway in GCC where the VS Code client ID is not consented.
const AZURE_PS_CLIENT_ID = "1950a258-227b-4e31-a9cf-717495945fc2";

// PAC CLI (Power Platform CLI) client ID — pre-authorized for BAP and
// CopilotStudio.Copilots.Invoke in government clouds.
const PAC_CLI_CLIENT_ID = "9cee029c-6210-4654-90bb-17e6e9d36617";

// Select the appropriate default client ID for the cloud and scope.
// In GCC/GCC-High, no single client ID works for all resources:
//   - VS Code:       Dataverse ✓  BAP ✗  Island API ✗  CopilotStudio.Invoke ✗
//   - Azure PS:      Dataverse ✓  BAP ✓  Island API ✓  CopilotStudio.Invoke ✗
//   - PAC CLI:       Dataverse ✓  BAP ✓  Island API ✗  CopilotStudio.Invoke ✓
function getDefaultClientId(cloud, scope) {
  if (cloud === "gcc" || cloud === "gcchigh") {
    if (scope && scope.startsWith("api://")) {
      // Island API resource (api://9315aedd... etc) — needs Azure PS
      return AZURE_PS_CLIENT_ID;
    }
    if (scope && !scope.includes(".dynamics.com") && !scope.includes(".dynamics.us")) {
      // BAP / PowerApps scopes — PAC CLI works
      return PAC_CLI_CLIENT_ID;
    }
  }
  return VSCODE_CLIENT_ID;
}

// Island API resource IDs by cluster category (from the VS Code extension).
const ISLAND_RESOURCE_IDS = {
  0: "a522f059-bb65-47c0-8934-7db6e5286414",
  1: "a522f059-bb65-47c0-8934-7db6e5286414",
  2: "a522f059-bb65-47c0-8934-7db6e5286414",
  3: "a522f059-bb65-47c0-8934-7db6e5286414",
  4: "96ff4394-9197-43aa-b393-6a41652e21f8",
  5: "96ff4394-9197-43aa-b393-6a41652e21f8",
  6: "9315aedd-209b-43b3-b149-2abff6a95d59",
  7: "69c6e40c-465f-4154-987d-da5cba10734e",
  8: "bd4a9f18-e349-4c74-a6b7-65dd465ea9ab",
};

function getIslandResourceId(clusterCategory) {
  const id = ISLAND_RESOURCE_IDS[clusterCategory];
  if (!id) throw new Error(`Unknown cluster category: ${clusterCategory}`);
  return id;
}

// ---------------------------------------------------------------------------
// MSAL app singleton — one instance per (tenantId, clientId) pair.
// Sharing the instance ensures all token acquisitions see the same
// in-memory cache, avoiding stale-cache issues across scopes.
// ---------------------------------------------------------------------------

let _cachePlugin = null;
const _msalApps = new Map();

async function getDefaultCachePlugin() {
  if (!_cachePlugin) {
    _cachePlugin = await createCachePlugin("manage-agent");
  }
  return _cachePlugin;
}

/**
 * Get the login authority base URL for a given cloud.
 */
function getLoginAuthority(cloud) {
  if (cloud === "gcchigh") return "https://login.microsoftonline.us";
  return "https://login.microsoftonline.com";
}

/**
 * Create or retrieve a cached MSAL PublicClientApplication.
 *
 * @param {string} tenantId - Azure AD tenant ID
 * @param {string} clientId - Application (client) ID
 * @param {string} [cacheSlot] - Optional cache slot name. When omitted, uses the
 *   default "manage-agent" singleton. When provided (e.g., "chat"), creates a
 *   separate non-singleton MSAL app with its own cache.
 * @param {string} [cloud="public"] - Cloud environment (public, gcc, gcchigh)
 */
async function createMsalApp(tenantId, clientId, cacheSlot, cloud) {
  const msal = require("@azure/msal-node");
  const authority = `${getLoginAuthority(cloud || "public")}/${tenantId}`;

  if (cacheSlot) {
    // Non-default slot: create a standalone app (not cached in the singleton map)
    const plugin = await createCachePlugin(cacheSlot);
    return new msal.PublicClientApplication({
      auth: { clientId, authority },
      cache: { cachePlugin: plugin },
    });
  }

  // Default path — singleton keyed by tenantId:clientId:cloud
  const key = `${tenantId}:${clientId}:${cloud || "public"}`;
  if (_msalApps.has(key)) return _msalApps.get(key);

  const cachePlugin = await getDefaultCachePlugin();
  const app = new msal.PublicClientApplication({
    auth: { clientId, authority },
    cache: { cachePlugin },
  });
  _msalApps.set(key, app);
  return app;
}

// ---------------------------------------------------------------------------
// Token result normalization
// ---------------------------------------------------------------------------

function buildTokenInfo(result) {
  return {
    accessToken: result.accessToken,
    expiresOn: result.expiresOn
      ? result.expiresOn.toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString(),
    scopes: result.scopes,
    account: result.account
      ? {
          homeAccountId: result.account.homeAccountId,
          environment: result.account.environment,
          tenantId: result.account.tenantId,
          username: result.account.username,
        }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Token acquisition flows
// ---------------------------------------------------------------------------

async function acquireTokenDeviceCode(tenantId, clientId, scopes, cacheSlot, cloud) {
  const app = await createMsalApp(tenantId, clientId, cacheSlot, cloud);

  const result = await app.acquireTokenByDeviceCode({
    scopes,
    deviceCodeCallback: (response) => {
      log("");
      log(`  ${response.message}`);
      log("");
      // Also emit structured JSON so skills/Claude can parse it
      process.stdout.write(
        JSON.stringify({
          status: "device_code",
          userCode: response.userCode,
          verificationUri: response.verificationUri,
          message: response.message,
          expiresIn: response.expiresIn,
        }) + "\n"
      );
    },
  });

  if (!result) throw new Error("Device code flow returned no result");
  return buildTokenInfo(result);
}

async function acquireTokenInteractive(tenantId, clientId, scopes, cacheSlot, cloud) {
  const app = await createMsalApp(tenantId, clientId, cacheSlot, cloud);

  const result = await app.acquireTokenInteractive({
    scopes,
    openBrowser: async (url) => {
      log("");
      log(`  Open this URL to sign in: ${url}`);
      log("");
      const open = (await import("open")).default;
      await open(url);
    },
    successTemplate:
      "<html><body><h1>Login successful. You can close this tab.</h1></body></html>",
  });

  if (!result) throw new Error("Interactive flow returned no result");
  return buildTokenInfo(result);
}

async function acquireTokenSilent(tenantId, clientId, scopes, cacheSlot, cloud) {
  const app = await createMsalApp(tenantId, clientId, cacheSlot, cloud);
  const allAccounts = await app.getTokenCache().getAllAccounts();
  // Filter to accounts matching this tenant to avoid cross-tenant errors
  const accounts = allAccounts.filter(a => a.tenantId === tenantId);
  if (accounts.length > 0) {
    try {
      const result = await app.acquireTokenSilent({
        scopes,
        account: accounts[0],
      });
      if (result) {
        const scopeKey = scopes[0];
        log(`${scopeKey}: silently refreshed (expires ${result.expiresOn?.toISOString()})`);
        return buildTokenInfo(result);
      }
    } catch (e) {
      log(`Silent refresh failed: ${e.message}`);
    }
  }
  return null;
}

/**
 * Get a token silently, falling back to interactive browser login.
 */
async function getOrAcquireToken(tenantId, clientId, scopes, label, cacheSlot, cloud) {
  const silent = await acquireTokenSilent(tenantId, clientId, scopes, cacheSlot, cloud);
  if (silent) {
    log(`${label}: using cached token (expires ${silent.expiresOn})`);
    return silent;
  }
  log(`${label}: starting interactive login...`);
  return acquireTokenInteractive(tenantId, clientId, scopes, cacheSlot, cloud);
}

/**
 * Get a token for the Island API gateway, using the appropriate client ID for the cloud.
 */
async function getOrAcquireIslandToken(tenantId, clusterCategory, label, cloud) {
  const resourceId = getIslandResourceId(clusterCategory);
  const scope = `api://${resourceId}/.default`;
  return getOrAcquireToken(
    tenantId, getDefaultClientId(cloud || "public", scope),
    [scope],
    label,
    undefined,
    cloud
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  VSCODE_CLIENT_ID,
  AZURE_PS_CLIENT_ID,
  PAC_CLI_CLIENT_ID,
  ISLAND_RESOURCE_IDS,
  getIslandResourceId,
  getDefaultClientId,
  getLoginAuthority,
  createMsalApp,
  buildTokenInfo,
  acquireTokenDeviceCode,
  acquireTokenInteractive,
  acquireTokenSilent,
  getOrAcquireToken,
  getOrAcquireIslandToken,
};
