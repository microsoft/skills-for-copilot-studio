/**
 * manage-agent.js — Push/pull agent content via the Copilot Studio VS Code extension's
 * LanguageServerHost binary, using its custom LSP protocol.
 *
 * Subcommands:
 *   node manage-agent.bundle.js auth                          # Interactive browser login for both tokens
 *   node manage-agent.bundle.js push --workspace <path>       # Push local changes
 *   node manage-agent.bundle.js pull --workspace <path>       # Pull remote changes
 *   node manage-agent.bundle.js clone --workspace <path>      # Clone agent to local
 *   node manage-agent.bundle.js changes --workspace <path>    # Show local/remote diffs
 *   node manage-agent.bundle.js list-agents                   # List agents in environment
 *   node manage-agent.bundle.js list-envs                     # List environments
 *
 * Environment variables (all optional):
 *   CPS_LSP_BINARY          Override path to LanguageServerHost binary
 *   CPS_TENANT_ID           Azure AD tenant ID
 *   CPS_CLIENT_ID           Azure AD client ID (public client)
 *   CPS_ENVIRONMENT_ID      Power Platform environment ID
 *   CPS_ENVIRONMENT_URL     Dataverse environment URL (e.g. https://org123.crm.dynamics.com)
 *   CPS_AGENT_MGMT_URL      Agent management URL
 *   CPS_ENVIRONMENT_NAME    Display name for the environment
 *
 * Output: JSON on stdout, diagnostics on stderr.
 */

const { spawn } = require("child_process");
const { randomUUID } = require("crypto");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { createCachePlugin } = require("./msal-cache");

// ---------------------------------------------------------------------------
// Logging helpers
// ---------------------------------------------------------------------------

function log(msg) {
  process.stderr.write(msg + "\n");
}

function die(msg) {
  process.stdout.write(JSON.stringify({ status: "error", error: msg }) + "\n");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    command: null,
    workspace: null,
    tenantId: process.env.CPS_TENANT_ID || null,
    clientId: process.env.CPS_CLIENT_ID || null,
    environmentId: process.env.CPS_ENVIRONMENT_ID || null,
    environmentUrl: process.env.CPS_ENVIRONMENT_URL || null,
    agentMgmtUrl: process.env.CPS_AGENT_MGMT_URL || null,
    environmentName: process.env.CPS_ENVIRONMENT_NAME || null,
    accountId: null,
    accountEmail: null,
    agentId: null,
    owner: true, // default: filter by owner
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--workspace":
        parsed.workspace = args[++i];
        break;
      case "--tenant-id":
        parsed.tenantId = args[++i];
        break;
      case "--client-id":
        parsed.clientId = args[++i];
        break;
      case "--environment-id":
        parsed.environmentId = args[++i];
        break;
      case "--environment-url":
        parsed.environmentUrl = args[++i];
        break;
      case "--agent-mgmt-url":
        parsed.agentMgmtUrl = args[++i];
        break;
      case "--environment-name":
        parsed.environmentName = args[++i];
        break;
      case "--account-id":
        parsed.accountId = args[++i];
        break;
      case "--account-email":
        parsed.accountEmail = args[++i];
        break;
      case "--agent-id":
        parsed.agentId = args[++i];
        break;
      case "--no-owner":
        parsed.owner = false;
        break;
      default:
        if (!args[i].startsWith("--") && !parsed.command) {
          parsed.command = args[i];
        }
        break;
    }
  }

  if (!parsed.command) {
    die(
      "Usage: manage-agent <command> [options]\n" +
        "Commands: auth, push, pull, clone, changes, list-agents, list-envs"
    );
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Token cache — MSAL persistence via @azure/msal-node-extensions
// ---------------------------------------------------------------------------

let _cachePlugin = null;

async function getCachePlugin() {
  if (!_cachePlugin) _cachePlugin = await createCachePlugin("manage-agent");
  return _cachePlugin;
}

// ---------------------------------------------------------------------------
// MSAL — interactive browser login with persistent cache
// ---------------------------------------------------------------------------

// VS Code's first-party client ID — pre-authorized with the Island API gateway.
const VSCODE_CLIENT_ID = "51f81489-12ee-4a9e-aaae-a2591f45987d";

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

async function createMsalApp(tenantId, clientId) {
  const msal = require("@azure/msal-node");
  const cachePlugin = await getCachePlugin();
  return new msal.PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
    cache: { cachePlugin },
  });
}

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

