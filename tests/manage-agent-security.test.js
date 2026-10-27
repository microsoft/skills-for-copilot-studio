const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRequire } = require("node:module");
const { test } = require("node:test");
const vm = require("node:vm");
const {
  validateTenantId, validateAgentId, validateDataverseUrl,
} = require("../scripts/src/dataverse-validation");

const tenantId = "11111111-2222-3333-4444-555555555555";
const agentId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

test("Dataverse URL policy preserves regional and sovereign hostname families", () => {
  for (const host of [
    "org.crm.dynamics.com", "org.crm2.dynamics.com", "org.crm17.dynamics.com",
    "org.crm.microsoftdynamics.us", "org.crm.appsplatform.us", "org.crm.dynamics.cn",
  ]) {
    assert.equal(validateDataverseUrl(`https://${host.toUpperCase()}:443///`), `https://${host}`);
  }
});

test("Dataverse URL policy rejects untrusted or non-origin destinations", () => {
  for (const url of [
    "", null, {}, "http://org.crm.dynamics.com", "https://localhost",
    "https://127.0.0.1", "https://[::1]", "https://169.254.169.254",
    "https://org.crm.dynamics.com.evil.example", "https://crm.dynamics.com",
    "https://org.crmevil.dynamics.com", "https://other.org.crm.dynamics.com",
    "https://org.crm.dynamics.com:444", "https://user:pass@org.crm.dynamics.com",
    "https://org.crm.dynamics.com@evil.example", "https://org.crm.dynamics.com.",
    "https://org.crm.dynamics.com/path", "https://org.crm.dynamics.com/a/../",
    "https://org.crm.dynamics.com?query", "https://org.crm.dynamics.com#fragment",
    "https://org.crm.dynamics.com\\path", " https://org.crm.dynamics.com",
    "https://org.crm.dynamics.com\n",
  ]) {
    assert.throws(() => validateDataverseUrl(url), undefined, String(url));
  }
});

test("identifiers are validated without rejecting tenant domains or GUID casing", () => {
  assert.equal(validateTenantId(tenantId), tenantId);
  assert.equal(validateTenantId("contoso.onmicrosoft.com"), "contoso.onmicrosoft.com");
  assert.equal(validateAgentId(agentId.toUpperCase()), agentId.toUpperCase());
  for (const value of ["../common", "tenant/path", "tenant?query", {}, null, ""]) {
    assert.throws(() => validateTenantId(value));
  }
  for (const value of ["not-a-guid", `${agentId})/other`, {}, null, ""]) {
    assert.throws(() => validateAgentId(value));
  }
});

function loadCommands(filename, acquireToken, fetch) {
  const resolved = path.resolve(__dirname, "..", filename);
  const localRequire = createRequire(resolved);
  const bundled = filename.endsWith(".bundle.js");
  const context = vm.createContext({
    require(id) {
      if (id === "./shared-auth") {
        return { VSCODE_CLIENT_ID: "test-client", getOrAcquireToken: acquireToken };
      }
      if (id === "@azure/msal-node-extensions") return {};
      if (id === "./shared-utils") {
        return { log() {}, die(message) { throw new Error(message); } };
      }
      return localRequire(id);
    },
    module: { exports: {} },
    process: { env: {}, stderr: { write() {} }, stdout: { write() {} } },
    URL, AbortSignal, fetch,
    setTimeout(callback) { callback(); },
    testAcquireToken: acquireToken,
  });
  let source = fs.readFileSync(resolved, "utf8");
  // Skip only the CLI entry call and the bundle's native-dependency discovery banner.
  if (bundled) source = source.substring(source.indexOf("\n") + 1);
  const entrypoint = /\nmain\(\);(?=\s*(?:\/\*! Bundled license information:[\s\S]*\*\/)?\s*$)/;
  assert.ok(entrypoint.test(source), "CLI entrypoint must be found");
  vm.runInContext(source.replace(entrypoint, "\n"), context, { filename });
  if (bundled) vm.runInContext("getOrAcquireToken = globalThis.testAcquireToken", context);
  return vm.runInContext("({ cmdPublish, cmdListAgents, httpGetJson, httpPostJson })", context);
}

