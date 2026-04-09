/**
 * manage-agent.js — Push/pull agent content via the Copilot Studio VS Code extension's
 * LanguageServerHost binary, using its custom LSP protocol.
 *
 * Subcommands:
 *   node manage-agent.bundle.js auth                          # Device code flow for both tokens
 *   node manage-agent.bundle.js push --workspace <path>       # Push local changes
 *   node manage-agent.bundle.js pull --workspace <path>       # Pull remote changes
 *   node manage-agent.bundle.js clone --workspace <path>      # Clone agent to local
 *   node manage-agent.bundle.js changes --workspace <path>    # Show local/remote diffs
 *   node manage-agent.bundle.js publish --workspace <path>    # Publish agent (make draft live)
 *   node manage-agent.bundle.js validate --workspace <path>   # Validate YAML via LSP
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
 *   CPS_CLOUD               Cloud environment: public, gcc, or gcchigh (default: public)
 *
 * Output: JSON on stdout, diagnostics on stderr.
 */

const { spawn } = require("child_process");
const { randomUUID } = require("crypto");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { log, die } = require("./shared-utils");
const {
  VSCODE_CLIENT_ID,
  getIslandResourceId,
  getDefaultClientId,
  buildTokenInfo,
  acquireTokenDeviceCode,
  acquireTokenInteractive,
  acquireTokenSilent,
  getOrAcquireToken,
  getOrAcquireIslandToken,
} = require("./shared-auth");

// ---------------------------------------------------------------------------
// Logging helpers
// ---------------------------------------------------------------------------

function warn(msg) {
  process.stderr.write("[WARN] " + msg + "\n");
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
    timeout: 300000, // default: 5 minutes for publish polling
    force: false,
    cloud: process.env.CPS_CLOUD || "public",
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
      case "--timeout": {
        const v = parseInt(args[++i], 10);
        parsed.timeout = Number.isFinite(v) && v > 0 ? v : 300000;
        break;
      }
      case "--force":
        parsed.force = true;
        break;
      case "--cloud":
        parsed.cloud = args[++i];
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
        "Commands: auth, push, pull, clone, changes, validate, publish, list-agents, list-envs"
    );
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Cloud-specific endpoint configuration
// ---------------------------------------------------------------------------

const CLOUD_ENDPOINTS = {
  public: {
    bapHost: "api.bap.microsoft.com",
    bapTokenScope: "https://service.powerapps.com/.default",
    powerPlatformScope: "https://api.powerplatform.com/.default",
    loginAuthority: "https://login.microsoftonline.com",
    clusterCategory: 5,
  },
  gcc: {
    bapHost: "gov.api.bap.microsoft.us",
    bapTokenScope: "https://gov.service.powerapps.us/.default",
    powerPlatformScope: "https://api.gov.powerplatform.microsoft.us/.default",
    loginAuthority: "https://login.microsoftonline.com",
    clusterCategory: 6,
  },
  gcchigh: {
    bapHost: "high.api.bap.microsoft.us",
    bapTokenScope: "https://high.service.powerapps.us/.default",
    powerPlatformScope: "https://api.high.powerplatform.microsoft.us/.default",
    loginAuthority: "https://login.microsoftonline.us",
    clusterCategory: 7,
  },
};

function getCloudEndpoints(cloud) {
  const endpoints = CLOUD_ENDPOINTS[cloud];
  if (!endpoints) {
    die(`Unknown cloud: ${cloud}. Use: public, gcc, or gcchigh`);
  }
  return endpoints;
}