async function acquireTokenInteractive(tenantId, clientId, scopes) {
  const app = await createMsalApp(tenantId, clientId);

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

async function acquireTokenSilent(tenantId, clientId, scopes) {
  const app = await createMsalApp(tenantId, clientId);
  const accounts = await app.getTokenCache().getAllAccounts();
  if (accounts.length === 0) return null;
  try {
    const result = await app.acquireTokenSilent({
      scopes,
      account: accounts[0],
    });
    if (result) {
      log(`${scopes[0]}: silently refreshed (expires ${result.expiresOn.toISOString()})`);
      return buildTokenInfo(result);
    }
  } catch (e) {
    log(`Silent refresh failed: ${e.message}`);
  }
  return null;
}

async function getOrAcquireToken(tenantId, clientId, scopes, label) {
  const silent = await acquireTokenSilent(tenantId, clientId, scopes);
  if (silent) {
    log(`${label}: using cached token (expires ${silent.expiresOn})`);
    return silent;
  }
  log(`${label}: starting interactive login...`);
  return acquireTokenInteractive(tenantId, clientId, scopes);
}

async function getOrAcquireIslandToken(tenantId, clusterCategory, label) {
  const resourceId = getIslandResourceId(clusterCategory);
  return getOrAcquireToken(
    tenantId, VSCODE_CLIENT_ID,
    [`api://${resourceId}/.default`],
    label
  );
}

// ---------------------------------------------------------------------------
// Binary discovery — find LanguageServerHost
// ---------------------------------------------------------------------------

const EXTENSION_ID = "ms-copilotstudio.vscode-copilotstudio";
const BINARY_NAME = "LanguageServerHost";
const MIN_EXTENSION_VERSION = "1.2.90";

function getPlatformSuffix() {
  const p = os.platform();
  const a = os.arch();
  if (p === "darwin") return a === "arm64" ? "darwin-arm64" : "darwin-x64";
  if (p === "win32") return a === "arm64" ? "win32-arm64" : "win32-x64";
  return "linux-x64";
}

function parseSemver(v) {
  return v.split(".").map((n) => parseInt(n, 10) || 0);
}

function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function searchInDir(extensionsDir) {
  const suffix = getPlatformSuffix();
  let entries;
  try {
    entries = fs.readdirSync(extensionsDir);
  } catch {
    return null;
  }

  const prefix = `${EXTENSION_ID}-`;
  const matches = [];
  for (const entry of entries) {
    if (!entry.startsWith(prefix)) continue;
    const rest = entry.slice(prefix.length);
    if (!rest.endsWith(`-${suffix}`)) continue;
    const version = rest.slice(0, -(suffix.length + 1));
    if (version) matches.push({ dir: entry, version });
  }

  if (matches.length === 0) return null;
  matches.sort((a, b) => compareSemver(b.version, a.version));

  const best = matches[0];
  const extensionDir = path.join(extensionsDir, best.dir);
  const lspOutDir = path.join(extensionDir, "lspOut");
  const binaryName =
    os.platform() === "win32" ? `${BINARY_NAME}.exe` : BINARY_NAME;
  const binaryPath = path.join(lspOutDir, binaryName);

  if (!fs.existsSync(binaryPath)) {
    log(`Extension found at ${extensionDir} but binary missing: ${binaryPath}`);
    return null;
  }

  // Ensure executable on Unix
  if (os.platform() !== "win32") {
    try {
      fs.accessSync(binaryPath, fs.constants.X_OK);
    } catch {
      log(`Setting executable permission on ${binaryPath}`);
      fs.chmodSync(binaryPath, 0o755);
    }
  }

  return { binaryPath, extensionDir, lspOutDir, version: best.version };
}

function findBinary() {
  // Check env override first
  const envBinary = process.env.CPS_LSP_BINARY;
  if (envBinary) {
    if (fs.existsSync(envBinary)) {
      log(`Using CPS_LSP_BINARY override: ${envBinary}`);
      return {
        binaryPath: envBinary,
        lspOutDir: path.dirname(envBinary),
        version: "custom",
      };
    }
    log(`Warning: CPS_LSP_BINARY set but not found: ${envBinary}`);
  }

  const home = os.homedir();
  const searchDirs = [
    path.join(home, ".vscode", "extensions"),
    path.join(home, ".vscode-insiders", "extensions"),
  ];

  for (const dir of searchDirs) {
    const result = searchInDir(dir);
    if (result) {
      log(
        `Found Copilot Studio extension v${result.version} at ${result.lspOutDir}`
      );
      if (compareSemver(result.version, MIN_EXTENSION_VERSION) < 0) {
        warn(`Extension v${result.version} is older than tested v${MIN_EXTENSION_VERSION}. Some features may not work. Update: https://marketplace.visualstudio.com/items?itemName=ms-copilotstudio.vscode-copilotstudio`);
      }
      return result;
    }
  }

  die(
    "Copilot Studio VS Code extension not found.\n" +
      `Searched: ${searchDirs.join(", ")}\n` +
      "Install from: https://marketplace.visualstudio.com/items?itemName=ms-copilotstudio.vscode-copilotstudio\n" +
      "Or set CPS_LSP_BINARY env var to the LanguageServerHost path."
  );
}

// ---------------------------------------------------------------------------
// LSP client — spawn binary, connect via named pipe, JSON-RPC lifecycle
// ---------------------------------------------------------------------------

class LspClient {
  constructor(binaryInfo, workspaceRoot) {
    this.binaryPath = binaryInfo.binaryPath;
    this.lspOutDir = binaryInfo.lspOutDir;
    this.workspaceRoot = workspaceRoot || process.cwd();
    this.process = null;
    this.running = false;
    this._pendingRequests = new Map();
    this._nextId = 1;
    this._responseBuffer = "";
    this._pipeSocket = null;
  }

  async start() {
    if (this.running) return;

    const net = require("net");
    const sessionId = randomUUID();
    const pipePath = os.platform() === "win32"
      ? `\\\\.\\pipe\\manage-agent-${sessionId}`
      : path.join(os.tmpdir(), `manage-agent-${sessionId}.sock`);

    // Create socket server FIRST — the binary connects to us as a client
    const server = net.createServer();
    server.listen(pipePath);
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    log(`Listening on pipe: ${pipePath}`);

    // Spawn binary — it will connect to our socket
    const args = [
      `--sessionid=${sessionId}`,
      "--enabletelemetry=false",
      `--pipe=${pipePath}`,
    ];

    log(`Spawning LSP: ${this.binaryPath}`);
    log(`  cwd: ${this.lspOutDir}`);

    this.process = spawn(this.binaryPath, args, {
      cwd: this.lspOutDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    // Discard stdout (.NET log noise) — LSP goes over the pipe instead
    this.process.stdout.resume();
    this.process.stderr.on("data", (data) => {
      const text = data.toString().trim();
      if (text) log(`[LSP stderr] ${text}`);
    });

    this.process.on("exit", (code, signal) => {
      log(`LSP process exited: code=${code}, signal=${signal}`);
      this.running = false;
    });

    this.process.on("error", (err) => {
      log(`LSP process error: ${err.message}`);
      this.running = false;
    });

    // Wait for the binary to connect to our socket
    this._pipeSocket = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("LSP binary did not connect to pipe within 15s"));
      }, 15000);
      server.once("connection", (socket) => {
        clearTimeout(timeout);
        resolve(socket);
      });
      this.process.once("exit", () => {
        clearTimeout(timeout);
        reject(new Error("LSP binary exited before connecting to pipe"));
      });
    });

    this._pipeServer = server;
    log("LSP connected via named pipe (clean channel, no stdout filtering)");

    // Parse JSON-RPC from the clean pipe stream
    this._responseBuffer = "";
    this._expectedLength = -1;

    this._pipeSocket.on("data", (chunk) => {
      this._responseBuffer += chunk.toString("utf-8");
      this._processBuffer();
    });

    // Send initialize
    const rootUri = toFileUri(this.workspaceRoot);
    const initResult = await this._sendRequest("initialize", {
      processId: process.pid,
      rootUri,
      capabilities: {
        textDocument: {
          synchronization: { dynamicRegistration: false },
          publishDiagnostics: { relatedInformation: true },
        },
        workspace: { workspaceFolders: true },
      },
      workspaceFolders: [{ uri: rootUri, name: "agent" }],
    });

    log("LSP initialized successfully");

    // Send initialized notification
    this._sendNotification("initialized", {});
    this.running = true;

    return initResult;
  }

  _processBuffer() {
    while (true) {
      if (this._expectedLength === -1) {
        const headerEnd = this._responseBuffer.indexOf("\r\n\r\n");
        if (headerEnd === -1) return;

        const header = this._responseBuffer.substring(0, headerEnd);
        const match = header.match(/Content-Length:\s*(\d+)/);
        if (!match) {
          // Discard up to the end of this header
          this._responseBuffer = this._responseBuffer.substring(headerEnd + 4);
          continue;
        }
        this._expectedLength = parseInt(match[1], 10);
        this._responseBuffer = this._responseBuffer.substring(headerEnd + 4);
      }

      if (this._responseBuffer.length < this._expectedLength) return;

      const body = this._responseBuffer.substring(0, this._expectedLength);
      this._responseBuffer = this._responseBuffer.substring(
        this._expectedLength
      );
      this._expectedLength = -1;

      try {
        const msg = JSON.parse(body);
        this._handleMessage(msg);
      } catch (e) {
        log(`Failed to parse LSP message: ${e.message}`);
      }
    }
  }

  _handleMessage(msg) {
    // Response to our request
    if (msg.id !== undefined && this._pendingRequests.has(msg.id)) {
      const { resolve, reject } = this._pendingRequests.get(msg.id);
      this._pendingRequests.delete(msg.id);
      if (msg.error) {
        log(`[LSP response] id=${msg.id} ERROR: ${msg.error.code} ${msg.error.message}`);
        reject(
          new Error(`LSP error ${msg.error.code}: ${msg.error.message}`)
        );
      } else {
        log(`[LSP response] id=${msg.id} OK`);
        resolve(msg.result);
      }
      return;
    }

    // Server request (has id + method) — needs a response
    if (msg.method && msg.id !== undefined) {
      log(`[LSP server request] ${msg.method} id=${msg.id} params=${JSON.stringify(msg.params).substring(0, 200)}`);

      // Handle known server requests
      if (msg.method === "workspace/configuration") {
        // Return empty configs for each requested item
        const items = msg.params?.items || [];
        this._sendRaw({
          jsonrpc: "2.0",
          id: msg.id,
          result: items.map(() => ({})),
        });
        return;
      }

      // Default: respond with null
      this._sendRaw({
        jsonrpc: "2.0",
        id: msg.id,
        result: null,
      });
      return;
    }

    // Server notification (no id)
    if (msg.method) {
      const detail = msg.params
        ? ` ${JSON.stringify(msg.params).substring(0, 300)}`
        : "";
      log(`[LSP notification] ${msg.method}${detail}`);
      return;
    }

    // Unmatched response (id doesn't match any pending request)
    if (msg.id !== undefined) {
      log(`[LSP unmatched response] id=${msg.id} result=${JSON.stringify(msg.result || msg.error).substring(0, 200)}`);
    }
  }

  _sendRaw(obj) {
    const body = JSON.stringify(obj);
    const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
    this._pipeSocket.write(header + body);
  }

  _sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = this._nextId++;
      this._pendingRequests.set(id, { resolve, reject });
      this._sendRaw({
        jsonrpc: "2.0",
        id,
        method,
        params,
      });

      // Timeout after 120s
      setTimeout(() => {
        if (this._pendingRequests.has(id)) {
          this._pendingRequests.delete(id);
          reject(new Error(`LSP request '${method}' timed out after 120s`));
        }
      }, 120000);
    });
  }

  _sendNotification(method, params) {
    this._sendRaw({
      jsonrpc: "2.0",
      method,
      params,
    });
  }

  async sendCustomRequest(method, params) {
    if (!this.running) throw new Error("LSP client not running");
    log(`Sending: ${method}`);
    const result = await this._sendRequest(method, params);
    return result;
  }

  async stop() {
    if (!this.running) return;

    // Match the VS Code extension's LanguageClient.stop() pattern:
    // Race shutdown+exit against a 2s timeout. If the binary doesn't
    // respond in time, move on and force-dispose everything.
    const graceful = (async () => {
      await this._sendRequest("shutdown", null);
      this._sendNotification("exit", null);
    })();
    const timeout = new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const result = await Promise.race([
        graceful.then(() => "ok"),
        timeout.then(() => "timeout"),
      ]);
      if (result === "timeout") {
        log("LSP shutdown timed out after 2s, forcing cleanup");
      }
    } catch {
      // Ignore errors during shutdown
    }

    this.running = false;
    if (this._pipeSocket) {
      this._pipeSocket.destroy();
      this._pipeSocket = null;
    }
    if (this._pipeServer) {
      this._pipeServer.close();
      this._pipeServer = null;
    }
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Request builders
// ---------------------------------------------------------------------------