for (const filename of ["scripts/src/manage-agent.js", "scripts/manage-agent.bundle.js"]) {
  test(`${filename}: publish rejects workspace metadata before authentication or fetch`, async (t) => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "publish-validation-"));
    t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
    fs.mkdirSync(path.join(workspace, ".mcs"));
    const commands = loadCommands(
      filename,
      async () => { assert.fail("authentication must not run"); },
      async () => { assert.fail("network must not run"); }
    );
    const valid = {
      AccountInfo: { TenantId: tenantId },
      DataverseEndpoint: "https://org.crm.dynamics.com",
      AgentId: agentId,
    };
    for (const patch of [
      { DataverseEndpoint: "https://localhost" },
      { DataverseEndpoint: "https://org.crm.dynamics.com.evil.example" },
      { DataverseEndpoint: "https://org.crm.dynamics.com/api" },
      { DataverseEndpoint: {} },
      { AgentId: `${agentId})/other` },
      { AgentId: {} },
      { AccountInfo: { TenantId: "../other" } },
    ]) {
      fs.writeFileSync(path.join(workspace, ".mcs", "conn.json"), JSON.stringify({ ...valid, ...patch }));
      await assert.rejects(commands.cmdPublish({ workspace }), /Dataverse|Agent ID|Tenant ID/);
    }
    await assert.rejects(
      commands.cmdListAgents({ tenantId, environmentUrl: "https://localhost" }),
      /Dataverse/
    );
  });

  test(`${filename}: publish keeps connection fallback and explicit endpoint/agent overrides`, async (t) => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "publish-success-"));
    t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
    fs.mkdirSync(path.join(workspace, ".mcs"));
    fs.writeFileSync(path.join(workspace, ".mcs", "conn.json"), JSON.stringify({
      AccountInfo: { TenantId: tenantId },
      DataverseEndpoint: "https://ORG.crm.dynamics.com///",
      AgentId: agentId,
    }));
    for (const override of [false, true]) {
      const expectedOrigin = override ? "https://other.crm2.dynamics.com" : "https://org.crm.dynamics.com";
      const expectedAgent = override ? tenantId : agentId;
      const requests = [];
      const tokens = [];
      const commands = loadCommands(filename, async (...args) => {
        tokens.push(args);
        return { accessToken: "test-token" };
      }, async (url, options) => {
        requests.push({ url, options });
        if (options.method === "POST") return { status: 204 };
        return {
          ok: true,
          json: async () => ({ publishedon: requests.length === 1 ? null : "2026-10-26T00:00:00Z" }),
        };
      });
      await commands.cmdPublish({
        workspace,
        ...(override ? { environmentUrl: `${expectedOrigin}/`, agentId: expectedAgent } : {}),
      });
      assert.equal(tokens.length, 1);
      assert.equal(tokens[0][0], tenantId);
      assert.deepEqual(Array.from(tokens[0][2]), [`${expectedOrigin}/.default`]);
      assert.equal(requests.length, 3);
      assert.equal(requests[0].url, `${expectedOrigin}/api/data/v9.2/bots(${expectedAgent})?$select=publishedon`);
      assert.equal(requests[1].url, `${expectedOrigin}/api/data/v9.2/bots(${expectedAgent})/Microsoft.Dynamics.CRM.PvaPublish`);
      for (const { options } of requests) {
        assert.equal(options.redirect, "error");
        assert.equal(options.headers.Authorization, "Bearer test-token");
      }
    }
  });

  test(`${filename}: both authenticated HTTP helpers prohibit redirects and propagate errors`, async () => {
    const commands = loadCommands(filename, async () => assert.fail(), async (_url, options) => {
      assert.equal(options.redirect, "error");
      throw new Error("redirect rejected");
    });
    await assert.rejects(commands.httpGetJson("https://org.crm.dynamics.com", "test-token"), /redirect rejected/);
    await assert.rejects(commands.httpPostJson("https://org.crm.dynamics.com", "test-token", null), /redirect rejected/);
  });
}