// Auto-detect cloud from environment URL if not explicitly set.
function detectCloud(envUrl, explicitCloud) {
  if (explicitCloud && explicitCloud !== "public") return explicitCloud;
  if (!envUrl) return explicitCloud || "public";
  if (envUrl.includes(".crm9.dynamics.com")) return "gcc";
  if (envUrl.includes(".crm.microsoftdynamics.us")) return "gcchigh";
  return explicitCloud || "public";
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
    this._connection = null;
    this._pipeSocket = null;
    this._pipeServer = null;
    this._diagnostics = new Map(); // uri → diagnostics[]
    this._onDiagnosticsCallback = null;
  }

  async start() {
    if (this.running) return;

    const net = require("net");
    const { SocketMessageReader, SocketMessageWriter, createMessageConnection } = require("vscode-jsonrpc/node");
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

    // Create JSON-RPC connection over the socket
    const reader = new SocketMessageReader(this._pipeSocket);
    const writer = new SocketMessageWriter(this._pipeSocket);
    this._connection = createMessageConnection(reader, writer);

    // Handle server requests
    this._connection.onRequest("workspace/configuration", (params) => {
      log(`[LSP server request] workspace/configuration`);
      return (params.items || []).map(() => ({}));
    });

    // Handle server notifications
    this._connection.onNotification("textDocument/publishDiagnostics", (params) => {
      const { uri, diagnostics } = params;
      this._diagnostics.set(uri, diagnostics || []);
      log(`[LSP diagnostics] ${uri}: ${(diagnostics || []).length} diagnostic(s)`);
      if (this._onDiagnosticsCallback) this._onDiagnosticsCallback(uri, diagnostics || []);
    });

    this._connection.onUnhandledNotification((msg) => {
      const detail = msg.params
        ? ` ${JSON.stringify(msg.params).substring(0, 300)}`
        : "";
      log(`[LSP notification] ${msg.method}${detail}`);
    });

    this._connection.listen();

    // Send initialize
    const rootUri = toFileUri(this.workspaceRoot);
    const initResult = await this._connection.sendRequest("initialize", {
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
    this._connection.sendNotification("initialized", {});
    this.running = true;

    return initResult;
  }

  async sendCustomRequest(method, params) {
    if (!this.running) throw new Error("LSP client not running");
    log(`Sending: ${method}`);
    return await this._connection.sendRequest(method, params);
  }

  sendNotification(method, params) {
    this._connection.sendNotification(method, params);
  }

  getDiagnostics() {
    return this._diagnostics;
  }

  async stop() {
    if (!this.running) return;

    // Race shutdown+exit against a 2s timeout
    const graceful = (async () => {
      await this._connection.sendRequest("shutdown", null);
      this._connection.sendNotification("exit", null);
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
    this._connection.dispose();
    this._connection = null;
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

// ---------------------------------------------------------------------------
// Validation helpers — LSP-based diagnostics
// ---------------------------------------------------------------------------

function findMcsYmlFiles(dir, results = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return results; }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findMcsYmlFiles(full, results);
    } else if (entry.isFile() && entry.name.endsWith(".mcs.yml")) {
      results.push(full);
    }
  }
  return results;
}

function openFilesForDiagnostics(client, filePaths) {
  // Notify the server about all files via workspace/didChangeWatchedFiles first.
  // This mirrors the VS Code extension's file watcher behavior and triggers
  // workspace-wide diagnostics (PublishAllDiagnosticsAsync) which includes
  // cross-file validation that textDocument/didOpen alone doesn't trigger.
  const fileEvents = filePaths.map((filePath) => ({
    uri: toFileUri(filePath),
    type: 1, // FileChangeType.Created
  }));
  client.sendNotification("workspace/didChangeWatchedFiles", { changes: fileEvents });

  // Then open each file for per-document diagnostics
  for (const filePath of filePaths) {
    const uri = toFileUri(filePath);
    let text = "";
    try { text = fs.readFileSync(filePath, "utf8"); }
    catch (e) { log(`[validate] Could not read ${filePath}: ${e.message}`); continue; }
    client.sendNotification("textDocument/didOpen", {
      textDocument: { uri, languageId: "yaml", version: 1, text },
    });
  }
}

function waitForDiagnostics(client, settleMs = 500, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let settleTimer = null;
    let hardTimer = null;
    let resolved = false;

    function done() {
      if (resolved) return;
      resolved = true;
      client._onDiagnosticsCallback = null;
      if (settleTimer) clearTimeout(settleTimer);
      if (hardTimer) clearTimeout(hardTimer);
      resolve(new Map(client._diagnostics));
    }

    function resetSettle() {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(done, settleMs);
    }

    hardTimer = setTimeout(() => {
      log("[validate] Diagnostics wait timed out, using current results");
      done();
    }, timeoutMs);

    client._onDiagnosticsCallback = () => resetSettle();
  });
}

const SEVERITY_NAMES = { 1: "error", 2: "warning", 3: "information", 4: "hint" };