function toFileUri(absPath) {
  // Proper file URI encoding: encode spaces and special chars
  // Windows: C:\foo\bar → file:///C:/foo/bar
  // Unix:    /foo/bar   → file:///foo/bar
  const resolved = path.resolve(absPath);
  const segments = resolved.split(path.sep);
  const encoded = segments.map((s, i) => {
    // Preserve Windows drive letter (e.g. "C:") unencoded
    if (i === 0 && /^[A-Za-z]:$/.test(s)) return s;
    return encodeURIComponent(s);
  }).join("/");
  const prefix = encoded.startsWith("/") ? "file://" : "file:///";
  return `${prefix}${encoded}`;
}

function findAgentDir(workspace) {
  // If workspace itself has .mcs/, use it directly
  const resolvedWs = path.resolve(workspace);
  if (fs.existsSync(path.join(resolvedWs, ".mcs", "conn.json"))) {
    return resolvedWs;
  }
  // Otherwise look for a single subfolder with .mcs/
  try {
    const entries = fs.readdirSync(resolvedWs, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const sub = path.join(resolvedWs, entry.name);
        if (fs.existsSync(path.join(sub, ".mcs", "conn.json"))) {
          log(`Found agent directory: ${sub}`);
          return sub;
        }
      }
    }
  } catch {}
  return resolvedWs;
}

function loadConnJson(agentDir) {
  try {
    const connPath = path.join(agentDir, ".mcs", "conn.json");
    return JSON.parse(fs.readFileSync(connPath, "utf8"));
  } catch {
    return null;
  }
}

function buildSyncRequest(args, tokens) {
  const agentDir = findAgentDir(args.workspace);
  const workspaceUri = toFileUri(agentDir);
  const conn = loadConnJson(agentDir);

  log(`Workspace URI: ${workspaceUri}`);
  if (conn) {
    log(`Found .mcs/conn.json — AgentId: ${conn.AgentId}`);
  }

  // Build accountInfo — conn.json uses PascalCase but LSP binary expects camelCase
  const connAccount = conn && conn.AccountInfo;
  const accountInfo = {
    accountId: (connAccount && connAccount.AccountId) || args.accountId || tokens.copilotStudio.account?.homeAccountId || "unknown",
    accountEmail: (connAccount && connAccount.AccountEmail) || args.accountEmail || tokens.copilotStudio.account?.username || undefined,
    tenantId: (connAccount && connAccount.TenantId) || args.tenantId,
    clusterCategory: connAccount && connAccount.clusterCategory,
  };

  const request = {
    accountInfo,
    copilotStudioAccessToken: tokens.copilotStudio.accessToken,
    dataverseAccessToken: tokens.dataverse.accessToken,
    environmentInfo: {
      agentManagementUrl: args.agentMgmtUrl || (conn && conn.AgentManagementEndpoint) || undefined,
      dataverseUrl: args.environmentUrl || (conn && conn.DataverseEndpoint) || undefined,
      displayName: args.environmentName || "Environment",
      environmentId: args.environmentId || (conn && conn.EnvironmentId) || undefined,
    },
    workspaceUri,
  };

  // Include solutionVersions if available from conn.json
  if (conn && conn.SolutionVersions) {
    request.solutionVersions = conn.SolutionVersions;
  }

  return request;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdAuth(args) {
  if (!args.tenantId) die("--tenant-id (or CPS_TENANT_ID) is required");
  if (!args.environmentUrl) die("--environment-url (or CPS_ENVIRONMENT_URL) is required");

  const clientId = args.clientId || VSCODE_CLIENT_ID;

  log("Acquiring Copilot Studio API token...");
  const cpsToken = await getOrAcquireToken(
    args.tenantId,
    clientId,
    ["https://api.powerplatform.com/.default"],
    "Copilot Studio API"
  );

  const envUrl = args.environmentUrl.replace(/\/+$/, "");
  log("Acquiring Dataverse API token...");
  const dvToken = await getOrAcquireToken(
    args.tenantId,
    clientId,
    [`${envUrl}/.default`],
    "Dataverse API"
  );

  const result = {
    status: "ok",
    copilotStudio: {
      expiresOn: cpsToken.expiresOn,
      account: cpsToken.account,
    },
    dataverse: {
      expiresOn: dvToken.expiresOn,
      account: dvToken.account,
    },
  };

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

async function cmdWithLsp(args, method) {
  if (!args.workspace) die("--workspace is required");
  if (!args.tenantId) die("--tenant-id (or CPS_TENANT_ID) is required");
  if (!args.environmentUrl) die("--environment-url (or CPS_ENVIRONMENT_URL) is required");
  if (!args.environmentId) die("--environment-id (or CPS_ENVIRONMENT_ID) is required");
  if (!args.agentMgmtUrl) die("--agent-mgmt-url (or CPS_AGENT_MGMT_URL) is required");

  // Use conn.json to determine the Island API audience and tenant.
  // The Island token uses VS Code's first-party client ID which is
  // pre-authorized with the gateway.
  const agentDir = findAgentDir(args.workspace);
  const conn = loadConnJson(agentDir);
  const clusterCategory = conn?.AccountInfo?.clusterCategory;
  const tenantId = conn?.AccountInfo?.TenantId || args.tenantId;

  const envUrl = args.environmentUrl.replace(/\/+$/, "");
  let cpsToken, dvToken;

  if (clusterCategory != null) {
    // Use VS Code's 1p app for both tokens — single interactive login
    cpsToken = await getOrAcquireIslandToken(tenantId, clusterCategory, "Island API");
    dvToken = await getOrAcquireToken(
      tenantId, VSCODE_CLIENT_ID,
      [`${envUrl}/.default`],
      "Dataverse API"
    );
  } else {
    cpsToken = await getOrAcquireToken(
      tenantId, VSCODE_CLIENT_ID,
      ["https://api.powerplatform.com/.default"],
      "Copilot Studio API"
    );
    dvToken = await getOrAcquireToken(
      tenantId, VSCODE_CLIENT_ID,
      [`${envUrl}/.default`],
      "Dataverse API"
    );
  }

  const tokens = { copilotStudio: cpsToken, dataverse: dvToken };

  // Find and start LSP binary
  const binaryInfo = findBinary();
  const client = new LspClient(binaryInfo, args.workspace);

  try {
    await client.start();

    const request = buildSyncRequest(args, tokens);
    log(`Calling ${method}...`);
    const result = await client.sendCustomRequest(method, request);

    process.stdout.write(
      JSON.stringify({ status: "ok", method, result }, null, 2) + "\n"
    );
  } finally {
    await client.stop();
  }
}

// ---------------------------------------------------------------------------
// BAP / Dataverse REST API helpers (list-envs, list-agents use REST, not LSP)
// ---------------------------------------------------------------------------

const BAP_HOST = "api.bap.microsoft.com";
const BAP_TOKEN_SCOPE = "https://service.powerapps.com/.default";

async function httpGetJson(url, accessToken) {
  const https = require("https");
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }, (res) => {
      let data = "";
      res.on("error", reject);
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 500)}`));
        } else {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error(`Invalid JSON: ${e.message}`)); }
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("HTTP request timed out")); });
  });
}

async function cmdListAgents(args) {
  if (!args.tenantId) die("--tenant-id (or CPS_TENANT_ID) is required");
  if (!args.environmentUrl) die("--environment-url (or CPS_ENVIRONMENT_URL) is required");

  const envUrl = args.environmentUrl.replace(/\/+$/, "");
  const dvToken = await getOrAcquireToken(
    args.tenantId,
    VSCODE_CLIENT_ID,
    [`${envUrl}/.default`],
    "Dataverse API"
  );

  const ownerOnly = args.owner !== false; // default: owned by current user

  // WhoAmI to get current user ID (needed for owner filter or annotation)
  log("Calling WhoAmI...");
  const whoAmI = await httpGetJson(
    `${envUrl}/api/data/v9.2/WhoAmI`,
    dvToken.accessToken
  );
  const systemUserId = whoAmI.UserId;
  log(`Signed in as user: ${systemUserId}`);

  // List unmanaged bots
  const select = encodeURIComponent("botid,name,_ownerid_value");
  const filterParts = ["ismanaged eq false"];
  if (ownerOnly) filterParts.push(`_ownerid_value eq ${systemUserId}`);
  const filter = encodeURIComponent(filterParts.join(" and "));
  log(ownerOnly ? "Listing agents owned by current user..." : "Listing all unmanaged agents...");
  const botsResponse = await httpGetJson(
    `${envUrl}/api/data/v9.2/bots?$select=${select}&$filter=${filter}`,
    dvToken.accessToken
  );

  const agents = (botsResponse.value || []).map((bot) => ({
    agentId: bot.botid,
    displayName: bot.name,
    ownedByCurrentUser: bot._ownerid_value === systemUserId,
  }));

  const result = { status: "ok", agents };
  if (agents.length === 0) {
    result.message = ownerOnly
      ? "No unmanaged agents owned by you in this environment. Retry with --no-owner to list all agents."
      : "No unmanaged agents found in this environment. Verify the environment URL is correct and your account has access.";
  }

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

async function cmdListEnvs(args) {
  if (!args.tenantId) die("--tenant-id (or CPS_TENANT_ID) is required");

  const bapToken = await getOrAcquireToken(
    args.tenantId,
    VSCODE_CLIENT_ID,
    [BAP_TOKEN_SCOPE],
    "Power Platform API"
  );

  const filter = encodeURIComponent("properties/environmentSku ne 'Platform'");
  const url = `https://${BAP_HOST}/providers/Microsoft.BusinessAppPlatform/environments?api-version=2024-05-01&$filter=${filter}&$expand=properties.permissions`;

  log("Fetching environments from BAP API...");
  const response = await httpGetJson(url, bapToken.accessToken);

  const environments = (response.value || [])
    .filter((env) => {
      // Only include environments with Dataverse (linked metadata) and edit permissions
      const meta = env.properties?.linkedEnvironmentMetadata;
      const perms = env.properties?.permissions;
      return meta?.instanceUrl && (perms?.UpdateEnvironment || perms?.CreatePowerApp);
    })
    .map((env) => ({
      environmentId: env.name,
      displayName: env.properties.displayName,
      dataverseUrl: env.properties.linkedEnvironmentMetadata.instanceUrl,
      agentManagementUrl: env.properties.runtimeEndpoints?.["microsoft.PowerVirtualAgents"] || null,
      environmentSku: env.properties.environmentSku,
    }));

  process.stdout.write(
    JSON.stringify({ status: "ok", environments }, null, 2) + "\n"
  );
}