function formatValidationOutput(diagnosticsMap, agentDir) {
  let errorCount = 0, warningCount = 0, infoCount = 0;
  const files = [];

  for (const [uri, diags] of diagnosticsMap) {
    if (!diags || diags.length === 0) continue;
    let filePath = uri;
    try {
      filePath = path.relative(agentDir, decodeURIComponent(uri.replace(/^file:\/\/\//, "")));
    } catch {}

    const mapped = diags.map((d) => {
      const sev = d.severity || 1;
      if (sev === 1) errorCount++;
      else if (sev === 2) warningCount++;
      else infoCount++;
      return {
        severity: SEVERITY_NAMES[sev] || "error",
        message: d.message,
        code: d.code,
        source: d.source,
        range: d.range,
      };
    });
    files.push({ file: filePath, diagnostics: mapped });
  }

  return {
    status: errorCount === 0 ? "ok" : "error",
    valid: errorCount === 0,
    summary: { errors: errorCount, warnings: warningCount, info: infoCount },
    files,
  };
}

async function runValidation(client, args, tokens) {
  const agentDir = findAgentDir(args.workspace);

  // Send a lightweight request to initialize environment context
  try {
    await client.sendCustomRequest("powerplatformls/getLocalChanges", buildSyncRequest(args, tokens));
  } catch (e) {
    log(`[validate] Context init warning: ${e.message}`);
  }

  const filePaths = findMcsYmlFiles(agentDir);
  if (filePaths.length === 0) {
    return {
      status: "ok", valid: true,
      summary: { errors: 0, warnings: 0, info: 0 },
      files: [], fileCount: 0,
      message: "No .mcs.yml files found",
    };
  }

  log(`[validate] Found ${filePaths.length} .mcs.yml file(s)`);
  openFilesForDiagnostics(client, filePaths);

  log("[validate] Waiting for diagnostics...");
  const diagnosticsMap = await waitForDiagnostics(client);

  const output = formatValidationOutput(diagnosticsMap, agentDir);
  output.fileCount = filePaths.length;
  return output;
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

  args.cloud = detectCloud(args.environmentUrl, args.cloud);
  const endpoints = getCloudEndpoints(args.cloud);

  log("Acquiring Copilot Studio API token...");
  const cpsToken = await getOrAcquireToken(
    args.tenantId,
    args.clientId || getDefaultClientId(args.cloud, endpoints.powerPlatformScope),
    [endpoints.powerPlatformScope],
    "Copilot Studio API",
    undefined,
    args.cloud
  );

  const envUrl = args.environmentUrl.replace(/\/+$/, "");
  log("Acquiring Dataverse API token...");
  const dvToken = await getOrAcquireToken(
    args.tenantId,
    args.clientId || getDefaultClientId(args.cloud, `${envUrl}/.default`),
    [`${envUrl}/.default`],
    "Dataverse API",
    undefined,
    args.cloud
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

async function acquireLspTokens(args) {
  const agentDir = findAgentDir(args.workspace);
  const conn = loadConnJson(agentDir);
  const clusterCategory = conn?.AccountInfo?.clusterCategory;
  const tenantId = conn?.AccountInfo?.TenantId || args.tenantId;

  const envUrl = args.environmentUrl.replace(/\/+$/, "");
  const cloud = detectCloud(args.environmentUrl, args.cloud);
  const endpoints = getCloudEndpoints(cloud);
  let cpsToken, dvToken;

  if (clusterCategory != null) {
    cpsToken = await getOrAcquireIslandToken(tenantId, clusterCategory, "Island API", cloud);
    dvToken = await getOrAcquireToken(
      tenantId, args.clientId || getDefaultClientId(cloud, `${envUrl}/.default`),
      [`${envUrl}/.default`],
      "Dataverse API",
      undefined,
      cloud
    );
  } else {
    cpsToken = await getOrAcquireToken(
      tenantId, args.clientId || getDefaultClientId(cloud, endpoints.powerPlatformScope),
      [endpoints.powerPlatformScope],
      "Copilot Studio API",
      undefined,
      cloud
    );
    dvToken = await getOrAcquireToken(
      tenantId, args.clientId || getDefaultClientId(cloud, `${envUrl}/.default`),
      [`${envUrl}/.default`],
      "Dataverse API",
      undefined,
      cloud
    );
  }

  return { copilotStudio: cpsToken, dataverse: dvToken };
}

async function cmdWithLsp(args, method) {
  if (!args.workspace) die("--workspace is required");
  if (!args.tenantId) die("--tenant-id (or CPS_TENANT_ID) is required");
  if (!args.environmentUrl) die("--environment-url (or CPS_ENVIRONMENT_URL) is required");
  if (!args.environmentId) die("--environment-id (or CPS_ENVIRONMENT_ID) is required");
  if (!args.agentMgmtUrl) die("--agent-mgmt-url (or CPS_AGENT_MGMT_URL) is required");

  const tokens = await acquireLspTokens(args);
  const binaryInfo = findBinary();
  const client = new LspClient(binaryInfo, args.workspace);

  try {
    await client.start();

    // Pre-push validation: block if errors found
    if (method === "powerplatformls/syncPush" && !args.force) {
      log("[push] Running pre-push validation...");
      const validation = await runValidation(client, args, tokens);
      if (!validation.valid) {
        process.stdout.write(
          JSON.stringify({
            status: "error",
            error: `Push blocked: ${validation.summary.errors} validation error(s). Fix errors before pushing, or use --force to bypass.`,
            validation,
          }, null, 2) + "\n"
        );
        return;
      }
      log(`[push] Validation passed (${validation.summary.warnings} warning(s))`);
    }

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

async function cmdValidate(args) {
  if (!args.workspace) die("--workspace is required");
  if (!args.tenantId) die("--tenant-id (or CPS_TENANT_ID) is required");
  if (!args.environmentUrl) die("--environment-url (or CPS_ENVIRONMENT_URL) is required");
  if (!args.environmentId) die("--environment-id (or CPS_ENVIRONMENT_ID) is required");
  if (!args.agentMgmtUrl) die("--agent-mgmt-url (or CPS_AGENT_MGMT_URL) is required");

  const tokens = await acquireLspTokens(args);
  const binaryInfo = findBinary();
  const client = new LspClient(binaryInfo, args.workspace);

  try {
    await client.start();
    const output = await runValidation(client, args, tokens);
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } finally {
    await client.stop();
  }
}

// ---------------------------------------------------------------------------
// BAP / Dataverse REST API helpers (list-envs, list-agents use REST, not LSP)
// ---------------------------------------------------------------------------

async function httpGetJson(url, accessToken) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body.substring(0, 500)}`);
  }
  return res.json();
}

async function httpPostJson(url, accessToken, body) {
  const payload = body != null ? JSON.stringify(body) : "";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
    },
    body: payload || undefined,
    signal: AbortSignal.timeout(60000),
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${errBody.substring(0, 500)}`);
  }
  const text = await res.text();
  if (!text.trim()) return null;
  return JSON.parse(text);
}

async function cmdListAgents(args) {
  if (!args.tenantId) die("--tenant-id (or CPS_TENANT_ID) is required");
  if (!args.environmentUrl) die("--environment-url (or CPS_ENVIRONMENT_URL) is required");

  const cloud = detectCloud(args.environmentUrl, args.cloud);
  const envUrl = args.environmentUrl.replace(/\/+$/, "");
  const dvToken = await getOrAcquireToken(
    args.tenantId,
    args.clientId || getDefaultClientId(cloud, `${envUrl}/.default`),
    [`${envUrl}/.default`],
    "Dataverse API",
    undefined,
    cloud
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

  const cloud = detectCloud(null, args.cloud);
  const endpoints = getCloudEndpoints(cloud);

  const bapToken = await getOrAcquireToken(
    args.tenantId,
    args.clientId || getDefaultClientId(cloud, endpoints.bapTokenScope),
    [endpoints.bapTokenScope],
    "Power Platform API",
    undefined,
    cloud
  );

  const filter = encodeURIComponent("properties/environmentSku ne 'Platform'");
  const url = `https://${endpoints.bapHost}/providers/Microsoft.BusinessAppPlatform/environments?api-version=2024-05-01&$filter=${filter}&$expand=properties.permissions`;

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

// ---------------------------------------------------------------------------
// Publish — trigger PvaPublish bound action and poll for completion
// ---------------------------------------------------------------------------

const PUBLISH_POLL_INTERVAL_MS = 10000; // 10 seconds

async function cmdPublish(args) {
  if (!args.workspace) die("--workspace is required");

  const agentDir = findAgentDir(args.workspace);
  const conn = loadConnJson(agentDir);

  const tenantId = (conn?.AccountInfo?.TenantId) || args.tenantId;
  if (!tenantId) die("--tenant-id (or CPS_TENANT_ID) is required");

  const envUrl = (args.environmentUrl || conn?.DataverseEndpoint || "").replace(/\/+$/, "");
  if (!envUrl) die("--environment-url (or CPS_ENVIRONMENT_URL) is required");

  const botId = args.agentId || (conn && conn.AgentId);
  if (!botId) die("Cannot determine agent ID. Provide --agent-id or ensure .mcs/conn.json exists.");

  const publishCloud = detectCloud(envUrl, args.cloud);
  const dvToken = await getOrAcquireToken(
    tenantId,
    args.clientId || getDefaultClientId(publishCloud, `${envUrl}/.default`),
    [`${envUrl}/.default`],
    "Dataverse API",
    undefined,
    publishCloud
  );

  // Read current publishedon timestamp before triggering publish
  log("Reading current publish timestamp...");
  const botBefore = await httpGetJson(
    `${envUrl}/api/data/v9.2/bots(${botId})?$select=publishedon`,
    dvToken.accessToken
  );
  const previousPublishedOn = botBefore.publishedon || null;
  log(`Current publishedon: ${previousPublishedOn || "(never published)"}`);

  // Trigger PvaPublish bound action
  log("Calling PvaPublish...");
  const publishUrl = `${envUrl}/api/data/v9.2/bots(${botId})/Microsoft.Dynamics.CRM.PvaPublish`;
  let publishResponse;
  try {
    publishResponse = await httpPostJson(publishUrl, dvToken.accessToken, null);
  } catch (err) {
    die(`PvaPublish failed: ${err.message}`);
  }
  log("PvaPublish triggered successfully.");

  // Poll for completion by watching the publishedon timestamp change
  const startTime = Date.now();
  const timeoutMs = args.timeout || 300000;
  log(`Polling for publish completion (timeout: ${timeoutMs / 1000}s)...`);

  while (Date.now() - startTime < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, PUBLISH_POLL_INTERVAL_MS));

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    let botNow;
    try {
      botNow = await httpGetJson(
        `${envUrl}/api/data/v9.2/bots(${botId})?$select=publishedon`,
        dvToken.accessToken
      );
    } catch (err) {
      log(`Poll error (${elapsed}s): ${err.message} — retrying...`);
      continue;
    }

    const currentPublishedOn = botNow.publishedon || null;
    log(`  [${elapsed}s] publishedon: ${currentPublishedOn || "(null)"}`);

    if (currentPublishedOn && currentPublishedOn !== previousPublishedOn) {
      const durationMs = Date.now() - startTime;
      const result = {
        status: "ok",
        botId,
        publishedOn: currentPublishedOn,
        previousPublishedOn,
        durationMs,
        durationSeconds: Math.round(durationMs / 1000),
      };
      if (publishResponse) {
        result.publishResponse = publishResponse;
      }
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      return;
    }
  }

  die(`Publish timed out after ${timeoutMs / 1000}s. The publish may still be in progress — check the Copilot Studio UI.`);
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
  const cloud = detectCloud(args.environmentUrl, args.cloud);
  const endpoints = getCloudEndpoints(cloud);
  let cpsToken, dvToken;

  if (clusterCategory != null) {
    cpsToken = await getOrAcquireIslandToken(tenantId, clusterCategory, "Island API", cloud);
    dvToken = await getOrAcquireToken(
      tenantId, args.clientId || getDefaultClientId(cloud, `${envUrl}/.default`),
      [`${envUrl}/.default`],
      "Dataverse API",
      undefined,
      cloud
    );
  } else {
    cpsToken = await getOrAcquireToken(
      tenantId, args.clientId || getDefaultClientId(cloud, endpoints.powerPlatformScope),
      [endpoints.powerPlatformScope],
      "Copilot Studio API",
      undefined,
      cloud
    );
    dvToken = await getOrAcquireToken(
      tenantId, args.clientId || getDefaultClientId(cloud, `${envUrl}/.default`),
      [`${envUrl}/.default`],
      "Dataverse API",
      undefined,
      cloud
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

  // Clone uses Island API token (same as push/pull) — cloud-aware cluster category
  const cloud = detectCloud(envUrl, args.cloud);
  const DEFAULT_CLUSTER_CATEGORY = cloud === "gcc" ? 6 : cloud === "gcchigh" ? 7 : 5;
  const cpsToken = await getOrAcquireIslandToken(args.tenantId, DEFAULT_CLUSTER_CATEGORY, "Island API", cloud);

  const dvToken = await getOrAcquireToken(args.tenantId, args.clientId || getDefaultClientId(cloud, `${envUrl}/.default`), [`${envUrl}/.default`], "Dataverse API", undefined, cloud);

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
      case "publish":
        await cmdPublish(args);
        break;
      case "validate":
        await cmdValidate(args);
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