async function cmdChanges(args) {
  if (!args.workspace) die("--workspace is required");
  if (!args.tenantId) die("--tenant-id (or CPS_TENANT_ID) is required");
  if (!args.environmentUrl) die("--environment-url (or CPS_ENVIRONMENT_URL) is required");
  if (!args.environmentId) die("--environment-id (or CPS_ENVIRONMENT_ID) is required");
  if (!args.agentMgmtUrl) die("--agent-mgmt-url (or CPS_AGENT_MGMT_URL) is required");

  const agentDir = findAgentDir(args.workspace);
  const conn = loadConnJson(agentDir);
  const clusterCategory = conn?.AccountInfo?.clusterCategory;
  const tenantId = conn?.AccountInfo?.TenantId || args.tenantId;

  const envUrl = args.environmentUrl.replace(/\/+$/, "");
  let cpsToken, dvToken;

  if (clusterCategory != null) {
    cpsToken = await getOrAcquireIslandToken(tenantId, clusterCategory, "Island API");
    dvToken = await getOrAcquireToken(
      tenantId, VSCODE_CLIENT_ID,
      [`${envUrl}/.default`],
      "Dataverse API"
    );
  } else {
    cpsToken = await getOrAcquireToken(
      tenantId, VSCODE_CLIENT_ID,
      ["https://api.powerplatform.com/.default"],
      "Copilot Studio API"
    );
    dvToken = await getOrAcquireToken(
      tenantId, VSCODE_CLIENT_ID,
      [`${envUrl}/.default`],
      "Dataverse API"
    );
  }

  const tokens = { copilotStudio: cpsToken, dataverse: dvToken };
  const binaryInfo = findBinary();
  const client = new LspClient(binaryInfo, args.workspace);

  try {
    await client.start();
    const request = buildSyncRequest(args, tokens);

    log("Fetching local changes...");
    const localChanges = await client.sendCustomRequest(
      "powerplatformls/getLocalChanges",
      request
    );

    log("Fetching remote changes...");
    const remoteChanges = await client.sendCustomRequest(
      "powerplatformls/getRemoteChanges",
      request
    );

    process.stdout.write(
      JSON.stringify(
        { status: "ok", localChanges, remoteChanges },
        null,
        2
      ) + "\n"
    );
  } finally {
    await client.stop();
  }
}

// ---------------------------------------------------------------------------
// Clone — needs additional fields vs push/pull
// ---------------------------------------------------------------------------

const SOLUTION_NAMES = [
  "msft_AIPlatformExtensionsComponents",
  "msdyn_RelevanceSearch",
  "PowerVirtualAgents",
];

async function fetchSolutionVersions(envUrl, accessToken) {
  const filter = SOLUTION_NAMES.map((s) => `uniquename eq '${s}'`).join(" or ");
  const query = `$select=uniquename,version&$filter=${encodeURIComponent(filter)}`;
  const url = `${envUrl}/api/data/v9.2/solutions?${query}`;

  log("Fetching solution versions...");
  const response = await httpGetJson(url, accessToken);

  const solutionVersions = {};
  let copilotStudioSolutionVersion = "1.0.0";

  for (const sol of response.value || []) {
    if (sol.uniquename === "PowerVirtualAgents") {
      copilotStudioSolutionVersion = sol.version;
    } else {
      solutionVersions[sol.uniquename] = sol.version;
    }
  }

  return { solutionVersions, copilotStudioSolutionVersion };
}

async function fetchAgentInfo(envUrl, agentId, accessToken) {
  const query = `$select=botid,name,iconbase64&$expand=bot_botcomponentcollection($select=schemaname,botcomponentcollectionid,name)`;
  const url = `${envUrl}/api/data/v9.2/bots(${agentId})?${query}`;

  log(`Fetching agent info for ${agentId}...`);
  const bot = await httpGetJson(url, accessToken);

  return {
    agentId: bot.botid,
    displayName: bot.name,
    displayComplement: "",
    iconBase64: bot.iconbase64 || "",
    componentCollections: (bot.bot_botcomponentcollection || []).map((cc) => ({
      id: cc.botcomponentcollectionid,
      schemaName: cc.schemaname,
      displayName: cc.name,
    })),
  };
}

async function cmdClone(args) {
  if (!args.workspace) die("--workspace is required");
  if (!args.tenantId) die("--tenant-id (or CPS_TENANT_ID) is required");
  if (!args.environmentUrl) die("--environment-url (or CPS_ENVIRONMENT_URL) is required");
  if (!args.environmentId) die("--environment-id (or CPS_ENVIRONMENT_ID) is required");
  if (!args.agentMgmtUrl) die("--agent-mgmt-url (or CPS_AGENT_MGMT_URL) is required");
  if (!args.agentId) die("--agent-id is required for clone");

  const envUrl = args.environmentUrl.replace(/\/+$/, "");

  // Clone uses Island API token (same as push/pull) — default to Prod cluster (5)
  const DEFAULT_CLUSTER_CATEGORY = 5;
  const cpsToken = await getOrAcquireIslandToken(args.tenantId, DEFAULT_CLUSTER_CATEGORY, "Island API");

  const dvToken = await getOrAcquireToken(
    args.tenantId, VSCODE_CLIENT_ID,
    [`${envUrl}/.default`],
    "Dataverse API"
  );

  // Fetch agent info and solution versions from Dataverse
  const [agentInfo, solVersions] = await Promise.all([
    fetchAgentInfo(envUrl, args.agentId, dvToken.accessToken),
    fetchSolutionVersions(envUrl, dvToken.accessToken),
  ]);

  log(`Cloning agent: ${agentInfo.displayName}`);

  const rootFolder = path.resolve(args.workspace);

  // Start LSP and send clone request
  const binaryInfo = findBinary();
  const client = new LspClient(binaryInfo, rootFolder);

  try {
    await client.start();

    const request = {
      accountInfo: {
        accountId: args.accountId || dvToken.account?.homeAccountId || "unknown",
        accountEmail: args.accountEmail || dvToken.account?.username || undefined,
        tenantId: args.tenantId,
        clusterCategory: DEFAULT_CLUSTER_CATEGORY,
      },
      copilotStudioAccessToken: cpsToken.accessToken,
      dataverseAccessToken: dvToken.accessToken,
      environmentInfo: {
        agentManagementUrl: args.agentMgmtUrl,
        dataverseUrl: envUrl,
        displayName: args.environmentName || "Environment",
        environmentId: args.environmentId,
      },
      solutionVersions: solVersions,
      agentInfo,
      assets: { cloneAgent: true, componentcollectionIds: [] },
      rootFolder,
    };

    log("Calling powerplatformls/cloneAgent...");
    const result = await client.sendCustomRequest(
      "powerplatformls/cloneAgent",
      request
    );

    process.stdout.write(
      JSON.stringify({ status: "ok", method: "powerplatformls/cloneAgent", result }, null, 2) + "\n"
    );
  } finally {
    await client.stop();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();

  try {
    switch (args.command) {
      case "auth":
        await cmdAuth(args);
        break;
      case "push":
        await cmdWithLsp(args, "powerplatformls/syncPush");
        break;
      case "pull":
        await cmdWithLsp(args, "powerplatformls/syncPull");
        break;
      case "clone":
        await cmdClone(args);
        break;
      case "changes":
        await cmdChanges(args);
        break;
      case "list-agents":
        await cmdListAgents(args);
        break;
      case "list-envs":
        await cmdListEnvs(args);
        break;
      default:
        die(`Unknown command: ${args.command}`);
    }
  } catch (e) {
    die(`${args.command} failed: ${e.message}`);
  }

  // Ensure Node exits even if stale event-loop handles linger (e.g. from
  // the LSP binary's pipe server or unresolved timers).
  process.exit(0);
}

main();
