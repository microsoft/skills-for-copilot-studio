var _d=process.env.CLAUDE_PLUGIN_DATA;if(!_d){try{_d=JSON.parse(require('fs').readFileSync(require('path').join(require('os').homedir(),'.copilot-studio-cli','plugin-paths.json'),'utf8')).pluginData}catch{}}if(_d){var _p=require('path');process.env.NODE_PATH=[_p.join(_d,'node_modules'),process.env.NODE_PATH].filter(Boolean).join(_p.delimiter);require('module')._initPaths()}
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/shared-utils.js
var require_shared_utils = __commonJS({
  "src/shared-utils.js"(exports2, module2) {
    var readline = require("readline");
    function log2(msg) {
      process.stderr.write(msg + "\n");
    }
    function die2(msg) {
      process.stdout.write(JSON.stringify({ status: "error", error: msg }) + "\n");
      process.exit(1);
    }
    var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    async function httpGet(url, headers) {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        die2(`HTTP ${res.status} from GET ${url}: ${body.slice(0, 200)}`);
      }
      return res.json();
    }
    async function httpPost(url, headers, body) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        die2(`HTTP ${res.status} from POST ${url}: ${text.slice(0, 200)}`);
      }
      return res.json();
    }
    async function fetchToken(tokenEndpointUrl) {
      log2("Fetching DirectLine token from token endpoint...");
      const data = await httpGet(tokenEndpointUrl, {});
      if (!data.token) die2("Token endpoint did not return a token.");
      return data.token;
    }
    async function getRegionalDomain(tokenEndpointUrl) {
      try {
        const parsed = new URL(tokenEndpointUrl);
        const settingsUrl = parsed.origin + "/powervirtualagents/regionalchannelsettings?api-version=2022-03-01-preview";
        log2("Fetching regional DirectLine domain...");
        const data = await httpGet(settingsUrl, {});
        const domain = data.channelUrlsById?.directline?.replace(/\/+$/, "");
        if (domain) {
          log2(`Regional domain: ${domain}`);
          return domain;
        }
      } catch (e) {
        log2(`Warning: Could not fetch regional domain (${e.message}). Using default.`);
      }
      return "https://directline.botframework.com";
    }
    async function startConversation(domain, token) {
      log2("Starting DirectLine conversation...");
      const data = await httpPost(
        `${domain}/v3/directline/conversations`,
        { Authorization: `Bearer ${token}` },
        {}
      );
      if (!data.conversationId) die2("startConversation did not return a conversationId.");
      return { conversationId: data.conversationId, token: data.token || token };
    }
    async function sendActivity(domain, conversationId, token, activity) {
      return httpPost(
        `${domain}/v3/directline/conversations/${conversationId}/activities`,
        { Authorization: `Bearer ${token}` },
        activity
      );
    }
    async function pollActivities(domain, conversationId, token, watermark) {
      let url = `${domain}/v3/directline/conversations/${conversationId}/activities`;
      if (watermark !== void 0) {
        url += `?watermark=${watermark}`;
      }
      const data = await httpGet(url, { Authorization: `Bearer ${token}` });
      return {
        activities: data.activities || [],
        watermark: data.watermark
      };
    }
    function findSignInCard(activities) {
      for (const activity of activities) {
        if (activity.type !== "message" || !activity.attachments) continue;
        for (const att of activity.attachments) {
          if (att.contentType === "application/vnd.microsoft.card.signin" || att.contentType === "application/vnd.microsoft.card.oauth") {
            const url = att.content?.buttons?.[0]?.value || att.content?.tokenExchangeResource?.uri || null;
            if (url) return { signinUrl: url };
          }
        }
      }
      return null;
    }
    async function promptForAuthCode(signinUrl) {
      log2("");
      log2("Sign-in required.");
      log2(`Open this URL in your browser:
  ${signinUrl}`);
      log2("After signing in, enter the validation code below.");
      log2("");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stderr
      });
      const code = await new Promise((resolve) => {
        rl.question("Validation code: ", (answer) => {
          resolve(answer.trim());
        });
      });
      rl.close();
      if (!code) die2("No validation code received on stdin.");
      return code;
    }
    async function runPollLoop(domain, conversationId, token, opts) {
      const timeoutMs = opts && opts.timeoutMs || 3e4;
      const intervalMs = opts && opts.intervalMs || 1e3;
      let watermark = opts && opts.watermark;
      let lastActivityTime = Date.now();
      let authHandled = false;
      const allBotActivities = [];
      while (true) {
        if (Date.now() - lastActivityTime > timeoutMs) {
          log2("Poll timeout \u2014 no more bot activities.");
          break;
        }
        const result = await pollActivities(domain, conversationId, token, watermark);
        watermark = result.watermark;
        const botActivities = result.activities.filter(
          (a) => a.from && a.from.role !== "user"
        );
        for (const activity of botActivities) {
          lastActivityTime = Date.now();
          if (activity.type === "endOfConversation") {
            allBotActivities.push(activity);
            return { activities: allBotActivities, watermark };
          }
          if (!authHandled) {
            const card = findSignInCard([activity]);
            if (card) {
              authHandled = true;
              if (process.stdin.isTTY) {
                const code = await promptForAuthCode(card.signinUrl);
                await sendActivity(domain, conversationId, token, {
                  type: "message",
                  from: { id: "user1", role: "user" },
                  text: code
                });
                log2("Validation code sent. Waiting for authenticated response...");
                lastActivityTime = Date.now();
                continue;
              } else {
                allBotActivities.push(activity);
                return {
                  activities: allBotActivities,
                  watermark,
                  signin: { url: card.signinUrl }
                };
              }
            }
          }
          allBotActivities.push(activity);
        }
        await sleep(intervalMs);
      }
      return { activities: allBotActivities, watermark };
    }
    module2.exports = {
      log: log2,
      die: die2,
      sleep,
      httpGet,
      httpPost,
      fetchToken,
      getRegionalDomain,
      startConversation,
      sendActivity,
      pollActivities,
      findSignInCard,
      runPollLoop
    };
  }
});

// src/msal-cache.js
var require_msal_cache = __commonJS({
  "src/msal-cache.js"(exports2, module2) {
    var { PersistenceCreator, PersistenceCachePlugin, DataProtectionScope } = require("@azure/msal-node-extensions");
    var path3 = require("path");
    var os2 = require("os");
    var CACHE_DIR = path3.join(os2.homedir(), ".copilot-studio-cli");
    var SERVICE_NAME = "copilot-studio-cli";
    async function createCachePlugin(accountName) {
      const cachePath = path3.join(CACHE_DIR, `${accountName}.cache.json`);
      const persistence = await PersistenceCreator.createPersistence({
        cachePath,
        dataProtectionScope: DataProtectionScope.CurrentUser,
        serviceName: SERVICE_NAME,
        accountName,
        usePlaintextFileOnLinux: true
      });
      return new PersistenceCachePlugin(persistence);
    }
    module2.exports = { createCachePlugin };
  }
});

// node_modules/uuid/dist/esm-node/rng.js
function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    import_crypto.default.randomFillSync(rnds8Pool);
    poolPtr = 0;
  }
  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}
var import_crypto, rnds8Pool, poolPtr;
var init_rng = __esm({
  "node_modules/uuid/dist/esm-node/rng.js"() {
    import_crypto = __toESM(require("crypto"));
    rnds8Pool = new Uint8Array(256);
    poolPtr = rnds8Pool.length;
  }
});

// node_modules/uuid/dist/esm-node/regex.js
var regex_default;
var init_regex = __esm({
  "node_modules/uuid/dist/esm-node/regex.js"() {
    regex_default = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;
  }
});

// node_modules/uuid/dist/esm-node/validate.js
function validate(uuid) {
  return typeof uuid === "string" && regex_default.test(uuid);
}
var validate_default;
var init_validate = __esm({
  "node_modules/uuid/dist/esm-node/validate.js"() {
    init_regex();
    validate_default = validate;
  }
});

// node_modules/uuid/dist/esm-node/stringify.js
function stringify(arr, offset = 0) {
  const uuid = (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
  if (!validate_default(uuid)) {
    throw TypeError("Stringified UUID is invalid");
  }
  return uuid;
}
var byteToHex, stringify_default;
var init_stringify = __esm({
  "node_modules/uuid/dist/esm-node/stringify.js"() {
    init_validate();
    byteToHex = [];
    for (let i = 0; i < 256; ++i) {
      byteToHex.push((i + 256).toString(16).substr(1));
    }
    stringify_default = stringify;
  }
});

// node_modules/uuid/dist/esm-node/v1.js
function v1(options, buf, offset) {
  let i = buf && offset || 0;
  const b = buf || new Array(16);
  options = options || {};
  let node = options.node || _nodeId;
  let clockseq = options.clockseq !== void 0 ? options.clockseq : _clockseq;
  if (node == null || clockseq == null) {
    const seedBytes = options.random || (options.rng || rng)();
    if (node == null) {
      node = _nodeId = [seedBytes[0] | 1, seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]];
    }
    if (clockseq == null) {
      clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 16383;
    }
  }
  let msecs = options.msecs !== void 0 ? options.msecs : Date.now();
  let nsecs = options.nsecs !== void 0 ? options.nsecs : _lastNSecs + 1;
  const dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 1e4;
  if (dt < 0 && options.clockseq === void 0) {
    clockseq = clockseq + 1 & 16383;
  }
  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === void 0) {
    nsecs = 0;
  }
  if (nsecs >= 1e4) {
    throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
  }
  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq;
  msecs += 122192928e5;
  const tl = ((msecs & 268435455) * 1e4 + nsecs) % 4294967296;
  b[i++] = tl >>> 24 & 255;
  b[i++] = tl >>> 16 & 255;
  b[i++] = tl >>> 8 & 255;
  b[i++] = tl & 255;
  const tmh = msecs / 4294967296 * 1e4 & 268435455;
  b[i++] = tmh >>> 8 & 255;
  b[i++] = tmh & 255;
  b[i++] = tmh >>> 24 & 15 | 16;
  b[i++] = tmh >>> 16 & 255;
  b[i++] = clockseq >>> 8 | 128;
  b[i++] = clockseq & 255;
  for (let n = 0; n < 6; ++n) {
    b[i + n] = node[n];
  }
  return buf || stringify_default(b);
}
var _nodeId, _clockseq, _lastMSecs, _lastNSecs, v1_default;
var init_v1 = __esm({
  "node_modules/uuid/dist/esm-node/v1.js"() {
    init_rng();
    init_stringify();
    _lastMSecs = 0;
    _lastNSecs = 0;
    v1_default = v1;
  }
});

// node_modules/uuid/dist/esm-node/parse.js
function parse(uuid) {
  if (!validate_default(uuid)) {
    throw TypeError("Invalid UUID");
  }
  let v;
  const arr = new Uint8Array(16);
  arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
  arr[1] = v >>> 16 & 255;
  arr[2] = v >>> 8 & 255;
  arr[3] = v & 255;
  arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
  arr[5] = v & 255;
  arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
  arr[7] = v & 255;
  arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
  arr[9] = v & 255;
  arr[10] = (v = parseInt(uuid.slice(24, 36), 16)) / 1099511627776 & 255;
  arr[11] = v / 4294967296 & 255;
  arr[12] = v >>> 24 & 255;
  arr[13] = v >>> 16 & 255;
  arr[14] = v >>> 8 & 255;
  arr[15] = v & 255;
  return arr;
}
var parse_default;
var init_parse = __esm({
  "node_modules/uuid/dist/esm-node/parse.js"() {
    init_validate();
    parse_default = parse;
  }
});

// node_modules/uuid/dist/esm-node/v35.js
function stringToBytes(str) {
  str = unescape(encodeURIComponent(str));
  const bytes = [];
  for (let i = 0; i < str.length; ++i) {
    bytes.push(str.charCodeAt(i));
  }
  return bytes;
}
function v35_default(name, version2, hashfunc) {
  function generateUUID(value, namespace, buf, offset) {
    if (typeof value === "string") {
      value = stringToBytes(value);
    }
    if (typeof namespace === "string") {
      namespace = parse_default(namespace);
    }
    if (namespace.length !== 16) {
      throw TypeError("Namespace must be array-like (16 iterable integer values, 0-255)");
    }
    let bytes = new Uint8Array(16 + value.length);
    bytes.set(namespace);
    bytes.set(value, namespace.length);
    bytes = hashfunc(bytes);
    bytes[6] = bytes[6] & 15 | version2;
    bytes[8] = bytes[8] & 63 | 128;
    if (buf) {
      offset = offset || 0;
      for (let i = 0; i < 16; ++i) {
        buf[offset + i] = bytes[i];
      }
      return buf;
    }
    return stringify_default(bytes);
  }
  try {
    generateUUID.name = name;
  } catch (err) {
  }
  generateUUID.DNS = DNS;
  generateUUID.URL = URL2;
  return generateUUID;
}
var DNS, URL2;
var init_v35 = __esm({
  "node_modules/uuid/dist/esm-node/v35.js"() {
    init_stringify();
    init_parse();
    DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
    URL2 = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
  }
});

// node_modules/uuid/dist/esm-node/md5.js
function md5(bytes) {
  if (Array.isArray(bytes)) {
    bytes = Buffer.from(bytes);
  } else if (typeof bytes === "string") {
    bytes = Buffer.from(bytes, "utf8");
  }
  return import_crypto2.default.createHash("md5").update(bytes).digest();
}
var import_crypto2, md5_default;
var init_md5 = __esm({
  "node_modules/uuid/dist/esm-node/md5.js"() {
    import_crypto2 = __toESM(require("crypto"));
    md5_default = md5;
  }
});

// node_modules/uuid/dist/esm-node/v3.js
var v3, v3_default;
var init_v3 = __esm({
  "node_modules/uuid/dist/esm-node/v3.js"() {
    init_v35();
    init_md5();
    v3 = v35_default("v3", 48, md5_default);
    v3_default = v3;
  }
});

// node_modules/uuid/dist/esm-node/v4.js
function v4(options, buf, offset) {
  options = options || {};
  const rnds = options.random || (options.rng || rng)();
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }
    return buf;
  }
  return stringify_default(rnds);
}
var v4_default;
var init_v4 = __esm({
  "node_modules/uuid/dist/esm-node/v4.js"() {
    init_rng();
    init_stringify();
    v4_default = v4;
  }
});

// node_modules/uuid/dist/esm-node/sha1.js
function sha1(bytes) {
  if (Array.isArray(bytes)) {
    bytes = Buffer.from(bytes);
  } else if (typeof bytes === "string") {
    bytes = Buffer.from(bytes, "utf8");
  }
  return import_crypto3.default.createHash("sha1").update(bytes).digest();
}
var import_crypto3, sha1_default;
var init_sha1 = __esm({
  "node_modules/uuid/dist/esm-node/sha1.js"() {
    import_crypto3 = __toESM(require("crypto"));
    sha1_default = sha1;
  }
});

// node_modules/uuid/dist/esm-node/v5.js
var v5, v5_default;
var init_v5 = __esm({
  "node_modules/uuid/dist/esm-node/v5.js"() {
    init_v35();
    init_sha1();
    v5 = v35_default("v5", 80, sha1_default);
    v5_default = v5;
  }
});

// node_modules/uuid/dist/esm-node/nil.js
var nil_default;
var init_nil = __esm({
  "node_modules/uuid/dist/esm-node/nil.js"() {
    nil_default = "00000000-0000-0000-0000-000000000000";
  }
});

// node_modules/uuid/dist/esm-node/version.js
function version(uuid) {
  if (!validate_default(uuid)) {
    throw TypeError("Invalid UUID");
  }
  return parseInt(uuid.substr(14, 1), 16);
}
var version_default;
var init_version = __esm({
  "node_modules/uuid/dist/esm-node/version.js"() {
    init_validate();
    version_default = version;
  }
});

// node_modules/uuid/dist/esm-node/index.js
var esm_node_exports = {};
__export(esm_node_exports, {
  NIL: () => nil_default,
  parse: () => parse_default,
  stringify: () => stringify_default,
  v1: () => v1_default,
  v3: () => v3_default,
  v4: () => v4_default,
  v5: () => v5_default,
  validate: () => validate_default,
  version: () => version_default
});
var init_esm_node = __esm({
  "node_modules/uuid/dist/esm-node/index.js"() {
    init_v1();
    init_v3();
    init_v4();
    init_v5();
    init_nil();
    init_version();
    init_validate();
    init_stringify();
    init_parse();
  }
});

// node_modules/safe-buffer/index.js
var require_safe_buffer = __commonJS({
  "node_modules/safe-buffer/index.js"(exports2, module2) {
    var buffer = require("buffer");
    var Buffer3 = buffer.Buffer;
    function copyProps(src, dst) {
      for (var key in src) {
        dst[key] = src[key];
      }
    }
    if (Buffer3.from && Buffer3.alloc && Buffer3.allocUnsafe && Buffer3.allocUnsafeSlow) {
      module2.exports = buffer;
    } else {
      copyProps(buffer, exports2);
      exports2.Buffer = SafeBuffer;
    }
    function SafeBuffer(arg, encodingOrOffset, length) {
      return Buffer3(arg, encodingOrOffset, length);
    }
    SafeBuffer.prototype = Object.create(Buffer3.prototype);
    copyProps(Buffer3, SafeBuffer);
    SafeBuffer.from = function(arg, encodingOrOffset, length) {
      if (typeof arg === "number") {
        throw new TypeError("Argument must not be a number");
      }
      return Buffer3(arg, encodingOrOffset, length);
    };
    SafeBuffer.alloc = function(size, fill, encoding) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      var buf = Buffer3(size);
      if (fill !== void 0) {
        if (typeof encoding === "string") {
          buf.fill(fill, encoding);
        } else {
          buf.fill(fill);
        }
      } else {
        buf.fill(0);
      }
      return buf;
    };
    SafeBuffer.allocUnsafe = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return Buffer3(size);
    };
    SafeBuffer.allocUnsafeSlow = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return buffer.SlowBuffer(size);
    };
  }
});

// node_modules/jws/lib/data-stream.js
var require_data_stream = __commonJS({
  "node_modules/jws/lib/data-stream.js"(exports2, module2) {
    var Buffer3 = require_safe_buffer().Buffer;
    var Stream = require("stream");
    var util = require("util");
    function DataStream(data) {
      this.buffer = null;
      this.writable = true;
      this.readable = true;
      if (!data) {
        this.buffer = Buffer3.alloc(0);
        return this;
      }
      if (typeof data.pipe === "function") {
        this.buffer = Buffer3.alloc(0);
        data.pipe(this);
        return this;
      }
      if (data.length || typeof data === "object") {
        this.buffer = data;
        this.writable = false;
        process.nextTick(function() {
          this.emit("end", data);
          this.readable = false;
          this.emit("close");
        }.bind(this));
        return this;
      }
      throw new TypeError("Unexpected data type (" + typeof data + ")");
    }
    util.inherits(DataStream, Stream);
    DataStream.prototype.write = function write(data) {
      this.buffer = Buffer3.concat([this.buffer, Buffer3.from(data)]);
      this.emit("data", data);
    };
    DataStream.prototype.end = function end(data) {
      if (data)
        this.write(data);
      this.emit("end", data);
      this.emit("close");
      this.writable = false;
      this.readable = false;
    };
    module2.exports = DataStream;
  }
});

// node_modules/ecdsa-sig-formatter/src/param-bytes-for-alg.js
var require_param_bytes_for_alg = __commonJS({
  "node_modules/ecdsa-sig-formatter/src/param-bytes-for-alg.js"(exports2, module2) {
    "use strict";
    function getParamSize(keySize) {
      var result = (keySize / 8 | 0) + (keySize % 8 === 0 ? 0 : 1);
      return result;
    }
    var paramBytesForAlg = {
      ES256: getParamSize(256),
      ES384: getParamSize(384),
      ES512: getParamSize(521)
    };
    function getParamBytesForAlg(alg) {
      var paramBytes = paramBytesForAlg[alg];
      if (paramBytes) {
        return paramBytes;
      }
      throw new Error('Unknown algorithm "' + alg + '"');
    }
    module2.exports = getParamBytesForAlg;
  }
});

// node_modules/ecdsa-sig-formatter/src/ecdsa-sig-formatter.js
var require_ecdsa_sig_formatter = __commonJS({
  "node_modules/ecdsa-sig-formatter/src/ecdsa-sig-formatter.js"(exports2, module2) {
    "use strict";
    var Buffer3 = require_safe_buffer().Buffer;
    var getParamBytesForAlg = require_param_bytes_for_alg();
    var MAX_OCTET = 128;
    var CLASS_UNIVERSAL = 0;
    var PRIMITIVE_BIT = 32;
    var TAG_SEQ = 16;
    var TAG_INT = 2;
    var ENCODED_TAG_SEQ = TAG_SEQ | PRIMITIVE_BIT | CLASS_UNIVERSAL << 6;
    var ENCODED_TAG_INT = TAG_INT | CLASS_UNIVERSAL << 6;
    function base64Url(base64) {
      return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    }
    function signatureAsBuffer(signature) {
      if (Buffer3.isBuffer(signature)) {
        return signature;
      } else if ("string" === typeof signature) {
        return Buffer3.from(signature, "base64");
      }
      throw new TypeError("ECDSA signature must be a Base64 string or a Buffer");
    }
    function derToJose(signature, alg) {
      signature = signatureAsBuffer(signature);
      var paramBytes = getParamBytesForAlg(alg);
      var maxEncodedParamLength = paramBytes + 1;
      var inputLength = signature.length;
      var offset = 0;
      if (signature[offset++] !== ENCODED_TAG_SEQ) {
        throw new Error('Could not find expected "seq"');
      }
      var seqLength = signature[offset++];
      if (seqLength === (MAX_OCTET | 1)) {
        seqLength = signature[offset++];
      }
      if (inputLength - offset < seqLength) {
        throw new Error('"seq" specified length of "' + seqLength + '", only "' + (inputLength - offset) + '" remaining');
      }
      if (signature[offset++] !== ENCODED_TAG_INT) {
        throw new Error('Could not find expected "int" for "r"');
      }
      var rLength = signature[offset++];
      if (inputLength - offset - 2 < rLength) {
        throw new Error('"r" specified length of "' + rLength + '", only "' + (inputLength - offset - 2) + '" available');
      }
      if (maxEncodedParamLength < rLength) {
        throw new Error('"r" specified length of "' + rLength + '", max of "' + maxEncodedParamLength + '" is acceptable');
      }
      var rOffset = offset;
      offset += rLength;
      if (signature[offset++] !== ENCODED_TAG_INT) {
        throw new Error('Could not find expected "int" for "s"');
      }
      var sLength = signature[offset++];
      if (inputLength - offset !== sLength) {
        throw new Error('"s" specified length of "' + sLength + '", expected "' + (inputLength - offset) + '"');
      }
      if (maxEncodedParamLength < sLength) {
        throw new Error('"s" specified length of "' + sLength + '", max of "' + maxEncodedParamLength + '" is acceptable');
      }
      var sOffset = offset;
      offset += sLength;
      if (offset !== inputLength) {
        throw new Error('Expected to consume entire buffer, but "' + (inputLength - offset) + '" bytes remain');
      }
      var rPadding = paramBytes - rLength, sPadding = paramBytes - sLength;
      var dst = Buffer3.allocUnsafe(rPadding + rLength + sPadding + sLength);
      for (offset = 0; offset < rPadding; ++offset) {
        dst[offset] = 0;
      }
      signature.copy(dst, offset, rOffset + Math.max(-rPadding, 0), rOffset + rLength);
      offset = paramBytes;
      for (var o = offset; offset < o + sPadding; ++offset) {
        dst[offset] = 0;
      }
      signature.copy(dst, offset, sOffset + Math.max(-sPadding, 0), sOffset + sLength);
      dst = dst.toString("base64");
      dst = base64Url(dst);
      return dst;
    }
    function countPadding(buf, start, stop) {
      var padding = 0;
      while (start + padding < stop && buf[start + padding] === 0) {
        ++padding;
      }
      var needsSign = buf[start + padding] >= MAX_OCTET;
      if (needsSign) {
        --padding;
      }
      return padding;
    }
    function joseToDer(signature, alg) {
      signature = signatureAsBuffer(signature);
      var paramBytes = getParamBytesForAlg(alg);
      var signatureBytes = signature.length;
      if (signatureBytes !== paramBytes * 2) {
        throw new TypeError('"' + alg + '" signatures must be "' + paramBytes * 2 + '" bytes, saw "' + signatureBytes + '"');
      }
      var rPadding = countPadding(signature, 0, paramBytes);
      var sPadding = countPadding(signature, paramBytes, signature.length);
      var rLength = paramBytes - rPadding;
      var sLength = paramBytes - sPadding;
      var rsBytes = 1 + 1 + rLength + 1 + 1 + sLength;
      var shortLength = rsBytes < MAX_OCTET;
      var dst = Buffer3.allocUnsafe((shortLength ? 2 : 3) + rsBytes);
      var offset = 0;
      dst[offset++] = ENCODED_TAG_SEQ;
      if (shortLength) {
        dst[offset++] = rsBytes;
      } else {
        dst[offset++] = MAX_OCTET | 1;
        dst[offset++] = rsBytes & 255;
      }
      dst[offset++] = ENCODED_TAG_INT;
      dst[offset++] = rLength;
      if (rPadding < 0) {
        dst[offset++] = 0;
        offset += signature.copy(dst, offset, 0, paramBytes);
      } else {
        offset += signature.copy(dst, offset, rPadding, paramBytes);
      }
      dst[offset++] = ENCODED_TAG_INT;
      dst[offset++] = sLength;
      if (sPadding < 0) {
        dst[offset++] = 0;
        signature.copy(dst, offset, paramBytes);
      } else {
        signature.copy(dst, offset, paramBytes + sPadding);
      }
      return dst;
    }
    module2.exports = {
      derToJose,
      joseToDer
    };
  }
});

// node_modules/buffer-equal-constant-time/index.js
var require_buffer_equal_constant_time = __commonJS({
  "node_modules/buffer-equal-constant-time/index.js"(exports2, module2) {
    "use strict";
    var Buffer3 = require("buffer").Buffer;
    var SlowBuffer = require("buffer").SlowBuffer;
    module2.exports = bufferEq;
    function bufferEq(a, b) {
      if (!Buffer3.isBuffer(a) || !Buffer3.isBuffer(b)) {
        return false;
      }
      if (a.length !== b.length) {
        return false;
      }
      var c = 0;
      for (var i = 0; i < a.length; i++) {
        c |= a[i] ^ b[i];
      }
      return c === 0;
    }
    bufferEq.install = function() {
      Buffer3.prototype.equal = SlowBuffer.prototype.equal = function equal(that) {
        return bufferEq(this, that);
      };
    };
    var origBufEqual = Buffer3.prototype.equal;
    var origSlowBufEqual = SlowBuffer.prototype.equal;
    bufferEq.restore = function() {
      Buffer3.prototype.equal = origBufEqual;
      SlowBuffer.prototype.equal = origSlowBufEqual;
    };
  }
});

// node_modules/jwa/index.js
var require_jwa = __commonJS({
  "node_modules/jwa/index.js"(exports2, module2) {
    var Buffer3 = require_safe_buffer().Buffer;
    var crypto4 = require("crypto");
    var formatEcdsa = require_ecdsa_sig_formatter();
    var util = require("util");
    var MSG_INVALID_ALGORITHM = '"%s" is not a valid algorithm.\n  Supported algorithms are:\n  "HS256", "HS384", "HS512", "RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512" and "none".';
    var MSG_INVALID_SECRET = "secret must be a string or buffer";
    var MSG_INVALID_VERIFIER_KEY = "key must be a string or a buffer";
    var MSG_INVALID_SIGNER_KEY = "key must be a string, a buffer or an object";
    var supportsKeyObjects = typeof crypto4.createPublicKey === "function";
    if (supportsKeyObjects) {
      MSG_INVALID_VERIFIER_KEY += " or a KeyObject";
      MSG_INVALID_SECRET += "or a KeyObject";
    }
    function checkIsPublicKey(key) {
      if (Buffer3.isBuffer(key)) {
        return;
      }
      if (typeof key === "string") {
        return;
      }
      if (!supportsKeyObjects) {
        throw typeError(MSG_INVALID_VERIFIER_KEY);
      }
      if (typeof key !== "object") {
        throw typeError(MSG_INVALID_VERIFIER_KEY);
      }
      if (typeof key.type !== "string") {
        throw typeError(MSG_INVALID_VERIFIER_KEY);
      }
      if (typeof key.asymmetricKeyType !== "string") {
        throw typeError(MSG_INVALID_VERIFIER_KEY);
      }
      if (typeof key.export !== "function") {
        throw typeError(MSG_INVALID_VERIFIER_KEY);
      }
    }
    function checkIsPrivateKey(key) {
      if (Buffer3.isBuffer(key)) {
        return;
      }
      if (typeof key === "string") {
        return;
      }
      if (typeof key === "object") {
        return;
      }
      throw typeError(MSG_INVALID_SIGNER_KEY);
    }
    function checkIsSecretKey(key) {
      if (Buffer3.isBuffer(key)) {
        return;
      }
      if (typeof key === "string") {
        return key;
      }
      if (!supportsKeyObjects) {
        throw typeError(MSG_INVALID_SECRET);
      }
      if (typeof key !== "object") {
        throw typeError(MSG_INVALID_SECRET);
      }
      if (key.type !== "secret") {
        throw typeError(MSG_INVALID_SECRET);
      }
      if (typeof key.export !== "function") {
        throw typeError(MSG_INVALID_SECRET);
      }
    }
    function fromBase64(base64) {
      return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    }
    function toBase64(base64url) {
      base64url = base64url.toString();
      var padding = 4 - base64url.length % 4;
      if (padding !== 4) {
        for (var i = 0; i < padding; ++i) {
          base64url += "=";
        }
      }
      return base64url.replace(/\-/g, "+").replace(/_/g, "/");
    }
    function typeError(template) {
      var args = [].slice.call(arguments, 1);
      var errMsg = util.format.bind(util, template).apply(null, args);
      return new TypeError(errMsg);
    }
    function bufferOrString(obj) {
      return Buffer3.isBuffer(obj) || typeof obj === "string";
    }
    function normalizeInput(thing) {
      if (!bufferOrString(thing))
        thing = JSON.stringify(thing);
      return thing;
    }
    function createHmacSigner(bits) {
      return function sign(thing, secret) {
        checkIsSecretKey(secret);
        thing = normalizeInput(thing);
        var hmac = crypto4.createHmac("sha" + bits, secret);
        var sig = (hmac.update(thing), hmac.digest("base64"));
        return fromBase64(sig);
      };
    }
    var bufferEqual;
    var timingSafeEqual = "timingSafeEqual" in crypto4 ? function timingSafeEqual2(a, b) {
      if (a.byteLength !== b.byteLength) {
        return false;
      }
      return crypto4.timingSafeEqual(a, b);
    } : function timingSafeEqual2(a, b) {
      if (!bufferEqual) {
        bufferEqual = require_buffer_equal_constant_time();
      }
      return bufferEqual(a, b);
    };
    function createHmacVerifier(bits) {
      return function verify(thing, signature, secret) {
        var computedSig = createHmacSigner(bits)(thing, secret);
        return timingSafeEqual(Buffer3.from(signature), Buffer3.from(computedSig));
      };
    }
    function createKeySigner(bits) {
      return function sign(thing, privateKey) {
        checkIsPrivateKey(privateKey);
        thing = normalizeInput(thing);
        var signer = crypto4.createSign("RSA-SHA" + bits);
        var sig = (signer.update(thing), signer.sign(privateKey, "base64"));
        return fromBase64(sig);
      };
    }
    function createKeyVerifier(bits) {
      return function verify(thing, signature, publicKey) {
        checkIsPublicKey(publicKey);
        thing = normalizeInput(thing);
        signature = toBase64(signature);
        var verifier = crypto4.createVerify("RSA-SHA" + bits);
        verifier.update(thing);
        return verifier.verify(publicKey, signature, "base64");
      };
    }
    function createPSSKeySigner(bits) {
      return function sign(thing, privateKey) {
        checkIsPrivateKey(privateKey);
        thing = normalizeInput(thing);
        var signer = crypto4.createSign("RSA-SHA" + bits);
        var sig = (signer.update(thing), signer.sign({
          key: privateKey,
          padding: crypto4.constants.RSA_PKCS1_PSS_PADDING,
          saltLength: crypto4.constants.RSA_PSS_SALTLEN_DIGEST
        }, "base64"));
        return fromBase64(sig);
      };
    }
    function createPSSKeyVerifier(bits) {
      return function verify(thing, signature, publicKey) {
        checkIsPublicKey(publicKey);
        thing = normalizeInput(thing);
        signature = toBase64(signature);
        var verifier = crypto4.createVerify("RSA-SHA" + bits);
        verifier.update(thing);
        return verifier.verify({
          key: publicKey,
          padding: crypto4.constants.RSA_PKCS1_PSS_PADDING,
          saltLength: crypto4.constants.RSA_PSS_SALTLEN_DIGEST
        }, signature, "base64");
      };
    }
    function createECDSASigner(bits) {
      var inner = createKeySigner(bits);
      return function sign() {
        var signature = inner.apply(null, arguments);
        signature = formatEcdsa.derToJose(signature, "ES" + bits);
        return signature;
      };
    }
    function createECDSAVerifer(bits) {
      var inner = createKeyVerifier(bits);
      return function verify(thing, signature, publicKey) {
        signature = formatEcdsa.joseToDer(signature, "ES" + bits).toString("base64");
        var result = inner(thing, signature, publicKey);
        return result;
      };
    }
    function createNoneSigner() {
      return function sign() {
        return "";
      };
    }
    function createNoneVerifier() {
      return function verify(thing, signature) {
        return signature === "";
      };
    }
    module2.exports = function jwa(algorithm) {
      var signerFactories = {
        hs: createHmacSigner,
        rs: createKeySigner,
        ps: createPSSKeySigner,
        es: createECDSASigner,
        none: createNoneSigner
      };
      var verifierFactories = {
        hs: createHmacVerifier,
        rs: createKeyVerifier,
        ps: createPSSKeyVerifier,
        es: createECDSAVerifer,
        none: createNoneVerifier
      };
      var match = algorithm.match(/^(RS|PS|ES|HS)(256|384|512)$|^(none)$/);
      if (!match)
        throw typeError(MSG_INVALID_ALGORITHM, algorithm);
      var algo = (match[1] || match[3]).toLowerCase();
      var bits = match[2];
      return {
        sign: signerFactories[algo](bits),
        verify: verifierFactories[algo](bits)
      };
    };
  }
});

// node_modules/jws/lib/tostring.js
var require_tostring = __commonJS({
  "node_modules/jws/lib/tostring.js"(exports2, module2) {
    var Buffer3 = require("buffer").Buffer;
    module2.exports = function toString(obj) {
      if (typeof obj === "string")
        return obj;
      if (typeof obj === "number" || Buffer3.isBuffer(obj))
        return obj.toString();
      return JSON.stringify(obj);
    };
  }
});

// node_modules/jws/lib/sign-stream.js
var require_sign_stream = __commonJS({
  "node_modules/jws/lib/sign-stream.js"(exports2, module2) {
    var Buffer3 = require_safe_buffer().Buffer;
    var DataStream = require_data_stream();
    var jwa = require_jwa();
    var Stream = require("stream");
    var toString = require_tostring();
    var util = require("util");
    function base64url(string, encoding) {
      return Buffer3.from(string, encoding).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    }
    function jwsSecuredInput(header, payload, encoding) {
      encoding = encoding || "utf8";
      var encodedHeader = base64url(toString(header), "binary");
      var encodedPayload = base64url(toString(payload), encoding);
      return util.format("%s.%s", encodedHeader, encodedPayload);
    }
    function jwsSign(opts) {
      var header = opts.header;
      var payload = opts.payload;
      var secretOrKey = opts.secret || opts.privateKey;
      var encoding = opts.encoding;
      var algo = jwa(header.alg);
      var securedInput = jwsSecuredInput(header, payload, encoding);
      var signature = algo.sign(securedInput, secretOrKey);
      return util.format("%s.%s", securedInput, signature);
    }
    function SignStream(opts) {
      var secret = opts.secret;
      secret = secret == null ? opts.privateKey : secret;
      secret = secret == null ? opts.key : secret;
      if (/^hs/i.test(opts.header.alg) === true && secret == null) {
        throw new TypeError("secret must be a string or buffer or a KeyObject");
      }
      var secretStream = new DataStream(secret);
      this.readable = true;
      this.header = opts.header;
      this.encoding = opts.encoding;
      this.secret = this.privateKey = this.key = secretStream;
      this.payload = new DataStream(opts.payload);
      this.secret.once("close", function() {
        if (!this.payload.writable && this.readable)
          this.sign();
      }.bind(this));
      this.payload.once("close", function() {
        if (!this.secret.writable && this.readable)
          this.sign();
      }.bind(this));
    }
    util.inherits(SignStream, Stream);
    SignStream.prototype.sign = function sign() {
      try {
        var signature = jwsSign({
          header: this.header,
          payload: this.payload.buffer,
          secret: this.secret.buffer,
          encoding: this.encoding
        });
        this.emit("done", signature);
        this.emit("data", signature);
        this.emit("end");
        this.readable = false;
        return signature;
      } catch (e) {
        this.readable = false;
        this.emit("error", e);
        this.emit("close");
      }
    };
    SignStream.sign = jwsSign;
    module2.exports = SignStream;
  }
});

// node_modules/jws/lib/verify-stream.js
var require_verify_stream = __commonJS({
  "node_modules/jws/lib/verify-stream.js"(exports2, module2) {
    var Buffer3 = require_safe_buffer().Buffer;
    var DataStream = require_data_stream();
    var jwa = require_jwa();
    var Stream = require("stream");
    var toString = require_tostring();
    var util = require("util");
    var JWS_REGEX = /^[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?$/;
    function isObject(thing) {
      return Object.prototype.toString.call(thing) === "[object Object]";
    }
    function safeJsonParse(thing) {
      if (isObject(thing))
        return thing;
      try {
        return JSON.parse(thing);
      } catch (e) {
        return void 0;
      }
    }
    function headerFromJWS(jwsSig) {
      var encodedHeader = jwsSig.split(".", 1)[0];
      return safeJsonParse(Buffer3.from(encodedHeader, "base64").toString("binary"));
    }
    function securedInputFromJWS(jwsSig) {
      return jwsSig.split(".", 2).join(".");
    }
    function signatureFromJWS(jwsSig) {
      return jwsSig.split(".")[2];
    }
    function payloadFromJWS(jwsSig, encoding) {
      encoding = encoding || "utf8";
      var payload = jwsSig.split(".")[1];
      return Buffer3.from(payload, "base64").toString(encoding);
    }
    function isValidJws(string) {
      return JWS_REGEX.test(string) && !!headerFromJWS(string);
    }
    function jwsVerify(jwsSig, algorithm, secretOrKey) {
      if (!algorithm) {
        var err = new Error("Missing algorithm parameter for jws.verify");
        err.code = "MISSING_ALGORITHM";
        throw err;
      }
      jwsSig = toString(jwsSig);
      var signature = signatureFromJWS(jwsSig);
      var securedInput = securedInputFromJWS(jwsSig);
      var algo = jwa(algorithm);
      return algo.verify(securedInput, signature, secretOrKey);
    }
    function jwsDecode(jwsSig, opts) {
      opts = opts || {};
      jwsSig = toString(jwsSig);
      if (!isValidJws(jwsSig))
        return null;
      var header = headerFromJWS(jwsSig);
      if (!header)
        return null;
      var payload = payloadFromJWS(jwsSig);
      if (header.typ === "JWT" || opts.json)
        payload = JSON.parse(payload, opts.encoding);
      return {
        header,
        payload,
        signature: signatureFromJWS(jwsSig)
      };
    }
    function VerifyStream(opts) {
      opts = opts || {};
      var secretOrKey = opts.secret;
      secretOrKey = secretOrKey == null ? opts.publicKey : secretOrKey;
      secretOrKey = secretOrKey == null ? opts.key : secretOrKey;
      if (/^hs/i.test(opts.algorithm) === true && secretOrKey == null) {
        throw new TypeError("secret must be a string or buffer or a KeyObject");
      }
      var secretStream = new DataStream(secretOrKey);
      this.readable = true;
      this.algorithm = opts.algorithm;
      this.encoding = opts.encoding;
      this.secret = this.publicKey = this.key = secretStream;
      this.signature = new DataStream(opts.signature);
      this.secret.once("close", function() {
        if (!this.signature.writable && this.readable)
          this.verify();
      }.bind(this));
      this.signature.once("close", function() {
        if (!this.secret.writable && this.readable)
          this.verify();
      }.bind(this));
    }
    util.inherits(VerifyStream, Stream);
    VerifyStream.prototype.verify = function verify() {
      try {
        var valid = jwsVerify(this.signature.buffer, this.algorithm, this.key.buffer);
        var obj = jwsDecode(this.signature.buffer, this.encoding);
        this.emit("done", valid, obj);
        this.emit("data", valid);
        this.emit("end");
        this.readable = false;
        return valid;
      } catch (e) {
        this.readable = false;
        this.emit("error", e);
        this.emit("close");
      }
    };
    VerifyStream.decode = jwsDecode;
    VerifyStream.isValid = isValidJws;
    VerifyStream.verify = jwsVerify;
    module2.exports = VerifyStream;
  }
});

// node_modules/jws/index.js
var require_jws = __commonJS({
  "node_modules/jws/index.js"(exports2) {
    var SignStream = require_sign_stream();
    var VerifyStream = require_verify_stream();
    var ALGORITHMS = [
      "HS256",
      "HS384",
      "HS512",
      "RS256",
      "RS384",
      "RS512",
      "PS256",
      "PS384",
      "PS512",
      "ES256",
      "ES384",
      "ES512"
    ];
    exports2.ALGORITHMS = ALGORITHMS;
    exports2.sign = SignStream.sign;
    exports2.verify = VerifyStream.verify;
    exports2.decode = VerifyStream.decode;
    exports2.isValid = VerifyStream.isValid;
    exports2.createSign = function createSign(opts) {
      return new SignStream(opts);
    };
    exports2.createVerify = function createVerify(opts) {
      return new VerifyStream(opts);
    };
  }
});

// node_modules/jsonwebtoken/decode.js
var require_decode = __commonJS({
  "node_modules/jsonwebtoken/decode.js"(exports2, module2) {
    var jws = require_jws();
    module2.exports = function(jwt, options) {
      options = options || {};
      var decoded = jws.decode(jwt, options);
      if (!decoded) {
        return null;
      }
      var payload = decoded.payload;
      if (typeof payload === "string") {
        try {
          var obj = JSON.parse(payload);
          if (obj !== null && typeof obj === "object") {
            payload = obj;
          }
        } catch (e) {
        }
      }
      if (options.complete === true) {
        return {
          header: decoded.header,
          payload,
          signature: decoded.signature
        };
      }
      return payload;
    };
  }
});

// node_modules/jsonwebtoken/lib/JsonWebTokenError.js
var require_JsonWebTokenError = __commonJS({
  "node_modules/jsonwebtoken/lib/JsonWebTokenError.js"(exports2, module2) {
    var JsonWebTokenError = function(message, error) {
      Error.call(this, message);
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
      }
      this.name = "JsonWebTokenError";
      this.message = message;
      if (error) this.inner = error;
    };
    JsonWebTokenError.prototype = Object.create(Error.prototype);
    JsonWebTokenError.prototype.constructor = JsonWebTokenError;
    module2.exports = JsonWebTokenError;
  }
});

// node_modules/jsonwebtoken/lib/NotBeforeError.js
var require_NotBeforeError = __commonJS({
  "node_modules/jsonwebtoken/lib/NotBeforeError.js"(exports2, module2) {
    var JsonWebTokenError = require_JsonWebTokenError();
    var NotBeforeError = function(message, date) {
      JsonWebTokenError.call(this, message);
      this.name = "NotBeforeError";
      this.date = date;
    };
    NotBeforeError.prototype = Object.create(JsonWebTokenError.prototype);
    NotBeforeError.prototype.constructor = NotBeforeError;
    module2.exports = NotBeforeError;
  }
});

// node_modules/jsonwebtoken/lib/TokenExpiredError.js
var require_TokenExpiredError = __commonJS({
  "node_modules/jsonwebtoken/lib/TokenExpiredError.js"(exports2, module2) {
    var JsonWebTokenError = require_JsonWebTokenError();
    var TokenExpiredError = function(message, expiredAt) {
      JsonWebTokenError.call(this, message);
      this.name = "TokenExpiredError";
      this.expiredAt = expiredAt;
    };
    TokenExpiredError.prototype = Object.create(JsonWebTokenError.prototype);
    TokenExpiredError.prototype.constructor = TokenExpiredError;
    module2.exports = TokenExpiredError;
  }
});

// node_modules/ms/index.js
var require_ms = __commonJS({
  "node_modules/ms/index.js"(exports2, module2) {
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;
    module2.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse2(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse2(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "weeks":
        case "week":
        case "w":
          return n * w;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return Math.round(ms / d) + "d";
      }
      if (msAbs >= h) {
        return Math.round(ms / h) + "h";
      }
      if (msAbs >= m) {
        return Math.round(ms / m) + "m";
      }
      if (msAbs >= s) {
        return Math.round(ms / s) + "s";
      }
      return ms + "ms";
    }
    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return plural(ms, msAbs, d, "day");
      }
      if (msAbs >= h) {
        return plural(ms, msAbs, h, "hour");
      }
      if (msAbs >= m) {
        return plural(ms, msAbs, m, "minute");
      }
      if (msAbs >= s) {
        return plural(ms, msAbs, s, "second");
      }
      return ms + " ms";
    }
    function plural(ms, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
    }
  }
});

// node_modules/jsonwebtoken/lib/timespan.js
var require_timespan = __commonJS({
  "node_modules/jsonwebtoken/lib/timespan.js"(exports2, module2) {
    var ms = require_ms();
    module2.exports = function(time, iat) {
      var timestamp = iat || Math.floor(Date.now() / 1e3);
      if (typeof time === "string") {
        var milliseconds = ms(time);
        if (typeof milliseconds === "undefined") {
          return;
        }
        return Math.floor(timestamp + milliseconds / 1e3);
      } else if (typeof time === "number") {
        return timestamp + time;
      } else {
        return;
      }
    };
  }
});

// node_modules/semver/internal/constants.js
var require_constants = __commonJS({
  "node_modules/semver/internal/constants.js"(exports2, module2) {
    "use strict";
    var SEMVER_SPEC_VERSION = "2.0.0";
    var MAX_LENGTH = 256;
    var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */
    9007199254740991;
    var MAX_SAFE_COMPONENT_LENGTH = 16;
    var MAX_SAFE_BUILD_LENGTH = MAX_LENGTH - 6;
    var RELEASE_TYPES = [
      "major",
      "premajor",
      "minor",
      "preminor",
      "patch",
      "prepatch",
      "prerelease"
    ];
    module2.exports = {
      MAX_LENGTH,
      MAX_SAFE_COMPONENT_LENGTH,
      MAX_SAFE_BUILD_LENGTH,
      MAX_SAFE_INTEGER,
      RELEASE_TYPES,
      SEMVER_SPEC_VERSION,
      FLAG_INCLUDE_PRERELEASE: 1,
      FLAG_LOOSE: 2
    };
  }
});

// node_modules/semver/internal/debug.js
var require_debug = __commonJS({
  "node_modules/semver/internal/debug.js"(exports2, module2) {
    "use strict";
    var debug = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {
    };
    module2.exports = debug;
  }
});

// node_modules/semver/internal/re.js
var require_re = __commonJS({
  "node_modules/semver/internal/re.js"(exports2, module2) {
    "use strict";
    var {
      MAX_SAFE_COMPONENT_LENGTH,
      MAX_SAFE_BUILD_LENGTH,
      MAX_LENGTH
    } = require_constants();
    var debug = require_debug();
    exports2 = module2.exports = {};
    var re = exports2.re = [];
    var safeRe = exports2.safeRe = [];
    var src = exports2.src = [];
    var safeSrc = exports2.safeSrc = [];
    var t = exports2.t = {};
    var R = 0;
    var LETTERDASHNUMBER = "[a-zA-Z0-9-]";
    var safeRegexReplacements = [
      ["\\s", 1],
      ["\\d", MAX_LENGTH],
      [LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]
    ];
    var makeSafeRegex = (value) => {
      for (const [token, max] of safeRegexReplacements) {
        value = value.split(`${token}*`).join(`${token}{0,${max}}`).split(`${token}+`).join(`${token}{1,${max}}`);
      }
      return value;
    };
    var createToken = (name, value, isGlobal) => {
      const safe = makeSafeRegex(value);
      const index = R++;
      debug(name, index, value);
      t[name] = index;
      src[index] = value;
      safeSrc[index] = safe;
      re[index] = new RegExp(value, isGlobal ? "g" : void 0);
      safeRe[index] = new RegExp(safe, isGlobal ? "g" : void 0);
    };
    createToken("NUMERICIDENTIFIER", "0|[1-9]\\d*");
    createToken("NUMERICIDENTIFIERLOOSE", "\\d+");
    createToken("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${LETTERDASHNUMBER}*`);
    createToken("MAINVERSION", `(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})`);
    createToken("MAINVERSIONLOOSE", `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASEIDENTIFIER", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIER]})`);
    createToken("PRERELEASEIDENTIFIERLOOSE", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASE", `(?:-(${src[t.PRERELEASEIDENTIFIER]}(?:\\.${src[t.PRERELEASEIDENTIFIER]})*))`);
    createToken("PRERELEASELOOSE", `(?:-?(${src[t.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${src[t.PRERELEASEIDENTIFIERLOOSE]})*))`);
    createToken("BUILDIDENTIFIER", `${LETTERDASHNUMBER}+`);
    createToken("BUILD", `(?:\\+(${src[t.BUILDIDENTIFIER]}(?:\\.${src[t.BUILDIDENTIFIER]})*))`);
    createToken("FULLPLAIN", `v?${src[t.MAINVERSION]}${src[t.PRERELEASE]}?${src[t.BUILD]}?`);
    createToken("FULL", `^${src[t.FULLPLAIN]}$`);
    createToken("LOOSEPLAIN", `[v=\\s]*${src[t.MAINVERSIONLOOSE]}${src[t.PRERELEASELOOSE]}?${src[t.BUILD]}?`);
    createToken("LOOSE", `^${src[t.LOOSEPLAIN]}$`);
    createToken("GTLT", "((?:<|>)?=?)");
    createToken("XRANGEIDENTIFIERLOOSE", `${src[t.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`);
    createToken("XRANGEIDENTIFIER", `${src[t.NUMERICIDENTIFIER]}|x|X|\\*`);
    createToken("XRANGEPLAIN", `[v=\\s]*(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:${src[t.PRERELEASE]})?${src[t.BUILD]}?)?)?`);
    createToken("XRANGEPLAINLOOSE", `[v=\\s]*(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:${src[t.PRERELEASELOOSE]})?${src[t.BUILD]}?)?)?`);
    createToken("XRANGE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAIN]}$`);
    createToken("XRANGELOOSE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("COERCEPLAIN", `${"(^|[^\\d])(\\d{1,"}${MAX_SAFE_COMPONENT_LENGTH}})(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`);
    createToken("COERCE", `${src[t.COERCEPLAIN]}(?:$|[^\\d])`);
    createToken("COERCEFULL", src[t.COERCEPLAIN] + `(?:${src[t.PRERELEASE]})?(?:${src[t.BUILD]})?(?:$|[^\\d])`);
    createToken("COERCERTL", src[t.COERCE], true);
    createToken("COERCERTLFULL", src[t.COERCEFULL], true);
    createToken("LONETILDE", "(?:~>?)");
    createToken("TILDETRIM", `(\\s*)${src[t.LONETILDE]}\\s+`, true);
    exports2.tildeTrimReplace = "$1~";
    createToken("TILDE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAIN]}$`);
    createToken("TILDELOOSE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("LONECARET", "(?:\\^)");
    createToken("CARETTRIM", `(\\s*)${src[t.LONECARET]}\\s+`, true);
    exports2.caretTrimReplace = "$1^";
    createToken("CARET", `^${src[t.LONECARET]}${src[t.XRANGEPLAIN]}$`);
    createToken("CARETLOOSE", `^${src[t.LONECARET]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("COMPARATORLOOSE", `^${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]})$|^$`);
    createToken("COMPARATOR", `^${src[t.GTLT]}\\s*(${src[t.FULLPLAIN]})$|^$`);
    createToken("COMPARATORTRIM", `(\\s*)${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]}|${src[t.XRANGEPLAIN]})`, true);
    exports2.comparatorTrimReplace = "$1$2$3";
    createToken("HYPHENRANGE", `^\\s*(${src[t.XRANGEPLAIN]})\\s+-\\s+(${src[t.XRANGEPLAIN]})\\s*$`);
    createToken("HYPHENRANGELOOSE", `^\\s*(${src[t.XRANGEPLAINLOOSE]})\\s+-\\s+(${src[t.XRANGEPLAINLOOSE]})\\s*$`);
    createToken("STAR", "(<|>)?=?\\s*\\*");
    createToken("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$");
    createToken("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
  }
});

// node_modules/semver/internal/parse-options.js
var require_parse_options = __commonJS({
  "node_modules/semver/internal/parse-options.js"(exports2, module2) {
    "use strict";
    var looseOption = Object.freeze({ loose: true });
    var emptyOpts = Object.freeze({});
    var parseOptions = (options) => {
      if (!options) {
        return emptyOpts;
      }
      if (typeof options !== "object") {
        return looseOption;
      }
      return options;
    };
    module2.exports = parseOptions;
  }
});

// node_modules/semver/internal/identifiers.js
var require_identifiers = __commonJS({
  "node_modules/semver/internal/identifiers.js"(exports2, module2) {
    "use strict";
    var numeric = /^[0-9]+$/;
    var compareIdentifiers = (a, b) => {
      if (typeof a === "number" && typeof b === "number") {
        return a === b ? 0 : a < b ? -1 : 1;
      }
      const anum = numeric.test(a);
      const bnum = numeric.test(b);
      if (anum && bnum) {
        a = +a;
        b = +b;
      }
      return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
    };
    var rcompareIdentifiers = (a, b) => compareIdentifiers(b, a);
    module2.exports = {
      compareIdentifiers,
      rcompareIdentifiers
    };
  }
});

// node_modules/semver/classes/semver.js
var require_semver = __commonJS({
  "node_modules/semver/classes/semver.js"(exports2, module2) {
    "use strict";
    var debug = require_debug();
    var { MAX_LENGTH, MAX_SAFE_INTEGER } = require_constants();
    var { safeRe: re, t } = require_re();
    var parseOptions = require_parse_options();
    var { compareIdentifiers } = require_identifiers();
    var SemVer = class _SemVer {
      constructor(version2, options) {
        options = parseOptions(options);
        if (version2 instanceof _SemVer) {
          if (version2.loose === !!options.loose && version2.includePrerelease === !!options.includePrerelease) {
            return version2;
          } else {
            version2 = version2.version;
          }
        } else if (typeof version2 !== "string") {
          throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version2}".`);
        }
        if (version2.length > MAX_LENGTH) {
          throw new TypeError(
            `version is longer than ${MAX_LENGTH} characters`
          );
        }
        debug("SemVer", version2, options);
        this.options = options;
        this.loose = !!options.loose;
        this.includePrerelease = !!options.includePrerelease;
        const m = version2.trim().match(options.loose ? re[t.LOOSE] : re[t.FULL]);
        if (!m) {
          throw new TypeError(`Invalid Version: ${version2}`);
        }
        this.raw = version2;
        this.major = +m[1];
        this.minor = +m[2];
        this.patch = +m[3];
        if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
          throw new TypeError("Invalid major version");
        }
        if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
          throw new TypeError("Invalid minor version");
        }
        if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
          throw new TypeError("Invalid patch version");
        }
        if (!m[4]) {
          this.prerelease = [];
        } else {
          this.prerelease = m[4].split(".").map((id) => {
            if (/^[0-9]+$/.test(id)) {
              const num = +id;
              if (num >= 0 && num < MAX_SAFE_INTEGER) {
                return num;
              }
            }
            return id;
          });
        }
        this.build = m[5] ? m[5].split(".") : [];
        this.format();
      }
      format() {
        this.version = `${this.major}.${this.minor}.${this.patch}`;
        if (this.prerelease.length) {
          this.version += `-${this.prerelease.join(".")}`;
        }
        return this.version;
      }
      toString() {
        return this.version;
      }
      compare(other) {
        debug("SemVer.compare", this.version, this.options, other);
        if (!(other instanceof _SemVer)) {
          if (typeof other === "string" && other === this.version) {
            return 0;
          }
          other = new _SemVer(other, this.options);
        }
        if (other.version === this.version) {
          return 0;
        }
        return this.compareMain(other) || this.comparePre(other);
      }
      compareMain(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        if (this.major < other.major) {
          return -1;
        }
        if (this.major > other.major) {
          return 1;
        }
        if (this.minor < other.minor) {
          return -1;
        }
        if (this.minor > other.minor) {
          return 1;
        }
        if (this.patch < other.patch) {
          return -1;
        }
        if (this.patch > other.patch) {
          return 1;
        }
        return 0;
      }
      comparePre(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        if (this.prerelease.length && !other.prerelease.length) {
          return -1;
        } else if (!this.prerelease.length && other.prerelease.length) {
          return 1;
        } else if (!this.prerelease.length && !other.prerelease.length) {
          return 0;
        }
        let i = 0;
        do {
          const a = this.prerelease[i];
          const b = other.prerelease[i];
          debug("prerelease compare", i, a, b);
          if (a === void 0 && b === void 0) {
            return 0;
          } else if (b === void 0) {
            return 1;
          } else if (a === void 0) {
            return -1;
          } else if (a === b) {
            continue;
          } else {
            return compareIdentifiers(a, b);
          }
        } while (++i);
      }
      compareBuild(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        let i = 0;
        do {
          const a = this.build[i];
          const b = other.build[i];
          debug("build compare", i, a, b);
          if (a === void 0 && b === void 0) {
            return 0;
          } else if (b === void 0) {
            return 1;
          } else if (a === void 0) {
            return -1;
          } else if (a === b) {
            continue;
          } else {
            return compareIdentifiers(a, b);
          }
        } while (++i);
      }
      // preminor will bump the version up to the next minor release, and immediately
      // down to pre-release. premajor and prepatch work the same way.
      inc(release, identifier, identifierBase) {
        if (release.startsWith("pre")) {
          if (!identifier && identifierBase === false) {
            throw new Error("invalid increment argument: identifier is empty");
          }
          if (identifier) {
            const match = `-${identifier}`.match(this.options.loose ? re[t.PRERELEASELOOSE] : re[t.PRERELEASE]);
            if (!match || match[1] !== identifier) {
              throw new Error(`invalid identifier: ${identifier}`);
            }
          }
        }
        switch (release) {
          case "premajor":
            this.prerelease.length = 0;
            this.patch = 0;
            this.minor = 0;
            this.major++;
            this.inc("pre", identifier, identifierBase);
            break;
          case "preminor":
            this.prerelease.length = 0;
            this.patch = 0;
            this.minor++;
            this.inc("pre", identifier, identifierBase);
            break;
          case "prepatch":
            this.prerelease.length = 0;
            this.inc("patch", identifier, identifierBase);
            this.inc("pre", identifier, identifierBase);
            break;
          // If the input is a non-prerelease version, this acts the same as
          // prepatch.
          case "prerelease":
            if (this.prerelease.length === 0) {
              this.inc("patch", identifier, identifierBase);
            }
            this.inc("pre", identifier, identifierBase);
            break;
          case "release":
            if (this.prerelease.length === 0) {
              throw new Error(`version ${this.raw} is not a prerelease`);
            }
            this.prerelease.length = 0;
            break;
          case "major":
            if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) {
              this.major++;
            }
            this.minor = 0;
            this.patch = 0;
            this.prerelease = [];
            break;
          case "minor":
            if (this.patch !== 0 || this.prerelease.length === 0) {
              this.minor++;
            }
            this.patch = 0;
            this.prerelease = [];
            break;
          case "patch":
            if (this.prerelease.length === 0) {
              this.patch++;
            }
            this.prerelease = [];
            break;
          // This probably shouldn't be used publicly.
          // 1.0.0 'pre' would become 1.0.0-0 which is the wrong direction.
          case "pre": {
            const base = Number(identifierBase) ? 1 : 0;
            if (this.prerelease.length === 0) {
              this.prerelease = [base];
            } else {
              let i = this.prerelease.length;
              while (--i >= 0) {
                if (typeof this.prerelease[i] === "number") {
                  this.prerelease[i]++;
                  i = -2;
                }
              }
              if (i === -1) {
                if (identifier === this.prerelease.join(".") && identifierBase === false) {
                  throw new Error("invalid increment argument: identifier already exists");
                }
                this.prerelease.push(base);
              }
            }
            if (identifier) {
              let prerelease = [identifier, base];
              if (identifierBase === false) {
                prerelease = [identifier];
              }
              if (compareIdentifiers(this.prerelease[0], identifier) === 0) {
                if (isNaN(this.prerelease[1])) {
                  this.prerelease = prerelease;
                }
              } else {
                this.prerelease = prerelease;
              }
            }
            break;
          }
          default:
            throw new Error(`invalid increment argument: ${release}`);
        }
        this.raw = this.format();
        if (this.build.length) {
          this.raw += `+${this.build.join(".")}`;
        }
        return this;
      }
    };
    module2.exports = SemVer;
  }
});

// node_modules/semver/functions/parse.js
var require_parse = __commonJS({
  "node_modules/semver/functions/parse.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var parse2 = (version2, options, throwErrors = false) => {
      if (version2 instanceof SemVer) {
        return version2;
      }
      try {
        return new SemVer(version2, options);
      } catch (er) {
        if (!throwErrors) {
          return null;
        }
        throw er;
      }
    };
    module2.exports = parse2;
  }
});

// node_modules/semver/functions/valid.js
var require_valid = __commonJS({
  "node_modules/semver/functions/valid.js"(exports2, module2) {
    "use strict";
    var parse2 = require_parse();
    var valid = (version2, options) => {
      const v = parse2(version2, options);
      return v ? v.version : null;
    };
    module2.exports = valid;
  }
});

// node_modules/semver/functions/clean.js
var require_clean = __commonJS({
  "node_modules/semver/functions/clean.js"(exports2, module2) {
    "use strict";
    var parse2 = require_parse();
    var clean = (version2, options) => {
      const s = parse2(version2.trim().replace(/^[=v]+/, ""), options);
      return s ? s.version : null;
    };
    module2.exports = clean;
  }
});

// node_modules/semver/functions/inc.js
var require_inc = __commonJS({
  "node_modules/semver/functions/inc.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var inc = (version2, release, options, identifier, identifierBase) => {
      if (typeof options === "string") {
        identifierBase = identifier;
        identifier = options;
        options = void 0;
      }
      try {
        return new SemVer(
          version2 instanceof SemVer ? version2.version : version2,
          options
        ).inc(release, identifier, identifierBase).version;
      } catch (er) {
        return null;
      }
    };
    module2.exports = inc;
  }
});

// node_modules/semver/functions/diff.js
var require_diff = __commonJS({
  "node_modules/semver/functions/diff.js"(exports2, module2) {
    "use strict";
    var parse2 = require_parse();
    var diff = (version1, version2) => {
      const v12 = parse2(version1, null, true);
      const v2 = parse2(version2, null, true);
      const comparison = v12.compare(v2);
      if (comparison === 0) {
        return null;
      }
      const v1Higher = comparison > 0;
      const highVersion = v1Higher ? v12 : v2;
      const lowVersion = v1Higher ? v2 : v12;
      const highHasPre = !!highVersion.prerelease.length;
      const lowHasPre = !!lowVersion.prerelease.length;
      if (lowHasPre && !highHasPre) {
        if (!lowVersion.patch && !lowVersion.minor) {
          return "major";
        }
        if (lowVersion.compareMain(highVersion) === 0) {
          if (lowVersion.minor && !lowVersion.patch) {
            return "minor";
          }
          return "patch";
        }
      }
      const prefix = highHasPre ? "pre" : "";
      if (v12.major !== v2.major) {
        return prefix + "major";
      }
      if (v12.minor !== v2.minor) {
        return prefix + "minor";
      }
      if (v12.patch !== v2.patch) {
        return prefix + "patch";
      }
      return "prerelease";
    };
    module2.exports = diff;
  }
});

// node_modules/semver/functions/major.js
var require_major = __commonJS({
  "node_modules/semver/functions/major.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var major = (a, loose) => new SemVer(a, loose).major;
    module2.exports = major;
  }
});

// node_modules/semver/functions/minor.js
var require_minor = __commonJS({
  "node_modules/semver/functions/minor.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var minor = (a, loose) => new SemVer(a, loose).minor;
    module2.exports = minor;
  }
});

// node_modules/semver/functions/patch.js
var require_patch = __commonJS({
  "node_modules/semver/functions/patch.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var patch = (a, loose) => new SemVer(a, loose).patch;
    module2.exports = patch;
  }
});

// node_modules/semver/functions/prerelease.js
var require_prerelease = __commonJS({
  "node_modules/semver/functions/prerelease.js"(exports2, module2) {
    "use strict";
    var parse2 = require_parse();
    var prerelease = (version2, options) => {
      const parsed = parse2(version2, options);
      return parsed && parsed.prerelease.length ? parsed.prerelease : null;
    };
    module2.exports = prerelease;
  }
});

// node_modules/semver/functions/compare.js
var require_compare = __commonJS({
  "node_modules/semver/functions/compare.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var compare = (a, b, loose) => new SemVer(a, loose).compare(new SemVer(b, loose));
    module2.exports = compare;
  }
});

// node_modules/semver/functions/rcompare.js
var require_rcompare = __commonJS({
  "node_modules/semver/functions/rcompare.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var rcompare = (a, b, loose) => compare(b, a, loose);
    module2.exports = rcompare;
  }
});

// node_modules/semver/functions/compare-loose.js
var require_compare_loose = __commonJS({
  "node_modules/semver/functions/compare-loose.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var compareLoose = (a, b) => compare(a, b, true);
    module2.exports = compareLoose;
  }
});

// node_modules/semver/functions/compare-build.js
var require_compare_build = __commonJS({
  "node_modules/semver/functions/compare-build.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var compareBuild = (a, b, loose) => {
      const versionA = new SemVer(a, loose);
      const versionB = new SemVer(b, loose);
      return versionA.compare(versionB) || versionA.compareBuild(versionB);
    };
    module2.exports = compareBuild;
  }
});

// node_modules/semver/functions/sort.js
var require_sort = __commonJS({
  "node_modules/semver/functions/sort.js"(exports2, module2) {
    "use strict";
    var compareBuild = require_compare_build();
    var sort = (list, loose) => list.sort((a, b) => compareBuild(a, b, loose));
    module2.exports = sort;
  }
});

// node_modules/semver/functions/rsort.js
var require_rsort = __commonJS({
  "node_modules/semver/functions/rsort.js"(exports2, module2) {
    "use strict";
    var compareBuild = require_compare_build();
    var rsort = (list, loose) => list.sort((a, b) => compareBuild(b, a, loose));
    module2.exports = rsort;
  }
});

// node_modules/semver/functions/gt.js
var require_gt = __commonJS({
  "node_modules/semver/functions/gt.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var gt = (a, b, loose) => compare(a, b, loose) > 0;
    module2.exports = gt;
  }
});

// node_modules/semver/functions/lt.js
var require_lt = __commonJS({
  "node_modules/semver/functions/lt.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var lt = (a, b, loose) => compare(a, b, loose) < 0;
    module2.exports = lt;
  }
});

// node_modules/semver/functions/eq.js
var require_eq = __commonJS({
  "node_modules/semver/functions/eq.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var eq = (a, b, loose) => compare(a, b, loose) === 0;
    module2.exports = eq;
  }
});

// node_modules/semver/functions/neq.js
var require_neq = __commonJS({
  "node_modules/semver/functions/neq.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var neq = (a, b, loose) => compare(a, b, loose) !== 0;
    module2.exports = neq;
  }
});

// node_modules/semver/functions/gte.js
var require_gte = __commonJS({
  "node_modules/semver/functions/gte.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var gte = (a, b, loose) => compare(a, b, loose) >= 0;
    module2.exports = gte;
  }
});

// node_modules/semver/functions/lte.js
var require_lte = __commonJS({
  "node_modules/semver/functions/lte.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var lte = (a, b, loose) => compare(a, b, loose) <= 0;
    module2.exports = lte;
  }
});

// node_modules/semver/functions/cmp.js
var require_cmp = __commonJS({
  "node_modules/semver/functions/cmp.js"(exports2, module2) {
    "use strict";
    var eq = require_eq();
    var neq = require_neq();
    var gt = require_gt();
    var gte = require_gte();
    var lt = require_lt();
    var lte = require_lte();
    var cmp = (a, op, b, loose) => {
      switch (op) {
        case "===":
          if (typeof a === "object") {
            a = a.version;
          }
          if (typeof b === "object") {
            b = b.version;
          }
          return a === b;
        case "!==":
          if (typeof a === "object") {
            a = a.version;
          }
          if (typeof b === "object") {
            b = b.version;
          }
          return a !== b;
        case "":
        case "=":
        case "==":
          return eq(a, b, loose);
        case "!=":
          return neq(a, b, loose);
        case ">":
          return gt(a, b, loose);
        case ">=":
          return gte(a, b, loose);
        case "<":
          return lt(a, b, loose);
        case "<=":
          return lte(a, b, loose);
        default:
          throw new TypeError(`Invalid operator: ${op}`);
      }
    };
    module2.exports = cmp;
  }
});

// node_modules/semver/functions/coerce.js
var require_coerce = __commonJS({
  "node_modules/semver/functions/coerce.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var parse2 = require_parse();
    var { safeRe: re, t } = require_re();
    var coerce = (version2, options) => {
      if (version2 instanceof SemVer) {
        return version2;
      }
      if (typeof version2 === "number") {
        version2 = String(version2);
      }
      if (typeof version2 !== "string") {
        return null;
      }
      options = options || {};
      let match = null;
      if (!options.rtl) {
        match = version2.match(options.includePrerelease ? re[t.COERCEFULL] : re[t.COERCE]);
      } else {
        const coerceRtlRegex = options.includePrerelease ? re[t.COERCERTLFULL] : re[t.COERCERTL];
        let next;
        while ((next = coerceRtlRegex.exec(version2)) && (!match || match.index + match[0].length !== version2.length)) {
          if (!match || next.index + next[0].length !== match.index + match[0].length) {
            match = next;
          }
          coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
        }
        coerceRtlRegex.lastIndex = -1;
      }
      if (match === null) {
        return null;
      }
      const major = match[2];
      const minor = match[3] || "0";
      const patch = match[4] || "0";
      const prerelease = options.includePrerelease && match[5] ? `-${match[5]}` : "";
      const build = options.includePrerelease && match[6] ? `+${match[6]}` : "";
      return parse2(`${major}.${minor}.${patch}${prerelease}${build}`, options);
    };
    module2.exports = coerce;
  }
});

// node_modules/semver/internal/lrucache.js
var require_lrucache = __commonJS({
  "node_modules/semver/internal/lrucache.js"(exports2, module2) {
    "use strict";
    var LRUCache = class {
      constructor() {
        this.max = 1e3;
        this.map = /* @__PURE__ */ new Map();
      }
      get(key) {
        const value = this.map.get(key);
        if (value === void 0) {
          return void 0;
        } else {
          this.map.delete(key);
          this.map.set(key, value);
          return value;
        }
      }
      delete(key) {
        return this.map.delete(key);
      }
      set(key, value) {
        const deleted = this.delete(key);
        if (!deleted && value !== void 0) {
          if (this.map.size >= this.max) {
            const firstKey = this.map.keys().next().value;
            this.delete(firstKey);
          }
          this.map.set(key, value);
        }
        return this;
      }
    };
    module2.exports = LRUCache;
  }
});

// node_modules/semver/classes/range.js
var require_range = __commonJS({
  "node_modules/semver/classes/range.js"(exports2, module2) {
    "use strict";
    var SPACE_CHARACTERS = /\s+/g;
    var Range = class _Range {
      constructor(range, options) {
        options = parseOptions(options);
        if (range instanceof _Range) {
          if (range.loose === !!options.loose && range.includePrerelease === !!options.includePrerelease) {
            return range;
          } else {
            return new _Range(range.raw, options);
          }
        }
        if (range instanceof Comparator) {
          this.raw = range.value;
          this.set = [[range]];
          this.formatted = void 0;
          return this;
        }
        this.options = options;
        this.loose = !!options.loose;
        this.includePrerelease = !!options.includePrerelease;
        this.raw = range.trim().replace(SPACE_CHARACTERS, " ");
        this.set = this.raw.split("||").map((r) => this.parseRange(r.trim())).filter((c) => c.length);
        if (!this.set.length) {
          throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
        }
        if (this.set.length > 1) {
          const first = this.set[0];
          this.set = this.set.filter((c) => !isNullSet(c[0]));
          if (this.set.length === 0) {
            this.set = [first];
          } else if (this.set.length > 1) {
            for (const c of this.set) {
              if (c.length === 1 && isAny(c[0])) {
                this.set = [c];
                break;
              }
            }
          }
        }
        this.formatted = void 0;
      }
      get range() {
        if (this.formatted === void 0) {
          this.formatted = "";
          for (let i = 0; i < this.set.length; i++) {
            if (i > 0) {
              this.formatted += "||";
            }
            const comps = this.set[i];
            for (let k = 0; k < comps.length; k++) {
              if (k > 0) {
                this.formatted += " ";
              }
              this.formatted += comps[k].toString().trim();
            }
          }
        }
        return this.formatted;
      }
      format() {
        return this.range;
      }
      toString() {
        return this.range;
      }
      parseRange(range) {
        const memoOpts = (this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) | (this.options.loose && FLAG_LOOSE);
        const memoKey = memoOpts + ":" + range;
        const cached = cache.get(memoKey);
        if (cached) {
          return cached;
        }
        const loose = this.options.loose;
        const hr = loose ? re[t.HYPHENRANGELOOSE] : re[t.HYPHENRANGE];
        range = range.replace(hr, hyphenReplace(this.options.includePrerelease));
        debug("hyphen replace", range);
        range = range.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
        debug("comparator trim", range);
        range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
        debug("tilde trim", range);
        range = range.replace(re[t.CARETTRIM], caretTrimReplace);
        debug("caret trim", range);
        let rangeList = range.split(" ").map((comp) => parseComparator(comp, this.options)).join(" ").split(/\s+/).map((comp) => replaceGTE0(comp, this.options));
        if (loose) {
          rangeList = rangeList.filter((comp) => {
            debug("loose invalid filter", comp, this.options);
            return !!comp.match(re[t.COMPARATORLOOSE]);
          });
        }
        debug("range list", rangeList);
        const rangeMap = /* @__PURE__ */ new Map();
        const comparators = rangeList.map((comp) => new Comparator(comp, this.options));
        for (const comp of comparators) {
          if (isNullSet(comp)) {
            return [comp];
          }
          rangeMap.set(comp.value, comp);
        }
        if (rangeMap.size > 1 && rangeMap.has("")) {
          rangeMap.delete("");
        }
        const result = [...rangeMap.values()];
        cache.set(memoKey, result);
        return result;
      }
      intersects(range, options) {
        if (!(range instanceof _Range)) {
          throw new TypeError("a Range is required");
        }
        return this.set.some((thisComparators) => {
          return isSatisfiable(thisComparators, options) && range.set.some((rangeComparators) => {
            return isSatisfiable(rangeComparators, options) && thisComparators.every((thisComparator) => {
              return rangeComparators.every((rangeComparator) => {
                return thisComparator.intersects(rangeComparator, options);
              });
            });
          });
        });
      }
      // if ANY of the sets match ALL of its comparators, then pass
      test(version2) {
        if (!version2) {
          return false;
        }
        if (typeof version2 === "string") {
          try {
            version2 = new SemVer(version2, this.options);
          } catch (er) {
            return false;
          }
        }
        for (let i = 0; i < this.set.length; i++) {
          if (testSet(this.set[i], version2, this.options)) {
            return true;
          }
        }
        return false;
      }
    };
    module2.exports = Range;
    var LRU = require_lrucache();
    var cache = new LRU();
    var parseOptions = require_parse_options();
    var Comparator = require_comparator();
    var debug = require_debug();
    var SemVer = require_semver();
    var {
      safeRe: re,
      t,
      comparatorTrimReplace,
      tildeTrimReplace,
      caretTrimReplace
    } = require_re();
    var { FLAG_INCLUDE_PRERELEASE, FLAG_LOOSE } = require_constants();
    var isNullSet = (c) => c.value === "<0.0.0-0";
    var isAny = (c) => c.value === "";
    var isSatisfiable = (comparators, options) => {
      let result = true;
      const remainingComparators = comparators.slice();
      let testComparator = remainingComparators.pop();
      while (result && remainingComparators.length) {
        result = remainingComparators.every((otherComparator) => {
          return testComparator.intersects(otherComparator, options);
        });
        testComparator = remainingComparators.pop();
      }
      return result;
    };
    var parseComparator = (comp, options) => {
      comp = comp.replace(re[t.BUILD], "");
      debug("comp", comp, options);
      comp = replaceCarets(comp, options);
      debug("caret", comp);
      comp = replaceTildes(comp, options);
      debug("tildes", comp);
      comp = replaceXRanges(comp, options);
      debug("xrange", comp);
      comp = replaceStars(comp, options);
      debug("stars", comp);
      return comp;
    };
    var isX = (id) => !id || id.toLowerCase() === "x" || id === "*";
    var replaceTildes = (comp, options) => {
      return comp.trim().split(/\s+/).map((c) => replaceTilde(c, options)).join(" ");
    };
    var replaceTilde = (comp, options) => {
      const r = options.loose ? re[t.TILDELOOSE] : re[t.TILDE];
      return comp.replace(r, (_, M, m, p, pr) => {
        debug("tilde", comp, _, M, m, p, pr);
        let ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = `>=${M}.0.0 <${+M + 1}.0.0-0`;
        } else if (isX(p)) {
          ret = `>=${M}.${m}.0 <${M}.${+m + 1}.0-0`;
        } else if (pr) {
          debug("replaceTilde pr", pr);
          ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
        } else {
          ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
        }
        debug("tilde return", ret);
        return ret;
      });
    };
    var replaceCarets = (comp, options) => {
      return comp.trim().split(/\s+/).map((c) => replaceCaret(c, options)).join(" ");
    };
    var replaceCaret = (comp, options) => {
      debug("caret", comp, options);
      const r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
      const z = options.includePrerelease ? "-0" : "";
      return comp.replace(r, (_, M, m, p, pr) => {
        debug("caret", comp, _, M, m, p, pr);
        let ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
        } else if (isX(p)) {
          if (M === "0") {
            ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
          } else {
            ret = `>=${M}.${m}.0${z} <${+M + 1}.0.0-0`;
          }
        } else if (pr) {
          debug("replaceCaret pr", pr);
          if (M === "0") {
            if (m === "0") {
              ret = `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`;
            } else {
              ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
            }
          } else {
            ret = `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`;
          }
        } else {
          debug("no pr");
          if (M === "0") {
            if (m === "0") {
              ret = `>=${M}.${m}.${p}${z} <${M}.${m}.${+p + 1}-0`;
            } else {
              ret = `>=${M}.${m}.${p}${z} <${M}.${+m + 1}.0-0`;
            }
          } else {
            ret = `>=${M}.${m}.${p} <${+M + 1}.0.0-0`;
          }
        }
        debug("caret return", ret);
        return ret;
      });
    };
    var replaceXRanges = (comp, options) => {
      debug("replaceXRanges", comp, options);
      return comp.split(/\s+/).map((c) => replaceXRange(c, options)).join(" ");
    };
    var replaceXRange = (comp, options) => {
      comp = comp.trim();
      const r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
      return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
        debug("xRange", comp, ret, gtlt, M, m, p, pr);
        const xM = isX(M);
        const xm = xM || isX(m);
        const xp = xm || isX(p);
        const anyX = xp;
        if (gtlt === "=" && anyX) {
          gtlt = "";
        }
        pr = options.includePrerelease ? "-0" : "";
        if (xM) {
          if (gtlt === ">" || gtlt === "<") {
            ret = "<0.0.0-0";
          } else {
            ret = "*";
          }
        } else if (gtlt && anyX) {
          if (xm) {
            m = 0;
          }
          p = 0;
          if (gtlt === ">") {
            gtlt = ">=";
            if (xm) {
              M = +M + 1;
              m = 0;
              p = 0;
            } else {
              m = +m + 1;
              p = 0;
            }
          } else if (gtlt === "<=") {
            gtlt = "<";
            if (xm) {
              M = +M + 1;
            } else {
              m = +m + 1;
            }
          }
          if (gtlt === "<") {
            pr = "-0";
          }
          ret = `${gtlt + M}.${m}.${p}${pr}`;
        } else if (xm) {
          ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
        } else if (xp) {
          ret = `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`;
        }
        debug("xRange return", ret);
        return ret;
      });
    };
    var replaceStars = (comp, options) => {
      debug("replaceStars", comp, options);
      return comp.trim().replace(re[t.STAR], "");
    };
    var replaceGTE0 = (comp, options) => {
      debug("replaceGTE0", comp, options);
      return comp.trim().replace(re[options.includePrerelease ? t.GTE0PRE : t.GTE0], "");
    };
    var hyphenReplace = (incPr) => ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr) => {
      if (isX(fM)) {
        from = "";
      } else if (isX(fm)) {
        from = `>=${fM}.0.0${incPr ? "-0" : ""}`;
      } else if (isX(fp)) {
        from = `>=${fM}.${fm}.0${incPr ? "-0" : ""}`;
      } else if (fpr) {
        from = `>=${from}`;
      } else {
        from = `>=${from}${incPr ? "-0" : ""}`;
      }
      if (isX(tM)) {
        to = "";
      } else if (isX(tm)) {
        to = `<${+tM + 1}.0.0-0`;
      } else if (isX(tp)) {
        to = `<${tM}.${+tm + 1}.0-0`;
      } else if (tpr) {
        to = `<=${tM}.${tm}.${tp}-${tpr}`;
      } else if (incPr) {
        to = `<${tM}.${tm}.${+tp + 1}-0`;
      } else {
        to = `<=${to}`;
      }
      return `${from} ${to}`.trim();
    };
    var testSet = (set, version2, options) => {
      for (let i = 0; i < set.length; i++) {
        if (!set[i].test(version2)) {
          return false;
        }
      }
      if (version2.prerelease.length && !options.includePrerelease) {
        for (let i = 0; i < set.length; i++) {
          debug(set[i].semver);
          if (set[i].semver === Comparator.ANY) {
            continue;
          }
          if (set[i].semver.prerelease.length > 0) {
            const allowed = set[i].semver;
            if (allowed.major === version2.major && allowed.minor === version2.minor && allowed.patch === version2.patch) {
              return true;
            }
          }
        }
        return false;
      }
      return true;
    };
  }
});

// node_modules/semver/classes/comparator.js
var require_comparator = __commonJS({
  "node_modules/semver/classes/comparator.js"(exports2, module2) {
    "use strict";
    var ANY = Symbol("SemVer ANY");
    var Comparator = class _Comparator {
      static get ANY() {
        return ANY;
      }
      constructor(comp, options) {
        options = parseOptions(options);
        if (comp instanceof _Comparator) {
          if (comp.loose === !!options.loose) {
            return comp;
          } else {
            comp = comp.value;
          }
        }
        comp = comp.trim().split(/\s+/).join(" ");
        debug("comparator", comp, options);
        this.options = options;
        this.loose = !!options.loose;
        this.parse(comp);
        if (this.semver === ANY) {
          this.value = "";
        } else {
          this.value = this.operator + this.semver.version;
        }
        debug("comp", this);
      }
      parse(comp) {
        const r = this.options.loose ? re[t.COMPARATORLOOSE] : re[t.COMPARATOR];
        const m = comp.match(r);
        if (!m) {
          throw new TypeError(`Invalid comparator: ${comp}`);
        }
        this.operator = m[1] !== void 0 ? m[1] : "";
        if (this.operator === "=") {
          this.operator = "";
        }
        if (!m[2]) {
          this.semver = ANY;
        } else {
          this.semver = new SemVer(m[2], this.options.loose);
        }
      }
      toString() {
        return this.value;
      }
      test(version2) {
        debug("Comparator.test", version2, this.options.loose);
        if (this.semver === ANY || version2 === ANY) {
          return true;
        }
        if (typeof version2 === "string") {
          try {
            version2 = new SemVer(version2, this.options);
          } catch (er) {
            return false;
          }
        }
        return cmp(version2, this.operator, this.semver, this.options);
      }
      intersects(comp, options) {
        if (!(comp instanceof _Comparator)) {
          throw new TypeError("a Comparator is required");
        }
        if (this.operator === "") {
          if (this.value === "") {
            return true;
          }
          return new Range(comp.value, options).test(this.value);
        } else if (comp.operator === "") {
          if (comp.value === "") {
            return true;
          }
          return new Range(this.value, options).test(comp.semver);
        }
        options = parseOptions(options);
        if (options.includePrerelease && (this.value === "<0.0.0-0" || comp.value === "<0.0.0-0")) {
          return false;
        }
        if (!options.includePrerelease && (this.value.startsWith("<0.0.0") || comp.value.startsWith("<0.0.0"))) {
          return false;
        }
        if (this.operator.startsWith(">") && comp.operator.startsWith(">")) {
          return true;
        }
        if (this.operator.startsWith("<") && comp.operator.startsWith("<")) {
          return true;
        }
        if (this.semver.version === comp.semver.version && this.operator.includes("=") && comp.operator.includes("=")) {
          return true;
        }
        if (cmp(this.semver, "<", comp.semver, options) && this.operator.startsWith(">") && comp.operator.startsWith("<")) {
          return true;
        }
        if (cmp(this.semver, ">", comp.semver, options) && this.operator.startsWith("<") && comp.operator.startsWith(">")) {
          return true;
        }
        return false;
      }
    };
    module2.exports = Comparator;
    var parseOptions = require_parse_options();
    var { safeRe: re, t } = require_re();
    var cmp = require_cmp();
    var debug = require_debug();
    var SemVer = require_semver();
    var Range = require_range();
  }
});

// node_modules/semver/functions/satisfies.js
var require_satisfies = __commonJS({
  "node_modules/semver/functions/satisfies.js"(exports2, module2) {
    "use strict";
    var Range = require_range();
    var satisfies = (version2, range, options) => {
      try {
        range = new Range(range, options);
      } catch (er) {
        return false;
      }
      return range.test(version2);
    };
    module2.exports = satisfies;
  }
});

// node_modules/semver/ranges/to-comparators.js
var require_to_comparators = __commonJS({
  "node_modules/semver/ranges/to-comparators.js"(exports2, module2) {
    "use strict";
    var Range = require_range();
    var toComparators = (range, options) => new Range(range, options).set.map((comp) => comp.map((c) => c.value).join(" ").trim().split(" "));
    module2.exports = toComparators;
  }
});

// node_modules/semver/ranges/max-satisfying.js
var require_max_satisfying = __commonJS({
  "node_modules/semver/ranges/max-satisfying.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var Range = require_range();
    var maxSatisfying = (versions, range, options) => {
      let max = null;
      let maxSV = null;
      let rangeObj = null;
      try {
        rangeObj = new Range(range, options);
      } catch (er) {
        return null;
      }
      versions.forEach((v) => {
        if (rangeObj.test(v)) {
          if (!max || maxSV.compare(v) === -1) {
            max = v;
            maxSV = new SemVer(max, options);
          }
        }
      });
      return max;
    };
    module2.exports = maxSatisfying;
  }
});

// node_modules/semver/ranges/min-satisfying.js
var require_min_satisfying = __commonJS({
  "node_modules/semver/ranges/min-satisfying.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var Range = require_range();
    var minSatisfying = (versions, range, options) => {
      let min = null;
      let minSV = null;
      let rangeObj = null;
      try {
        rangeObj = new Range(range, options);
      } catch (er) {
        return null;
      }
      versions.forEach((v) => {
        if (rangeObj.test(v)) {
          if (!min || minSV.compare(v) === 1) {
            min = v;
            minSV = new SemVer(min, options);
          }
        }
      });
      return min;
    };
    module2.exports = minSatisfying;
  }
});

// node_modules/semver/ranges/min-version.js
var require_min_version = __commonJS({
  "node_modules/semver/ranges/min-version.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var Range = require_range();
    var gt = require_gt();
    var minVersion = (range, loose) => {
      range = new Range(range, loose);
      let minver = new SemVer("0.0.0");
      if (range.test(minver)) {
        return minver;
      }
      minver = new SemVer("0.0.0-0");
      if (range.test(minver)) {
        return minver;
      }
      minver = null;
      for (let i = 0; i < range.set.length; ++i) {
        const comparators = range.set[i];
        let setMin = null;
        comparators.forEach((comparator) => {
          const compver = new SemVer(comparator.semver.version);
          switch (comparator.operator) {
            case ">":
              if (compver.prerelease.length === 0) {
                compver.patch++;
              } else {
                compver.prerelease.push(0);
              }
              compver.raw = compver.format();
            /* fallthrough */
            case "":
            case ">=":
              if (!setMin || gt(compver, setMin)) {
                setMin = compver;
              }
              break;
            case "<":
            case "<=":
              break;
            /* istanbul ignore next */
            default:
              throw new Error(`Unexpected operation: ${comparator.operator}`);
          }
        });
        if (setMin && (!minver || gt(minver, setMin))) {
          minver = setMin;
        }
      }
      if (minver && range.test(minver)) {
        return minver;
      }
      return null;
    };
    module2.exports = minVersion;
  }
});

// node_modules/semver/ranges/valid.js
var require_valid2 = __commonJS({
  "node_modules/semver/ranges/valid.js"(exports2, module2) {
    "use strict";
    var Range = require_range();
    var validRange = (range, options) => {
      try {
        return new Range(range, options).range || "*";
      } catch (er) {
        return null;
      }
    };
    module2.exports = validRange;
  }
});

// node_modules/semver/ranges/outside.js
var require_outside = __commonJS({
  "node_modules/semver/ranges/outside.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var Comparator = require_comparator();
    var { ANY } = Comparator;
    var Range = require_range();
    var satisfies = require_satisfies();
    var gt = require_gt();
    var lt = require_lt();
    var lte = require_lte();
    var gte = require_gte();
    var outside = (version2, range, hilo, options) => {
      version2 = new SemVer(version2, options);
      range = new Range(range, options);
      let gtfn, ltefn, ltfn, comp, ecomp;
      switch (hilo) {
        case ">":
          gtfn = gt;
          ltefn = lte;
          ltfn = lt;
          comp = ">";
          ecomp = ">=";
          break;
        case "<":
          gtfn = lt;
          ltefn = gte;
          ltfn = gt;
          comp = "<";
          ecomp = "<=";
          break;
        default:
          throw new TypeError('Must provide a hilo val of "<" or ">"');
      }
      if (satisfies(version2, range, options)) {
        return false;
      }
      for (let i = 0; i < range.set.length; ++i) {
        const comparators = range.set[i];
        let high = null;
        let low = null;
        comparators.forEach((comparator) => {
          if (comparator.semver === ANY) {
            comparator = new Comparator(">=0.0.0");
          }
          high = high || comparator;
          low = low || comparator;
          if (gtfn(comparator.semver, high.semver, options)) {
            high = comparator;
          } else if (ltfn(comparator.semver, low.semver, options)) {
            low = comparator;
          }
        });
        if (high.operator === comp || high.operator === ecomp) {
          return false;
        }
        if ((!low.operator || low.operator === comp) && ltefn(version2, low.semver)) {
          return false;
        } else if (low.operator === ecomp && ltfn(version2, low.semver)) {
          return false;
        }
      }
      return true;
    };
    module2.exports = outside;
  }
});

// node_modules/semver/ranges/gtr.js
var require_gtr = __commonJS({
  "node_modules/semver/ranges/gtr.js"(exports2, module2) {
    "use strict";
    var outside = require_outside();
    var gtr = (version2, range, options) => outside(version2, range, ">", options);
    module2.exports = gtr;
  }
});

// node_modules/semver/ranges/ltr.js
var require_ltr = __commonJS({
  "node_modules/semver/ranges/ltr.js"(exports2, module2) {
    "use strict";
    var outside = require_outside();
    var ltr = (version2, range, options) => outside(version2, range, "<", options);
    module2.exports = ltr;
  }
});

// node_modules/semver/ranges/intersects.js
var require_intersects = __commonJS({
  "node_modules/semver/ranges/intersects.js"(exports2, module2) {
    "use strict";
    var Range = require_range();
    var intersects = (r1, r2, options) => {
      r1 = new Range(r1, options);
      r2 = new Range(r2, options);
      return r1.intersects(r2, options);
    };
    module2.exports = intersects;
  }
});

// node_modules/semver/ranges/simplify.js
var require_simplify = __commonJS({
  "node_modules/semver/ranges/simplify.js"(exports2, module2) {
    "use strict";
    var satisfies = require_satisfies();
    var compare = require_compare();
    module2.exports = (versions, range, options) => {
      const set = [];
      let first = null;
      let prev = null;
      const v = versions.sort((a, b) => compare(a, b, options));
      for (const version2 of v) {
        const included = satisfies(version2, range, options);
        if (included) {
          prev = version2;
          if (!first) {
            first = version2;
          }
        } else {
          if (prev) {
            set.push([first, prev]);
          }
          prev = null;
          first = null;
        }
      }
      if (first) {
        set.push([first, null]);
      }
      const ranges = [];
      for (const [min, max] of set) {
        if (min === max) {
          ranges.push(min);
        } else if (!max && min === v[0]) {
          ranges.push("*");
        } else if (!max) {
          ranges.push(`>=${min}`);
        } else if (min === v[0]) {
          ranges.push(`<=${max}`);
        } else {
          ranges.push(`${min} - ${max}`);
        }
      }
      const simplified = ranges.join(" || ");
      const original = typeof range.raw === "string" ? range.raw : String(range);
      return simplified.length < original.length ? simplified : range;
    };
  }
});

// node_modules/semver/ranges/subset.js
var require_subset = __commonJS({
  "node_modules/semver/ranges/subset.js"(exports2, module2) {
    "use strict";
    var Range = require_range();
    var Comparator = require_comparator();
    var { ANY } = Comparator;
    var satisfies = require_satisfies();
    var compare = require_compare();
    var subset = (sub, dom, options = {}) => {
      if (sub === dom) {
        return true;
      }
      sub = new Range(sub, options);
      dom = new Range(dom, options);
      let sawNonNull = false;
      OUTER: for (const simpleSub of sub.set) {
        for (const simpleDom of dom.set) {
          const isSub = simpleSubset(simpleSub, simpleDom, options);
          sawNonNull = sawNonNull || isSub !== null;
          if (isSub) {
            continue OUTER;
          }
        }
        if (sawNonNull) {
          return false;
        }
      }
      return true;
    };
    var minimumVersionWithPreRelease = [new Comparator(">=0.0.0-0")];
    var minimumVersion = [new Comparator(">=0.0.0")];
    var simpleSubset = (sub, dom, options) => {
      if (sub === dom) {
        return true;
      }
      if (sub.length === 1 && sub[0].semver === ANY) {
        if (dom.length === 1 && dom[0].semver === ANY) {
          return true;
        } else if (options.includePrerelease) {
          sub = minimumVersionWithPreRelease;
        } else {
          sub = minimumVersion;
        }
      }
      if (dom.length === 1 && dom[0].semver === ANY) {
        if (options.includePrerelease) {
          return true;
        } else {
          dom = minimumVersion;
        }
      }
      const eqSet = /* @__PURE__ */ new Set();
      let gt, lt;
      for (const c of sub) {
        if (c.operator === ">" || c.operator === ">=") {
          gt = higherGT(gt, c, options);
        } else if (c.operator === "<" || c.operator === "<=") {
          lt = lowerLT(lt, c, options);
        } else {
          eqSet.add(c.semver);
        }
      }
      if (eqSet.size > 1) {
        return null;
      }
      let gtltComp;
      if (gt && lt) {
        gtltComp = compare(gt.semver, lt.semver, options);
        if (gtltComp > 0) {
          return null;
        } else if (gtltComp === 0 && (gt.operator !== ">=" || lt.operator !== "<=")) {
          return null;
        }
      }
      for (const eq of eqSet) {
        if (gt && !satisfies(eq, String(gt), options)) {
          return null;
        }
        if (lt && !satisfies(eq, String(lt), options)) {
          return null;
        }
        for (const c of dom) {
          if (!satisfies(eq, String(c), options)) {
            return false;
          }
        }
        return true;
      }
      let higher, lower;
      let hasDomLT, hasDomGT;
      let needDomLTPre = lt && !options.includePrerelease && lt.semver.prerelease.length ? lt.semver : false;
      let needDomGTPre = gt && !options.includePrerelease && gt.semver.prerelease.length ? gt.semver : false;
      if (needDomLTPre && needDomLTPre.prerelease.length === 1 && lt.operator === "<" && needDomLTPre.prerelease[0] === 0) {
        needDomLTPre = false;
      }
      for (const c of dom) {
        hasDomGT = hasDomGT || c.operator === ">" || c.operator === ">=";
        hasDomLT = hasDomLT || c.operator === "<" || c.operator === "<=";
        if (gt) {
          if (needDomGTPre) {
            if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomGTPre.major && c.semver.minor === needDomGTPre.minor && c.semver.patch === needDomGTPre.patch) {
              needDomGTPre = false;
            }
          }
          if (c.operator === ">" || c.operator === ">=") {
            higher = higherGT(gt, c, options);
            if (higher === c && higher !== gt) {
              return false;
            }
          } else if (gt.operator === ">=" && !satisfies(gt.semver, String(c), options)) {
            return false;
          }
        }
        if (lt) {
          if (needDomLTPre) {
            if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomLTPre.major && c.semver.minor === needDomLTPre.minor && c.semver.patch === needDomLTPre.patch) {
              needDomLTPre = false;
            }
          }
          if (c.operator === "<" || c.operator === "<=") {
            lower = lowerLT(lt, c, options);
            if (lower === c && lower !== lt) {
              return false;
            }
          } else if (lt.operator === "<=" && !satisfies(lt.semver, String(c), options)) {
            return false;
          }
        }
        if (!c.operator && (lt || gt) && gtltComp !== 0) {
          return false;
        }
      }
      if (gt && hasDomLT && !lt && gtltComp !== 0) {
        return false;
      }
      if (lt && hasDomGT && !gt && gtltComp !== 0) {
        return false;
      }
      if (needDomGTPre || needDomLTPre) {
        return false;
      }
      return true;
    };
    var higherGT = (a, b, options) => {
      if (!a) {
        return b;
      }
      const comp = compare(a.semver, b.semver, options);
      return comp > 0 ? a : comp < 0 ? b : b.operator === ">" && a.operator === ">=" ? b : a;
    };
    var lowerLT = (a, b, options) => {
      if (!a) {
        return b;
      }
      const comp = compare(a.semver, b.semver, options);
      return comp < 0 ? a : comp > 0 ? b : b.operator === "<" && a.operator === "<=" ? b : a;
    };
    module2.exports = subset;
  }
});

// node_modules/semver/index.js
var require_semver2 = __commonJS({
  "node_modules/semver/index.js"(exports2, module2) {
    "use strict";
    var internalRe = require_re();
    var constants = require_constants();
    var SemVer = require_semver();
    var identifiers = require_identifiers();
    var parse2 = require_parse();
    var valid = require_valid();
    var clean = require_clean();
    var inc = require_inc();
    var diff = require_diff();
    var major = require_major();
    var minor = require_minor();
    var patch = require_patch();
    var prerelease = require_prerelease();
    var compare = require_compare();
    var rcompare = require_rcompare();
    var compareLoose = require_compare_loose();
    var compareBuild = require_compare_build();
    var sort = require_sort();
    var rsort = require_rsort();
    var gt = require_gt();
    var lt = require_lt();
    var eq = require_eq();
    var neq = require_neq();
    var gte = require_gte();
    var lte = require_lte();
    var cmp = require_cmp();
    var coerce = require_coerce();
    var Comparator = require_comparator();
    var Range = require_range();
    var satisfies = require_satisfies();
    var toComparators = require_to_comparators();
    var maxSatisfying = require_max_satisfying();
    var minSatisfying = require_min_satisfying();
    var minVersion = require_min_version();
    var validRange = require_valid2();
    var outside = require_outside();
    var gtr = require_gtr();
    var ltr = require_ltr();
    var intersects = require_intersects();
    var simplifyRange = require_simplify();
    var subset = require_subset();
    module2.exports = {
      parse: parse2,
      valid,
      clean,
      inc,
      diff,
      major,
      minor,
      patch,
      prerelease,
      compare,
      rcompare,
      compareLoose,
      compareBuild,
      sort,
      rsort,
      gt,
      lt,
      eq,
      neq,
      gte,
      lte,
      cmp,
      coerce,
      Comparator,
      Range,
      satisfies,
      toComparators,
      maxSatisfying,
      minSatisfying,
      minVersion,
      validRange,
      outside,
      gtr,
      ltr,
      intersects,
      simplifyRange,
      subset,
      SemVer,
      re: internalRe.re,
      src: internalRe.src,
      tokens: internalRe.t,
      SEMVER_SPEC_VERSION: constants.SEMVER_SPEC_VERSION,
      RELEASE_TYPES: constants.RELEASE_TYPES,
      compareIdentifiers: identifiers.compareIdentifiers,
      rcompareIdentifiers: identifiers.rcompareIdentifiers
    };
  }
});

// node_modules/jsonwebtoken/lib/asymmetricKeyDetailsSupported.js
var require_asymmetricKeyDetailsSupported = __commonJS({
  "node_modules/jsonwebtoken/lib/asymmetricKeyDetailsSupported.js"(exports2, module2) {
    var semver = require_semver2();
    module2.exports = semver.satisfies(process.version, ">=15.7.0");
  }
});

// node_modules/jsonwebtoken/lib/rsaPssKeyDetailsSupported.js
var require_rsaPssKeyDetailsSupported = __commonJS({
  "node_modules/jsonwebtoken/lib/rsaPssKeyDetailsSupported.js"(exports2, module2) {
    var semver = require_semver2();
    module2.exports = semver.satisfies(process.version, ">=16.9.0");
  }
});

// node_modules/jsonwebtoken/lib/validateAsymmetricKey.js
var require_validateAsymmetricKey = __commonJS({
  "node_modules/jsonwebtoken/lib/validateAsymmetricKey.js"(exports2, module2) {
    var ASYMMETRIC_KEY_DETAILS_SUPPORTED = require_asymmetricKeyDetailsSupported();
    var RSA_PSS_KEY_DETAILS_SUPPORTED = require_rsaPssKeyDetailsSupported();
    var allowedAlgorithmsForKeys = {
      "ec": ["ES256", "ES384", "ES512"],
      "rsa": ["RS256", "PS256", "RS384", "PS384", "RS512", "PS512"],
      "rsa-pss": ["PS256", "PS384", "PS512"]
    };
    var allowedCurves = {
      ES256: "prime256v1",
      ES384: "secp384r1",
      ES512: "secp521r1"
    };
    module2.exports = function(algorithm, key) {
      if (!algorithm || !key) return;
      const keyType = key.asymmetricKeyType;
      if (!keyType) return;
      const allowedAlgorithms = allowedAlgorithmsForKeys[keyType];
      if (!allowedAlgorithms) {
        throw new Error(`Unknown key type "${keyType}".`);
      }
      if (!allowedAlgorithms.includes(algorithm)) {
        throw new Error(`"alg" parameter for "${keyType}" key type must be one of: ${allowedAlgorithms.join(", ")}.`);
      }
      if (ASYMMETRIC_KEY_DETAILS_SUPPORTED) {
        switch (keyType) {
          case "ec":
            const keyCurve = key.asymmetricKeyDetails.namedCurve;
            const allowedCurve = allowedCurves[algorithm];
            if (keyCurve !== allowedCurve) {
              throw new Error(`"alg" parameter "${algorithm}" requires curve "${allowedCurve}".`);
            }
            break;
          case "rsa-pss":
            if (RSA_PSS_KEY_DETAILS_SUPPORTED) {
              const length = parseInt(algorithm.slice(-3), 10);
              const { hashAlgorithm, mgf1HashAlgorithm, saltLength } = key.asymmetricKeyDetails;
              if (hashAlgorithm !== `sha${length}` || mgf1HashAlgorithm !== hashAlgorithm) {
                throw new Error(`Invalid key for this operation, its RSA-PSS parameters do not meet the requirements of "alg" ${algorithm}.`);
              }
              if (saltLength !== void 0 && saltLength > length >> 3) {
                throw new Error(`Invalid key for this operation, its RSA-PSS parameter saltLength does not meet the requirements of "alg" ${algorithm}.`);
              }
            }
            break;
        }
      }
    };
  }
});

// node_modules/jsonwebtoken/lib/psSupported.js
var require_psSupported = __commonJS({
  "node_modules/jsonwebtoken/lib/psSupported.js"(exports2, module2) {
    var semver = require_semver2();
    module2.exports = semver.satisfies(process.version, "^6.12.0 || >=8.0.0");
  }
});

// node_modules/jsonwebtoken/verify.js
var require_verify = __commonJS({
  "node_modules/jsonwebtoken/verify.js"(exports2, module2) {
    var JsonWebTokenError = require_JsonWebTokenError();
    var NotBeforeError = require_NotBeforeError();
    var TokenExpiredError = require_TokenExpiredError();
    var decode = require_decode();
    var timespan = require_timespan();
    var validateAsymmetricKey = require_validateAsymmetricKey();
    var PS_SUPPORTED = require_psSupported();
    var jws = require_jws();
    var { KeyObject, createSecretKey, createPublicKey } = require("crypto");
    var PUB_KEY_ALGS = ["RS256", "RS384", "RS512"];
    var EC_KEY_ALGS = ["ES256", "ES384", "ES512"];
    var RSA_KEY_ALGS = ["RS256", "RS384", "RS512"];
    var HS_ALGS = ["HS256", "HS384", "HS512"];
    if (PS_SUPPORTED) {
      PUB_KEY_ALGS.splice(PUB_KEY_ALGS.length, 0, "PS256", "PS384", "PS512");
      RSA_KEY_ALGS.splice(RSA_KEY_ALGS.length, 0, "PS256", "PS384", "PS512");
    }
    module2.exports = function(jwtString, secretOrPublicKey, options, callback) {
      if (typeof options === "function" && !callback) {
        callback = options;
        options = {};
      }
      if (!options) {
        options = {};
      }
      options = Object.assign({}, options);
      let done;
      if (callback) {
        done = callback;
      } else {
        done = function(err, data) {
          if (err) throw err;
          return data;
        };
      }
      if (options.clockTimestamp && typeof options.clockTimestamp !== "number") {
        return done(new JsonWebTokenError("clockTimestamp must be a number"));
      }
      if (options.nonce !== void 0 && (typeof options.nonce !== "string" || options.nonce.trim() === "")) {
        return done(new JsonWebTokenError("nonce must be a non-empty string"));
      }
      if (options.allowInvalidAsymmetricKeyTypes !== void 0 && typeof options.allowInvalidAsymmetricKeyTypes !== "boolean") {
        return done(new JsonWebTokenError("allowInvalidAsymmetricKeyTypes must be a boolean"));
      }
      const clockTimestamp = options.clockTimestamp || Math.floor(Date.now() / 1e3);
      if (!jwtString) {
        return done(new JsonWebTokenError("jwt must be provided"));
      }
      if (typeof jwtString !== "string") {
        return done(new JsonWebTokenError("jwt must be a string"));
      }
      const parts = jwtString.split(".");
      if (parts.length !== 3) {
        return done(new JsonWebTokenError("jwt malformed"));
      }
      let decodedToken;
      try {
        decodedToken = decode(jwtString, { complete: true });
      } catch (err) {
        return done(err);
      }
      if (!decodedToken) {
        return done(new JsonWebTokenError("invalid token"));
      }
      const header = decodedToken.header;
      let getSecret;
      if (typeof secretOrPublicKey === "function") {
        if (!callback) {
          return done(new JsonWebTokenError("verify must be called asynchronous if secret or public key is provided as a callback"));
        }
        getSecret = secretOrPublicKey;
      } else {
        getSecret = function(header2, secretCallback) {
          return secretCallback(null, secretOrPublicKey);
        };
      }
      return getSecret(header, function(err, secretOrPublicKey2) {
        if (err) {
          return done(new JsonWebTokenError("error in secret or public key callback: " + err.message));
        }
        const hasSignature = parts[2].trim() !== "";
        if (!hasSignature && secretOrPublicKey2) {
          return done(new JsonWebTokenError("jwt signature is required"));
        }
        if (hasSignature && !secretOrPublicKey2) {
          return done(new JsonWebTokenError("secret or public key must be provided"));
        }
        if (!hasSignature && !options.algorithms) {
          return done(new JsonWebTokenError('please specify "none" in "algorithms" to verify unsigned tokens'));
        }
        if (secretOrPublicKey2 != null && !(secretOrPublicKey2 instanceof KeyObject)) {
          try {
            secretOrPublicKey2 = createPublicKey(secretOrPublicKey2);
          } catch (_) {
            try {
              secretOrPublicKey2 = createSecretKey(typeof secretOrPublicKey2 === "string" ? Buffer.from(secretOrPublicKey2) : secretOrPublicKey2);
            } catch (_2) {
              return done(new JsonWebTokenError("secretOrPublicKey is not valid key material"));
            }
          }
        }
        if (!options.algorithms) {
          if (secretOrPublicKey2.type === "secret") {
            options.algorithms = HS_ALGS;
          } else if (["rsa", "rsa-pss"].includes(secretOrPublicKey2.asymmetricKeyType)) {
            options.algorithms = RSA_KEY_ALGS;
          } else if (secretOrPublicKey2.asymmetricKeyType === "ec") {
            options.algorithms = EC_KEY_ALGS;
          } else {
            options.algorithms = PUB_KEY_ALGS;
          }
        }
        if (options.algorithms.indexOf(decodedToken.header.alg) === -1) {
          return done(new JsonWebTokenError("invalid algorithm"));
        }
        if (header.alg.startsWith("HS") && secretOrPublicKey2.type !== "secret") {
          return done(new JsonWebTokenError(`secretOrPublicKey must be a symmetric key when using ${header.alg}`));
        } else if (/^(?:RS|PS|ES)/.test(header.alg) && secretOrPublicKey2.type !== "public") {
          return done(new JsonWebTokenError(`secretOrPublicKey must be an asymmetric key when using ${header.alg}`));
        }
        if (!options.allowInvalidAsymmetricKeyTypes) {
          try {
            validateAsymmetricKey(header.alg, secretOrPublicKey2);
          } catch (e) {
            return done(e);
          }
        }
        let valid;
        try {
          valid = jws.verify(jwtString, decodedToken.header.alg, secretOrPublicKey2);
        } catch (e) {
          return done(e);
        }
        if (!valid) {
          return done(new JsonWebTokenError("invalid signature"));
        }
        const payload = decodedToken.payload;
        if (typeof payload.nbf !== "undefined" && !options.ignoreNotBefore) {
          if (typeof payload.nbf !== "number") {
            return done(new JsonWebTokenError("invalid nbf value"));
          }
          if (payload.nbf > clockTimestamp + (options.clockTolerance || 0)) {
            return done(new NotBeforeError("jwt not active", new Date(payload.nbf * 1e3)));
          }
        }
        if (typeof payload.exp !== "undefined" && !options.ignoreExpiration) {
          if (typeof payload.exp !== "number") {
            return done(new JsonWebTokenError("invalid exp value"));
          }
          if (clockTimestamp >= payload.exp + (options.clockTolerance || 0)) {
            return done(new TokenExpiredError("jwt expired", new Date(payload.exp * 1e3)));
          }
        }
        if (options.audience) {
          const audiences = Array.isArray(options.audience) ? options.audience : [options.audience];
          const target = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
          const match = target.some(function(targetAudience) {
            return audiences.some(function(audience) {
              return audience instanceof RegExp ? audience.test(targetAudience) : audience === targetAudience;
            });
          });
          if (!match) {
            return done(new JsonWebTokenError("jwt audience invalid. expected: " + audiences.join(" or ")));
          }
        }
        if (options.issuer) {
          const invalid_issuer = typeof options.issuer === "string" && payload.iss !== options.issuer || Array.isArray(options.issuer) && options.issuer.indexOf(payload.iss) === -1;
          if (invalid_issuer) {
            return done(new JsonWebTokenError("jwt issuer invalid. expected: " + options.issuer));
          }
        }
        if (options.subject) {
          if (payload.sub !== options.subject) {
            return done(new JsonWebTokenError("jwt subject invalid. expected: " + options.subject));
          }
        }
        if (options.jwtid) {
          if (payload.jti !== options.jwtid) {
            return done(new JsonWebTokenError("jwt jwtid invalid. expected: " + options.jwtid));
          }
        }
        if (options.nonce) {
          if (payload.nonce !== options.nonce) {
            return done(new JsonWebTokenError("jwt nonce invalid. expected: " + options.nonce));
          }
        }
        if (options.maxAge) {
          if (typeof payload.iat !== "number") {
            return done(new JsonWebTokenError("iat required when maxAge is specified"));
          }
          const maxAgeTimestamp = timespan(options.maxAge, payload.iat);
          if (typeof maxAgeTimestamp === "undefined") {
            return done(new JsonWebTokenError('"maxAge" should be a number of seconds or string representing a timespan eg: "1d", "20h", 60'));
          }
          if (clockTimestamp >= maxAgeTimestamp + (options.clockTolerance || 0)) {
            return done(new TokenExpiredError("maxAge exceeded", new Date(maxAgeTimestamp * 1e3)));
          }
        }
        if (options.complete === true) {
          const signature = decodedToken.signature;
          return done(null, {
            header,
            payload,
            signature
          });
        }
        return done(null, payload);
      });
    };
  }
});

// node_modules/lodash.includes/index.js
var require_lodash = __commonJS({
  "node_modules/lodash.includes/index.js"(exports2, module2) {
    var INFINITY = 1 / 0;
    var MAX_SAFE_INTEGER = 9007199254740991;
    var MAX_INTEGER = 17976931348623157e292;
    var NAN = 0 / 0;
    var argsTag = "[object Arguments]";
    var funcTag = "[object Function]";
    var genTag = "[object GeneratorFunction]";
    var stringTag = "[object String]";
    var symbolTag = "[object Symbol]";
    var reTrim = /^\s+|\s+$/g;
    var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
    var reIsBinary = /^0b[01]+$/i;
    var reIsOctal = /^0o[0-7]+$/i;
    var reIsUint = /^(?:0|[1-9]\d*)$/;
    var freeParseInt = parseInt;
    function arrayMap(array, iteratee) {
      var index = -1, length = array ? array.length : 0, result = Array(length);
      while (++index < length) {
        result[index] = iteratee(array[index], index, array);
      }
      return result;
    }
    function baseFindIndex(array, predicate, fromIndex, fromRight) {
      var length = array.length, index = fromIndex + (fromRight ? 1 : -1);
      while (fromRight ? index-- : ++index < length) {
        if (predicate(array[index], index, array)) {
          return index;
        }
      }
      return -1;
    }
    function baseIndexOf(array, value, fromIndex) {
      if (value !== value) {
        return baseFindIndex(array, baseIsNaN, fromIndex);
      }
      var index = fromIndex - 1, length = array.length;
      while (++index < length) {
        if (array[index] === value) {
          return index;
        }
      }
      return -1;
    }
    function baseIsNaN(value) {
      return value !== value;
    }
    function baseTimes(n, iteratee) {
      var index = -1, result = Array(n);
      while (++index < n) {
        result[index] = iteratee(index);
      }
      return result;
    }
    function baseValues(object, props) {
      return arrayMap(props, function(key) {
        return object[key];
      });
    }
    function overArg(func, transform) {
      return function(arg) {
        return func(transform(arg));
      };
    }
    var objectProto = Object.prototype;
    var hasOwnProperty = objectProto.hasOwnProperty;
    var objectToString = objectProto.toString;
    var propertyIsEnumerable = objectProto.propertyIsEnumerable;
    var nativeKeys = overArg(Object.keys, Object);
    var nativeMax = Math.max;
    function arrayLikeKeys(value, inherited) {
      var result = isArray(value) || isArguments(value) ? baseTimes(value.length, String) : [];
      var length = result.length, skipIndexes = !!length;
      for (var key in value) {
        if ((inherited || hasOwnProperty.call(value, key)) && !(skipIndexes && (key == "length" || isIndex(key, length)))) {
          result.push(key);
        }
      }
      return result;
    }
    function baseKeys(object) {
      if (!isPrototype(object)) {
        return nativeKeys(object);
      }
      var result = [];
      for (var key in Object(object)) {
        if (hasOwnProperty.call(object, key) && key != "constructor") {
          result.push(key);
        }
      }
      return result;
    }
    function isIndex(value, length) {
      length = length == null ? MAX_SAFE_INTEGER : length;
      return !!length && (typeof value == "number" || reIsUint.test(value)) && (value > -1 && value % 1 == 0 && value < length);
    }
    function isPrototype(value) {
      var Ctor = value && value.constructor, proto = typeof Ctor == "function" && Ctor.prototype || objectProto;
      return value === proto;
    }
    function includes(collection, value, fromIndex, guard) {
      collection = isArrayLike(collection) ? collection : values(collection);
      fromIndex = fromIndex && !guard ? toInteger(fromIndex) : 0;
      var length = collection.length;
      if (fromIndex < 0) {
        fromIndex = nativeMax(length + fromIndex, 0);
      }
      return isString(collection) ? fromIndex <= length && collection.indexOf(value, fromIndex) > -1 : !!length && baseIndexOf(collection, value, fromIndex) > -1;
    }
    function isArguments(value) {
      return isArrayLikeObject(value) && hasOwnProperty.call(value, "callee") && (!propertyIsEnumerable.call(value, "callee") || objectToString.call(value) == argsTag);
    }
    var isArray = Array.isArray;
    function isArrayLike(value) {
      return value != null && isLength(value.length) && !isFunction(value);
    }
    function isArrayLikeObject(value) {
      return isObjectLike(value) && isArrayLike(value);
    }
    function isFunction(value) {
      var tag = isObject(value) ? objectToString.call(value) : "";
      return tag == funcTag || tag == genTag;
    }
    function isLength(value) {
      return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
    }
    function isObject(value) {
      var type = typeof value;
      return !!value && (type == "object" || type == "function");
    }
    function isObjectLike(value) {
      return !!value && typeof value == "object";
    }
    function isString(value) {
      return typeof value == "string" || !isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag;
    }
    function isSymbol(value) {
      return typeof value == "symbol" || isObjectLike(value) && objectToString.call(value) == symbolTag;
    }
    function toFinite(value) {
      if (!value) {
        return value === 0 ? value : 0;
      }
      value = toNumber(value);
      if (value === INFINITY || value === -INFINITY) {
        var sign = value < 0 ? -1 : 1;
        return sign * MAX_INTEGER;
      }
      return value === value ? value : 0;
    }
    function toInteger(value) {
      var result = toFinite(value), remainder = result % 1;
      return result === result ? remainder ? result - remainder : result : 0;
    }
    function toNumber(value) {
      if (typeof value == "number") {
        return value;
      }
      if (isSymbol(value)) {
        return NAN;
      }
      if (isObject(value)) {
        var other = typeof value.valueOf == "function" ? value.valueOf() : value;
        value = isObject(other) ? other + "" : other;
      }
      if (typeof value != "string") {
        return value === 0 ? value : +value;
      }
      value = value.replace(reTrim, "");
      var isBinary = reIsBinary.test(value);
      return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
    }
    function keys(object) {
      return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
    }
    function values(object) {
      return object ? baseValues(object, keys(object)) : [];
    }
    module2.exports = includes;
  }
});

// node_modules/lodash.isboolean/index.js
var require_lodash2 = __commonJS({
  "node_modules/lodash.isboolean/index.js"(exports2, module2) {
    var boolTag = "[object Boolean]";
    var objectProto = Object.prototype;
    var objectToString = objectProto.toString;
    function isBoolean(value) {
      return value === true || value === false || isObjectLike(value) && objectToString.call(value) == boolTag;
    }
    function isObjectLike(value) {
      return !!value && typeof value == "object";
    }
    module2.exports = isBoolean;
  }
});

// node_modules/lodash.isinteger/index.js
var require_lodash3 = __commonJS({
  "node_modules/lodash.isinteger/index.js"(exports2, module2) {
    var INFINITY = 1 / 0;
    var MAX_INTEGER = 17976931348623157e292;
    var NAN = 0 / 0;
    var symbolTag = "[object Symbol]";
    var reTrim = /^\s+|\s+$/g;
    var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
    var reIsBinary = /^0b[01]+$/i;
    var reIsOctal = /^0o[0-7]+$/i;
    var freeParseInt = parseInt;
    var objectProto = Object.prototype;
    var objectToString = objectProto.toString;
    function isInteger(value) {
      return typeof value == "number" && value == toInteger(value);
    }
    function isObject(value) {
      var type = typeof value;
      return !!value && (type == "object" || type == "function");
    }
    function isObjectLike(value) {
      return !!value && typeof value == "object";
    }
    function isSymbol(value) {
      return typeof value == "symbol" || isObjectLike(value) && objectToString.call(value) == symbolTag;
    }
    function toFinite(value) {
      if (!value) {
        return value === 0 ? value : 0;
      }
      value = toNumber(value);
      if (value === INFINITY || value === -INFINITY) {
        var sign = value < 0 ? -1 : 1;
        return sign * MAX_INTEGER;
      }
      return value === value ? value : 0;
    }
    function toInteger(value) {
      var result = toFinite(value), remainder = result % 1;
      return result === result ? remainder ? result - remainder : result : 0;
    }
    function toNumber(value) {
      if (typeof value == "number") {
        return value;
      }
      if (isSymbol(value)) {
        return NAN;
      }
      if (isObject(value)) {
        var other = typeof value.valueOf == "function" ? value.valueOf() : value;
        value = isObject(other) ? other + "" : other;
      }
      if (typeof value != "string") {
        return value === 0 ? value : +value;
      }
      value = value.replace(reTrim, "");
      var isBinary = reIsBinary.test(value);
      return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
    }
    module2.exports = isInteger;
  }
});

// node_modules/lodash.isnumber/index.js
var require_lodash4 = __commonJS({
  "node_modules/lodash.isnumber/index.js"(exports2, module2) {
    var numberTag = "[object Number]";
    var objectProto = Object.prototype;
    var objectToString = objectProto.toString;
    function isObjectLike(value) {
      return !!value && typeof value == "object";
    }
    function isNumber(value) {
      return typeof value == "number" || isObjectLike(value) && objectToString.call(value) == numberTag;
    }
    module2.exports = isNumber;
  }
});

// node_modules/lodash.isplainobject/index.js
var require_lodash5 = __commonJS({
  "node_modules/lodash.isplainobject/index.js"(exports2, module2) {
    var objectTag = "[object Object]";
    function isHostObject(value) {
      var result = false;
      if (value != null && typeof value.toString != "function") {
        try {
          result = !!(value + "");
        } catch (e) {
        }
      }
      return result;
    }
    function overArg(func, transform) {
      return function(arg) {
        return func(transform(arg));
      };
    }
    var funcProto = Function.prototype;
    var objectProto = Object.prototype;
    var funcToString = funcProto.toString;
    var hasOwnProperty = objectProto.hasOwnProperty;
    var objectCtorString = funcToString.call(Object);
    var objectToString = objectProto.toString;
    var getPrototype = overArg(Object.getPrototypeOf, Object);
    function isObjectLike(value) {
      return !!value && typeof value == "object";
    }
    function isPlainObject(value) {
      if (!isObjectLike(value) || objectToString.call(value) != objectTag || isHostObject(value)) {
        return false;
      }
      var proto = getPrototype(value);
      if (proto === null) {
        return true;
      }
      var Ctor = hasOwnProperty.call(proto, "constructor") && proto.constructor;
      return typeof Ctor == "function" && Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString;
    }
    module2.exports = isPlainObject;
  }
});

// node_modules/lodash.isstring/index.js
var require_lodash6 = __commonJS({
  "node_modules/lodash.isstring/index.js"(exports2, module2) {
    var stringTag = "[object String]";
    var objectProto = Object.prototype;
    var objectToString = objectProto.toString;
    var isArray = Array.isArray;
    function isObjectLike(value) {
      return !!value && typeof value == "object";
    }
    function isString(value) {
      return typeof value == "string" || !isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag;
    }
    module2.exports = isString;
  }
});

// node_modules/lodash.once/index.js
var require_lodash7 = __commonJS({
  "node_modules/lodash.once/index.js"(exports2, module2) {
    var FUNC_ERROR_TEXT = "Expected a function";
    var INFINITY = 1 / 0;
    var MAX_INTEGER = 17976931348623157e292;
    var NAN = 0 / 0;
    var symbolTag = "[object Symbol]";
    var reTrim = /^\s+|\s+$/g;
    var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
    var reIsBinary = /^0b[01]+$/i;
    var reIsOctal = /^0o[0-7]+$/i;
    var freeParseInt = parseInt;
    var objectProto = Object.prototype;
    var objectToString = objectProto.toString;
    function before(n, func) {
      var result;
      if (typeof func != "function") {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      n = toInteger(n);
      return function() {
        if (--n > 0) {
          result = func.apply(this, arguments);
        }
        if (n <= 1) {
          func = void 0;
        }
        return result;
      };
    }
    function once(func) {
      return before(2, func);
    }
    function isObject(value) {
      var type = typeof value;
      return !!value && (type == "object" || type == "function");
    }
    function isObjectLike(value) {
      return !!value && typeof value == "object";
    }
    function isSymbol(value) {
      return typeof value == "symbol" || isObjectLike(value) && objectToString.call(value) == symbolTag;
    }
    function toFinite(value) {
      if (!value) {
        return value === 0 ? value : 0;
      }
      value = toNumber(value);
      if (value === INFINITY || value === -INFINITY) {
        var sign = value < 0 ? -1 : 1;
        return sign * MAX_INTEGER;
      }
      return value === value ? value : 0;
    }
    function toInteger(value) {
      var result = toFinite(value), remainder = result % 1;
      return result === result ? remainder ? result - remainder : result : 0;
    }
    function toNumber(value) {
      if (typeof value == "number") {
        return value;
      }
      if (isSymbol(value)) {
        return NAN;
      }
      if (isObject(value)) {
        var other = typeof value.valueOf == "function" ? value.valueOf() : value;
        value = isObject(other) ? other + "" : other;
      }
      if (typeof value != "string") {
        return value === 0 ? value : +value;
      }
      value = value.replace(reTrim, "");
      var isBinary = reIsBinary.test(value);
      return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
    }
    module2.exports = once;
  }
});

// node_modules/jsonwebtoken/sign.js
var require_sign = __commonJS({
  "node_modules/jsonwebtoken/sign.js"(exports2, module2) {
    var timespan = require_timespan();
    var PS_SUPPORTED = require_psSupported();
    var validateAsymmetricKey = require_validateAsymmetricKey();
    var jws = require_jws();
    var includes = require_lodash();
    var isBoolean = require_lodash2();
    var isInteger = require_lodash3();
    var isNumber = require_lodash4();
    var isPlainObject = require_lodash5();
    var isString = require_lodash6();
    var once = require_lodash7();
    var { KeyObject, createSecretKey, createPrivateKey } = require("crypto");
    var SUPPORTED_ALGS = ["RS256", "RS384", "RS512", "ES256", "ES384", "ES512", "HS256", "HS384", "HS512", "none"];
    if (PS_SUPPORTED) {
      SUPPORTED_ALGS.splice(3, 0, "PS256", "PS384", "PS512");
    }
    var sign_options_schema = {
      expiresIn: { isValid: function(value) {
        return isInteger(value) || isString(value) && value;
      }, message: '"expiresIn" should be a number of seconds or string representing a timespan' },
      notBefore: { isValid: function(value) {
        return isInteger(value) || isString(value) && value;
      }, message: '"notBefore" should be a number of seconds or string representing a timespan' },
      audience: { isValid: function(value) {
        return isString(value) || Array.isArray(value);
      }, message: '"audience" must be a string or array' },
      algorithm: { isValid: includes.bind(null, SUPPORTED_ALGS), message: '"algorithm" must be a valid string enum value' },
      header: { isValid: isPlainObject, message: '"header" must be an object' },
      encoding: { isValid: isString, message: '"encoding" must be a string' },
      issuer: { isValid: isString, message: '"issuer" must be a string' },
      subject: { isValid: isString, message: '"subject" must be a string' },
      jwtid: { isValid: isString, message: '"jwtid" must be a string' },
      noTimestamp: { isValid: isBoolean, message: '"noTimestamp" must be a boolean' },
      keyid: { isValid: isString, message: '"keyid" must be a string' },
      mutatePayload: { isValid: isBoolean, message: '"mutatePayload" must be a boolean' },
      allowInsecureKeySizes: { isValid: isBoolean, message: '"allowInsecureKeySizes" must be a boolean' },
      allowInvalidAsymmetricKeyTypes: { isValid: isBoolean, message: '"allowInvalidAsymmetricKeyTypes" must be a boolean' }
    };
    var registered_claims_schema = {
      iat: { isValid: isNumber, message: '"iat" should be a number of seconds' },
      exp: { isValid: isNumber, message: '"exp" should be a number of seconds' },
      nbf: { isValid: isNumber, message: '"nbf" should be a number of seconds' }
    };
    function validate2(schema, allowUnknown, object, parameterName) {
      if (!isPlainObject(object)) {
        throw new Error('Expected "' + parameterName + '" to be a plain object.');
      }
      Object.keys(object).forEach(function(key) {
        const validator = schema[key];
        if (!validator) {
          if (!allowUnknown) {
            throw new Error('"' + key + '" is not allowed in "' + parameterName + '"');
          }
          return;
        }
        if (!validator.isValid(object[key])) {
          throw new Error(validator.message);
        }
      });
    }
    function validateOptions(options) {
      return validate2(sign_options_schema, false, options, "options");
    }
    function validatePayload(payload) {
      return validate2(registered_claims_schema, true, payload, "payload");
    }
    var options_to_payload = {
      "audience": "aud",
      "issuer": "iss",
      "subject": "sub",
      "jwtid": "jti"
    };
    var options_for_objects = [
      "expiresIn",
      "notBefore",
      "noTimestamp",
      "audience",
      "issuer",
      "subject",
      "jwtid"
    ];
    module2.exports = function(payload, secretOrPrivateKey, options, callback) {
      if (typeof options === "function") {
        callback = options;
        options = {};
      } else {
        options = options || {};
      }
      const isObjectPayload = typeof payload === "object" && !Buffer.isBuffer(payload);
      const header = Object.assign({
        alg: options.algorithm || "HS256",
        typ: isObjectPayload ? "JWT" : void 0,
        kid: options.keyid
      }, options.header);
      function failure(err) {
        if (callback) {
          return callback(err);
        }
        throw err;
      }
      if (!secretOrPrivateKey && options.algorithm !== "none") {
        return failure(new Error("secretOrPrivateKey must have a value"));
      }
      if (secretOrPrivateKey != null && !(secretOrPrivateKey instanceof KeyObject)) {
        try {
          secretOrPrivateKey = createPrivateKey(secretOrPrivateKey);
        } catch (_) {
          try {
            secretOrPrivateKey = createSecretKey(typeof secretOrPrivateKey === "string" ? Buffer.from(secretOrPrivateKey) : secretOrPrivateKey);
          } catch (_2) {
            return failure(new Error("secretOrPrivateKey is not valid key material"));
          }
        }
      }
      if (header.alg.startsWith("HS") && secretOrPrivateKey.type !== "secret") {
        return failure(new Error(`secretOrPrivateKey must be a symmetric key when using ${header.alg}`));
      } else if (/^(?:RS|PS|ES)/.test(header.alg)) {
        if (secretOrPrivateKey.type !== "private") {
          return failure(new Error(`secretOrPrivateKey must be an asymmetric key when using ${header.alg}`));
        }
        if (!options.allowInsecureKeySizes && !header.alg.startsWith("ES") && secretOrPrivateKey.asymmetricKeyDetails !== void 0 && //KeyObject.asymmetricKeyDetails is supported in Node 15+
        secretOrPrivateKey.asymmetricKeyDetails.modulusLength < 2048) {
          return failure(new Error(`secretOrPrivateKey has a minimum key size of 2048 bits for ${header.alg}`));
        }
      }
      if (typeof payload === "undefined") {
        return failure(new Error("payload is required"));
      } else if (isObjectPayload) {
        try {
          validatePayload(payload);
        } catch (error) {
          return failure(error);
        }
        if (!options.mutatePayload) {
          payload = Object.assign({}, payload);
        }
      } else {
        const invalid_options = options_for_objects.filter(function(opt) {
          return typeof options[opt] !== "undefined";
        });
        if (invalid_options.length > 0) {
          return failure(new Error("invalid " + invalid_options.join(",") + " option for " + typeof payload + " payload"));
        }
      }
      if (typeof payload.exp !== "undefined" && typeof options.expiresIn !== "undefined") {
        return failure(new Error('Bad "options.expiresIn" option the payload already has an "exp" property.'));
      }
      if (typeof payload.nbf !== "undefined" && typeof options.notBefore !== "undefined") {
        return failure(new Error('Bad "options.notBefore" option the payload already has an "nbf" property.'));
      }
      try {
        validateOptions(options);
      } catch (error) {
        return failure(error);
      }
      if (!options.allowInvalidAsymmetricKeyTypes) {
        try {
          validateAsymmetricKey(header.alg, secretOrPrivateKey);
        } catch (error) {
          return failure(error);
        }
      }
      const timestamp = payload.iat || Math.floor(Date.now() / 1e3);
      if (options.noTimestamp) {
        delete payload.iat;
      } else if (isObjectPayload) {
        payload.iat = timestamp;
      }
      if (typeof options.notBefore !== "undefined") {
        try {
          payload.nbf = timespan(options.notBefore, timestamp);
        } catch (err) {
          return failure(err);
        }
        if (typeof payload.nbf === "undefined") {
          return failure(new Error('"notBefore" should be a number of seconds or string representing a timespan eg: "1d", "20h", 60'));
        }
      }
      if (typeof options.expiresIn !== "undefined" && typeof payload === "object") {
        try {
          payload.exp = timespan(options.expiresIn, timestamp);
        } catch (err) {
          return failure(err);
        }
        if (typeof payload.exp === "undefined") {
          return failure(new Error('"expiresIn" should be a number of seconds or string representing a timespan eg: "1d", "20h", 60'));
        }
      }
      Object.keys(options_to_payload).forEach(function(key) {
        const claim = options_to_payload[key];
        if (typeof options[key] !== "undefined") {
          if (typeof payload[claim] !== "undefined") {
            return failure(new Error('Bad "options.' + key + '" option. The payload already has an "' + claim + '" property.'));
          }
          payload[claim] = options[key];
        }
      });
      const encoding = options.encoding || "utf8";
      if (typeof callback === "function") {
        callback = callback && once(callback);
        jws.createSign({
          header,
          privateKey: secretOrPrivateKey,
          payload,
          encoding
        }).once("error", callback).once("done", function(signature) {
          if (!options.allowInsecureKeySizes && /^(?:RS|PS)/.test(header.alg) && signature.length < 256) {
            return callback(new Error(`secretOrPrivateKey has a minimum key size of 2048 bits for ${header.alg}`));
          }
          callback(null, signature);
        });
      } else {
        let signature = jws.sign({ header, payload, secret: secretOrPrivateKey, encoding });
        if (!options.allowInsecureKeySizes && /^(?:RS|PS)/.test(header.alg) && signature.length < 256) {
          throw new Error(`secretOrPrivateKey has a minimum key size of 2048 bits for ${header.alg}`);
        }
        return signature;
      }
    };
  }
});

// node_modules/jsonwebtoken/index.js
var require_jsonwebtoken = __commonJS({
  "node_modules/jsonwebtoken/index.js"(exports2, module2) {
    module2.exports = {
      decode: require_decode(),
      verify: require_verify(),
      sign: require_sign(),
      JsonWebTokenError: require_JsonWebTokenError(),
      NotBeforeError: require_NotBeforeError(),
      TokenExpiredError: require_TokenExpiredError()
    };
  }
});

// node_modules/@azure/msal-node/lib/msal-node.cjs
var require_msal_node = __commonJS({
  "node_modules/@azure/msal-node/lib/msal-node.cjs"(exports2) {
    "use strict";
    var uuid = (init_esm_node(), __toCommonJS(esm_node_exports));
    var crypto4 = require("crypto");
    var jwt = require_jsonwebtoken();
    var http = require("http");
    var fs7 = require("fs");
    var path3 = require("path");
    var Serializer = class {
      /**
       * serialize the JSON blob
       * @param data - JSON blob cache
       */
      static serializeJSONBlob(data) {
        return JSON.stringify(data);
      }
      /**
       * Serialize Accounts
       * @param accCache - cache of accounts
       */
      static serializeAccounts(accCache) {
        const accounts = {};
        Object.keys(accCache).map(function(key) {
          const accountEntity = accCache[key];
          accounts[key] = {
            home_account_id: accountEntity.homeAccountId,
            environment: accountEntity.environment,
            realm: accountEntity.realm,
            local_account_id: accountEntity.localAccountId,
            username: accountEntity.username,
            authority_type: accountEntity.authorityType,
            name: accountEntity.name,
            client_info: accountEntity.clientInfo,
            last_modification_time: accountEntity.lastModificationTime,
            last_modification_app: accountEntity.lastModificationApp,
            tenantProfiles: accountEntity.tenantProfiles?.map((tenantProfile) => {
              return JSON.stringify(tenantProfile);
            })
          };
        });
        return accounts;
      }
      /**
       * Serialize IdTokens
       * @param idTCache - cache of ID tokens
       */
      static serializeIdTokens(idTCache) {
        const idTokens = {};
        Object.keys(idTCache).map(function(key) {
          const idTEntity = idTCache[key];
          idTokens[key] = {
            home_account_id: idTEntity.homeAccountId,
            environment: idTEntity.environment,
            credential_type: idTEntity.credentialType,
            client_id: idTEntity.clientId,
            secret: idTEntity.secret,
            realm: idTEntity.realm
          };
        });
        return idTokens;
      }
      /**
       * Serializes AccessTokens
       * @param atCache - cache of access tokens
       */
      static serializeAccessTokens(atCache) {
        const accessTokens = {};
        Object.keys(atCache).map(function(key) {
          const atEntity = atCache[key];
          accessTokens[key] = {
            home_account_id: atEntity.homeAccountId,
            environment: atEntity.environment,
            credential_type: atEntity.credentialType,
            client_id: atEntity.clientId,
            secret: atEntity.secret,
            realm: atEntity.realm,
            target: atEntity.target,
            cached_at: atEntity.cachedAt,
            expires_on: atEntity.expiresOn,
            extended_expires_on: atEntity.extendedExpiresOn,
            refresh_on: atEntity.refreshOn,
            key_id: atEntity.keyId,
            token_type: atEntity.tokenType,
            userAssertionHash: atEntity.userAssertionHash
          };
        });
        return accessTokens;
      }
      /**
       * Serialize refreshTokens
       * @param rtCache - cache of refresh tokens
       */
      static serializeRefreshTokens(rtCache) {
        const refreshTokens = {};
        Object.keys(rtCache).map(function(key) {
          const rtEntity = rtCache[key];
          refreshTokens[key] = {
            home_account_id: rtEntity.homeAccountId,
            environment: rtEntity.environment,
            credential_type: rtEntity.credentialType,
            client_id: rtEntity.clientId,
            secret: rtEntity.secret,
            family_id: rtEntity.familyId,
            target: rtEntity.target,
            realm: rtEntity.realm
          };
        });
        return refreshTokens;
      }
      /**
       * Serialize amdtCache
       * @param amdtCache - cache of app metadata
       */
      static serializeAppMetadata(amdtCache) {
        const appMetadata = {};
        Object.keys(amdtCache).map(function(key) {
          const amdtEntity = amdtCache[key];
          appMetadata[key] = {
            client_id: amdtEntity.clientId,
            environment: amdtEntity.environment,
            family_id: amdtEntity.familyId
          };
        });
        return appMetadata;
      }
      /**
       * Serialize the cache
       * @param inMemCache - itemised cache read from the JSON
       */
      static serializeAllCache(inMemCache) {
        return {
          Account: this.serializeAccounts(inMemCache.accounts),
          IdToken: this.serializeIdTokens(inMemCache.idTokens),
          AccessToken: this.serializeAccessTokens(inMemCache.accessTokens),
          RefreshToken: this.serializeRefreshTokens(inMemCache.refreshTokens),
          AppMetadata: this.serializeAppMetadata(inMemCache.appMetadata)
        };
      }
    };
    var SKU = "msal.js.common";
    var DEFAULT_AUTHORITY = "https://login.microsoftonline.com/common/";
    var DEFAULT_AUTHORITY_HOST = "login.microsoftonline.com";
    var DEFAULT_COMMON_TENANT = "common";
    var ADFS = "adfs";
    var DSTS = "dstsv2";
    var AAD_INSTANCE_DISCOVERY_ENDPT = `${DEFAULT_AUTHORITY}discovery/instance?api-version=1.1&authorization_endpoint=`;
    var CIAM_AUTH_URL = ".ciamlogin.com";
    var AAD_TENANT_DOMAIN_SUFFIX = ".onmicrosoft.com";
    var RESOURCE_DELIM = "|";
    var OPENID_SCOPE = "openid";
    var PROFILE_SCOPE = "profile";
    var OFFLINE_ACCESS_SCOPE = "offline_access";
    var EMAIL_SCOPE = "email";
    var URL_FORM_CONTENT_TYPE = "application/x-www-form-urlencoded;charset=utf-8";
    var AUTHORIZATION_PENDING = "authorization_pending";
    var NOT_APPLICABLE = "N/A";
    var NOT_AVAILABLE = "Not Available";
    var FORWARD_SLASH = "/";
    var IMDS_ENDPOINT = "http://169.254.169.254/metadata/instance/compute/location";
    var IMDS_VERSION = "2020-06-01";
    var IMDS_TIMEOUT = 2e3;
    var AZURE_REGION_AUTO_DISCOVER_FLAG = "TryAutoDetect";
    var REGIONAL_AUTH_PUBLIC_CLOUD_SUFFIX = "login.microsoft.com";
    var KNOWN_PUBLIC_CLOUDS = [
      "login.microsoftonline.com",
      "login.windows.net",
      "login.microsoft.com",
      "sts.windows.net"
    ];
    var INVALID_INSTANCE = "invalid_instance";
    var HTTP_SUCCESS = 200;
    var HTTP_REDIRECT = 302;
    var HTTP_CLIENT_ERROR_RANGE_START = 400;
    var HTTP_BAD_REQUEST = 400;
    var HTTP_UNAUTHORIZED = 401;
    var HTTP_NOT_FOUND = 404;
    var HTTP_REQUEST_TIMEOUT = 408;
    var HTTP_GONE = 410;
    var HTTP_TOO_MANY_REQUESTS = 429;
    var HTTP_CLIENT_ERROR_RANGE_END = 499;
    var HTTP_SERVER_ERROR = 500;
    var HTTP_SERVER_ERROR_RANGE_START = 500;
    var HTTP_SERVICE_UNAVAILABLE = 503;
    var HTTP_GATEWAY_TIMEOUT = 504;
    var HTTP_SERVER_ERROR_RANGE_END = 599;
    var OIDC_DEFAULT_SCOPES = [
      OPENID_SCOPE,
      PROFILE_SCOPE,
      OFFLINE_ACCESS_SCOPE
    ];
    var OIDC_SCOPES = [...OIDC_DEFAULT_SCOPES, EMAIL_SCOPE];
    var HeaderNames = {
      CONTENT_TYPE: "Content-Type",
      CONTENT_LENGTH: "Content-Length",
      RETRY_AFTER: "Retry-After",
      CCS_HEADER: "X-AnchorMailbox",
      WWWAuthenticate: "WWW-Authenticate",
      AuthenticationInfo: "Authentication-Info",
      X_MS_REQUEST_ID: "x-ms-request-id",
      X_MS_HTTP_VERSION: "x-ms-httpver"
    };
    var AADAuthority = {
      COMMON: "common",
      ORGANIZATIONS: "organizations",
      CONSUMERS: "consumers"
    };
    var ClaimsRequestKeys = {
      ACCESS_TOKEN: "access_token",
      XMS_CC: "xms_cc"
    };
    var PromptValue$1 = {
      LOGIN: "login",
      SELECT_ACCOUNT: "select_account",
      CONSENT: "consent",
      NONE: "none",
      CREATE: "create",
      NO_SESSION: "no_session"
    };
    var CodeChallengeMethodValues = {
      S256: "S256"
    };
    var OAuthResponseType = {
      CODE: "code",
      IDTOKEN_TOKEN: "id_token token"
    };
    var ResponseMode$1 = {
      QUERY: "query",
      FRAGMENT: "fragment",
      FORM_POST: "form_post"
    };
    var GrantType = {
      AUTHORIZATION_CODE_GRANT: "authorization_code",
      CLIENT_CREDENTIALS_GRANT: "client_credentials",
      RESOURCE_OWNER_PASSWORD_GRANT: "password",
      REFRESH_TOKEN_GRANT: "refresh_token",
      DEVICE_CODE_GRANT: "device_code",
      JWT_BEARER: "urn:ietf:params:oauth:grant-type:jwt-bearer"
    };
    var CACHE_ACCOUNT_TYPE_MSSTS = "MSSTS";
    var CACHE_ACCOUNT_TYPE_ADFS = "ADFS";
    var CACHE_ACCOUNT_TYPE_GENERIC = "Generic";
    var CACHE_KEY_SEPARATOR = "-";
    var CLIENT_INFO_SEPARATOR = ".";
    var CredentialType = {
      ID_TOKEN: "IdToken",
      ACCESS_TOKEN: "AccessToken",
      ACCESS_TOKEN_WITH_AUTH_SCHEME: "AccessToken_With_AuthScheme",
      REFRESH_TOKEN: "RefreshToken"
    };
    var APP_METADATA = "appmetadata";
    var CLIENT_INFO = "client_info";
    var THE_FAMILY_ID = "1";
    var AUTHORITY_METADATA_CACHE_KEY = "authority-metadata";
    var AUTHORITY_METADATA_REFRESH_TIME_SECONDS = 3600 * 24;
    var AuthorityMetadataSource = {
      CONFIG: "config",
      CACHE: "cache",
      NETWORK: "network",
      HARDCODED_VALUES: "hardcoded_values"
    };
    var SERVER_TELEM_SCHEMA_VERSION = 5;
    var SERVER_TELEM_MAX_LAST_HEADER_BYTES = 330;
    var SERVER_TELEM_MAX_CACHED_ERRORS = 50;
    var SERVER_TELEM_CACHE_KEY = "server-telemetry";
    var SERVER_TELEM_CATEGORY_SEPARATOR = "|";
    var SERVER_TELEM_VALUE_SEPARATOR = ",";
    var SERVER_TELEM_OVERFLOW_TRUE = "1";
    var SERVER_TELEM_OVERFLOW_FALSE = "0";
    var SERVER_TELEM_UNKNOWN_ERROR = "unknown_error";
    var AuthenticationScheme = {
      BEARER: "Bearer",
      POP: "pop",
      SSH: "ssh-cert"
    };
    var DEFAULT_THROTTLE_TIME_SECONDS = 60;
    var DEFAULT_MAX_THROTTLE_TIME_SECONDS = 3600;
    var THROTTLING_PREFIX = "throttling";
    var X_MS_LIB_CAPABILITY_VALUE = "retry-after, h429";
    var INVALID_GRANT_ERROR = "invalid_grant";
    var CLIENT_MISMATCH_ERROR = "client_mismatch";
    var PasswordGrantConstants = {
      username: "username",
      password: "password"
    };
    var RegionDiscoverySources = {
      FAILED_AUTO_DETECTION: "1",
      INTERNAL_CACHE: "2",
      ENVIRONMENT_VARIABLE: "3",
      IMDS: "4"
    };
    var RegionDiscoveryOutcomes = {
      CONFIGURED_NO_AUTO_DETECTION: "2",
      AUTO_DETECTION_REQUESTED_SUCCESSFUL: "4",
      AUTO_DETECTION_REQUESTED_FAILED: "5"
    };
    var CacheOutcome = {
      // When a token is found in the cache or the cache is not supposed to be hit when making the request
      NOT_APPLICABLE: "0",
      // When the token request goes to the identity provider because force_refresh was set to true. Also occurs if claims were requested
      FORCE_REFRESH_OR_CLAIMS: "1",
      // When the token request goes to the identity provider because no cached access token exists
      NO_CACHED_ACCESS_TOKEN: "2",
      // When the token request goes to the identity provider because cached access token expired
      CACHED_ACCESS_TOKEN_EXPIRED: "3",
      // When the token request goes to the identity provider because refresh_in was used and the existing token needs to be refreshed
      PROACTIVELY_REFRESHED: "4"
    };
    var DEFAULT_TOKEN_RENEWAL_OFFSET_SEC = 300;
    var EncodingTypes = {
      BASE64: "base64",
      HEX: "hex",
      UTF8: "utf-8"
    };
    var CLIENT_ID = "client_id";
    var REDIRECT_URI = "redirect_uri";
    var RESPONSE_TYPE = "response_type";
    var RESPONSE_MODE = "response_mode";
    var GRANT_TYPE = "grant_type";
    var CLAIMS = "claims";
    var SCOPE = "scope";
    var REFRESH_TOKEN = "refresh_token";
    var STATE = "state";
    var NONCE = "nonce";
    var PROMPT = "prompt";
    var CODE = "code";
    var CODE_CHALLENGE = "code_challenge";
    var CODE_CHALLENGE_METHOD = "code_challenge_method";
    var CODE_VERIFIER = "code_verifier";
    var CLIENT_REQUEST_ID = "client-request-id";
    var X_CLIENT_SKU = "x-client-SKU";
    var X_CLIENT_VER = "x-client-VER";
    var X_CLIENT_OS = "x-client-OS";
    var X_CLIENT_CPU = "x-client-CPU";
    var X_CLIENT_CURR_TELEM = "x-client-current-telemetry";
    var X_CLIENT_LAST_TELEM = "x-client-last-telemetry";
    var X_MS_LIB_CAPABILITY = "x-ms-lib-capability";
    var X_APP_NAME = "x-app-name";
    var X_APP_VER = "x-app-ver";
    var POST_LOGOUT_URI = "post_logout_redirect_uri";
    var ID_TOKEN_HINT = "id_token_hint";
    var DEVICE_CODE = "device_code";
    var CLIENT_SECRET = "client_secret";
    var CLIENT_ASSERTION = "client_assertion";
    var CLIENT_ASSERTION_TYPE = "client_assertion_type";
    var TOKEN_TYPE = "token_type";
    var REQ_CNF = "req_cnf";
    var OBO_ASSERTION = "assertion";
    var REQUESTED_TOKEN_USE = "requested_token_use";
    var ON_BEHALF_OF = "on_behalf_of";
    var RETURN_SPA_CODE = "return_spa_code";
    var LOGOUT_HINT = "logout_hint";
    var SID = "sid";
    var LOGIN_HINT = "login_hint";
    var DOMAIN_HINT = "domain_hint";
    var X_CLIENT_EXTRA_SKU = "x-client-xtra-sku";
    var BROKER_CLIENT_ID = "brk_client_id";
    var BROKER_REDIRECT_URI = "brk_redirect_uri";
    var INSTANCE_AWARE = "instance_aware";
    function getDefaultErrorMessage(code) {
      return `See https://aka.ms/msal.js.errors#${code} for details`;
    }
    var AuthError = class _AuthError extends Error {
      constructor(errorCode, errorMessage, suberror) {
        const message = errorMessage || (errorCode ? getDefaultErrorMessage(errorCode) : "");
        const errorString = message ? `${errorCode}: ${message}` : errorCode;
        super(errorString);
        Object.setPrototypeOf(this, _AuthError.prototype);
        this.errorCode = errorCode || "";
        this.errorMessage = message || "";
        this.subError = suberror || "";
        this.name = "AuthError";
      }
      setCorrelationId(correlationId) {
        this.correlationId = correlationId;
      }
    };
    function createAuthError(code, additionalMessage) {
      return new AuthError(code, additionalMessage || getDefaultErrorMessage(code));
    }
    var ClientConfigurationError = class _ClientConfigurationError extends AuthError {
      constructor(errorCode) {
        super(errorCode);
        this.name = "ClientConfigurationError";
        Object.setPrototypeOf(this, _ClientConfigurationError.prototype);
      }
    };
    function createClientConfigurationError(errorCode) {
      return new ClientConfigurationError(errorCode);
    }
    var StringUtils = class {
      /**
       * Check if stringified object is empty
       * @param strObj
       */
      static isEmptyObj(strObj) {
        if (strObj) {
          try {
            const obj = JSON.parse(strObj);
            return Object.keys(obj).length === 0;
          } catch (e) {
          }
        }
        return true;
      }
      static startsWith(str, search) {
        return str.indexOf(search) === 0;
      }
      static endsWith(str, search) {
        return str.length >= search.length && str.lastIndexOf(search) === str.length - search.length;
      }
      /**
       * Parses string into an object.
       *
       * @param query
       */
      static queryStringToObject(query) {
        const obj = {};
        const params = query.split("&");
        const decode = (s) => decodeURIComponent(s.replace(/\+/g, " "));
        params.forEach((pair) => {
          if (pair.trim()) {
            const [key, value] = pair.split(/=(.+)/g, 2);
            if (key && value) {
              obj[decode(key)] = decode(value);
            }
          }
        });
        return obj;
      }
      /**
       * Trims entries in an array.
       *
       * @param arr
       */
      static trimArrayEntries(arr) {
        return arr.map((entry) => entry.trim());
      }
      /**
       * Removes empty strings from array
       * @param arr
       */
      static removeEmptyStringsFromArray(arr) {
        return arr.filter((entry) => {
          return !!entry;
        });
      }
      /**
       * Attempts to parse a string into JSON
       * @param str
       */
      static jsonParseHelper(str) {
        try {
          return JSON.parse(str);
        } catch (e) {
          return null;
        }
      }
    };
    var ClientAuthError = class _ClientAuthError extends AuthError {
      constructor(errorCode, additionalMessage) {
        super(errorCode, additionalMessage);
        this.name = "ClientAuthError";
        Object.setPrototypeOf(this, _ClientAuthError.prototype);
      }
    };
    function createClientAuthError(errorCode, additionalMessage) {
      return new ClientAuthError(errorCode, additionalMessage);
    }
    var redirectUriEmpty = "redirect_uri_empty";
    var claimsRequestParsingError = "claims_request_parsing_error";
    var authorityUriInsecure = "authority_uri_insecure";
    var urlParseError = "url_parse_error";
    var urlEmptyError = "empty_url_error";
    var emptyInputScopesError = "empty_input_scopes_error";
    var invalidClaims = "invalid_claims";
    var tokenRequestEmpty = "token_request_empty";
    var logoutRequestEmpty = "logout_request_empty";
    var invalidCodeChallengeMethod = "invalid_code_challenge_method";
    var pkceParamsMissing = "pkce_params_missing";
    var invalidCloudDiscoveryMetadata = "invalid_cloud_discovery_metadata";
    var invalidAuthorityMetadata = "invalid_authority_metadata";
    var untrustedAuthority = "untrusted_authority";
    var missingSshJwk = "missing_ssh_jwk";
    var missingSshKid = "missing_ssh_kid";
    var missingNonceAuthenticationHeader = "missing_nonce_authentication_header";
    var invalidAuthenticationHeader = "invalid_authentication_header";
    var cannotSetOIDCOptions = "cannot_set_OIDCOptions";
    var cannotAllowPlatformBroker = "cannot_allow_platform_broker";
    var authorityMismatch = "authority_mismatch";
    var invalidRequestMethodForEAR = "invalid_request_method_for_EAR";
    var ClientConfigurationErrorCodes = /* @__PURE__ */ Object.freeze({
      __proto__: null,
      authorityMismatch,
      authorityUriInsecure,
      cannotAllowPlatformBroker,
      cannotSetOIDCOptions,
      claimsRequestParsingError,
      emptyInputScopesError,
      invalidAuthenticationHeader,
      invalidAuthorityMetadata,
      invalidClaims,
      invalidCloudDiscoveryMetadata,
      invalidCodeChallengeMethod,
      invalidRequestMethodForEAR,
      logoutRequestEmpty,
      missingNonceAuthenticationHeader,
      missingSshJwk,
      missingSshKid,
      pkceParamsMissing,
      redirectUriEmpty,
      tokenRequestEmpty,
      untrustedAuthority,
      urlEmptyError,
      urlParseError
    });
    var clientInfoDecodingError = "client_info_decoding_error";
    var clientInfoEmptyError = "client_info_empty_error";
    var tokenParsingError = "token_parsing_error";
    var nullOrEmptyToken = "null_or_empty_token";
    var endpointResolutionError = "endpoints_resolution_error";
    var networkError = "network_error";
    var openIdConfigError = "openid_config_error";
    var hashNotDeserialized = "hash_not_deserialized";
    var invalidState = "invalid_state";
    var stateMismatch = "state_mismatch";
    var stateNotFound = "state_not_found";
    var nonceMismatch = "nonce_mismatch";
    var authTimeNotFound = "auth_time_not_found";
    var maxAgeTranspired = "max_age_transpired";
    var multipleMatchingTokens = "multiple_matching_tokens";
    var multipleMatchingAppMetadata = "multiple_matching_appMetadata";
    var requestCannotBeMade = "request_cannot_be_made";
    var cannotRemoveEmptyScope = "cannot_remove_empty_scope";
    var cannotAppendScopeSet = "cannot_append_scopeset";
    var emptyInputScopeSet = "empty_input_scopeset";
    var noAccountInSilentRequest = "no_account_in_silent_request";
    var invalidCacheRecord = "invalid_cache_record";
    var invalidCacheEnvironment = "invalid_cache_environment";
    var noAccountFound = "no_account_found";
    var noCryptoObject = "no_crypto_object";
    var unexpectedCredentialType = "unexpected_credential_type";
    var tokenRefreshRequired = "token_refresh_required";
    var tokenClaimsCnfRequiredForSignedJwt = "token_claims_cnf_required_for_signedjwt";
    var authorizationCodeMissingFromServerResponse = "authorization_code_missing_from_server_response";
    var bindingKeyNotRemoved = "binding_key_not_removed";
    var endSessionEndpointNotSupported = "end_session_endpoint_not_supported";
    var keyIdMissing = "key_id_missing";
    var noNetworkConnectivity = "no_network_connectivity";
    var userCanceled = "user_canceled";
    var methodNotImplemented = "method_not_implemented";
    var nestedAppAuthBridgeDisabled = "nested_app_auth_bridge_disabled";
    var platformBrokerError = "platform_broker_error";
    var ClientAuthErrorCodes = /* @__PURE__ */ Object.freeze({
      __proto__: null,
      authTimeNotFound,
      authorizationCodeMissingFromServerResponse,
      bindingKeyNotRemoved,
      cannotAppendScopeSet,
      cannotRemoveEmptyScope,
      clientInfoDecodingError,
      clientInfoEmptyError,
      emptyInputScopeSet,
      endSessionEndpointNotSupported,
      endpointResolutionError,
      hashNotDeserialized,
      invalidCacheEnvironment,
      invalidCacheRecord,
      invalidState,
      keyIdMissing,
      maxAgeTranspired,
      methodNotImplemented,
      multipleMatchingAppMetadata,
      multipleMatchingTokens,
      nestedAppAuthBridgeDisabled,
      networkError,
      noAccountFound,
      noAccountInSilentRequest,
      noCryptoObject,
      noNetworkConnectivity,
      nonceMismatch,
      nullOrEmptyToken,
      openIdConfigError,
      platformBrokerError,
      requestCannotBeMade,
      stateMismatch,
      stateNotFound,
      tokenClaimsCnfRequiredForSignedJwt,
      tokenParsingError,
      tokenRefreshRequired,
      unexpectedCredentialType,
      userCanceled
    });
    var ScopeSet = class _ScopeSet {
      constructor(inputScopes) {
        const scopeArr = inputScopes ? StringUtils.trimArrayEntries([...inputScopes]) : [];
        const filteredInput = scopeArr ? StringUtils.removeEmptyStringsFromArray(scopeArr) : [];
        if (!filteredInput || !filteredInput.length) {
          throw createClientConfigurationError(emptyInputScopesError);
        }
        this.scopes = /* @__PURE__ */ new Set();
        filteredInput.forEach((scope) => this.scopes.add(scope));
      }
      /**
       * Factory method to create ScopeSet from space-delimited string
       * @param inputScopeString
       * @param appClientId
       * @param scopesRequired
       */
      static fromString(inputScopeString) {
        const scopeString = inputScopeString || "";
        const inputScopes = scopeString.split(" ");
        return new _ScopeSet(inputScopes);
      }
      /**
       * Creates the set of scopes to search for in cache lookups
       * @param inputScopeString
       * @returns
       */
      static createSearchScopes(inputScopeString) {
        const scopesToUse = inputScopeString && inputScopeString.length > 0 ? inputScopeString : [...OIDC_DEFAULT_SCOPES];
        const scopeSet = new _ScopeSet(scopesToUse);
        if (!scopeSet.containsOnlyOIDCScopes()) {
          scopeSet.removeOIDCScopes();
        } else {
          scopeSet.removeScope(OFFLINE_ACCESS_SCOPE);
        }
        return scopeSet;
      }
      /**
       * Check if a given scope is present in this set of scopes.
       * @param scope
       */
      containsScope(scope) {
        const lowerCaseScopes = this.printScopesLowerCase().split(" ");
        const lowerCaseScopesSet = new _ScopeSet(lowerCaseScopes);
        return scope ? lowerCaseScopesSet.scopes.has(scope.toLowerCase()) : false;
      }
      /**
       * Check if a set of scopes is present in this set of scopes.
       * @param scopeSet
       */
      containsScopeSet(scopeSet) {
        if (!scopeSet || scopeSet.scopes.size <= 0) {
          return false;
        }
        return this.scopes.size >= scopeSet.scopes.size && scopeSet.asArray().every((scope) => this.containsScope(scope));
      }
      /**
       * Check if set of scopes contains only the defaults
       */
      containsOnlyOIDCScopes() {
        let defaultScopeCount = 0;
        OIDC_SCOPES.forEach((defaultScope) => {
          if (this.containsScope(defaultScope)) {
            defaultScopeCount += 1;
          }
        });
        return this.scopes.size === defaultScopeCount;
      }
      /**
       * Appends single scope if passed
       * @param newScope
       */
      appendScope(newScope) {
        if (newScope) {
          this.scopes.add(newScope.trim());
        }
      }
      /**
       * Appends multiple scopes if passed
       * @param newScopes
       */
      appendScopes(newScopes) {
        try {
          newScopes.forEach((newScope) => this.appendScope(newScope));
        } catch (e) {
          throw createClientAuthError(cannotAppendScopeSet);
        }
      }
      /**
       * Removes element from set of scopes.
       * @param scope
       */
      removeScope(scope) {
        if (!scope) {
          throw createClientAuthError(cannotRemoveEmptyScope);
        }
        this.scopes.delete(scope.trim());
      }
      /**
       * Removes default scopes from set of scopes
       * Primarily used to prevent cache misses if the default scopes are not returned from the server
       */
      removeOIDCScopes() {
        OIDC_SCOPES.forEach((defaultScope) => {
          this.scopes.delete(defaultScope);
        });
      }
      /**
       * Combines an array of scopes with the current set of scopes.
       * @param otherScopes
       */
      unionScopeSets(otherScopes) {
        if (!otherScopes) {
          throw createClientAuthError(emptyInputScopeSet);
        }
        const unionScopes = /* @__PURE__ */ new Set();
        otherScopes.scopes.forEach((scope) => unionScopes.add(scope.toLowerCase()));
        this.scopes.forEach((scope) => unionScopes.add(scope.toLowerCase()));
        return unionScopes;
      }
      /**
       * Check if scopes intersect between this set and another.
       * @param otherScopes
       */
      intersectingScopeSets(otherScopes) {
        if (!otherScopes) {
          throw createClientAuthError(emptyInputScopeSet);
        }
        if (!otherScopes.containsOnlyOIDCScopes()) {
          otherScopes.removeOIDCScopes();
        }
        const unionScopes = this.unionScopeSets(otherScopes);
        const sizeOtherScopes = otherScopes.getScopeCount();
        const sizeThisScopes = this.getScopeCount();
        const sizeUnionScopes = unionScopes.size;
        return sizeUnionScopes < sizeThisScopes + sizeOtherScopes;
      }
      /**
       * Returns size of set of scopes.
       */
      getScopeCount() {
        return this.scopes.size;
      }
      /**
       * Returns the scopes as an array of string values
       */
      asArray() {
        const array = [];
        this.scopes.forEach((val) => array.push(val));
        return array;
      }
      /**
       * Prints scopes into a space-delimited string
       */
      printScopes() {
        if (this.scopes) {
          const scopeArr = this.asArray();
          return scopeArr.join(" ");
        }
        return "";
      }
      /**
       * Prints scopes into a space-delimited lower-case string (used for caching)
       */
      printScopesLowerCase() {
        return this.printScopes().toLowerCase();
      }
    };
    function instrumentBrokerParams(parameters, correlationId, performanceClient) {
      if (!correlationId) {
        return;
      }
      const clientId = parameters.get(CLIENT_ID);
      if (clientId && parameters.has(BROKER_CLIENT_ID)) {
        performanceClient?.addFields({
          embeddedClientId: clientId,
          embeddedRedirectUri: parameters.get(REDIRECT_URI)
        }, correlationId);
      }
    }
    function addResponseType(parameters, responseType) {
      parameters.set(RESPONSE_TYPE, responseType);
    }
    function addResponseMode(parameters, responseMode) {
      parameters.set(RESPONSE_MODE, responseMode ? responseMode : ResponseMode$1.QUERY);
    }
    function addScopes(parameters, scopes, addOidcScopes = true, defaultScopes = OIDC_DEFAULT_SCOPES) {
      if (addOidcScopes && !defaultScopes.includes("openid") && !scopes.includes("openid")) {
        defaultScopes.push("openid");
      }
      const requestScopes = addOidcScopes ? [...scopes || [], ...defaultScopes] : scopes || [];
      const scopeSet = new ScopeSet(requestScopes);
      parameters.set(SCOPE, scopeSet.printScopes());
    }
    function addClientId(parameters, clientId) {
      parameters.set(CLIENT_ID, clientId);
    }
    function addRedirectUri(parameters, redirectUri) {
      parameters.set(REDIRECT_URI, redirectUri);
    }
    function addPostLogoutRedirectUri(parameters, redirectUri) {
      parameters.set(POST_LOGOUT_URI, redirectUri);
    }
    function addIdTokenHint(parameters, idTokenHint) {
      parameters.set(ID_TOKEN_HINT, idTokenHint);
    }
    function addDomainHint(parameters, domainHint) {
      parameters.set(DOMAIN_HINT, domainHint);
    }
    function addLoginHint(parameters, loginHint) {
      parameters.set(LOGIN_HINT, loginHint);
    }
    function addCcsUpn(parameters, loginHint) {
      parameters.set(HeaderNames.CCS_HEADER, `UPN:${loginHint}`);
    }
    function addCcsOid(parameters, clientInfo) {
      parameters.set(HeaderNames.CCS_HEADER, `Oid:${clientInfo.uid}@${clientInfo.utid}`);
    }
    function addSid(parameters, sid) {
      parameters.set(SID, sid);
    }
    function addClaims(parameters, claims, clientCapabilities) {
      const mergedClaims = addClientCapabilitiesToClaims(claims, clientCapabilities);
      try {
        JSON.parse(mergedClaims);
      } catch (e) {
        throw createClientConfigurationError(invalidClaims);
      }
      parameters.set(CLAIMS, mergedClaims);
    }
    function addCorrelationId(parameters, correlationId) {
      parameters.set(CLIENT_REQUEST_ID, correlationId);
    }
    function addLibraryInfo(parameters, libraryInfo) {
      parameters.set(X_CLIENT_SKU, libraryInfo.sku);
      parameters.set(X_CLIENT_VER, libraryInfo.version);
      if (libraryInfo.os) {
        parameters.set(X_CLIENT_OS, libraryInfo.os);
      }
      if (libraryInfo.cpu) {
        parameters.set(X_CLIENT_CPU, libraryInfo.cpu);
      }
    }
    function addApplicationTelemetry(parameters, appTelemetry) {
      if (appTelemetry?.appName) {
        parameters.set(X_APP_NAME, appTelemetry.appName);
      }
      if (appTelemetry?.appVersion) {
        parameters.set(X_APP_VER, appTelemetry.appVersion);
      }
    }
    function addPrompt(parameters, prompt) {
      parameters.set(PROMPT, prompt);
    }
    function addState(parameters, state) {
      if (state) {
        parameters.set(STATE, state);
      }
    }
    function addNonce(parameters, nonce) {
      parameters.set(NONCE, nonce);
    }
    function addCodeChallengeParams(parameters, codeChallenge, codeChallengeMethod) {
      if (codeChallenge && codeChallengeMethod) {
        parameters.set(CODE_CHALLENGE, codeChallenge);
        parameters.set(CODE_CHALLENGE_METHOD, codeChallengeMethod);
      } else {
        throw createClientConfigurationError(pkceParamsMissing);
      }
    }
    function addAuthorizationCode(parameters, code) {
      parameters.set(CODE, code);
    }
    function addDeviceCode(parameters, code) {
      parameters.set(DEVICE_CODE, code);
    }
    function addRefreshToken(parameters, refreshToken) {
      parameters.set(REFRESH_TOKEN, refreshToken);
    }
    function addCodeVerifier(parameters, codeVerifier) {
      parameters.set(CODE_VERIFIER, codeVerifier);
    }
    function addClientSecret(parameters, clientSecret) {
      parameters.set(CLIENT_SECRET, clientSecret);
    }
    function addClientAssertion(parameters, clientAssertion) {
      if (clientAssertion) {
        parameters.set(CLIENT_ASSERTION, clientAssertion);
      }
    }
    function addClientAssertionType(parameters, clientAssertionType) {
      if (clientAssertionType) {
        parameters.set(CLIENT_ASSERTION_TYPE, clientAssertionType);
      }
    }
    function addOboAssertion(parameters, oboAssertion) {
      parameters.set(OBO_ASSERTION, oboAssertion);
    }
    function addRequestTokenUse(parameters, tokenUse) {
      parameters.set(REQUESTED_TOKEN_USE, tokenUse);
    }
    function addGrantType(parameters, grantType) {
      parameters.set(GRANT_TYPE, grantType);
    }
    function addClientInfo(parameters) {
      parameters.set(CLIENT_INFO, "1");
    }
    function addInstanceAware(parameters) {
      if (!parameters.has(INSTANCE_AWARE)) {
        parameters.set(INSTANCE_AWARE, "true");
      }
    }
    function addExtraParameters(parameters, extraParams) {
      Object.entries(extraParams).forEach(([key, value]) => {
        if (!parameters.has(key) && value) {
          parameters.set(key, value);
        }
      });
    }
    function addClientCapabilitiesToClaims(claims, clientCapabilities) {
      let mergedClaims;
      if (!claims) {
        mergedClaims = {};
      } else {
        try {
          mergedClaims = JSON.parse(claims);
        } catch (e) {
          throw createClientConfigurationError(invalidClaims);
        }
      }
      if (clientCapabilities && clientCapabilities.length > 0) {
        if (!mergedClaims.hasOwnProperty(ClaimsRequestKeys.ACCESS_TOKEN)) {
          mergedClaims[ClaimsRequestKeys.ACCESS_TOKEN] = {};
        }
        mergedClaims[ClaimsRequestKeys.ACCESS_TOKEN][ClaimsRequestKeys.XMS_CC] = {
          values: clientCapabilities
        };
      }
      return JSON.stringify(mergedClaims);
    }
    function addUsername(parameters, username) {
      parameters.set(PasswordGrantConstants.username, username);
    }
    function addPassword(parameters, password) {
      parameters.set(PasswordGrantConstants.password, password);
    }
    function addPopToken(parameters, cnfString) {
      if (cnfString) {
        parameters.set(TOKEN_TYPE, AuthenticationScheme.POP);
        parameters.set(REQ_CNF, cnfString);
      }
    }
    function addSshJwk(parameters, sshJwkString) {
      if (sshJwkString) {
        parameters.set(TOKEN_TYPE, AuthenticationScheme.SSH);
        parameters.set(REQ_CNF, sshJwkString);
      }
    }
    function addServerTelemetry(parameters, serverTelemetryManager) {
      parameters.set(X_CLIENT_CURR_TELEM, serverTelemetryManager.generateCurrentRequestHeaderValue());
      parameters.set(X_CLIENT_LAST_TELEM, serverTelemetryManager.generateLastRequestHeaderValue());
    }
    function addThrottling(parameters) {
      parameters.set(X_MS_LIB_CAPABILITY, X_MS_LIB_CAPABILITY_VALUE);
    }
    function addLogoutHint(parameters, logoutHint) {
      parameters.set(LOGOUT_HINT, logoutHint);
    }
    function addBrokerParameters(parameters, brokerClientId, brokerRedirectUri) {
      if (!parameters.has(BROKER_CLIENT_ID)) {
        parameters.set(BROKER_CLIENT_ID, brokerClientId);
      }
      if (!parameters.has(BROKER_REDIRECT_URI)) {
        parameters.set(BROKER_REDIRECT_URI, brokerRedirectUri);
      }
    }
    function stripLeadingHashOrQuery(responseString) {
      if (responseString.startsWith("#/")) {
        return responseString.substring(2);
      } else if (responseString.startsWith("#") || responseString.startsWith("?")) {
        return responseString.substring(1);
      }
      return responseString;
    }
    function getDeserializedResponse(responseString) {
      if (!responseString || responseString.indexOf("=") < 0) {
        return null;
      }
      try {
        const normalizedResponse = stripLeadingHashOrQuery(responseString);
        const deserializedHash = Object.fromEntries(new URLSearchParams(normalizedResponse));
        if (deserializedHash.code || deserializedHash.ear_jwe || deserializedHash.error || deserializedHash.error_description || deserializedHash.state) {
          return deserializedHash;
        }
      } catch (e) {
        throw createClientAuthError(hashNotDeserialized);
      }
      return null;
    }
    function mapToQueryString(parameters) {
      const queryParameterArray = new Array();
      parameters.forEach((value, key) => {
        queryParameterArray.push(`${key}=${encodeURIComponent(value)}`);
      });
      return queryParameterArray.join("&");
    }
    var DEFAULT_CRYPTO_IMPLEMENTATION = {
      createNewGuid: () => {
        throw createClientAuthError(methodNotImplemented);
      },
      base64Decode: () => {
        throw createClientAuthError(methodNotImplemented);
      },
      base64Encode: () => {
        throw createClientAuthError(methodNotImplemented);
      },
      base64UrlEncode: () => {
        throw createClientAuthError(methodNotImplemented);
      },
      encodeKid: () => {
        throw createClientAuthError(methodNotImplemented);
      },
      async getPublicKeyThumbprint() {
        throw createClientAuthError(methodNotImplemented);
      },
      async removeTokenBindingKey() {
        throw createClientAuthError(methodNotImplemented);
      },
      async clearKeystore() {
        throw createClientAuthError(methodNotImplemented);
      },
      async signJwt() {
        throw createClientAuthError(methodNotImplemented);
      },
      async hashString() {
        throw createClientAuthError(methodNotImplemented);
      }
    };
    exports2.LogLevel = void 0;
    (function(LogLevel) {
      LogLevel[LogLevel["Error"] = 0] = "Error";
      LogLevel[LogLevel["Warning"] = 1] = "Warning";
      LogLevel[LogLevel["Info"] = 2] = "Info";
      LogLevel[LogLevel["Verbose"] = 3] = "Verbose";
      LogLevel[LogLevel["Trace"] = 4] = "Trace";
    })(exports2.LogLevel || (exports2.LogLevel = {}));
    var CACHE_CAPACITY = 50;
    var MAX_LOGS_PER_CORRELATION = 500;
    var correlationCache = /* @__PURE__ */ new Map();
    function markAsRecentlyUsed(correlationId, data) {
      correlationCache.delete(correlationId);
      correlationCache.set(correlationId, data);
    }
    function addLogToCache(correlationId, loggedMessage) {
      const currentTime = Date.now();
      let data = correlationCache.get(correlationId);
      if (data) {
        markAsRecentlyUsed(correlationId, data);
      } else {
        data = { logs: [], firstEventTime: currentTime };
        correlationCache.set(correlationId, data);
        if (correlationCache.size > CACHE_CAPACITY) {
          const firstKey = correlationCache.keys().next().value;
          if (firstKey) {
            correlationCache.delete(firstKey);
          }
        }
      }
      data.logs.push({
        ...loggedMessage,
        milliseconds: currentTime - data.firstEventTime
      });
      if (data.logs.length > MAX_LOGS_PER_CORRELATION) {
        data.logs.shift();
      }
    }
    function isHashedString(str) {
      if (str.length !== 6) {
        return false;
      }
      for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const isAlphaNumeric = char >= "a" && char <= "z" || char >= "A" && char <= "Z" || char >= "0" && char <= "9";
        if (!isAlphaNumeric) {
          return false;
        }
      }
      return true;
    }
    var Logger = class _Logger {
      constructor(loggerOptions, packageName, packageVersion) {
        this.level = exports2.LogLevel.Info;
        const defaultLoggerCallback = () => {
          return;
        };
        const setLoggerOptions = loggerOptions || _Logger.createDefaultLoggerOptions();
        this.localCallback = setLoggerOptions.loggerCallback || defaultLoggerCallback;
        this.piiLoggingEnabled = setLoggerOptions.piiLoggingEnabled || false;
        this.level = typeof setLoggerOptions.logLevel === "number" ? setLoggerOptions.logLevel : exports2.LogLevel.Info;
        this.packageName = packageName || "";
        this.packageVersion = packageVersion || "";
      }
      static createDefaultLoggerOptions() {
        return {
          loggerCallback: () => {
          },
          piiLoggingEnabled: false,
          logLevel: exports2.LogLevel.Info
        };
      }
      /**
       * Create new Logger with existing configurations.
       */
      clone(packageName, packageVersion) {
        return new _Logger({
          loggerCallback: this.localCallback,
          piiLoggingEnabled: this.piiLoggingEnabled,
          logLevel: this.level
        }, packageName, packageVersion);
      }
      /**
       * Log message with required options.
       */
      logMessage(logMessage, options) {
        const correlationId = options.correlationId;
        const isHashedInput = isHashedString(logMessage);
        if (isHashedInput) {
          const loggedMessage = {
            hash: logMessage,
            level: options.logLevel,
            containsPii: options.containsPii || false,
            milliseconds: 0
            // Will be calculated in addLogToCache
          };
          addLogToCache(correlationId, loggedMessage);
        }
        if (options.logLevel > this.level || !this.piiLoggingEnabled && options.containsPii) {
          return;
        }
        const timestamp = (/* @__PURE__ */ new Date()).toUTCString();
        const logHeader = `[${timestamp}] : [${correlationId}]`;
        const log2 = `${logHeader} : ${this.packageName}@${this.packageVersion} : ${exports2.LogLevel[options.logLevel]} - ${logMessage}`;
        this.executeCallback(options.logLevel, log2, options.containsPii || false);
      }
      /**
       * Execute callback with message.
       */
      executeCallback(level, message, containsPii) {
        if (this.localCallback) {
          this.localCallback(level, message, containsPii);
        }
      }
      /**
       * Logs error messages.
       */
      error(message, correlationId) {
        this.logMessage(message, {
          logLevel: exports2.LogLevel.Error,
          containsPii: false,
          correlationId
        });
      }
      /**
       * Logs error messages with PII.
       */
      errorPii(message, correlationId) {
        this.logMessage(message, {
          logLevel: exports2.LogLevel.Error,
          containsPii: true,
          correlationId
        });
      }
      /**
       * Logs warning messages.
       */
      warning(message, correlationId) {
        this.logMessage(message, {
          logLevel: exports2.LogLevel.Warning,
          containsPii: false,
          correlationId
        });
      }
      /**
       * Logs warning messages with PII.
       */
      warningPii(message, correlationId) {
        this.logMessage(message, {
          logLevel: exports2.LogLevel.Warning,
          containsPii: true,
          correlationId
        });
      }
      /**
       * Logs info messages.
       */
      info(message, correlationId) {
        this.logMessage(message, {
          logLevel: exports2.LogLevel.Info,
          containsPii: false,
          correlationId
        });
      }
      /**
       * Logs info messages with PII.
       */
      infoPii(message, correlationId) {
        this.logMessage(message, {
          logLevel: exports2.LogLevel.Info,
          containsPii: true,
          correlationId
        });
      }
      /**
       * Logs verbose messages.
       */
      verbose(message, correlationId) {
        this.logMessage(message, {
          logLevel: exports2.LogLevel.Verbose,
          containsPii: false,
          correlationId
        });
      }
      /**
       * Logs verbose messages with PII.
       */
      verbosePii(message, correlationId) {
        this.logMessage(message, {
          logLevel: exports2.LogLevel.Verbose,
          containsPii: true,
          correlationId
        });
      }
      /**
       * Logs trace messages.
       */
      trace(message, correlationId) {
        this.logMessage(message, {
          logLevel: exports2.LogLevel.Trace,
          containsPii: false,
          correlationId
        });
      }
      /**
       * Logs trace messages with PII.
       */
      tracePii(message, correlationId) {
        this.logMessage(message, {
          logLevel: exports2.LogLevel.Trace,
          containsPii: true,
          correlationId
        });
      }
      /**
       * Returns whether PII Logging is enabled or not.
       */
      isPiiLoggingEnabled() {
        return this.piiLoggingEnabled || false;
      }
    };
    var name$1 = "@azure/msal-common";
    var version$1 = "16.2.0";
    var AzureCloudInstance = {
      // AzureCloudInstance is not specified.
      None: "none",
      // Microsoft Azure public cloud
      AzurePublic: "https://login.microsoftonline.com",
      // Microsoft PPE
      AzurePpe: "https://login.windows-ppe.net",
      // Microsoft Chinese national/regional cloud
      AzureChina: "https://login.chinacloudapi.cn",
      // Microsoft German national/regional cloud ("Black Forest")
      AzureGermany: "https://login.microsoftonline.de",
      // US Government cloud
      AzureUsGovernment: "https://login.microsoftonline.us"
    };
    function tenantIdMatchesHomeTenant(tenantId, homeAccountId) {
      return !!tenantId && !!homeAccountId && tenantId === homeAccountId.split(".")[1];
    }
    function buildTenantProfile(homeAccountId, localAccountId, tenantId, idTokenClaims) {
      if (idTokenClaims) {
        const { oid, sub, tid, name: name2, tfp, acr, preferred_username, upn, login_hint } = idTokenClaims;
        const tenantId2 = tid || tfp || acr || "";
        return {
          tenantId: tenantId2,
          localAccountId: oid || sub || "",
          name: name2,
          username: preferred_username || upn || "",
          loginHint: login_hint,
          isHomeTenant: tenantIdMatchesHomeTenant(tenantId2, homeAccountId)
        };
      } else {
        return {
          tenantId,
          localAccountId,
          username: "",
          isHomeTenant: tenantIdMatchesHomeTenant(tenantId, homeAccountId)
        };
      }
    }
    function updateAccountTenantProfileData(baseAccountInfo, tenantProfile, idTokenClaims, idTokenSecret) {
      let updatedAccountInfo = baseAccountInfo;
      if (tenantProfile) {
        const { isHomeTenant, ...tenantProfileOverride } = tenantProfile;
        updatedAccountInfo = { ...baseAccountInfo, ...tenantProfileOverride };
      }
      if (idTokenClaims) {
        const { isHomeTenant, ...claimsSourcedTenantProfile } = buildTenantProfile(baseAccountInfo.homeAccountId, baseAccountInfo.localAccountId, baseAccountInfo.tenantId, idTokenClaims);
        updatedAccountInfo = {
          ...updatedAccountInfo,
          ...claimsSourcedTenantProfile,
          idTokenClaims,
          idToken: idTokenSecret
        };
        return updatedAccountInfo;
      }
      return updatedAccountInfo;
    }
    function extractTokenClaims(encodedToken, base64Decode) {
      const jswPayload = getJWSPayload(encodedToken);
      try {
        const base64Decoded = base64Decode(jswPayload);
        return JSON.parse(base64Decoded);
      } catch (err) {
        throw createClientAuthError(tokenParsingError);
      }
    }
    function isKmsi(idTokenClaims) {
      if (!idTokenClaims.signin_state) {
        return false;
      }
      const kmsiClaims = ["kmsi", "dvc_dmjd"];
      return idTokenClaims.signin_state.some((value) => kmsiClaims.includes(value.trim().toLowerCase()));
    }
    function getJWSPayload(authToken) {
      if (!authToken) {
        throw createClientAuthError(nullOrEmptyToken);
      }
      const tokenPartsRegex = /^([^\.\s]*)\.([^\.\s]+)\.([^\.\s]*)$/;
      const matches = tokenPartsRegex.exec(authToken);
      if (!matches || matches.length < 4) {
        throw createClientAuthError(tokenParsingError);
      }
      return matches[2];
    }
    function checkMaxAge(authTime, maxAge) {
      const fiveMinuteSkew = 3e5;
      if (maxAge === 0 || Date.now() - fiveMinuteSkew > authTime + maxAge) {
        throw createClientAuthError(maxAgeTranspired);
      }
    }
    var UrlString = class _UrlString {
      get urlString() {
        return this._urlString;
      }
      constructor(url) {
        this._urlString = url;
        if (!this._urlString) {
          throw createClientConfigurationError(urlEmptyError);
        }
        if (!url.includes("#")) {
          this._urlString = _UrlString.canonicalizeUri(url);
        }
      }
      /**
       * Ensure urls are lower case and end with a / character.
       * @param url
       */
      static canonicalizeUri(url) {
        if (url) {
          let lowerCaseUrl = url.toLowerCase();
          if (StringUtils.endsWith(lowerCaseUrl, "?")) {
            lowerCaseUrl = lowerCaseUrl.slice(0, -1);
          } else if (StringUtils.endsWith(lowerCaseUrl, "?/")) {
            lowerCaseUrl = lowerCaseUrl.slice(0, -2);
          }
          if (!StringUtils.endsWith(lowerCaseUrl, "/")) {
            lowerCaseUrl += "/";
          }
          return lowerCaseUrl;
        }
        return url;
      }
      /**
       * Throws if urlString passed is not a valid authority URI string.
       */
      validateAsUri() {
        let components;
        try {
          components = this.getUrlComponents();
        } catch (e) {
          throw createClientConfigurationError(urlParseError);
        }
        if (!components.HostNameAndPort || !components.PathSegments) {
          throw createClientConfigurationError(urlParseError);
        }
        if (!components.Protocol || components.Protocol.toLowerCase() !== "https:") {
          throw createClientConfigurationError(authorityUriInsecure);
        }
      }
      /**
       * Given a url and a query string return the url with provided query string appended
       * @param url
       * @param queryString
       */
      static appendQueryString(url, queryString) {
        if (!queryString) {
          return url;
        }
        return url.indexOf("?") < 0 ? `${url}?${queryString}` : `${url}&${queryString}`;
      }
      /**
       * Returns a url with the hash removed
       * @param url
       */
      static removeHashFromUrl(url) {
        return _UrlString.canonicalizeUri(url.split("#")[0]);
      }
      /**
       * Given a url like https://a:b/common/d?e=f#g, and a tenantId, returns https://a:b/tenantId/d
       * @param href The url
       * @param tenantId The tenant id to replace
       */
      replaceTenantPath(tenantId) {
        const urlObject = this.getUrlComponents();
        const pathArray = urlObject.PathSegments;
        if (tenantId && pathArray.length !== 0 && (pathArray[0] === AADAuthority.COMMON || pathArray[0] === AADAuthority.ORGANIZATIONS)) {
          pathArray[0] = tenantId;
        }
        return _UrlString.constructAuthorityUriFromObject(urlObject);
      }
      /**
       * Parses out the components from a url string.
       * @returns An object with the various components. Please cache this value insted of calling this multiple times on the same url.
       */
      getUrlComponents() {
        const regEx = RegExp("^(([^:/?#]+):)?(//([^/?#]*))?([^?#]*)(\\?([^#]*))?(#(.*))?");
        const match = this.urlString.match(regEx);
        if (!match) {
          throw createClientConfigurationError(urlParseError);
        }
        const urlComponents = {
          Protocol: match[1],
          HostNameAndPort: match[4],
          AbsolutePath: match[5],
          QueryString: match[7]
        };
        let pathSegments = urlComponents.AbsolutePath.split("/");
        pathSegments = pathSegments.filter((val) => val && val.length > 0);
        urlComponents.PathSegments = pathSegments;
        if (urlComponents.QueryString && urlComponents.QueryString.endsWith("/")) {
          urlComponents.QueryString = urlComponents.QueryString.substring(0, urlComponents.QueryString.length - 1);
        }
        return urlComponents;
      }
      static getDomainFromUrl(url) {
        const regEx = RegExp("^([^:/?#]+://)?([^/?#]*)");
        const match = url.match(regEx);
        if (!match) {
          throw createClientConfigurationError(urlParseError);
        }
        return match[2];
      }
      static getAbsoluteUrl(relativeUrl, baseUrl) {
        if (relativeUrl[0] === FORWARD_SLASH) {
          const url = new _UrlString(baseUrl);
          const baseComponents = url.getUrlComponents();
          return baseComponents.Protocol + "//" + baseComponents.HostNameAndPort + relativeUrl;
        }
        return relativeUrl;
      }
      static constructAuthorityUriFromObject(urlObject) {
        return new _UrlString(urlObject.Protocol + "//" + urlObject.HostNameAndPort + "/" + urlObject.PathSegments.join("/"));
      }
    };
    var endpointHosts = [
      { host: "login.microsoftonline.com" },
      {
        host: "login.chinacloudapi.cn",
        issuerHost: "login.partner.microsoftonline.cn"
        // Issuer differs
      },
      { host: "login.microsoftonline.us" },
      { host: "login.sovcloud-identity.fr" },
      { host: "login.sovcloud-identity.de" },
      { host: "login.sovcloud-identity.sg" }
    ];
    function buildOpenIdConfig(host, issuerHost) {
      return {
        token_endpoint: `https://${host}/{tenantid}/oauth2/v2.0/token`,
        jwks_uri: `https://${host}/{tenantid}/discovery/v2.0/keys`,
        issuer: `https://${issuerHost}/{tenantid}/v2.0`,
        authorization_endpoint: `https://${host}/{tenantid}/oauth2/v2.0/authorize`,
        end_session_endpoint: `https://${host}/{tenantid}/oauth2/v2.0/logout`
      };
    }
    var dynamicEndpointMetadata = endpointHosts.reduce((acc, { host, issuerHost }) => {
      acc[host] = buildOpenIdConfig(host, issuerHost || host);
      return acc;
    }, {});
    var rawMetdataJSON = {
      endpointMetadata: dynamicEndpointMetadata,
      instanceDiscoveryMetadata: {
        metadata: [
          {
            preferred_network: "login.microsoftonline.com",
            preferred_cache: "login.windows.net",
            aliases: [
              "login.microsoftonline.com",
              "login.windows.net",
              "login.microsoft.com",
              "sts.windows.net"
            ]
          },
          {
            preferred_network: "login.partner.microsoftonline.cn",
            preferred_cache: "login.partner.microsoftonline.cn",
            aliases: [
              "login.partner.microsoftonline.cn",
              "login.chinacloudapi.cn"
            ]
          },
          {
            preferred_network: "login.microsoftonline.de",
            preferred_cache: "login.microsoftonline.de",
            aliases: ["login.microsoftonline.de"]
          },
          {
            preferred_network: "login.microsoftonline.us",
            preferred_cache: "login.microsoftonline.us",
            aliases: [
              "login.microsoftonline.us",
              "login.usgovcloudapi.net"
            ]
          },
          {
            preferred_network: "login-us.microsoftonline.com",
            preferred_cache: "login-us.microsoftonline.com",
            aliases: ["login-us.microsoftonline.com"]
          },
          {
            preferred_network: "login.sovcloud-identity.fr",
            preferred_cache: "login.sovcloud-identity.fr",
            aliases: ["login.sovcloud-identity.fr"]
          },
          {
            preferred_network: "login.sovcloud-identity.de",
            preferred_cache: "login.sovcloud-identity.de",
            aliases: ["login.sovcloud-identity.de"]
          },
          {
            preferred_network: "login.sovcloud-identity.sg",
            preferred_cache: "login.sovcloud-identity.sg",
            aliases: ["login.sovcloud-identity.sg"]
          }
        ]
      }
    };
    var EndpointMetadata = rawMetdataJSON.endpointMetadata;
    var InstanceDiscoveryMetadata = rawMetdataJSON.instanceDiscoveryMetadata;
    var InstanceDiscoveryMetadataAliases = /* @__PURE__ */ new Set();
    InstanceDiscoveryMetadata.metadata.forEach((metadataEntry) => {
      metadataEntry.aliases.forEach((alias) => {
        InstanceDiscoveryMetadataAliases.add(alias);
      });
    });
    function getAliasesFromStaticSources(staticAuthorityOptions, logger, correlationId) {
      let staticAliases;
      const canonicalAuthority = staticAuthorityOptions.canonicalAuthority;
      if (canonicalAuthority) {
        const authorityHost = new UrlString(canonicalAuthority).getUrlComponents().HostNameAndPort;
        staticAliases = getAliasesFromMetadata(logger, correlationId, authorityHost, staticAuthorityOptions.cloudDiscoveryMetadata?.metadata, AuthorityMetadataSource.CONFIG) || getAliasesFromMetadata(logger, correlationId, authorityHost, InstanceDiscoveryMetadata.metadata, AuthorityMetadataSource.HARDCODED_VALUES) || staticAuthorityOptions.knownAuthorities;
      }
      return staticAliases || [];
    }
    function getAliasesFromMetadata(logger, correlationId, authorityHost, cloudDiscoveryMetadata, source) {
      logger.trace(`getAliasesFromMetadata called with source: '${source}'`, correlationId);
      if (authorityHost && cloudDiscoveryMetadata) {
        const metadata = getCloudDiscoveryMetadataFromNetworkResponse(cloudDiscoveryMetadata, authorityHost);
        if (metadata) {
          logger.trace(`getAliasesFromMetadata: found cloud discovery metadata in '${source}', returning aliases`, correlationId);
          return metadata.aliases;
        } else {
          logger.trace(`getAliasesFromMetadata: did not find cloud discovery metadata in '${source}'`, correlationId);
        }
      }
      return null;
    }
    function getCloudDiscoveryMetadataFromHardcodedValues(authorityHost) {
      const metadata = getCloudDiscoveryMetadataFromNetworkResponse(InstanceDiscoveryMetadata.metadata, authorityHost);
      return metadata;
    }
    function getCloudDiscoveryMetadataFromNetworkResponse(response, authorityHost) {
      for (let i = 0; i < response.length; i++) {
        const metadata = response[i];
        if (metadata.aliases.includes(authorityHost)) {
          return metadata;
        }
      }
      return null;
    }
    var cacheQuotaExceeded = "cache_quota_exceeded";
    var cacheErrorUnknown = "cache_error_unknown";
    var CacheError = class _CacheError extends Error {
      constructor(errorCode, errorMessage) {
        const message = errorMessage || getDefaultErrorMessage(errorCode);
        super(message);
        Object.setPrototypeOf(this, _CacheError.prototype);
        this.name = "CacheError";
        this.errorCode = errorCode;
        this.errorMessage = message;
      }
    };
    function createCacheError(e) {
      if (!(e instanceof Error)) {
        return new CacheError(cacheErrorUnknown);
      }
      if (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.message.includes("exceeded the quota")) {
        return new CacheError(cacheQuotaExceeded);
      } else {
        return new CacheError(e.name, e.message);
      }
    }
    function buildClientInfo(rawClientInfo, base64Decode) {
      if (!rawClientInfo) {
        throw createClientAuthError(clientInfoEmptyError);
      }
      try {
        const decodedClientInfo = base64Decode(rawClientInfo);
        return JSON.parse(decodedClientInfo);
      } catch (e) {
        throw createClientAuthError(clientInfoDecodingError);
      }
    }
    function buildClientInfoFromHomeAccountId(homeAccountId) {
      if (!homeAccountId) {
        throw createClientAuthError(clientInfoDecodingError);
      }
      const clientInfoParts = homeAccountId.split(CLIENT_INFO_SEPARATOR, 2);
      return {
        uid: clientInfoParts[0],
        utid: clientInfoParts.length < 2 ? "" : clientInfoParts[1]
      };
    }
    var AuthorityType = {
      Default: 0,
      Adfs: 1,
      Dsts: 2,
      Ciam: 3
    };
    function getTenantIdFromIdTokenClaims(idTokenClaims) {
      if (idTokenClaims) {
        const tenantId = idTokenClaims.tid || idTokenClaims.tfp || idTokenClaims.acr;
        return tenantId || null;
      }
      return null;
    }
    var ProtocolMode = {
      /**
       * Auth Code + PKCE with Entra ID (formerly AAD) specific optimizations and features
       */
      AAD: "AAD",
      /**
       * Auth Code + PKCE without Entra ID specific optimizations and features. For use only with non-Microsoft owned authorities.
       * Support is limited for this mode.
       */
      OIDC: "OIDC",
      /**
       * Encrypted Authorize Response (EAR) with Entra ID specific optimizations and features
       */
      EAR: "EAR"
    };
    function getAccountInfo(accountEntity) {
      const tenantProfiles = accountEntity.tenantProfiles || [];
      if (tenantProfiles.length === 0 && accountEntity.realm && accountEntity.localAccountId) {
        tenantProfiles.push(buildTenantProfile(accountEntity.homeAccountId, accountEntity.localAccountId, accountEntity.realm));
      }
      return {
        homeAccountId: accountEntity.homeAccountId,
        environment: accountEntity.environment,
        tenantId: accountEntity.realm,
        username: accountEntity.username,
        localAccountId: accountEntity.localAccountId,
        loginHint: accountEntity.loginHint,
        name: accountEntity.name,
        nativeAccountId: accountEntity.nativeAccountId,
        authorityType: accountEntity.authorityType,
        // Deserialize tenant profiles array into a Map
        tenantProfiles: new Map(tenantProfiles.map((tenantProfile) => {
          return [tenantProfile.tenantId, tenantProfile];
        })),
        dataBoundary: accountEntity.dataBoundary
      };
    }
    function createAccountEntity(accountDetails, authority, base64Decode) {
      let authorityType;
      if (authority.authorityType === AuthorityType.Adfs) {
        authorityType = CACHE_ACCOUNT_TYPE_ADFS;
      } else if (authority.protocolMode === ProtocolMode.OIDC) {
        authorityType = CACHE_ACCOUNT_TYPE_GENERIC;
      } else {
        authorityType = CACHE_ACCOUNT_TYPE_MSSTS;
      }
      let clientInfo;
      let dataBoundary;
      if (accountDetails.clientInfo && base64Decode) {
        clientInfo = buildClientInfo(accountDetails.clientInfo, base64Decode);
        if (clientInfo.xms_tdbr) {
          dataBoundary = clientInfo.xms_tdbr === "EU" ? "EU" : "None";
        }
      }
      const env = accountDetails.environment || authority && authority.getPreferredCache();
      if (!env) {
        throw createClientAuthError(invalidCacheEnvironment);
      }
      const preferredUsername = accountDetails.idTokenClaims?.preferred_username || accountDetails.idTokenClaims?.upn;
      const email = accountDetails.idTokenClaims?.emails ? accountDetails.idTokenClaims.emails[0] : null;
      const username = preferredUsername || email || "";
      const loginHint = accountDetails.idTokenClaims?.login_hint;
      const realm = clientInfo?.utid || getTenantIdFromIdTokenClaims(accountDetails.idTokenClaims) || "";
      const localAccountId = clientInfo?.uid || accountDetails.idTokenClaims?.oid || accountDetails.idTokenClaims?.sub || "";
      let tenantProfiles;
      if (accountDetails.tenantProfiles) {
        tenantProfiles = accountDetails.tenantProfiles;
      } else {
        const tenantProfile = buildTenantProfile(accountDetails.homeAccountId, localAccountId, realm, accountDetails.idTokenClaims);
        tenantProfiles = [tenantProfile];
      }
      return {
        homeAccountId: accountDetails.homeAccountId,
        environment: env,
        realm,
        localAccountId,
        username,
        authorityType,
        loginHint,
        clientInfo: accountDetails.clientInfo,
        name: accountDetails.idTokenClaims?.name || "",
        lastModificationTime: void 0,
        lastModificationApp: void 0,
        cloudGraphHostName: accountDetails.cloudGraphHostName,
        msGraphHost: accountDetails.msGraphHost,
        nativeAccountId: accountDetails.nativeAccountId,
        tenantProfiles,
        dataBoundary
      };
    }
    function generateHomeAccountId(serverClientInfo, authType, logger, cryptoObj, correlationId, idTokenClaims) {
      if (!(authType === AuthorityType.Adfs || authType === AuthorityType.Dsts)) {
        if (serverClientInfo) {
          try {
            const clientInfo = buildClientInfo(serverClientInfo, cryptoObj.base64Decode);
            if (clientInfo.uid && clientInfo.utid) {
              return `${clientInfo.uid}.${clientInfo.utid}`;
            }
          } catch (e) {
          }
        }
        logger.warning("No client info in response", correlationId);
      }
      return idTokenClaims?.sub || "";
    }
    function isAccountEntity(entity) {
      if (!entity) {
        return false;
      }
      return entity.hasOwnProperty("homeAccountId") && entity.hasOwnProperty("environment") && entity.hasOwnProperty("realm") && entity.hasOwnProperty("localAccountId") && entity.hasOwnProperty("username") && entity.hasOwnProperty("authorityType");
    }
    var CacheManager = class {
      constructor(clientId, cryptoImpl, logger, performanceClient, staticAuthorityOptions) {
        this.clientId = clientId;
        this.cryptoImpl = cryptoImpl;
        this.commonLogger = logger.clone(name$1, version$1);
        this.staticAuthorityOptions = staticAuthorityOptions;
        this.performanceClient = performanceClient;
      }
      /**
       * Returns all the accounts in the cache that match the optional filter. If no filter is provided, all accounts are returned.
       * @param accountFilter - (Optional) filter to narrow down the accounts returned
       * @returns Array of AccountInfo objects in cache
       */
      getAllAccounts(accountFilter = {}, correlationId) {
        return this.buildTenantProfiles(this.getAccountsFilteredBy(accountFilter, correlationId), correlationId, accountFilter);
      }
      /**
       * Gets first tenanted AccountInfo object found based on provided filters
       */
      getAccountInfoFilteredBy(accountFilter, correlationId) {
        const allAccounts = this.getAllAccounts(accountFilter, correlationId);
        if (allAccounts.length > 1) {
          const sortedAccounts = allAccounts.sort((account) => {
            return account.idTokenClaims ? -1 : 1;
          });
          return sortedAccounts[0];
        } else if (allAccounts.length === 1) {
          return allAccounts[0];
        } else {
          return null;
        }
      }
      /**
       * Returns a single matching
       * @param accountFilter
       * @returns
       */
      getBaseAccountInfo(accountFilter, correlationId) {
        const accountEntities = this.getAccountsFilteredBy(accountFilter, correlationId);
        if (accountEntities.length > 0) {
          return getAccountInfo(accountEntities[0]);
        } else {
          return null;
        }
      }
      /**
       * Matches filtered account entities with cached ID tokens that match the tenant profile-specific account filters
       * and builds the account info objects from the matching ID token's claims
       * @param cachedAccounts
       * @param accountFilter
       * @returns Array of AccountInfo objects that match account and tenant profile filters
       */
      buildTenantProfiles(cachedAccounts, correlationId, accountFilter) {
        return cachedAccounts.flatMap((accountEntity) => {
          return this.getTenantProfilesFromAccountEntity(accountEntity, correlationId, accountFilter?.tenantId, accountFilter);
        });
      }
      getTenantedAccountInfoByFilter(accountInfo, tokenKeys, tenantProfile, correlationId, tenantProfileFilter) {
        let tenantedAccountInfo = null;
        let idTokenClaims;
        if (tenantProfileFilter) {
          if (!this.tenantProfileMatchesFilter(tenantProfile, tenantProfileFilter)) {
            return null;
          }
        }
        const idToken = this.getIdToken(accountInfo, correlationId, tokenKeys, tenantProfile.tenantId);
        if (idToken) {
          idTokenClaims = extractTokenClaims(idToken.secret, this.cryptoImpl.base64Decode);
          if (!this.idTokenClaimsMatchTenantProfileFilter(idTokenClaims, tenantProfileFilter)) {
            return null;
          }
        }
        tenantedAccountInfo = updateAccountTenantProfileData(accountInfo, tenantProfile, idTokenClaims, idToken?.secret);
        return tenantedAccountInfo;
      }
      getTenantProfilesFromAccountEntity(accountEntity, correlationId, targetTenantId, tenantProfileFilter) {
        const accountInfo = getAccountInfo(accountEntity);
        let searchTenantProfiles = accountInfo.tenantProfiles || /* @__PURE__ */ new Map();
        const tokenKeys = this.getTokenKeys();
        if (targetTenantId) {
          const tenantProfile = searchTenantProfiles.get(targetTenantId);
          if (tenantProfile) {
            searchTenantProfiles = /* @__PURE__ */ new Map([
              [targetTenantId, tenantProfile]
            ]);
          } else {
            return [];
          }
        }
        const matchingTenantProfiles = [];
        searchTenantProfiles.forEach((tenantProfile) => {
          const tenantedAccountInfo = this.getTenantedAccountInfoByFilter(accountInfo, tokenKeys, tenantProfile, correlationId, tenantProfileFilter);
          if (tenantedAccountInfo) {
            matchingTenantProfiles.push(tenantedAccountInfo);
          }
        });
        return matchingTenantProfiles;
      }
      tenantProfileMatchesFilter(tenantProfile, tenantProfileFilter) {
        if (!!tenantProfileFilter.localAccountId && !this.matchLocalAccountIdFromTenantProfile(tenantProfile, tenantProfileFilter.localAccountId)) {
          return false;
        }
        if (!!tenantProfileFilter.name && !(tenantProfile.name === tenantProfileFilter.name)) {
          return false;
        }
        if (tenantProfileFilter.isHomeTenant !== void 0 && !(tenantProfile.isHomeTenant === tenantProfileFilter.isHomeTenant)) {
          return false;
        }
        return true;
      }
      idTokenClaimsMatchTenantProfileFilter(idTokenClaims, tenantProfileFilter) {
        if (tenantProfileFilter) {
          if (!!tenantProfileFilter.localAccountId && !this.matchLocalAccountIdFromTokenClaims(idTokenClaims, tenantProfileFilter.localAccountId)) {
            return false;
          }
          if (!!tenantProfileFilter.loginHint && !this.matchLoginHintFromTokenClaims(idTokenClaims, tenantProfileFilter.loginHint)) {
            return false;
          }
          if (!!tenantProfileFilter.username && !this.matchUsername(idTokenClaims.preferred_username, tenantProfileFilter.username)) {
            return false;
          }
          if (!!tenantProfileFilter.name && !this.matchName(idTokenClaims, tenantProfileFilter.name)) {
            return false;
          }
          if (!!tenantProfileFilter.sid && !this.matchSid(idTokenClaims, tenantProfileFilter.sid)) {
            return false;
          }
        }
        return true;
      }
      /**
       * saves a cache record
       * @param cacheRecord {CacheRecord}
       * @param storeInCache {?StoreInCache}
       * @param correlationId {?string} correlation id
       */
      async saveCacheRecord(cacheRecord, correlationId, kmsi, apiId, storeInCache) {
        if (!cacheRecord) {
          throw createClientAuthError(invalidCacheRecord);
        }
        try {
          if (!!cacheRecord.account) {
            await this.setAccount(cacheRecord.account, correlationId, kmsi, apiId);
          }
          if (!!cacheRecord.idToken && storeInCache?.idToken !== false) {
            await this.setIdTokenCredential(cacheRecord.idToken, correlationId, kmsi);
          }
          if (!!cacheRecord.accessToken && storeInCache?.accessToken !== false) {
            await this.saveAccessToken(cacheRecord.accessToken, correlationId, kmsi);
          }
          if (!!cacheRecord.refreshToken && storeInCache?.refreshToken !== false) {
            await this.setRefreshTokenCredential(cacheRecord.refreshToken, correlationId, kmsi);
          }
          if (!!cacheRecord.appMetadata) {
            this.setAppMetadata(cacheRecord.appMetadata, correlationId);
          }
        } catch (e) {
          this.commonLogger?.error(`CacheManager.saveCacheRecord: failed`, correlationId);
          if (e instanceof AuthError) {
            throw e;
          } else {
            throw createCacheError(e);
          }
        }
      }
      /**
       * saves access token credential
       * @param credential
       */
      async saveAccessToken(credential, correlationId, kmsi) {
        const accessTokenFilter = {
          clientId: credential.clientId,
          credentialType: credential.credentialType,
          environment: credential.environment,
          homeAccountId: credential.homeAccountId,
          realm: credential.realm,
          tokenType: credential.tokenType
        };
        const tokenKeys = this.getTokenKeys();
        const currentScopes = ScopeSet.fromString(credential.target);
        tokenKeys.accessToken.forEach((key) => {
          if (!this.accessTokenKeyMatchesFilter(key, accessTokenFilter, false)) {
            return;
          }
          const tokenEntity = this.getAccessTokenCredential(key, correlationId);
          if (tokenEntity && this.credentialMatchesFilter(tokenEntity, accessTokenFilter, correlationId)) {
            const tokenScopeSet = ScopeSet.fromString(tokenEntity.target);
            if (tokenScopeSet.intersectingScopeSets(currentScopes)) {
              this.removeAccessToken(key, correlationId);
            }
          }
        });
        await this.setAccessTokenCredential(credential, correlationId, kmsi);
      }
      /**
       * Retrieve account entities matching all provided tenant-agnostic filters; if no filter is set, get all account entities in the cache
       * Not checking for casing as keys are all generated in lower case, remember to convert to lower case if object properties are compared
       * @param accountFilter - An object containing Account properties to filter by
       */
      getAccountsFilteredBy(accountFilter, correlationId) {
        const allAccountKeys = this.getAccountKeys();
        const matchingAccounts = [];
        allAccountKeys.forEach((cacheKey) => {
          const entity = this.getAccount(cacheKey, correlationId);
          if (!entity) {
            return;
          }
          if (!!accountFilter.homeAccountId && !this.matchHomeAccountId(entity, accountFilter.homeAccountId)) {
            return;
          }
          if (!!accountFilter.username && !this.matchUsername(entity.username, accountFilter.username)) {
            return;
          }
          if (!!accountFilter.environment && !this.matchEnvironment(entity, accountFilter.environment, correlationId)) {
            return;
          }
          if (!!accountFilter.realm && !this.matchRealm(entity, accountFilter.realm)) {
            return;
          }
          if (!!accountFilter.nativeAccountId && !this.matchNativeAccountId(entity, accountFilter.nativeAccountId)) {
            return;
          }
          if (!!accountFilter.authorityType && !this.matchAuthorityType(entity, accountFilter.authorityType)) {
            return;
          }
          const tenantProfileFilter = {
            localAccountId: accountFilter?.localAccountId,
            name: accountFilter?.name
          };
          const matchingTenantProfiles = entity.tenantProfiles?.filter((tenantProfile) => {
            return this.tenantProfileMatchesFilter(tenantProfile, tenantProfileFilter);
          });
          if (matchingTenantProfiles && matchingTenantProfiles.length === 0) {
            return;
          }
          matchingAccounts.push(entity);
        });
        return matchingAccounts;
      }
      /**
       * Returns whether or not the given credential entity matches the filter
       * @param entity
       * @param filter
       * @param correlationId
       * @returns
       */
      credentialMatchesFilter(entity, filter, correlationId) {
        if (!!filter.clientId && !this.matchClientId(entity, filter.clientId)) {
          return false;
        }
        if (!!filter.userAssertionHash && !this.matchUserAssertionHash(entity, filter.userAssertionHash)) {
          return false;
        }
        if (typeof filter.homeAccountId === "string" && !this.matchHomeAccountId(entity, filter.homeAccountId)) {
          return false;
        }
        if (!!filter.environment && !this.matchEnvironment(entity, filter.environment, correlationId)) {
          return false;
        }
        if (!!filter.realm && !this.matchRealm(entity, filter.realm)) {
          return false;
        }
        if (!!filter.credentialType && !this.matchCredentialType(entity, filter.credentialType)) {
          return false;
        }
        if (!!filter.familyId && !this.matchFamilyId(entity, filter.familyId)) {
          return false;
        }
        if (!!filter.target && !this.matchTarget(entity, filter.target)) {
          return false;
        }
        if (entity.credentialType === CredentialType.ACCESS_TOKEN_WITH_AUTH_SCHEME) {
          if (!!filter.tokenType && !this.matchTokenType(entity, filter.tokenType)) {
            return false;
          }
          if (filter.tokenType === AuthenticationScheme.SSH) {
            if (filter.keyId && !this.matchKeyId(entity, filter.keyId)) {
              return false;
            }
          }
        }
        return true;
      }
      /**
       * retrieve appMetadata matching all provided filters; if no filter is set, get all appMetadata
       * @param filter
       * @param correlationId
       */
      getAppMetadataFilteredBy(filter, correlationId) {
        const allCacheKeys = this.getKeys();
        const matchingAppMetadata = {};
        allCacheKeys.forEach((cacheKey) => {
          if (!this.isAppMetadata(cacheKey)) {
            return;
          }
          const entity = this.getAppMetadata(cacheKey, correlationId);
          if (!entity) {
            return;
          }
          if (!!filter.environment && !this.matchEnvironment(entity, filter.environment, correlationId)) {
            return;
          }
          if (!!filter.clientId && !this.matchClientId(entity, filter.clientId)) {
            return;
          }
          matchingAppMetadata[cacheKey] = entity;
        });
        return matchingAppMetadata;
      }
      /**
       * retrieve authorityMetadata that contains a matching alias
       * @param host
       * @param correlationId
       */
      getAuthorityMetadataByAlias(host, correlationId) {
        const allCacheKeys = this.getAuthorityMetadataKeys();
        let matchedEntity = null;
        allCacheKeys.forEach((cacheKey) => {
          if (!this.isAuthorityMetadata(cacheKey) || cacheKey.indexOf(this.clientId) === -1) {
            return;
          }
          const entity = this.getAuthorityMetadata(cacheKey, correlationId);
          if (!entity) {
            return;
          }
          if (entity.aliases.indexOf(host) === -1) {
            return;
          }
          matchedEntity = entity;
        });
        return matchedEntity;
      }
      /**
       * Removes all accounts and related tokens from cache.
       */
      removeAllAccounts(correlationId) {
        const accounts = this.getAllAccounts({}, correlationId);
        accounts.forEach((account) => {
          this.removeAccount(account, correlationId);
        });
      }
      /**
       * Removes the account and related tokens for a given account key
       * @param account
       */
      removeAccount(account, correlationId) {
        this.removeAccountContext(account, correlationId);
        const accountKeys = this.getAccountKeys();
        const keyFilter = (key) => {
          return key.includes(account.homeAccountId) && key.includes(account.environment);
        };
        accountKeys.filter(keyFilter).forEach((key) => {
          this.removeItem(key, correlationId);
          this.performanceClient.incrementFields({ accountsRemoved: 1 }, correlationId);
        });
      }
      /**
       * Removes credentials associated with the provided account
       * @param account
       */
      removeAccountContext(account, correlationId) {
        const allTokenKeys = this.getTokenKeys();
        const keyFilter = (key) => {
          return key.includes(account.homeAccountId) && key.includes(account.environment);
        };
        allTokenKeys.idToken.filter(keyFilter).forEach((key) => {
          this.removeIdToken(key, correlationId);
        });
        allTokenKeys.accessToken.filter(keyFilter).forEach((key) => {
          this.removeAccessToken(key, correlationId);
        });
        allTokenKeys.refreshToken.filter(keyFilter).forEach((key) => {
          this.removeRefreshToken(key, correlationId);
        });
      }
      /**
       * returns a boolean if the given credential is removed
       * @param key
       * @param correlationId
       */
      removeAccessToken(key, correlationId) {
        const credential = this.getAccessTokenCredential(key, correlationId);
        if (!credential) {
          return;
        }
        this.removeItem(key, correlationId);
        this.performanceClient.incrementFields({ accessTokensRemoved: 1 }, correlationId);
        if (credential.credentialType.toLowerCase() === CredentialType.ACCESS_TOKEN_WITH_AUTH_SCHEME.toLowerCase()) {
          if (credential.tokenType === AuthenticationScheme.POP) {
            const accessTokenWithAuthSchemeEntity = credential;
            const kid = accessTokenWithAuthSchemeEntity.keyId;
            if (kid) {
              void this.cryptoImpl.removeTokenBindingKey(kid, correlationId).catch(() => {
                this.commonLogger.error(`Failed to remove token binding key '${kid}'`, correlationId);
                this.performanceClient?.incrementFields({ removeTokenBindingKeyFailure: 1 }, correlationId);
              });
            }
          }
        }
      }
      /**
       * Removes all app metadata objects from cache.
       */
      removeAppMetadata(correlationId) {
        const allCacheKeys = this.getKeys();
        allCacheKeys.forEach((cacheKey) => {
          if (this.isAppMetadata(cacheKey)) {
            this.removeItem(cacheKey, correlationId);
          }
        });
        return true;
      }
      /**
       * Retrieve IdTokenEntity from cache
       * @param account {AccountInfo}
       * @param tokenKeys {?TokenKeys}
       * @param targetRealm {?string}
       * @param performanceClient {?IPerformanceClient}
       * @param correlationId {?string}
       */
      getIdToken(account, correlationId, tokenKeys, targetRealm) {
        this.commonLogger.trace("CacheManager - getIdToken called", correlationId);
        const idTokenFilter = {
          homeAccountId: account.homeAccountId,
          environment: account.environment,
          credentialType: CredentialType.ID_TOKEN,
          clientId: this.clientId,
          realm: targetRealm
        };
        const idTokenMap = this.getIdTokensByFilter(idTokenFilter, correlationId, tokenKeys);
        const numIdTokens = idTokenMap.size;
        if (numIdTokens < 1) {
          this.commonLogger.info("CacheManager:getIdToken - No token found", correlationId);
          return null;
        } else if (numIdTokens > 1) {
          let tokensToBeRemoved = idTokenMap;
          if (!targetRealm) {
            const homeIdTokenMap = /* @__PURE__ */ new Map();
            idTokenMap.forEach((idToken, key) => {
              if (idToken.realm === account.tenantId) {
                homeIdTokenMap.set(key, idToken);
              }
            });
            const numHomeIdTokens = homeIdTokenMap.size;
            if (numHomeIdTokens < 1) {
              this.commonLogger.info("CacheManager:getIdToken - Multiple ID tokens found for account but none match account entity tenant id, returning first result", correlationId);
              return idTokenMap.values().next().value;
            } else if (numHomeIdTokens === 1) {
              this.commonLogger.info("CacheManager:getIdToken - Multiple ID tokens found for account, defaulting to home tenant profile", correlationId);
              return homeIdTokenMap.values().next().value;
            } else {
              tokensToBeRemoved = homeIdTokenMap;
            }
          }
          this.commonLogger.info("CacheManager:getIdToken - Multiple matching ID tokens found, clearing them", correlationId);
          tokensToBeRemoved.forEach((idToken, key) => {
            this.removeIdToken(key, correlationId);
          });
          this.performanceClient.addFields({ multiMatchedID: idTokenMap.size }, correlationId);
          return null;
        }
        this.commonLogger.info("CacheManager:getIdToken - Returning ID token", correlationId);
        return idTokenMap.values().next().value;
      }
      /**
       * Gets all idTokens matching the given filter
       * @param filter
       * @returns
       */
      getIdTokensByFilter(filter, correlationId, tokenKeys) {
        const idTokenKeys = tokenKeys && tokenKeys.idToken || this.getTokenKeys().idToken;
        const idTokens = /* @__PURE__ */ new Map();
        idTokenKeys.forEach((key) => {
          if (!this.idTokenKeyMatchesFilter(key, {
            clientId: this.clientId,
            ...filter
          })) {
            return;
          }
          const idToken = this.getIdTokenCredential(key, correlationId);
          if (idToken && this.credentialMatchesFilter(idToken, filter, correlationId)) {
            idTokens.set(key, idToken);
          }
        });
        return idTokens;
      }
      /**
       * Validate the cache key against filter before retrieving and parsing cache value
       * @param key
       * @param filter
       * @returns
       */
      idTokenKeyMatchesFilter(inputKey, filter) {
        const key = inputKey.toLowerCase();
        if (filter.clientId && key.indexOf(filter.clientId.toLowerCase()) === -1) {
          return false;
        }
        if (filter.homeAccountId && key.indexOf(filter.homeAccountId.toLowerCase()) === -1) {
          return false;
        }
        return true;
      }
      /**
       * Removes idToken from the cache
       * @param key
       */
      removeIdToken(key, correlationId) {
        this.removeItem(key, correlationId);
      }
      /**
       * Removes refresh token from the cache
       * @param key
       */
      removeRefreshToken(key, correlationId) {
        this.removeItem(key, correlationId);
      }
      /**
       * Retrieve AccessTokenEntity from cache
       * @param account {AccountInfo}
       * @param request {BaseAuthRequest}
       * @param tokenKeys {?TokenKeys}
       * @param performanceClient {?IPerformanceClient}
       */
      getAccessToken(account, request, tokenKeys, targetRealm) {
        const correlationId = request.correlationId;
        this.commonLogger.trace("CacheManager - getAccessToken called", correlationId);
        const scopes = ScopeSet.createSearchScopes(request.scopes);
        const authScheme = request.authenticationScheme || AuthenticationScheme.BEARER;
        const credentialType = authScheme.toLowerCase() !== AuthenticationScheme.BEARER.toLowerCase() ? CredentialType.ACCESS_TOKEN_WITH_AUTH_SCHEME : CredentialType.ACCESS_TOKEN;
        const accessTokenFilter = {
          homeAccountId: account.homeAccountId,
          environment: account.environment,
          credentialType,
          clientId: this.clientId,
          realm: targetRealm || account.tenantId,
          target: scopes,
          tokenType: authScheme,
          keyId: request.sshKid
        };
        const accessTokenKeys = tokenKeys && tokenKeys.accessToken || this.getTokenKeys().accessToken;
        const accessTokens = [];
        accessTokenKeys.forEach((key) => {
          if (this.accessTokenKeyMatchesFilter(key, accessTokenFilter, true)) {
            const accessToken = this.getAccessTokenCredential(key, correlationId);
            if (accessToken && this.credentialMatchesFilter(accessToken, accessTokenFilter, correlationId)) {
              accessTokens.push(accessToken);
            }
          }
        });
        const numAccessTokens = accessTokens.length;
        if (numAccessTokens < 1) {
          this.commonLogger.info("CacheManager:getAccessToken - No token found", correlationId);
          return null;
        } else if (numAccessTokens > 1) {
          this.commonLogger.info("CacheManager:getAccessToken - Multiple access tokens found, clearing them", correlationId);
          accessTokens.forEach((accessToken) => {
            this.removeAccessToken(this.generateCredentialKey(accessToken), correlationId);
          });
          this.performanceClient.addFields({ multiMatchedAT: accessTokens.length }, correlationId);
          return null;
        }
        this.commonLogger.info("CacheManager:getAccessToken - Returning access token", correlationId);
        return accessTokens[0];
      }
      /**
       * Validate the cache key against filter before retrieving and parsing cache value
       * @param key
       * @param filter
       * @param keyMustContainAllScopes
       * @returns
       */
      accessTokenKeyMatchesFilter(inputKey, filter, keyMustContainAllScopes) {
        const key = inputKey.toLowerCase();
        if (filter.clientId && key.indexOf(filter.clientId.toLowerCase()) === -1) {
          return false;
        }
        if (filter.homeAccountId && key.indexOf(filter.homeAccountId.toLowerCase()) === -1) {
          return false;
        }
        if (filter.realm && key.indexOf(filter.realm.toLowerCase()) === -1) {
          return false;
        }
        if (filter.target) {
          const scopes = filter.target.asArray();
          for (let i = 0; i < scopes.length; i++) {
            if (keyMustContainAllScopes && !key.includes(scopes[i].toLowerCase())) {
              return false;
            } else if (!keyMustContainAllScopes && key.includes(scopes[i].toLowerCase())) {
              return true;
            }
          }
        }
        return true;
      }
      /**
       * Gets all access tokens matching the filter
       * @param filter
       * @returns
       */
      getAccessTokensByFilter(filter, correlationId) {
        const tokenKeys = this.getTokenKeys();
        const accessTokens = [];
        tokenKeys.accessToken.forEach((key) => {
          if (!this.accessTokenKeyMatchesFilter(key, filter, true)) {
            return;
          }
          const accessToken = this.getAccessTokenCredential(key, correlationId);
          if (accessToken && this.credentialMatchesFilter(accessToken, filter, correlationId)) {
            accessTokens.push(accessToken);
          }
        });
        return accessTokens;
      }
      /**
       * Helper to retrieve the appropriate refresh token from cache
       * @param account {AccountInfo}
       * @param familyRT {boolean}
       * @param tokenKeys {?TokenKeys}
       * @param performanceClient {?IPerformanceClient}
       * @param correlationId {?string}
       */
      getRefreshToken(account, familyRT, correlationId, tokenKeys) {
        this.commonLogger.trace("CacheManager - getRefreshToken called", correlationId);
        const id = familyRT ? THE_FAMILY_ID : void 0;
        const refreshTokenFilter = {
          homeAccountId: account.homeAccountId,
          environment: account.environment,
          credentialType: CredentialType.REFRESH_TOKEN,
          clientId: this.clientId,
          familyId: id
        };
        const refreshTokenKeys = tokenKeys && tokenKeys.refreshToken || this.getTokenKeys().refreshToken;
        const refreshTokens = [];
        refreshTokenKeys.forEach((key) => {
          if (this.refreshTokenKeyMatchesFilter(key, refreshTokenFilter)) {
            const refreshToken = this.getRefreshTokenCredential(key, correlationId);
            if (refreshToken && this.credentialMatchesFilter(refreshToken, refreshTokenFilter, correlationId)) {
              refreshTokens.push(refreshToken);
            }
          }
        });
        const numRefreshTokens = refreshTokens.length;
        if (numRefreshTokens < 1) {
          this.commonLogger.info("CacheManager:getRefreshToken - No refresh token found.", correlationId);
          return null;
        }
        if (numRefreshTokens > 1) {
          this.performanceClient.addFields({ multiMatchedRT: numRefreshTokens }, correlationId);
        }
        this.commonLogger.info("CacheManager:getRefreshToken - returning refresh token", correlationId);
        return refreshTokens[0];
      }
      /**
       * Validate the cache key against filter before retrieving and parsing cache value
       * @param key
       * @param filter
       */
      refreshTokenKeyMatchesFilter(inputKey, filter) {
        const key = inputKey.toLowerCase();
        if (filter.familyId && key.indexOf(filter.familyId.toLowerCase()) === -1) {
          return false;
        }
        if (!filter.familyId && filter.clientId && key.indexOf(filter.clientId.toLowerCase()) === -1) {
          return false;
        }
        if (filter.homeAccountId && key.indexOf(filter.homeAccountId.toLowerCase()) === -1) {
          return false;
        }
        return true;
      }
      /**
       * Retrieve AppMetadataEntity from cache
       */
      readAppMetadataFromCache(environment, correlationId) {
        const appMetadataFilter = {
          environment,
          clientId: this.clientId
        };
        const appMetadata = this.getAppMetadataFilteredBy(appMetadataFilter, correlationId);
        const appMetadataEntries = Object.keys(appMetadata).map((key) => appMetadata[key]);
        const numAppMetadata = appMetadataEntries.length;
        if (numAppMetadata < 1) {
          return null;
        } else if (numAppMetadata > 1) {
          throw createClientAuthError(multipleMatchingAppMetadata);
        }
        return appMetadataEntries[0];
      }
      /**
       * Return the family_id value associated  with FOCI
       * @param environment
       * @param clientId
       */
      isAppMetadataFOCI(environment, correlationId) {
        const appMetadata = this.readAppMetadataFromCache(environment, correlationId);
        return !!(appMetadata && appMetadata.familyId === THE_FAMILY_ID);
      }
      /**
       * helper to match account ids
       * @param value
       * @param homeAccountId
       */
      matchHomeAccountId(entity, homeAccountId) {
        return !!(typeof entity.homeAccountId === "string" && homeAccountId === entity.homeAccountId);
      }
      /**
       * helper to match account ids
       * @param entity
       * @param localAccountId
       * @returns
       */
      matchLocalAccountIdFromTokenClaims(tokenClaims, localAccountId) {
        const idTokenLocalAccountId = tokenClaims.oid || tokenClaims.sub;
        return localAccountId === idTokenLocalAccountId;
      }
      matchLocalAccountIdFromTenantProfile(tenantProfile, localAccountId) {
        return tenantProfile.localAccountId === localAccountId;
      }
      /**
       * helper to match names
       * @param entity
       * @param name
       * @returns true if the downcased name properties are present and match in the filter and the entity
       */
      matchName(claims, name2) {
        return !!(name2.toLowerCase() === claims.name?.toLowerCase());
      }
      /**
       * helper to match usernames
       * @param entity
       * @param username
       * @returns
       */
      matchUsername(cachedUsername, filterUsername) {
        return !!(cachedUsername && typeof cachedUsername === "string" && filterUsername?.toLowerCase() === cachedUsername.toLowerCase());
      }
      /**
       * helper to match assertion
       * @param value
       * @param oboAssertion
       */
      matchUserAssertionHash(entity, userAssertionHash) {
        return !!(entity.userAssertionHash && userAssertionHash === entity.userAssertionHash);
      }
      /**
       * helper to match environment
       * @param value
       * @param environment
       */
      matchEnvironment(entity, environment, correlationId) {
        if (this.staticAuthorityOptions) {
          const staticAliases = getAliasesFromStaticSources(this.staticAuthorityOptions, this.commonLogger, correlationId);
          if (staticAliases.includes(environment) && staticAliases.includes(entity.environment)) {
            return true;
          }
        }
        const cloudMetadata = this.getAuthorityMetadataByAlias(environment, correlationId);
        if (cloudMetadata && cloudMetadata.aliases.indexOf(entity.environment) > -1) {
          return true;
        }
        return false;
      }
      /**
       * helper to match credential type
       * @param entity
       * @param credentialType
       */
      matchCredentialType(entity, credentialType) {
        return entity.credentialType && credentialType.toLowerCase() === entity.credentialType.toLowerCase();
      }
      /**
       * helper to match client ids
       * @param entity
       * @param clientId
       */
      matchClientId(entity, clientId) {
        return !!(entity.clientId && clientId === entity.clientId);
      }
      /**
       * helper to match family ids
       * @param entity
       * @param familyId
       */
      matchFamilyId(entity, familyId) {
        return !!(entity.familyId && familyId === entity.familyId);
      }
      /**
       * helper to match realm
       * @param entity
       * @param realm
       */
      matchRealm(entity, realm) {
        return !!(entity.realm?.toLowerCase() === realm.toLowerCase());
      }
      /**
       * helper to match nativeAccountId
       * @param entity
       * @param nativeAccountId
       * @returns boolean indicating the match result
       */
      matchNativeAccountId(entity, nativeAccountId) {
        return !!(entity.nativeAccountId && nativeAccountId === entity.nativeAccountId);
      }
      /**
       * helper to match loginHint which can be either:
       * 1. login_hint ID token claim
       * 2. username in cached account object
       * 3. upn in ID token claims
       * @param entity
       * @param loginHint
       * @returns
       */
      matchLoginHintFromTokenClaims(tokenClaims, loginHint) {
        if (tokenClaims.login_hint === loginHint) {
          return true;
        }
        if (tokenClaims.preferred_username === loginHint) {
          return true;
        }
        if (tokenClaims.upn === loginHint) {
          return true;
        }
        return false;
      }
      /**
       * Helper to match sid
       * @param entity
       * @param sid
       * @returns true if the sid claim is present and matches the filter
       */
      matchSid(idTokenClaims, sid) {
        return idTokenClaims.sid === sid;
      }
      matchAuthorityType(entity, authorityType) {
        return !!(entity.authorityType && authorityType.toLowerCase() === entity.authorityType.toLowerCase());
      }
      /**
       * Returns true if the target scopes are a subset of the current entity's scopes, false otherwise.
       * @param entity
       * @param target
       */
      matchTarget(entity, target) {
        const isNotAccessTokenCredential = entity.credentialType !== CredentialType.ACCESS_TOKEN && entity.credentialType !== CredentialType.ACCESS_TOKEN_WITH_AUTH_SCHEME;
        if (isNotAccessTokenCredential || !entity.target) {
          return false;
        }
        const entityScopeSet = ScopeSet.fromString(entity.target);
        return entityScopeSet.containsScopeSet(target);
      }
      /**
       * Returns true if the credential's tokenType or Authentication Scheme matches the one in the request, false otherwise
       * @param entity
       * @param tokenType
       */
      matchTokenType(entity, tokenType) {
        return !!(entity.tokenType && entity.tokenType === tokenType);
      }
      /**
       * Returns true if the credential's keyId matches the one in the request, false otherwise
       * @param entity
       * @param keyId
       */
      matchKeyId(entity, keyId) {
        return !!(entity.keyId && entity.keyId === keyId);
      }
      /**
       * returns if a given cache entity is of the type appmetadata
       * @param key
       */
      isAppMetadata(key) {
        return key.indexOf(APP_METADATA) !== -1;
      }
      /**
       * returns if a given cache entity is of the type authoritymetadata
       * @param key
       */
      isAuthorityMetadata(key) {
        return key.indexOf(AUTHORITY_METADATA_CACHE_KEY) !== -1;
      }
      /**
       * returns cache key used for cloud instance metadata
       */
      generateAuthorityMetadataCacheKey(authority) {
        return `${AUTHORITY_METADATA_CACHE_KEY}-${this.clientId}-${authority}`;
      }
      /**
       * Helper to convert serialized data to object
       * @param obj
       * @param json
       */
      static toObject(obj, json) {
        for (const propertyName in json) {
          obj[propertyName] = json[propertyName];
        }
        return obj;
      }
    };
    var DefaultStorageClass = class extends CacheManager {
      async setAccount() {
        throw createClientAuthError(methodNotImplemented);
      }
      getAccount() {
        throw createClientAuthError(methodNotImplemented);
      }
      async setIdTokenCredential() {
        throw createClientAuthError(methodNotImplemented);
      }
      getIdTokenCredential() {
        throw createClientAuthError(methodNotImplemented);
      }
      async setAccessTokenCredential() {
        throw createClientAuthError(methodNotImplemented);
      }
      getAccessTokenCredential() {
        throw createClientAuthError(methodNotImplemented);
      }
      async setRefreshTokenCredential() {
        throw createClientAuthError(methodNotImplemented);
      }
      getRefreshTokenCredential() {
        throw createClientAuthError(methodNotImplemented);
      }
      setAppMetadata() {
        throw createClientAuthError(methodNotImplemented);
      }
      getAppMetadata() {
        throw createClientAuthError(methodNotImplemented);
      }
      setServerTelemetry() {
        throw createClientAuthError(methodNotImplemented);
      }
      getServerTelemetry() {
        throw createClientAuthError(methodNotImplemented);
      }
      setAuthorityMetadata() {
        throw createClientAuthError(methodNotImplemented);
      }
      getAuthorityMetadata() {
        throw createClientAuthError(methodNotImplemented);
      }
      getAuthorityMetadataKeys() {
        throw createClientAuthError(methodNotImplemented);
      }
      setThrottlingCache() {
        throw createClientAuthError(methodNotImplemented);
      }
      getThrottlingCache() {
        throw createClientAuthError(methodNotImplemented);
      }
      removeItem() {
        throw createClientAuthError(methodNotImplemented);
      }
      getKeys() {
        throw createClientAuthError(methodNotImplemented);
      }
      getAccountKeys() {
        throw createClientAuthError(methodNotImplemented);
      }
      getTokenKeys() {
        throw createClientAuthError(methodNotImplemented);
      }
      generateCredentialKey() {
        throw createClientAuthError(methodNotImplemented);
      }
      generateAccountKey() {
        throw createClientAuthError(methodNotImplemented);
      }
    };
    var PerformanceEventStatus = {
      InProgress: 1
    };
    var StubPerformanceClient = class {
      generateId() {
        return "callback-id";
      }
      startMeasurement(measureName, correlationId) {
        return {
          end: () => null,
          discard: () => {
          },
          add: () => {
          },
          increment: () => {
          },
          event: {
            eventId: this.generateId(),
            status: PerformanceEventStatus.InProgress,
            authority: "",
            libraryName: "",
            libraryVersion: "",
            clientId: "",
            name: measureName,
            startTimeMs: Date.now(),
            correlationId: correlationId || ""
          }
        };
      }
      endMeasurement() {
        return null;
      }
      discardMeasurements() {
        return;
      }
      removePerformanceCallback() {
        return true;
      }
      addPerformanceCallback() {
        return "";
      }
      emitEvents() {
        return;
      }
      addFields() {
        return;
      }
      incrementFields() {
        return;
      }
      cacheEventByCorrelationId() {
        return;
      }
    };
    var DEFAULT_SYSTEM_OPTIONS$1 = {
      tokenRenewalOffsetSeconds: DEFAULT_TOKEN_RENEWAL_OFFSET_SEC,
      preventCorsPreflight: false
    };
    var DEFAULT_LOGGER_IMPLEMENTATION = {
      loggerCallback: () => {
      },
      piiLoggingEnabled: false,
      logLevel: exports2.LogLevel.Info,
      correlationId: ""
    };
    var DEFAULT_NETWORK_IMPLEMENTATION = {
      async sendGetRequestAsync() {
        throw createClientAuthError(methodNotImplemented);
      },
      async sendPostRequestAsync() {
        throw createClientAuthError(methodNotImplemented);
      }
    };
    var DEFAULT_LIBRARY_INFO = {
      sku: SKU,
      version: version$1,
      cpu: "",
      os: ""
    };
    var DEFAULT_CLIENT_CREDENTIALS = {
      clientSecret: "",
      clientAssertion: void 0
    };
    var DEFAULT_AZURE_CLOUD_OPTIONS = {
      azureCloudInstance: AzureCloudInstance.None,
      tenant: `${DEFAULT_COMMON_TENANT}`
    };
    var DEFAULT_TELEMETRY_OPTIONS$1 = {
      application: {
        appName: "",
        appVersion: ""
      }
    };
    function buildClientConfiguration({ authOptions: userAuthOptions, systemOptions: userSystemOptions, loggerOptions: userLoggerOption, storageInterface: storageImplementation, networkInterface: networkImplementation, cryptoInterface: cryptoImplementation, clientCredentials, libraryInfo, telemetry, serverTelemetryManager, persistencePlugin, serializableCache }) {
      const loggerOptions = {
        ...DEFAULT_LOGGER_IMPLEMENTATION,
        ...userLoggerOption
      };
      return {
        authOptions: buildAuthOptions(userAuthOptions),
        systemOptions: { ...DEFAULT_SYSTEM_OPTIONS$1, ...userSystemOptions },
        loggerOptions,
        storageInterface: storageImplementation || new DefaultStorageClass(userAuthOptions.clientId, DEFAULT_CRYPTO_IMPLEMENTATION, new Logger(loggerOptions), new StubPerformanceClient()),
        networkInterface: networkImplementation || DEFAULT_NETWORK_IMPLEMENTATION,
        cryptoInterface: cryptoImplementation || DEFAULT_CRYPTO_IMPLEMENTATION,
        clientCredentials: clientCredentials || DEFAULT_CLIENT_CREDENTIALS,
        libraryInfo: { ...DEFAULT_LIBRARY_INFO, ...libraryInfo },
        telemetry: { ...DEFAULT_TELEMETRY_OPTIONS$1, ...telemetry },
        serverTelemetryManager: serverTelemetryManager || null,
        persistencePlugin: persistencePlugin || null,
        serializableCache: serializableCache || null
      };
    }
    function buildAuthOptions(authOptions) {
      return {
        clientCapabilities: [],
        azureCloudOptions: DEFAULT_AZURE_CLOUD_OPTIONS,
        instanceAware: false,
        ...authOptions
      };
    }
    function isOidcProtocolMode(config) {
      return config.authOptions.authority.options.protocolMode === ProtocolMode.OIDC;
    }
    var ServerError = class _ServerError extends AuthError {
      constructor(errorCode, errorMessage, subError, errorNo, status) {
        super(errorCode, errorMessage, subError);
        this.name = "ServerError";
        this.errorNo = errorNo;
        this.status = status;
        Object.setPrototypeOf(this, _ServerError.prototype);
      }
    };
    var noTokensFound = "no_tokens_found";
    var nativeAccountUnavailable = "native_account_unavailable";
    var refreshTokenExpired = "refresh_token_expired";
    var uxNotAllowed = "ux_not_allowed";
    var interactionRequired = "interaction_required";
    var consentRequired = "consent_required";
    var loginRequired = "login_required";
    var badToken = "bad_token";
    var interruptedUser = "interrupted_user";
    var InteractionRequiredAuthErrorCodes = /* @__PURE__ */ Object.freeze({
      __proto__: null,
      badToken,
      consentRequired,
      interactionRequired,
      interruptedUser,
      loginRequired,
      nativeAccountUnavailable,
      noTokensFound,
      refreshTokenExpired,
      uxNotAllowed
    });
    var InteractionRequiredServerErrorMessage = [
      interactionRequired,
      consentRequired,
      loginRequired,
      badToken,
      uxNotAllowed,
      interruptedUser
    ];
    var InteractionRequiredAuthSubErrorMessage = [
      "message_only",
      "additional_action",
      "basic_action",
      "user_password_expired",
      "consent_required",
      "bad_token",
      "ux_not_allowed",
      "interrupted_user"
    ];
    var InteractionRequiredAuthError = class _InteractionRequiredAuthError extends AuthError {
      constructor(errorCode, errorMessage, subError, timestamp, traceId, correlationId, claims, errorNo) {
        super(errorCode, errorMessage, subError);
        Object.setPrototypeOf(this, _InteractionRequiredAuthError.prototype);
        this.timestamp = timestamp || "";
        this.traceId = traceId || "";
        this.correlationId = correlationId || "";
        this.claims = claims || "";
        this.name = "InteractionRequiredAuthError";
        this.errorNo = errorNo;
      }
    };
    function isInteractionRequiredError(errorCode, errorString, subError) {
      const isInteractionRequiredErrorCode = !!errorCode && InteractionRequiredServerErrorMessage.indexOf(errorCode) > -1;
      const isInteractionRequiredSubError = !!subError && InteractionRequiredAuthSubErrorMessage.indexOf(subError) > -1;
      const isInteractionRequiredErrorDesc = !!errorString && InteractionRequiredServerErrorMessage.some((irErrorCode) => {
        return errorString.indexOf(irErrorCode) > -1;
      });
      return isInteractionRequiredErrorCode || isInteractionRequiredErrorDesc || isInteractionRequiredSubError;
    }
    function createInteractionRequiredAuthError(errorCode, errorMessage) {
      return new InteractionRequiredAuthError(errorCode, errorMessage);
    }
    function parseRequestState(base64Decode, state) {
      if (!base64Decode) {
        throw createClientAuthError(noCryptoObject);
      }
      if (!state) {
        throw createClientAuthError(invalidState);
      }
      try {
        const splitState = state.split(RESOURCE_DELIM);
        const libraryState = splitState[0];
        const userState = splitState.length > 1 ? splitState.slice(1).join(RESOURCE_DELIM) : "";
        const libraryStateString = base64Decode(libraryState);
        const libraryStateObj = JSON.parse(libraryStateString);
        return {
          userRequestState: userState || "",
          libraryState: libraryStateObj
        };
      } catch (e) {
        throw createClientAuthError(invalidState);
      }
    }
    function nowSeconds() {
      return Math.round((/* @__PURE__ */ new Date()).getTime() / 1e3);
    }
    function toDateFromSeconds(seconds) {
      if (seconds) {
        return new Date(Number(seconds) * 1e3);
      }
      return /* @__PURE__ */ new Date();
    }
    function isTokenExpired(expiresOn, offset) {
      const expirationSec = Number(expiresOn) || 0;
      const offsetCurrentTimeSec = nowSeconds() + offset;
      return offsetCurrentTimeSec > expirationSec;
    }
    function wasClockTurnedBack(cachedAt) {
      const cachedAtSec = Number(cachedAt);
      return cachedAtSec > nowSeconds();
    }
    function delay(t, value) {
      return new Promise((resolve) => setTimeout(() => resolve(value), t));
    }
    var NetworkClientSendPostRequestAsync = "networkClientSendPostRequestAsync";
    var RefreshTokenClientExecutePostToTokenEndpoint = "refreshTokenClientExecutePostToTokenEndpoint";
    var AuthorizationCodeClientExecutePostToTokenEndpoint = "authorizationCodeClientExecutePostToTokenEndpoint";
    var RefreshTokenClientExecuteTokenRequest = "refreshTokenClientExecuteTokenRequest";
    var RefreshTokenClientAcquireToken = "refreshTokenClientAcquireToken";
    var RefreshTokenClientAcquireTokenWithCachedRefreshToken = "refreshTokenClientAcquireTokenWithCachedRefreshToken";
    var RefreshTokenClientCreateTokenRequestBody = "refreshTokenClientCreateTokenRequestBody";
    var SilentFlowClientGenerateResultFromCacheRecord = "silentFlowClientGenerateResultFromCacheRecord";
    var AuthClientExecuteTokenRequest = "authClientExecuteTokenRequest";
    var AuthClientCreateTokenRequestBody = "authClientCreateTokenRequestBody";
    var UpdateTokenEndpointAuthority = "updateTokenEndpointAuthority";
    var PopTokenGenerateCnf = "popTokenGenerateCnf";
    var HandleServerTokenResponse = "handleServerTokenResponse";
    var AuthorityResolveEndpointsAsync = "authorityResolveEndpointsAsync";
    var AuthorityGetCloudDiscoveryMetadataFromNetwork = "authorityGetCloudDiscoveryMetadataFromNetwork";
    var AuthorityUpdateCloudDiscoveryMetadata = "authorityUpdateCloudDiscoveryMetadata";
    var AuthorityGetEndpointMetadataFromNetwork = "authorityGetEndpointMetadataFromNetwork";
    var AuthorityUpdateEndpointMetadata = "authorityUpdateEndpointMetadata";
    var AuthorityUpdateMetadataWithRegionalInformation = "authorityUpdateMetadataWithRegionalInformation";
    var RegionDiscoveryDetectRegion = "regionDiscoveryDetectRegion";
    var RegionDiscoveryGetRegionFromIMDS = "regionDiscoveryGetRegionFromIMDS";
    var RegionDiscoveryGetCurrentVersion = "regionDiscoveryGetCurrentVersion";
    var CacheManagerGetRefreshToken = "cacheManagerGetRefreshToken";
    var invoke = (callback, eventName, logger, telemetryClient, correlationId) => {
      return (...args) => {
        logger.trace(`Executing function '${eventName}'`, correlationId);
        const inProgressEvent = telemetryClient.startMeasurement(eventName, correlationId);
        if (correlationId) {
          telemetryClient.incrementFields({ [`ext.${eventName}CallCount`]: 1 }, correlationId);
        }
        try {
          const result = callback(...args);
          inProgressEvent.end({
            success: true
          });
          logger.trace(`Returning result from '${eventName}'`, correlationId);
          return result;
        } catch (e) {
          logger.trace(`Error occurred in '${eventName}'`, correlationId);
          try {
            logger.trace(JSON.stringify(e), correlationId);
          } catch (e2) {
            logger.trace("Unable to print error message.", correlationId);
          }
          inProgressEvent.end({
            success: false
          }, e);
          throw e;
        }
      };
    };
    var invokeAsync = (callback, eventName, logger, telemetryClient, correlationId) => {
      return (...args) => {
        logger.trace(`Executing function '${eventName}'`, correlationId);
        const inProgressEvent = telemetryClient.startMeasurement(eventName, correlationId);
        if (correlationId) {
          telemetryClient.incrementFields({ [`ext.${eventName}CallCount`]: 1 }, correlationId);
        }
        return callback(...args).then((response) => {
          logger.trace(`Returning result from '${eventName}'`, correlationId);
          inProgressEvent.end({
            success: true
          });
          return response;
        }).catch((e) => {
          logger.trace(`Error occurred in '${eventName}'`, correlationId);
          try {
            logger.trace(JSON.stringify(e), correlationId);
          } catch (e2) {
            logger.trace("Unable to print error message.", correlationId);
          }
          inProgressEvent.end({
            success: false
          }, e);
          throw e;
        });
      };
    };
    var KeyLocation = {
      SW: "sw"
    };
    var PopTokenGenerator = class {
      constructor(cryptoUtils, performanceClient) {
        this.cryptoUtils = cryptoUtils;
        this.performanceClient = performanceClient;
      }
      /**
       * Generates the req_cnf validated at the RP in the POP protocol for SHR parameters
       * and returns an object containing the keyid, the full req_cnf string and the req_cnf string hash
       * @param request
       * @returns
       */
      async generateCnf(request, logger) {
        const reqCnf = await invokeAsync(this.generateKid.bind(this), PopTokenGenerateCnf, logger, this.performanceClient, request.correlationId)(request);
        const reqCnfString = this.cryptoUtils.base64UrlEncode(JSON.stringify(reqCnf));
        return {
          kid: reqCnf.kid,
          reqCnfString
        };
      }
      /**
       * Generates key_id for a SHR token request
       * @param request
       * @returns
       */
      async generateKid(request) {
        const kidThumbprint = await this.cryptoUtils.getPublicKeyThumbprint(request);
        return {
          kid: kidThumbprint,
          xms_ksl: KeyLocation.SW
        };
      }
      /**
       * Signs the POP access_token with the local generated key-pair
       * @param accessToken
       * @param request
       * @returns
       */
      async signPopToken(accessToken, keyId, request) {
        return this.signPayload(accessToken, keyId, request);
      }
      /**
       * Utility function to generate the signed JWT for an access_token
       * @param payload
       * @param kid
       * @param request
       * @param claims
       * @returns
       */
      async signPayload(payload, keyId, request, claims) {
        const { resourceRequestMethod, resourceRequestUri, shrClaims, shrNonce, shrOptions } = request;
        const resourceUrlString = resourceRequestUri ? new UrlString(resourceRequestUri) : void 0;
        const resourceUrlComponents = resourceUrlString?.getUrlComponents();
        return this.cryptoUtils.signJwt({
          at: payload,
          ts: nowSeconds(),
          m: resourceRequestMethod?.toUpperCase(),
          u: resourceUrlComponents?.HostNameAndPort,
          nonce: shrNonce || this.cryptoUtils.createNewGuid(),
          p: resourceUrlComponents?.AbsolutePath,
          q: resourceUrlComponents?.QueryString ? [[], resourceUrlComponents.QueryString] : void 0,
          client_claims: shrClaims || void 0,
          ...claims
        }, keyId, shrOptions, request.correlationId);
      }
    };
    var TokenCacheContext = class {
      constructor(tokenCache, hasChanged) {
        this.cache = tokenCache;
        this.hasChanged = hasChanged;
      }
      /**
       * boolean which indicates the changes in cache
       */
      get cacheHasChanged() {
        return this.hasChanged;
      }
      /**
       * function to retrieve the token cache
       */
      get tokenCache() {
        return this.cache;
      }
    };
    function createIdTokenEntity(homeAccountId, environment, idToken, clientId, tenantId) {
      const idTokenEntity = {
        credentialType: CredentialType.ID_TOKEN,
        homeAccountId,
        environment,
        clientId,
        secret: idToken,
        realm: tenantId,
        lastUpdatedAt: Date.now().toString()
        // Set the last updated time to now
      };
      return idTokenEntity;
    }
    function createAccessTokenEntity(homeAccountId, environment, accessToken, clientId, tenantId, scopes, expiresOn, extExpiresOn, base64Decode, refreshOn, tokenType, userAssertionHash, keyId) {
      const atEntity = {
        homeAccountId,
        credentialType: CredentialType.ACCESS_TOKEN,
        secret: accessToken,
        cachedAt: nowSeconds().toString(),
        expiresOn: expiresOn.toString(),
        extendedExpiresOn: extExpiresOn.toString(),
        environment,
        clientId,
        realm: tenantId,
        target: scopes,
        tokenType: tokenType || AuthenticationScheme.BEARER,
        lastUpdatedAt: Date.now().toString()
        // Set the last updated time to now
      };
      if (userAssertionHash) {
        atEntity.userAssertionHash = userAssertionHash;
      }
      if (refreshOn) {
        atEntity.refreshOn = refreshOn.toString();
      }
      if (atEntity.tokenType?.toLowerCase() !== AuthenticationScheme.BEARER.toLowerCase()) {
        atEntity.credentialType = CredentialType.ACCESS_TOKEN_WITH_AUTH_SCHEME;
        switch (atEntity.tokenType) {
          case AuthenticationScheme.POP:
            const tokenClaims = extractTokenClaims(accessToken, base64Decode);
            if (!tokenClaims?.cnf?.kid) {
              throw createClientAuthError(tokenClaimsCnfRequiredForSignedJwt);
            }
            atEntity.keyId = tokenClaims.cnf.kid;
            break;
          case AuthenticationScheme.SSH:
            atEntity.keyId = keyId;
        }
      }
      return atEntity;
    }
    function createRefreshTokenEntity(homeAccountId, environment, refreshToken, clientId, familyId, userAssertionHash, expiresOn) {
      const rtEntity = {
        credentialType: CredentialType.REFRESH_TOKEN,
        homeAccountId,
        environment,
        clientId,
        secret: refreshToken,
        lastUpdatedAt: Date.now().toString()
      };
      if (userAssertionHash) {
        rtEntity.userAssertionHash = userAssertionHash;
      }
      if (familyId) {
        rtEntity.familyId = familyId;
      }
      if (expiresOn) {
        rtEntity.expiresOn = expiresOn.toString();
      }
      return rtEntity;
    }
    function isCredentialEntity(entity) {
      return entity.hasOwnProperty("homeAccountId") && entity.hasOwnProperty("environment") && entity.hasOwnProperty("credentialType") && entity.hasOwnProperty("clientId") && entity.hasOwnProperty("secret");
    }
    function isAccessTokenEntity(entity) {
      if (!entity) {
        return false;
      }
      return isCredentialEntity(entity) && entity.hasOwnProperty("realm") && entity.hasOwnProperty("target") && (entity["credentialType"] === CredentialType.ACCESS_TOKEN || entity["credentialType"] === CredentialType.ACCESS_TOKEN_WITH_AUTH_SCHEME);
    }
    function isIdTokenEntity(entity) {
      if (!entity) {
        return false;
      }
      return isCredentialEntity(entity) && entity.hasOwnProperty("realm") && entity["credentialType"] === CredentialType.ID_TOKEN;
    }
    function isRefreshTokenEntity(entity) {
      if (!entity) {
        return false;
      }
      return isCredentialEntity(entity) && entity["credentialType"] === CredentialType.REFRESH_TOKEN;
    }
    function isServerTelemetryEntity(key, entity) {
      const validateKey = key.indexOf(SERVER_TELEM_CACHE_KEY) === 0;
      let validateEntity = true;
      if (entity) {
        validateEntity = entity.hasOwnProperty("failedRequests") && entity.hasOwnProperty("errors") && entity.hasOwnProperty("cacheHits");
      }
      return validateKey && validateEntity;
    }
    function isThrottlingEntity(key, entity) {
      let validateKey = false;
      if (key) {
        validateKey = key.indexOf(THROTTLING_PREFIX) === 0;
      }
      let validateEntity = true;
      if (entity) {
        validateEntity = entity.hasOwnProperty("throttleTime");
      }
      return validateKey && validateEntity;
    }
    function generateAppMetadataKey({ environment, clientId }) {
      const appMetaDataKeyArray = [
        APP_METADATA,
        environment,
        clientId
      ];
      return appMetaDataKeyArray.join(CACHE_KEY_SEPARATOR).toLowerCase();
    }
    function isAppMetadataEntity(key, entity) {
      if (!entity) {
        return false;
      }
      return key.indexOf(APP_METADATA) === 0 && entity.hasOwnProperty("clientId") && entity.hasOwnProperty("environment");
    }
    function isAuthorityMetadataEntity(key, entity) {
      if (!entity) {
        return false;
      }
      return key.indexOf(AUTHORITY_METADATA_CACHE_KEY) === 0 && entity.hasOwnProperty("aliases") && entity.hasOwnProperty("preferred_cache") && entity.hasOwnProperty("preferred_network") && entity.hasOwnProperty("canonical_authority") && entity.hasOwnProperty("authorization_endpoint") && entity.hasOwnProperty("token_endpoint") && entity.hasOwnProperty("issuer") && entity.hasOwnProperty("aliasesFromNetwork") && entity.hasOwnProperty("endpointsFromNetwork") && entity.hasOwnProperty("expiresAt") && entity.hasOwnProperty("jwks_uri");
    }
    function generateAuthorityMetadataExpiresAt() {
      return nowSeconds() + AUTHORITY_METADATA_REFRESH_TIME_SECONDS;
    }
    function updateAuthorityEndpointMetadata(authorityMetadata, updatedValues, fromNetwork) {
      authorityMetadata.authorization_endpoint = updatedValues.authorization_endpoint;
      authorityMetadata.token_endpoint = updatedValues.token_endpoint;
      authorityMetadata.end_session_endpoint = updatedValues.end_session_endpoint;
      authorityMetadata.issuer = updatedValues.issuer;
      authorityMetadata.endpointsFromNetwork = fromNetwork;
      authorityMetadata.jwks_uri = updatedValues.jwks_uri;
    }
    function updateCloudDiscoveryMetadata(authorityMetadata, updatedValues, fromNetwork) {
      authorityMetadata.aliases = updatedValues.aliases;
      authorityMetadata.preferred_cache = updatedValues.preferred_cache;
      authorityMetadata.preferred_network = updatedValues.preferred_network;
      authorityMetadata.aliasesFromNetwork = fromNetwork;
    }
    function isAuthorityMetadataExpired(metadata) {
      return metadata.expiresAt <= nowSeconds();
    }
    var ResponseHandler = class _ResponseHandler {
      constructor(clientId, cacheStorage, cryptoObj, logger, performanceClient, serializableCache, persistencePlugin) {
        this.clientId = clientId;
        this.cacheStorage = cacheStorage;
        this.cryptoObj = cryptoObj;
        this.logger = logger;
        this.performanceClient = performanceClient;
        this.serializableCache = serializableCache;
        this.persistencePlugin = persistencePlugin;
      }
      /**
       * Function which validates server authorization token response.
       * @param serverResponse
       * @param correlationId
       * @param refreshAccessToken
       */
      validateTokenResponse(serverResponse, correlationId, refreshAccessToken) {
        if (serverResponse.error || serverResponse.error_description || serverResponse.suberror) {
          const errString = `Error(s): ${serverResponse.error_codes || NOT_AVAILABLE} - Timestamp: ${serverResponse.timestamp || NOT_AVAILABLE} - Description: ${serverResponse.error_description || NOT_AVAILABLE} - Correlation ID: ${serverResponse.correlation_id || NOT_AVAILABLE} - Trace ID: ${serverResponse.trace_id || NOT_AVAILABLE}`;
          const serverErrorNo = serverResponse.error_codes?.length ? serverResponse.error_codes[0] : void 0;
          const serverError = new ServerError(serverResponse.error, errString, serverResponse.suberror, serverErrorNo, serverResponse.status);
          if (refreshAccessToken && serverResponse.status && serverResponse.status >= HTTP_SERVER_ERROR_RANGE_START && serverResponse.status <= HTTP_SERVER_ERROR_RANGE_END) {
            this.logger.warning(`executeTokenRequest:validateTokenResponse - AAD is currently unavailable and the access token is unable to be refreshed.
${serverError}`, correlationId);
            return;
          } else if (refreshAccessToken && serverResponse.status && serverResponse.status >= HTTP_CLIENT_ERROR_RANGE_START && serverResponse.status <= HTTP_CLIENT_ERROR_RANGE_END) {
            this.logger.warning(`executeTokenRequest:validateTokenResponse - AAD is currently available but is unable to refresh the access token.
${serverError}`, correlationId);
            return;
          }
          if (isInteractionRequiredError(serverResponse.error, serverResponse.error_description, serverResponse.suberror)) {
            throw new InteractionRequiredAuthError(serverResponse.error, serverResponse.error_description, serverResponse.suberror, serverResponse.timestamp || "", serverResponse.trace_id || "", serverResponse.correlation_id || "", serverResponse.claims || "", serverErrorNo);
          }
          throw serverError;
        }
      }
      /**
       * Returns a constructed token response based on given string. Also manages the cache updates and cleanups.
       * @param serverTokenResponse
       * @param authority
       */
      async handleServerTokenResponse(serverTokenResponse, authority, reqTimestamp, request, apiId, authCodePayload, userAssertionHash, handlingRefreshTokenResponse, forceCacheRefreshTokenResponse, serverRequestId) {
        let idTokenClaims;
        if (serverTokenResponse.id_token) {
          idTokenClaims = extractTokenClaims(serverTokenResponse.id_token || "", this.cryptoObj.base64Decode);
          if (authCodePayload && authCodePayload.nonce) {
            if (idTokenClaims.nonce !== authCodePayload.nonce) {
              throw createClientAuthError(nonceMismatch);
            }
          }
          if (request.maxAge || request.maxAge === 0) {
            const authTime = idTokenClaims.auth_time;
            if (!authTime) {
              throw createClientAuthError(authTimeNotFound);
            }
            checkMaxAge(authTime, request.maxAge);
          }
        }
        this.homeAccountIdentifier = generateHomeAccountId(serverTokenResponse.client_info || "", authority.authorityType, this.logger, this.cryptoObj, request.correlationId, idTokenClaims);
        let requestStateObj;
        if (!!authCodePayload && !!authCodePayload.state) {
          requestStateObj = parseRequestState(this.cryptoObj.base64Decode, authCodePayload.state);
        }
        serverTokenResponse.key_id = serverTokenResponse.key_id || request.sshKid || void 0;
        const cacheRecord = this.generateCacheRecord(serverTokenResponse, authority, reqTimestamp, request, idTokenClaims, userAssertionHash, authCodePayload);
        let cacheContext;
        try {
          if (this.persistencePlugin && this.serializableCache) {
            this.logger.verbose("Persistence enabled, calling beforeCacheAccess", request.correlationId);
            cacheContext = new TokenCacheContext(this.serializableCache, true);
            await this.persistencePlugin.beforeCacheAccess(cacheContext);
          }
          if (handlingRefreshTokenResponse && !forceCacheRefreshTokenResponse && cacheRecord.account) {
            const cachedAccounts = this.cacheStorage.getAllAccounts({
              homeAccountId: cacheRecord.account.homeAccountId,
              environment: cacheRecord.account.environment
            }, request.correlationId);
            if (cachedAccounts.length < 1) {
              this.logger.warning("Account used to refresh tokens not in persistence, refreshed tokens will not be stored in the cache", request.correlationId);
              this.performanceClient?.addFields({
                acntLoggedOut: true
              }, request.correlationId);
              return await _ResponseHandler.generateAuthenticationResult(this.cryptoObj, authority, cacheRecord, false, request, this.performanceClient, idTokenClaims, requestStateObj, void 0, serverRequestId);
            }
          }
          await this.cacheStorage.saveCacheRecord(cacheRecord, request.correlationId, isKmsi(idTokenClaims || {}), apiId, request.storeInCache);
        } finally {
          if (this.persistencePlugin && this.serializableCache && cacheContext) {
            this.logger.verbose("Persistence enabled, calling afterCacheAccess", request.correlationId);
            await this.persistencePlugin.afterCacheAccess(cacheContext);
          }
        }
        return _ResponseHandler.generateAuthenticationResult(this.cryptoObj, authority, cacheRecord, false, request, this.performanceClient, idTokenClaims, requestStateObj, serverTokenResponse, serverRequestId);
      }
      /**
       * Generates CacheRecord
       * @param serverTokenResponse
       * @param idTokenObj
       * @param authority
       */
      generateCacheRecord(serverTokenResponse, authority, reqTimestamp, request, idTokenClaims, userAssertionHash, authCodePayload) {
        const env = authority.getPreferredCache();
        if (!env) {
          throw createClientAuthError(invalidCacheEnvironment);
        }
        const claimsTenantId = getTenantIdFromIdTokenClaims(idTokenClaims);
        let cachedIdToken;
        let cachedAccount;
        if (serverTokenResponse.id_token && !!idTokenClaims) {
          cachedIdToken = createIdTokenEntity(this.homeAccountIdentifier, env, serverTokenResponse.id_token, this.clientId, claimsTenantId || "");
          cachedAccount = buildAccountToCache(
            this.cacheStorage,
            authority,
            this.homeAccountIdentifier,
            this.cryptoObj.base64Decode,
            request.correlationId,
            idTokenClaims,
            serverTokenResponse.client_info,
            env,
            claimsTenantId,
            authCodePayload,
            void 0,
            // nativeAccountId
            this.logger
          );
        }
        let cachedAccessToken = null;
        if (serverTokenResponse.access_token) {
          const responseScopes = serverTokenResponse.scope ? ScopeSet.fromString(serverTokenResponse.scope) : new ScopeSet(request.scopes || []);
          const expiresIn = (typeof serverTokenResponse.expires_in === "string" ? parseInt(serverTokenResponse.expires_in, 10) : serverTokenResponse.expires_in) || 0;
          const extExpiresIn = (typeof serverTokenResponse.ext_expires_in === "string" ? parseInt(serverTokenResponse.ext_expires_in, 10) : serverTokenResponse.ext_expires_in) || 0;
          const refreshIn = (typeof serverTokenResponse.refresh_in === "string" ? parseInt(serverTokenResponse.refresh_in, 10) : serverTokenResponse.refresh_in) || void 0;
          const tokenExpirationSeconds = reqTimestamp + expiresIn;
          const extendedTokenExpirationSeconds = tokenExpirationSeconds + extExpiresIn;
          const refreshOnSeconds = refreshIn && refreshIn > 0 ? reqTimestamp + refreshIn : void 0;
          cachedAccessToken = createAccessTokenEntity(this.homeAccountIdentifier, env, serverTokenResponse.access_token, this.clientId, claimsTenantId || authority.tenant || "", responseScopes.printScopes(), tokenExpirationSeconds, extendedTokenExpirationSeconds, this.cryptoObj.base64Decode, refreshOnSeconds, serverTokenResponse.token_type, userAssertionHash, serverTokenResponse.key_id);
        }
        let cachedRefreshToken = null;
        if (serverTokenResponse.refresh_token) {
          let rtExpiresOn;
          if (serverTokenResponse.refresh_token_expires_in) {
            const rtExpiresIn = typeof serverTokenResponse.refresh_token_expires_in === "string" ? parseInt(serverTokenResponse.refresh_token_expires_in, 10) : serverTokenResponse.refresh_token_expires_in;
            rtExpiresOn = reqTimestamp + rtExpiresIn;
            this.performanceClient?.addFields({ ntwkRtExpiresOnSeconds: rtExpiresOn }, request.correlationId);
          }
          cachedRefreshToken = createRefreshTokenEntity(this.homeAccountIdentifier, env, serverTokenResponse.refresh_token, this.clientId, serverTokenResponse.foci, userAssertionHash, rtExpiresOn);
        }
        let cachedAppMetadata = null;
        if (serverTokenResponse.foci) {
          cachedAppMetadata = {
            clientId: this.clientId,
            environment: env,
            familyId: serverTokenResponse.foci
          };
        }
        return {
          account: cachedAccount,
          idToken: cachedIdToken,
          accessToken: cachedAccessToken,
          refreshToken: cachedRefreshToken,
          appMetadata: cachedAppMetadata
        };
      }
      /**
       * Creates an @AuthenticationResult from @CacheRecord , @IdToken , and a boolean that states whether or not the result is from cache.
       *
       * Optionally takes a state string that is set as-is in the response.
       *
       * @param cacheRecord
       * @param idTokenObj
       * @param fromTokenCache
       * @param stateString
       */
      static async generateAuthenticationResult(cryptoObj, authority, cacheRecord, fromTokenCache, request, performanceClient, idTokenClaims, requestState, serverTokenResponse, requestId) {
        let accessToken = "";
        let responseScopes = [];
        let expiresOn = null;
        let extExpiresOn;
        let refreshOn;
        let familyId = "";
        if (cacheRecord.accessToken) {
          if (cacheRecord.accessToken.tokenType === AuthenticationScheme.POP && !request.popKid) {
            const popTokenGenerator = new PopTokenGenerator(cryptoObj, performanceClient);
            const { secret, keyId } = cacheRecord.accessToken;
            if (!keyId) {
              throw createClientAuthError(keyIdMissing);
            }
            accessToken = await popTokenGenerator.signPopToken(secret, keyId, request);
          } else {
            accessToken = cacheRecord.accessToken.secret;
          }
          responseScopes = ScopeSet.fromString(cacheRecord.accessToken.target).asArray();
          expiresOn = toDateFromSeconds(cacheRecord.accessToken.expiresOn);
          extExpiresOn = toDateFromSeconds(cacheRecord.accessToken.extendedExpiresOn);
          if (cacheRecord.accessToken.refreshOn) {
            refreshOn = toDateFromSeconds(cacheRecord.accessToken.refreshOn);
          }
        }
        if (cacheRecord.appMetadata) {
          familyId = cacheRecord.appMetadata.familyId === THE_FAMILY_ID ? THE_FAMILY_ID : "";
        }
        const uid = idTokenClaims?.oid || idTokenClaims?.sub || "";
        const tid = idTokenClaims?.tid || "";
        if (serverTokenResponse?.spa_accountid && !!cacheRecord.account) {
          cacheRecord.account.nativeAccountId = serverTokenResponse?.spa_accountid;
        }
        const accountInfo = cacheRecord.account ? updateAccountTenantProfileData(
          getAccountInfo(cacheRecord.account),
          void 0,
          // tenantProfile optional
          idTokenClaims,
          cacheRecord.idToken?.secret
        ) : null;
        return {
          authority: authority.canonicalAuthority,
          uniqueId: uid,
          tenantId: tid,
          scopes: responseScopes,
          account: accountInfo,
          idToken: cacheRecord?.idToken?.secret || "",
          idTokenClaims: idTokenClaims || {},
          accessToken,
          fromCache: fromTokenCache,
          expiresOn,
          extExpiresOn,
          refreshOn,
          correlationId: request.correlationId,
          requestId: requestId || "",
          familyId,
          tokenType: cacheRecord.accessToken?.tokenType || "",
          state: requestState ? requestState.userRequestState : "",
          cloudGraphHostName: cacheRecord.account?.cloudGraphHostName || "",
          msGraphHost: cacheRecord.account?.msGraphHost || "",
          code: serverTokenResponse?.spa_code,
          fromPlatformBroker: false
        };
      }
    };
    function buildAccountToCache(cacheStorage, authority, homeAccountId, base64Decode, correlationId, idTokenClaims, clientInfo, environment, claimsTenantId, authCodePayload, nativeAccountId, logger) {
      logger?.verbose("setCachedAccount called", correlationId);
      const accountKeys = cacheStorage.getAccountKeys();
      const baseAccountKey = accountKeys.find((accountKey) => {
        return accountKey.startsWith(homeAccountId);
      });
      let cachedAccount = null;
      if (baseAccountKey) {
        cachedAccount = cacheStorage.getAccount(baseAccountKey, correlationId);
      }
      const baseAccount = cachedAccount || createAccountEntity({
        homeAccountId,
        idTokenClaims,
        clientInfo,
        environment,
        cloudGraphHostName: authCodePayload?.cloud_graph_host_name,
        msGraphHost: authCodePayload?.msgraph_host,
        nativeAccountId
      }, authority, base64Decode);
      const tenantProfiles = baseAccount.tenantProfiles || [];
      const tenantId = claimsTenantId || baseAccount.realm;
      if (tenantId && !tenantProfiles.find((tenantProfile) => {
        return tenantProfile.tenantId === tenantId;
      })) {
        const newTenantProfile = buildTenantProfile(homeAccountId, baseAccount.localAccountId, tenantId, idTokenClaims);
        tenantProfiles.push(newTenantProfile);
      }
      baseAccount.tenantProfiles = tenantProfiles;
      return baseAccount;
    }
    var CcsCredentialType = {
      HOME_ACCOUNT_ID: "home_account_id",
      UPN: "UPN"
    };
    async function getClientAssertion(clientAssertion, clientId, tokenEndpoint) {
      if (typeof clientAssertion === "string") {
        return clientAssertion;
      } else {
        const config = {
          clientId,
          tokenEndpoint
        };
        return clientAssertion(config);
      }
    }
    function getRequestThumbprint(clientId, request, homeAccountId) {
      return {
        clientId,
        authority: request.authority,
        scopes: request.scopes,
        homeAccountIdentifier: homeAccountId,
        claims: request.claims,
        authenticationScheme: request.authenticationScheme,
        resourceRequestMethod: request.resourceRequestMethod,
        resourceRequestUri: request.resourceRequestUri,
        shrClaims: request.shrClaims,
        sshKid: request.sshKid,
        embeddedClientId: request.embeddedClientId || request.extraParameters?.clientId
      };
    }
    var ThrottlingUtils = class _ThrottlingUtils {
      /**
       * Prepares a RequestThumbprint to be stored as a key.
       * @param thumbprint
       */
      static generateThrottlingStorageKey(thumbprint) {
        return `${THROTTLING_PREFIX}.${JSON.stringify(thumbprint)}`;
      }
      /**
       * Performs necessary throttling checks before a network request.
       * @param cacheManager
       * @param thumbprint
       */
      static preProcess(cacheManager, thumbprint, correlationId) {
        const key = _ThrottlingUtils.generateThrottlingStorageKey(thumbprint);
        const value = cacheManager.getThrottlingCache(key, correlationId);
        if (value) {
          if (value.throttleTime < Date.now()) {
            cacheManager.removeItem(key, correlationId);
            return;
          }
          throw new ServerError(value.errorCodes?.join(" ") || "", value.errorMessage, value.subError);
        }
      }
      /**
       * Performs necessary throttling checks after a network request.
       * @param cacheManager
       * @param thumbprint
       * @param response
       */
      static postProcess(cacheManager, thumbprint, response, correlationId) {
        if (_ThrottlingUtils.checkResponseStatus(response) || _ThrottlingUtils.checkResponseForRetryAfter(response)) {
          const thumbprintValue = {
            throttleTime: _ThrottlingUtils.calculateThrottleTime(parseInt(response.headers[HeaderNames.RETRY_AFTER])),
            error: response.body.error,
            errorCodes: response.body.error_codes,
            errorMessage: response.body.error_description,
            subError: response.body.suberror
          };
          cacheManager.setThrottlingCache(_ThrottlingUtils.generateThrottlingStorageKey(thumbprint), thumbprintValue, correlationId);
        }
      }
      /**
       * Checks a NetworkResponse object's status codes against 429 or 5xx
       * @param response
       */
      static checkResponseStatus(response) {
        return response.status === 429 || response.status >= 500 && response.status < 600;
      }
      /**
       * Checks a NetworkResponse object's RetryAfter header
       * @param response
       */
      static checkResponseForRetryAfter(response) {
        if (response.headers) {
          return response.headers.hasOwnProperty(HeaderNames.RETRY_AFTER) && (response.status < 200 || response.status >= 300);
        }
        return false;
      }
      /**
       * Calculates the Unix-time value for a throttle to expire given throttleTime in seconds.
       * @param throttleTime
       */
      static calculateThrottleTime(throttleTime) {
        const time = throttleTime <= 0 ? 0 : throttleTime;
        const currentSeconds = Date.now() / 1e3;
        return Math.floor(Math.min(currentSeconds + (time || DEFAULT_THROTTLE_TIME_SECONDS), currentSeconds + DEFAULT_MAX_THROTTLE_TIME_SECONDS) * 1e3);
      }
      static removeThrottle(cacheManager, clientId, request, homeAccountIdentifier) {
        const thumbprint = getRequestThumbprint(clientId, request, homeAccountIdentifier);
        const key = this.generateThrottlingStorageKey(thumbprint);
        cacheManager.removeItem(key, request.correlationId);
      }
    };
    var NetworkError = class _NetworkError extends AuthError {
      constructor(error, httpStatus, responseHeaders) {
        super(error.errorCode, error.errorMessage, error.subError);
        Object.setPrototypeOf(this, _NetworkError.prototype);
        this.name = "NetworkError";
        this.error = error;
        this.httpStatus = httpStatus;
        this.responseHeaders = responseHeaders;
      }
    };
    function createNetworkError(error, httpStatus, responseHeaders, additionalError) {
      error.errorMessage = `${error.errorMessage}, additionalErrorInfo: error.name:${additionalError?.name}, error.message:${additionalError?.message}`;
      return new NetworkError(error, httpStatus, responseHeaders);
    }
    function createTokenRequestHeaders(logger, preventCorsPreflight, ccsCred) {
      const headers = {};
      headers[HeaderNames.CONTENT_TYPE] = URL_FORM_CONTENT_TYPE;
      if (!preventCorsPreflight && ccsCred) {
        switch (ccsCred.type) {
          case CcsCredentialType.HOME_ACCOUNT_ID:
            try {
              const clientInfo = buildClientInfoFromHomeAccountId(ccsCred.credential);
              headers[HeaderNames.CCS_HEADER] = `Oid:${clientInfo.uid}@${clientInfo.utid}`;
            } catch (e) {
              logger.verbose(`Could not parse home account ID for CCS Header: '${e}'`, "");
            }
            break;
          case CcsCredentialType.UPN:
            headers[HeaderNames.CCS_HEADER] = `UPN: ${ccsCred.credential}`;
            break;
        }
      }
      return headers;
    }
    function createTokenQueryParameters(request, clientId, redirectUri, performanceClient) {
      const parameters = /* @__PURE__ */ new Map();
      if (request.embeddedClientId) {
        addBrokerParameters(parameters, clientId, redirectUri);
      }
      if (request.extraQueryParameters) {
        addExtraParameters(parameters, request.extraQueryParameters);
      }
      addCorrelationId(parameters, request.correlationId);
      instrumentBrokerParams(parameters, request.correlationId, performanceClient);
      return mapToQueryString(parameters);
    }
    async function executePostToTokenEndpoint(tokenEndpoint, queryString, headers, thumbprint, correlationId, cacheManager, networkClient, logger, performanceClient, serverTelemetryManager) {
      const response = await sendPostRequest(thumbprint, tokenEndpoint, { body: queryString, headers }, correlationId, cacheManager, networkClient, logger, performanceClient);
      if (serverTelemetryManager && response.status < 500 && response.status !== 429) {
        serverTelemetryManager.clearTelemetryCache();
      }
      return response;
    }
    async function sendPostRequest(thumbprint, tokenEndpoint, options, correlationId, cacheManager, networkClient, logger, performanceClient) {
      ThrottlingUtils.preProcess(cacheManager, thumbprint, correlationId);
      let response;
      try {
        response = await invokeAsync(networkClient.sendPostRequestAsync.bind(networkClient), NetworkClientSendPostRequestAsync, logger, performanceClient, correlationId)(tokenEndpoint, options);
        const responseHeaders = response.headers || {};
        performanceClient?.addFields({
          refreshTokenSize: response.body.refresh_token?.length || 0,
          httpVerToken: responseHeaders[HeaderNames.X_MS_HTTP_VERSION] || "",
          requestId: responseHeaders[HeaderNames.X_MS_REQUEST_ID] || ""
        }, correlationId);
      } catch (e) {
        if (e instanceof NetworkError) {
          const responseHeaders = e.responseHeaders;
          if (responseHeaders) {
            performanceClient?.addFields({
              httpVerToken: responseHeaders[HeaderNames.X_MS_HTTP_VERSION] || "",
              requestId: responseHeaders[HeaderNames.X_MS_REQUEST_ID] || "",
              contentTypeHeader: responseHeaders[HeaderNames.CONTENT_TYPE] || void 0,
              contentLengthHeader: responseHeaders[HeaderNames.CONTENT_LENGTH] || void 0,
              httpStatus: e.httpStatus
            }, correlationId);
          }
          throw e.error;
        }
        if (e instanceof AuthError) {
          throw e;
        } else {
          throw createClientAuthError(networkError);
        }
      }
      ThrottlingUtils.postProcess(cacheManager, thumbprint, response, correlationId);
      return response;
    }
    function isOpenIdConfigResponse(response) {
      return response.hasOwnProperty("authorization_endpoint") && response.hasOwnProperty("token_endpoint") && response.hasOwnProperty("issuer") && response.hasOwnProperty("jwks_uri");
    }
    function isCloudInstanceDiscoveryResponse(response) {
      return response.hasOwnProperty("tenant_discovery_endpoint") && response.hasOwnProperty("metadata");
    }
    function isCloudInstanceDiscoveryErrorResponse(response) {
      return response.hasOwnProperty("error") && response.hasOwnProperty("error_description");
    }
    var RegionDiscovery = class _RegionDiscovery {
      constructor(networkInterface, logger, performanceClient, correlationId) {
        this.networkInterface = networkInterface;
        this.logger = logger;
        this.performanceClient = performanceClient;
        this.correlationId = correlationId;
      }
      /**
       * Detect the region from the application's environment.
       *
       * @returns Promise<string | null>
       */
      async detectRegion(environmentRegion, regionDiscoveryMetadata) {
        let autodetectedRegionName = environmentRegion;
        if (!autodetectedRegionName) {
          const options = _RegionDiscovery.IMDS_OPTIONS;
          try {
            const localIMDSVersionResponse = await invokeAsync(this.getRegionFromIMDS.bind(this), RegionDiscoveryGetRegionFromIMDS, this.logger, this.performanceClient, this.correlationId)(IMDS_VERSION, options);
            if (localIMDSVersionResponse.status === HTTP_SUCCESS) {
              autodetectedRegionName = localIMDSVersionResponse.body;
              regionDiscoveryMetadata.region_source = RegionDiscoverySources.IMDS;
            }
            if (localIMDSVersionResponse.status === HTTP_BAD_REQUEST) {
              const currentIMDSVersion = await invokeAsync(this.getCurrentVersion.bind(this), RegionDiscoveryGetCurrentVersion, this.logger, this.performanceClient, this.correlationId)(options);
              if (!currentIMDSVersion) {
                regionDiscoveryMetadata.region_source = RegionDiscoverySources.FAILED_AUTO_DETECTION;
                return null;
              }
              const currentIMDSVersionResponse = await invokeAsync(this.getRegionFromIMDS.bind(this), RegionDiscoveryGetRegionFromIMDS, this.logger, this.performanceClient, this.correlationId)(currentIMDSVersion, options);
              if (currentIMDSVersionResponse.status === HTTP_SUCCESS) {
                autodetectedRegionName = currentIMDSVersionResponse.body;
                regionDiscoveryMetadata.region_source = RegionDiscoverySources.IMDS;
              }
            }
          } catch (e) {
            regionDiscoveryMetadata.region_source = RegionDiscoverySources.FAILED_AUTO_DETECTION;
            return null;
          }
        } else {
          regionDiscoveryMetadata.region_source = RegionDiscoverySources.ENVIRONMENT_VARIABLE;
        }
        if (!autodetectedRegionName) {
          regionDiscoveryMetadata.region_source = RegionDiscoverySources.FAILED_AUTO_DETECTION;
        }
        return autodetectedRegionName || null;
      }
      /**
       * Make the call to the IMDS endpoint
       *
       * @param imdsEndpointUrl
       * @returns Promise<NetworkResponse<string>>
       */
      async getRegionFromIMDS(version3, options) {
        return this.networkInterface.sendGetRequestAsync(`${IMDS_ENDPOINT}?api-version=${version3}&format=text`, options, IMDS_TIMEOUT);
      }
      /**
       * Get the most recent version of the IMDS endpoint available
       *
       * @returns Promise<string | null>
       */
      async getCurrentVersion(options) {
        try {
          const response = await this.networkInterface.sendGetRequestAsync(`${IMDS_ENDPOINT}?format=json`, options);
          if (response.status === HTTP_BAD_REQUEST && response.body && response.body["newest-versions"] && response.body["newest-versions"].length > 0) {
            return response.body["newest-versions"][0];
          }
          return null;
        } catch (e) {
          return null;
        }
      }
    };
    RegionDiscovery.IMDS_OPTIONS = {
      headers: {
        Metadata: "true"
      }
    };
    var Authority = class _Authority {
      constructor(authority, networkInterface, cacheManager, authorityOptions, logger, correlationId, performanceClient, managedIdentity) {
        this.canonicalAuthority = authority;
        this._canonicalAuthority.validateAsUri();
        this.networkInterface = networkInterface;
        this.cacheManager = cacheManager;
        this.authorityOptions = authorityOptions;
        this.regionDiscoveryMetadata = {
          region_used: void 0,
          region_source: void 0,
          region_outcome: void 0
        };
        this.logger = logger;
        this.performanceClient = performanceClient;
        this.correlationId = correlationId;
        this.managedIdentity = managedIdentity || false;
        this.regionDiscovery = new RegionDiscovery(networkInterface, this.logger, this.performanceClient, this.correlationId);
      }
      /**
       * Get {@link AuthorityType}
       * @param authorityUri {@link IUri}
       * @private
       */
      getAuthorityType(authorityUri) {
        if (authorityUri.HostNameAndPort.endsWith(CIAM_AUTH_URL)) {
          return AuthorityType.Ciam;
        }
        const pathSegments = authorityUri.PathSegments;
        if (pathSegments.length) {
          switch (pathSegments[0].toLowerCase()) {
            case ADFS:
              return AuthorityType.Adfs;
            case DSTS:
              return AuthorityType.Dsts;
          }
        }
        return AuthorityType.Default;
      }
      // See above for AuthorityType
      get authorityType() {
        return this.getAuthorityType(this.canonicalAuthorityUrlComponents);
      }
      /**
       * ProtocolMode enum representing the way endpoints are constructed.
       */
      get protocolMode() {
        return this.authorityOptions.protocolMode;
      }
      /**
       * Returns authorityOptions which can be used to reinstantiate a new authority instance
       */
      get options() {
        return this.authorityOptions;
      }
      /**
       * A URL that is the authority set by the developer
       */
      get canonicalAuthority() {
        return this._canonicalAuthority.urlString;
      }
      /**
       * Sets canonical authority.
       */
      set canonicalAuthority(url) {
        this._canonicalAuthority = new UrlString(url);
        this._canonicalAuthority.validateAsUri();
        this._canonicalAuthorityUrlComponents = null;
      }
      /**
       * Get authority components.
       */
      get canonicalAuthorityUrlComponents() {
        if (!this._canonicalAuthorityUrlComponents) {
          this._canonicalAuthorityUrlComponents = this._canonicalAuthority.getUrlComponents();
        }
        return this._canonicalAuthorityUrlComponents;
      }
      /**
       * Get hostname and port i.e. login.microsoftonline.com
       */
      get hostnameAndPort() {
        return this.canonicalAuthorityUrlComponents.HostNameAndPort.toLowerCase();
      }
      /**
       * Get tenant for authority.
       */
      get tenant() {
        return this.canonicalAuthorityUrlComponents.PathSegments[0];
      }
      /**
       * OAuth /authorize endpoint for requests
       */
      get authorizationEndpoint() {
        if (this.discoveryComplete()) {
          return this.replacePath(this.metadata.authorization_endpoint);
        } else {
          throw createClientAuthError(endpointResolutionError);
        }
      }
      /**
       * OAuth /token endpoint for requests
       */
      get tokenEndpoint() {
        if (this.discoveryComplete()) {
          return this.replacePath(this.metadata.token_endpoint);
        } else {
          throw createClientAuthError(endpointResolutionError);
        }
      }
      get deviceCodeEndpoint() {
        if (this.discoveryComplete()) {
          return this.replacePath(this.metadata.token_endpoint.replace("/token", "/devicecode"));
        } else {
          throw createClientAuthError(endpointResolutionError);
        }
      }
      /**
       * OAuth logout endpoint for requests
       */
      get endSessionEndpoint() {
        if (this.discoveryComplete()) {
          if (!this.metadata.end_session_endpoint) {
            throw createClientAuthError(endSessionEndpointNotSupported);
          }
          return this.replacePath(this.metadata.end_session_endpoint);
        } else {
          throw createClientAuthError(endpointResolutionError);
        }
      }
      /**
       * OAuth issuer for requests
       */
      get selfSignedJwtAudience() {
        if (this.discoveryComplete()) {
          return this.replacePath(this.metadata.issuer);
        } else {
          throw createClientAuthError(endpointResolutionError);
        }
      }
      /**
       * Jwks_uri for token signing keys
       */
      get jwksUri() {
        if (this.discoveryComplete()) {
          return this.replacePath(this.metadata.jwks_uri);
        } else {
          throw createClientAuthError(endpointResolutionError);
        }
      }
      /**
       * Returns a flag indicating that tenant name can be replaced in authority {@link IUri}
       * @param authorityUri {@link IUri}
       * @private
       */
      canReplaceTenant(authorityUri) {
        return authorityUri.PathSegments.length === 1 && !_Authority.reservedTenantDomains.has(authorityUri.PathSegments[0]) && this.getAuthorityType(authorityUri) === AuthorityType.Default && this.protocolMode !== ProtocolMode.OIDC;
      }
      /**
       * Replaces tenant in url path with current tenant. Defaults to common.
       * @param urlString
       */
      replaceTenant(urlString) {
        return urlString.replace(/{tenant}|{tenantid}/g, this.tenant);
      }
      /**
       * Replaces path such as tenant or policy with the current tenant or policy.
       * @param urlString
       */
      replacePath(urlString) {
        let endpoint = urlString;
        const cachedAuthorityUrl = new UrlString(this.metadata.canonical_authority);
        const cachedAuthorityUrlComponents = cachedAuthorityUrl.getUrlComponents();
        const cachedAuthorityParts = cachedAuthorityUrlComponents.PathSegments;
        const currentAuthorityParts = this.canonicalAuthorityUrlComponents.PathSegments;
        currentAuthorityParts.forEach((currentPart, index) => {
          let cachedPart = cachedAuthorityParts[index];
          if (index === 0 && this.canReplaceTenant(cachedAuthorityUrlComponents)) {
            const tenantId = new UrlString(this.metadata.authorization_endpoint).getUrlComponents().PathSegments[0];
            if (cachedPart !== tenantId) {
              this.logger.verbose(`Replacing tenant domain name '${cachedPart}' with id '${tenantId}'`, this.correlationId);
              cachedPart = tenantId;
            }
          }
          if (currentPart !== cachedPart) {
            endpoint = endpoint.replace(`/${cachedPart}/`, `/${currentPart}/`);
          }
        });
        return this.replaceTenant(endpoint);
      }
      /**
       * The default open id configuration endpoint for any canonical authority.
       */
      get defaultOpenIdConfigurationEndpoint() {
        const canonicalAuthorityHost = this.hostnameAndPort;
        if (this.canonicalAuthority.endsWith("v2.0/") || this.authorityType === AuthorityType.Adfs || this.protocolMode === ProtocolMode.OIDC && !this.isAliasOfKnownMicrosoftAuthority(canonicalAuthorityHost)) {
          return `${this.canonicalAuthority}.well-known/openid-configuration`;
        }
        return `${this.canonicalAuthority}v2.0/.well-known/openid-configuration`;
      }
      /**
       * Boolean that returns whether or not tenant discovery has been completed.
       */
      discoveryComplete() {
        return !!this.metadata;
      }
      /**
       * Perform endpoint discovery to discover aliases, preferred_cache, preferred_network
       * and the /authorize, /token and logout endpoints.
       */
      async resolveEndpointsAsync() {
        const metadataEntity = this.getCurrentMetadataEntity();
        const cloudDiscoverySource = await invokeAsync(this.updateCloudDiscoveryMetadata.bind(this), AuthorityUpdateCloudDiscoveryMetadata, this.logger, this.performanceClient, this.correlationId)(metadataEntity);
        this.canonicalAuthority = this.canonicalAuthority.replace(this.hostnameAndPort, metadataEntity.preferred_network);
        const endpointSource = await invokeAsync(this.updateEndpointMetadata.bind(this), AuthorityUpdateEndpointMetadata, this.logger, this.performanceClient, this.correlationId)(metadataEntity);
        this.updateCachedMetadata(metadataEntity, cloudDiscoverySource, {
          source: endpointSource
        });
        this.performanceClient?.addFields({
          cloudDiscoverySource,
          authorityEndpointSource: endpointSource
        }, this.correlationId);
      }
      /**
       * Returns metadata entity from cache if it exists, otherwiser returns a new metadata entity built
       * from the configured canonical authority
       * @returns
       */
      getCurrentMetadataEntity() {
        let metadataEntity = this.cacheManager.getAuthorityMetadataByAlias(this.hostnameAndPort, this.correlationId);
        if (!metadataEntity) {
          metadataEntity = {
            aliases: [],
            preferred_cache: this.hostnameAndPort,
            preferred_network: this.hostnameAndPort,
            canonical_authority: this.canonicalAuthority,
            authorization_endpoint: "",
            token_endpoint: "",
            end_session_endpoint: "",
            issuer: "",
            aliasesFromNetwork: false,
            endpointsFromNetwork: false,
            expiresAt: generateAuthorityMetadataExpiresAt(),
            jwks_uri: ""
          };
        }
        return metadataEntity;
      }
      /**
       * Updates cached metadata based on metadata source and sets the instance's metadata
       * property to the same value
       * @param metadataEntity
       * @param cloudDiscoverySource
       * @param endpointMetadataResult
       */
      updateCachedMetadata(metadataEntity, cloudDiscoverySource, endpointMetadataResult) {
        if (cloudDiscoverySource !== AuthorityMetadataSource.CACHE && endpointMetadataResult?.source !== AuthorityMetadataSource.CACHE) {
          metadataEntity.expiresAt = generateAuthorityMetadataExpiresAt();
          metadataEntity.canonical_authority = this.canonicalAuthority;
        }
        const cacheKey = this.cacheManager.generateAuthorityMetadataCacheKey(metadataEntity.preferred_cache, this.correlationId);
        this.cacheManager.setAuthorityMetadata(cacheKey, metadataEntity, this.correlationId);
        this.metadata = metadataEntity;
      }
      /**
       * Update AuthorityMetadataEntity with new endpoints and return where the information came from
       * @param metadataEntity
       */
      async updateEndpointMetadata(metadataEntity) {
        const localMetadata = this.updateEndpointMetadataFromLocalSources(metadataEntity);
        if (localMetadata) {
          if (localMetadata.source === AuthorityMetadataSource.HARDCODED_VALUES) {
            if (this.authorityOptions.azureRegionConfiguration?.azureRegion) {
              if (localMetadata.metadata) {
                const hardcodedMetadata = await invokeAsync(this.updateMetadataWithRegionalInformation.bind(this), AuthorityUpdateMetadataWithRegionalInformation, this.logger, this.performanceClient, this.correlationId)(localMetadata.metadata);
                updateAuthorityEndpointMetadata(metadataEntity, hardcodedMetadata, false);
                metadataEntity.canonical_authority = this.canonicalAuthority;
              }
            }
          }
          return localMetadata.source;
        }
        let metadata = await invokeAsync(this.getEndpointMetadataFromNetwork.bind(this), AuthorityGetEndpointMetadataFromNetwork, this.logger, this.performanceClient, this.correlationId)();
        if (metadata) {
          if (this.authorityOptions.azureRegionConfiguration?.azureRegion) {
            metadata = await invokeAsync(this.updateMetadataWithRegionalInformation.bind(this), AuthorityUpdateMetadataWithRegionalInformation, this.logger, this.performanceClient, this.correlationId)(metadata);
          }
          updateAuthorityEndpointMetadata(metadataEntity, metadata, true);
          return AuthorityMetadataSource.NETWORK;
        } else {
          throw createClientAuthError(openIdConfigError, this.defaultOpenIdConfigurationEndpoint);
        }
      }
      /**
       * Updates endpoint metadata from local sources and returns where the information was retrieved from and the metadata config
       * response if the source is hardcoded metadata
       * @param metadataEntity
       * @returns
       */
      updateEndpointMetadataFromLocalSources(metadataEntity) {
        this.logger.verbose("Attempting to get endpoint metadata from authority configuration", this.correlationId);
        const configMetadata = this.getEndpointMetadataFromConfig();
        if (configMetadata) {
          this.logger.verbose("Found endpoint metadata in authority configuration", this.correlationId);
          updateAuthorityEndpointMetadata(metadataEntity, configMetadata, false);
          return {
            source: AuthorityMetadataSource.CONFIG
          };
        }
        this.logger.verbose("Did not find endpoint metadata in the config... Attempting to get endpoint metadata from the hardcoded values.", this.correlationId);
        const hardcodedMetadata = this.getEndpointMetadataFromHardcodedValues();
        if (hardcodedMetadata) {
          updateAuthorityEndpointMetadata(metadataEntity, hardcodedMetadata, false);
          return {
            source: AuthorityMetadataSource.HARDCODED_VALUES,
            metadata: hardcodedMetadata
          };
        } else {
          this.logger.verbose("Did not find endpoint metadata in hardcoded values... Attempting to get endpoint metadata from the network metadata cache.", this.correlationId);
        }
        const metadataEntityExpired = isAuthorityMetadataExpired(metadataEntity);
        if (this.isAuthoritySameType(metadataEntity) && metadataEntity.endpointsFromNetwork && !metadataEntityExpired) {
          this.logger.verbose("Found endpoint metadata in the cache.", "");
          return { source: AuthorityMetadataSource.CACHE };
        } else if (metadataEntityExpired) {
          this.logger.verbose("The metadata entity is expired.", "");
        }
        return null;
      }
      /**
       * Compares the number of url components after the domain to determine if the cached
       * authority metadata can be used for the requested authority. Protects against same domain different
       * authority such as login.microsoftonline.com/tenant and login.microsoftonline.com/tfp/tenant/policy
       * @param metadataEntity
       */
      isAuthoritySameType(metadataEntity) {
        const cachedAuthorityUrl = new UrlString(metadataEntity.canonical_authority);
        const cachedParts = cachedAuthorityUrl.getUrlComponents().PathSegments;
        return cachedParts.length === this.canonicalAuthorityUrlComponents.PathSegments.length;
      }
      /**
       * Parse authorityMetadata config option
       */
      getEndpointMetadataFromConfig() {
        if (this.authorityOptions.authorityMetadata) {
          try {
            return JSON.parse(this.authorityOptions.authorityMetadata);
          } catch (e) {
            throw createClientConfigurationError(invalidAuthorityMetadata);
          }
        }
        return null;
      }
      /**
       * Gets OAuth endpoints from the given OpenID configuration endpoint.
       *
       * @param hasHardcodedMetadata boolean
       */
      async getEndpointMetadataFromNetwork() {
        const options = {};
        const openIdConfigurationEndpoint = this.defaultOpenIdConfigurationEndpoint;
        this.logger.verbose(`Authority.getEndpointMetadataFromNetwork: attempting to retrieve OAuth endpoints from '${openIdConfigurationEndpoint}'`, this.correlationId);
        try {
          const response = await this.networkInterface.sendGetRequestAsync(openIdConfigurationEndpoint, options);
          const isValidResponse = isOpenIdConfigResponse(response.body);
          if (isValidResponse) {
            return response.body;
          } else {
            this.logger.verbose(`Authority.getEndpointMetadataFromNetwork: could not parse response as OpenID configuration`, this.correlationId);
            return null;
          }
        } catch (e) {
          this.logger.verbose(`Authority.getEndpointMetadataFromNetwork: '${e}'`, this.correlationId);
          return null;
        }
      }
      /**
       * Get OAuth endpoints for common authorities.
       */
      getEndpointMetadataFromHardcodedValues() {
        if (this.hostnameAndPort in EndpointMetadata) {
          return EndpointMetadata[this.hostnameAndPort];
        }
        return null;
      }
      /**
       * Update the retrieved metadata with regional information.
       * User selected Azure region will be used if configured.
       */
      async updateMetadataWithRegionalInformation(metadata) {
        const userConfiguredAzureRegion = this.authorityOptions.azureRegionConfiguration?.azureRegion;
        if (userConfiguredAzureRegion) {
          if (userConfiguredAzureRegion !== AZURE_REGION_AUTO_DISCOVER_FLAG) {
            this.regionDiscoveryMetadata.region_outcome = RegionDiscoveryOutcomes.CONFIGURED_NO_AUTO_DETECTION;
            this.regionDiscoveryMetadata.region_used = userConfiguredAzureRegion;
            return _Authority.replaceWithRegionalInformation(metadata, userConfiguredAzureRegion);
          }
          const autodetectedRegionName = await invokeAsync(this.regionDiscovery.detectRegion.bind(this.regionDiscovery), RegionDiscoveryDetectRegion, this.logger, this.performanceClient, this.correlationId)(this.authorityOptions.azureRegionConfiguration?.environmentRegion, this.regionDiscoveryMetadata);
          if (autodetectedRegionName) {
            this.regionDiscoveryMetadata.region_outcome = RegionDiscoveryOutcomes.AUTO_DETECTION_REQUESTED_SUCCESSFUL;
            this.regionDiscoveryMetadata.region_used = autodetectedRegionName;
            return _Authority.replaceWithRegionalInformation(metadata, autodetectedRegionName);
          }
          this.regionDiscoveryMetadata.region_outcome = RegionDiscoveryOutcomes.AUTO_DETECTION_REQUESTED_FAILED;
        }
        return metadata;
      }
      /**
       * Updates the AuthorityMetadataEntity with new aliases, preferred_network and preferred_cache
       * and returns where the information was retrieved from
       * @param metadataEntity
       * @returns AuthorityMetadataSource
       */
      async updateCloudDiscoveryMetadata(metadataEntity) {
        const localMetadataSource = this.updateCloudDiscoveryMetadataFromLocalSources(metadataEntity);
        if (localMetadataSource) {
          return localMetadataSource;
        }
        const metadata = await invokeAsync(this.getCloudDiscoveryMetadataFromNetwork.bind(this), AuthorityGetCloudDiscoveryMetadataFromNetwork, this.logger, this.performanceClient, this.correlationId)();
        if (metadata) {
          updateCloudDiscoveryMetadata(metadataEntity, metadata, true);
          return AuthorityMetadataSource.NETWORK;
        }
        throw createClientConfigurationError(untrustedAuthority);
      }
      updateCloudDiscoveryMetadataFromLocalSources(metadataEntity) {
        this.logger.verbose("Attempting to get cloud discovery metadata  from authority configuration", this.correlationId);
        this.logger.verbosePii(`Known Authorities: '${this.authorityOptions.knownAuthorities || NOT_APPLICABLE}'`, this.correlationId);
        this.logger.verbosePii(`Authority Metadata: '${this.authorityOptions.authorityMetadata || NOT_APPLICABLE}'`, this.correlationId);
        this.logger.verbosePii(`Canonical Authority: '${metadataEntity.canonical_authority || NOT_APPLICABLE}'`, this.correlationId);
        const metadata = this.getCloudDiscoveryMetadataFromConfig();
        if (metadata) {
          this.logger.verbose("Found cloud discovery metadata in authority configuration", this.correlationId);
          updateCloudDiscoveryMetadata(metadataEntity, metadata, false);
          return AuthorityMetadataSource.CONFIG;
        }
        this.logger.verbose("Did not find cloud discovery metadata in the config... Attempting to get cloud discovery metadata from the hardcoded values.", this.correlationId);
        const hardcodedMetadata = getCloudDiscoveryMetadataFromHardcodedValues(this.hostnameAndPort);
        if (hardcodedMetadata) {
          this.logger.verbose("Found cloud discovery metadata from hardcoded values.", this.correlationId);
          updateCloudDiscoveryMetadata(metadataEntity, hardcodedMetadata, false);
          return AuthorityMetadataSource.HARDCODED_VALUES;
        }
        this.logger.verbose("Did not find cloud discovery metadata in hardcoded values... Attempting to get cloud discovery metadata from the network metadata cache.", this.correlationId);
        const metadataEntityExpired = isAuthorityMetadataExpired(metadataEntity);
        if (this.isAuthoritySameType(metadataEntity) && metadataEntity.aliasesFromNetwork && !metadataEntityExpired) {
          this.logger.verbose("Found cloud discovery metadata in the cache.", "");
          return AuthorityMetadataSource.CACHE;
        } else if (metadataEntityExpired) {
          this.logger.verbose("The metadata entity is expired.", "");
        }
        return null;
      }
      /**
       * Parse cloudDiscoveryMetadata config or check knownAuthorities
       */
      getCloudDiscoveryMetadataFromConfig() {
        if (this.authorityType === AuthorityType.Ciam) {
          this.logger.verbose("CIAM authorities do not support cloud discovery metadata, generate the aliases from authority host.", this.correlationId);
          return _Authority.createCloudDiscoveryMetadataFromHost(this.hostnameAndPort);
        }
        if (this.authorityOptions.cloudDiscoveryMetadata) {
          this.logger.verbose("The cloud discovery metadata has been provided as a network response, in the config.", this.correlationId);
          try {
            this.logger.verbose("Attempting to parse the cloud discovery metadata.", this.correlationId);
            const parsedResponse = JSON.parse(this.authorityOptions.cloudDiscoveryMetadata);
            const metadata = getCloudDiscoveryMetadataFromNetworkResponse(parsedResponse.metadata, this.hostnameAndPort);
            this.logger.verbose("Parsed the cloud discovery metadata.", "");
            if (metadata) {
              this.logger.verbose("There is returnable metadata attached to the parsed cloud discovery metadata.", this.correlationId);
              return metadata;
            } else {
              this.logger.verbose("There is no metadata attached to the parsed cloud discovery metadata.", this.correlationId);
            }
          } catch (e) {
            this.logger.verbose("Unable to parse the cloud discovery metadata. Throwing Invalid Cloud Discovery Metadata Error.", this.correlationId);
            throw createClientConfigurationError(invalidCloudDiscoveryMetadata);
          }
        }
        if (this.isInKnownAuthorities()) {
          this.logger.verbose("The host is included in knownAuthorities. Creating new cloud discovery metadata from the host.", this.correlationId);
          return _Authority.createCloudDiscoveryMetadataFromHost(this.hostnameAndPort);
        }
        return null;
      }
      /**
       * Called to get metadata from network if CloudDiscoveryMetadata was not populated by config
       *
       * @param hasHardcodedMetadata boolean
       */
      async getCloudDiscoveryMetadataFromNetwork() {
        const instanceDiscoveryEndpoint = `${AAD_INSTANCE_DISCOVERY_ENDPT}${this.canonicalAuthority}oauth2/v2.0/authorize`;
        const options = {};
        let match = null;
        try {
          const response = await this.networkInterface.sendGetRequestAsync(instanceDiscoveryEndpoint, options);
          let typedResponseBody;
          let metadata;
          if (isCloudInstanceDiscoveryResponse(response.body)) {
            typedResponseBody = response.body;
            metadata = typedResponseBody.metadata;
            this.logger.verbosePii(`tenant_discovery_endpoint is: '${typedResponseBody.tenant_discovery_endpoint}'`, this.correlationId);
          } else if (isCloudInstanceDiscoveryErrorResponse(response.body)) {
            this.logger.warning(`A CloudInstanceDiscoveryErrorResponse was returned. The cloud instance discovery network request's status code is: '${response.status}'`, this.correlationId);
            typedResponseBody = response.body;
            if (typedResponseBody.error === INVALID_INSTANCE) {
              this.logger.error("The CloudInstanceDiscoveryErrorResponse error is invalid_instance.", this.correlationId);
              return null;
            }
            this.logger.warning(`The CloudInstanceDiscoveryErrorResponse error is '${typedResponseBody.error}'`, this.correlationId);
            this.logger.warning(`The CloudInstanceDiscoveryErrorResponse error description is '${typedResponseBody.error_description}'`, this.correlationId);
            this.logger.warning("Setting the value of the CloudInstanceDiscoveryMetadata (returned from the network, correlationId) to []", this.correlationId);
            metadata = [];
          } else {
            this.logger.error("AAD did not return a CloudInstanceDiscoveryResponse or CloudInstanceDiscoveryErrorResponse", this.correlationId);
            return null;
          }
          this.logger.verbose("Attempting to find a match between the developer's authority and the CloudInstanceDiscoveryMetadata returned from the network request.", this.correlationId);
          match = getCloudDiscoveryMetadataFromNetworkResponse(metadata, this.hostnameAndPort);
        } catch (error) {
          if (error instanceof AuthError) {
            this.logger.error(`There was a network error while attempting to get the cloud discovery instance metadata.
Error: '${error.errorCode}'
Error Description: '${error.errorMessage}'`, this.correlationId);
          } else {
            const typedError = error;
            this.logger.error(`A non-MSALJS error was thrown while attempting to get the cloud instance discovery metadata.
Error: '${typedError.name}'
Error Description: '${typedError.message}'`, this.correlationId);
          }
          return null;
        }
        if (!match) {
          this.logger.warning("The developer's authority was not found within the CloudInstanceDiscoveryMetadata returned from the network request.", this.correlationId);
          this.logger.verbose("Creating custom Authority for custom domain scenario.", this.correlationId);
          match = _Authority.createCloudDiscoveryMetadataFromHost(this.hostnameAndPort);
        }
        return match;
      }
      /**
       * Helper function to determine if this host is included in the knownAuthorities config option
       */
      isInKnownAuthorities() {
        const matches = this.authorityOptions.knownAuthorities.filter((authority) => {
          return authority && UrlString.getDomainFromUrl(authority).toLowerCase() === this.hostnameAndPort;
        });
        return matches.length > 0;
      }
      /**
       * helper function to populate the authority based on azureCloudOptions
       * @param authorityString
       * @param azureCloudOptions
       */
      static generateAuthority(authorityString, azureCloudOptions) {
        let authorityAzureCloudInstance;
        if (azureCloudOptions && azureCloudOptions.azureCloudInstance !== AzureCloudInstance.None) {
          const tenant = azureCloudOptions.tenant ? azureCloudOptions.tenant : DEFAULT_COMMON_TENANT;
          authorityAzureCloudInstance = `${azureCloudOptions.azureCloudInstance}/${tenant}/`;
        }
        return authorityAzureCloudInstance ? authorityAzureCloudInstance : authorityString;
      }
      /**
       * Creates cloud discovery metadata object from a given host
       * @param host
       */
      static createCloudDiscoveryMetadataFromHost(host) {
        return {
          preferred_network: host,
          preferred_cache: host,
          aliases: [host]
        };
      }
      /**
       * helper function to generate environment from authority object
       */
      getPreferredCache() {
        if (this.managedIdentity) {
          return DEFAULT_AUTHORITY_HOST;
        } else if (this.discoveryComplete()) {
          return this.metadata.preferred_cache;
        } else {
          throw createClientAuthError(endpointResolutionError);
        }
      }
      /**
       * Returns whether or not the provided host is an alias of this authority instance
       * @param host
       */
      isAlias(host) {
        return this.metadata.aliases.indexOf(host) > -1;
      }
      /**
       * Returns whether or not the provided host is an alias of a known Microsoft authority for purposes of endpoint discovery
       * @param host
       */
      isAliasOfKnownMicrosoftAuthority(host) {
        return InstanceDiscoveryMetadataAliases.has(host);
      }
      /**
       * Checks whether the provided host is that of a public cloud authority
       *
       * @param authority string
       * @returns bool
       */
      static isPublicCloudAuthority(host) {
        return KNOWN_PUBLIC_CLOUDS.indexOf(host) >= 0;
      }
      /**
       * Rebuild the authority string with the region
       *
       * @param host string
       * @param region string
       */
      static buildRegionalAuthorityString(host, region, queryString) {
        const authorityUrlInstance = new UrlString(host);
        authorityUrlInstance.validateAsUri();
        const authorityUrlParts = authorityUrlInstance.getUrlComponents();
        let hostNameAndPort = `${region}.${authorityUrlParts.HostNameAndPort}`;
        if (this.isPublicCloudAuthority(authorityUrlParts.HostNameAndPort)) {
          hostNameAndPort = `${region}.${REGIONAL_AUTH_PUBLIC_CLOUD_SUFFIX}`;
        }
        const url = UrlString.constructAuthorityUriFromObject({
          ...authorityUrlInstance.getUrlComponents(),
          HostNameAndPort: hostNameAndPort
        }).urlString;
        if (queryString)
          return `${url}?${queryString}`;
        return url;
      }
      /**
       * Replace the endpoints in the metadata object with their regional equivalents.
       *
       * @param metadata OpenIdConfigResponse
       * @param azureRegion string
       */
      static replaceWithRegionalInformation(metadata, azureRegion) {
        const regionalMetadata = { ...metadata };
        regionalMetadata.authorization_endpoint = _Authority.buildRegionalAuthorityString(regionalMetadata.authorization_endpoint, azureRegion);
        regionalMetadata.token_endpoint = _Authority.buildRegionalAuthorityString(regionalMetadata.token_endpoint, azureRegion);
        if (regionalMetadata.end_session_endpoint) {
          regionalMetadata.end_session_endpoint = _Authority.buildRegionalAuthorityString(regionalMetadata.end_session_endpoint, azureRegion);
        }
        return regionalMetadata;
      }
      /**
       * Transform CIAM_AUTHORIY as per the below rules:
       * If no path segments found and it is a CIAM authority (hostname ends with .ciamlogin.com), then transform it
       *
       * NOTE: The transformation path should go away once STS supports CIAM with the format: `tenantIdorDomain.ciamlogin.com`
       * `ciamlogin.com` can also change in the future and we should accommodate the same
       *
       * @param authority
       */
      static transformCIAMAuthority(authority) {
        let ciamAuthority = authority;
        const authorityUrl = new UrlString(authority);
        const authorityUrlComponents = authorityUrl.getUrlComponents();
        if (authorityUrlComponents.PathSegments.length === 0 && authorityUrlComponents.HostNameAndPort.endsWith(CIAM_AUTH_URL)) {
          const tenantIdOrDomain = authorityUrlComponents.HostNameAndPort.split(".")[0];
          ciamAuthority = `${ciamAuthority}${tenantIdOrDomain}${AAD_TENANT_DOMAIN_SUFFIX}`;
        }
        return ciamAuthority;
      }
    };
    Authority.reservedTenantDomains = /* @__PURE__ */ new Set([
      "{tenant}",
      "{tenantid}",
      AADAuthority.COMMON,
      AADAuthority.CONSUMERS,
      AADAuthority.ORGANIZATIONS
    ]);
    function getTenantFromAuthorityString(authority) {
      const authorityUrl = new UrlString(authority);
      const authorityUrlComponents = authorityUrl.getUrlComponents();
      const tenantId = authorityUrlComponents.PathSegments.slice(-1)[0]?.toLowerCase();
      switch (tenantId) {
        case AADAuthority.COMMON:
        case AADAuthority.ORGANIZATIONS:
        case AADAuthority.CONSUMERS:
          return void 0;
        default:
          return tenantId;
      }
    }
    function formatAuthorityUri(authorityUri) {
      return authorityUri.endsWith(FORWARD_SLASH) ? authorityUri : `${authorityUri}${FORWARD_SLASH}`;
    }
    function buildStaticAuthorityOptions(authOptions) {
      const rawCloudDiscoveryMetadata = authOptions.cloudDiscoveryMetadata;
      let cloudDiscoveryMetadata = void 0;
      if (rawCloudDiscoveryMetadata) {
        try {
          cloudDiscoveryMetadata = JSON.parse(rawCloudDiscoveryMetadata);
        } catch (e) {
          throw createClientConfigurationError(invalidCloudDiscoveryMetadata);
        }
      }
      return {
        canonicalAuthority: authOptions.authority ? formatAuthorityUri(authOptions.authority) : void 0,
        knownAuthorities: authOptions.knownAuthorities,
        cloudDiscoveryMetadata
      };
    }
    async function createDiscoveredInstance(authorityUri, networkClient, cacheManager, authorityOptions, logger, correlationId, performanceClient) {
      const authorityUriFinal = Authority.transformCIAMAuthority(formatAuthorityUri(authorityUri));
      const acquireTokenAuthority = new Authority(authorityUriFinal, networkClient, cacheManager, authorityOptions, logger, correlationId, performanceClient);
      try {
        await invokeAsync(acquireTokenAuthority.resolveEndpointsAsync.bind(acquireTokenAuthority), AuthorityResolveEndpointsAsync, logger, performanceClient, correlationId)();
        return acquireTokenAuthority;
      } catch (e) {
        throw createClientAuthError(endpointResolutionError);
      }
    }
    var AuthorizationCodeClient = class {
      constructor(configuration, performanceClient) {
        this.includeRedirectUri = true;
        this.config = buildClientConfiguration(configuration);
        this.logger = new Logger(this.config.loggerOptions, name$1, version$1);
        this.cryptoUtils = this.config.cryptoInterface;
        this.cacheManager = this.config.storageInterface;
        this.networkClient = this.config.networkInterface;
        this.serverTelemetryManager = this.config.serverTelemetryManager;
        this.authority = this.config.authOptions.authority;
        this.performanceClient = performanceClient;
        this.oidcDefaultScopes = this.config.authOptions.authority.options.OIDCOptions?.defaultScopes;
      }
      /**
       * API to acquire a token in exchange of 'authorization_code` acquired by the user in the first leg of the
       * authorization_code_grant
       * @param request
       */
      async acquireToken(request, apiId, authCodePayload) {
        if (!request.code) {
          throw createClientAuthError(requestCannotBeMade);
        }
        if (authCodePayload && authCodePayload.cloud_instance_host_name) {
          await invokeAsync(this.updateTokenEndpointAuthority.bind(this), UpdateTokenEndpointAuthority, this.logger, this.performanceClient, request.correlationId)(authCodePayload.cloud_instance_host_name, request.correlationId);
        }
        const reqTimestamp = nowSeconds();
        const response = await invokeAsync(this.executeTokenRequest.bind(this), AuthClientExecuteTokenRequest, this.logger, this.performanceClient, request.correlationId)(this.authority, request, this.serverTelemetryManager);
        const requestId = response.headers?.[HeaderNames.X_MS_REQUEST_ID];
        const responseHandler = new ResponseHandler(this.config.authOptions.clientId, this.cacheManager, this.cryptoUtils, this.logger, this.performanceClient, this.config.serializableCache, this.config.persistencePlugin);
        responseHandler.validateTokenResponse(response.body, request.correlationId);
        return invokeAsync(responseHandler.handleServerTokenResponse.bind(responseHandler), HandleServerTokenResponse, this.logger, this.performanceClient, request.correlationId)(response.body, this.authority, reqTimestamp, request, apiId, authCodePayload, void 0, void 0, void 0, requestId);
      }
      /**
       * Used to log out the current user, and redirect the user to the postLogoutRedirectUri.
       * Default behaviour is to redirect the user to `window.location.href`.
       * @param authorityUri
       */
      getLogoutUri(logoutRequest) {
        if (!logoutRequest) {
          throw createClientConfigurationError(logoutRequestEmpty);
        }
        const queryString = this.createLogoutUrlQueryString(logoutRequest);
        return UrlString.appendQueryString(this.authority.endSessionEndpoint, queryString);
      }
      /**
       * Executes POST request to token endpoint
       * @param authority
       * @param request
       */
      async executeTokenRequest(authority, request, serverTelemetryManager) {
        const queryParametersString = createTokenQueryParameters(request, this.config.authOptions.clientId, this.config.authOptions.redirectUri, this.performanceClient);
        const endpoint = UrlString.appendQueryString(authority.tokenEndpoint, queryParametersString);
        const requestBody = await invokeAsync(this.createTokenRequestBody.bind(this), AuthClientCreateTokenRequestBody, this.logger, this.performanceClient, request.correlationId)(request);
        let ccsCredential = void 0;
        if (request.clientInfo) {
          try {
            const clientInfo = buildClientInfo(request.clientInfo, this.cryptoUtils.base64Decode);
            ccsCredential = {
              credential: `${clientInfo.uid}${CLIENT_INFO_SEPARATOR}${clientInfo.utid}`,
              type: CcsCredentialType.HOME_ACCOUNT_ID
            };
          } catch (e) {
            this.logger.verbose(`Could not parse client info for CCS Header: '${e}'`, request.correlationId);
          }
        }
        const headers = createTokenRequestHeaders(this.logger, this.config.systemOptions.preventCorsPreflight, ccsCredential || request.ccsCredential);
        const thumbprint = getRequestThumbprint(this.config.authOptions.clientId, request);
        return invokeAsync(executePostToTokenEndpoint, AuthorizationCodeClientExecutePostToTokenEndpoint, this.logger, this.performanceClient, request.correlationId)(endpoint, requestBody, headers, thumbprint, request.correlationId, this.cacheManager, this.networkClient, this.logger, this.performanceClient, serverTelemetryManager);
      }
      /**
       * Generates a map for all the params to be sent to the service
       * @param request
       */
      async createTokenRequestBody(request) {
        const parameters = /* @__PURE__ */ new Map();
        addClientId(parameters, request.embeddedClientId || request.extraParameters?.[CLIENT_ID] || this.config.authOptions.clientId);
        if (!this.includeRedirectUri) {
          if (!request.redirectUri) {
            throw createClientConfigurationError(redirectUriEmpty);
          }
        } else {
          addRedirectUri(parameters, request.redirectUri);
        }
        addScopes(parameters, request.scopes, true, this.oidcDefaultScopes);
        addAuthorizationCode(parameters, request.code);
        addLibraryInfo(parameters, this.config.libraryInfo);
        addApplicationTelemetry(parameters, this.config.telemetry.application);
        addThrottling(parameters);
        if (this.serverTelemetryManager && !isOidcProtocolMode(this.config)) {
          addServerTelemetry(parameters, this.serverTelemetryManager);
        }
        if (request.codeVerifier) {
          addCodeVerifier(parameters, request.codeVerifier);
        }
        if (this.config.clientCredentials.clientSecret) {
          addClientSecret(parameters, this.config.clientCredentials.clientSecret);
        }
        if (this.config.clientCredentials.clientAssertion) {
          const clientAssertion = this.config.clientCredentials.clientAssertion;
          addClientAssertion(parameters, await getClientAssertion(clientAssertion.assertion, this.config.authOptions.clientId, request.resourceRequestUri));
          addClientAssertionType(parameters, clientAssertion.assertionType);
        }
        addGrantType(parameters, GrantType.AUTHORIZATION_CODE_GRANT);
        addClientInfo(parameters);
        if (request.authenticationScheme === AuthenticationScheme.POP) {
          const popTokenGenerator = new PopTokenGenerator(this.cryptoUtils, this.performanceClient);
          let reqCnfData;
          if (!request.popKid) {
            const generatedReqCnfData = await invokeAsync(popTokenGenerator.generateCnf.bind(popTokenGenerator), PopTokenGenerateCnf, this.logger, this.performanceClient, request.correlationId)(request, this.logger);
            reqCnfData = generatedReqCnfData.reqCnfString;
          } else {
            reqCnfData = this.cryptoUtils.encodeKid(request.popKid);
          }
          addPopToken(parameters, reqCnfData);
        } else if (request.authenticationScheme === AuthenticationScheme.SSH) {
          if (request.sshJwk) {
            addSshJwk(parameters, request.sshJwk);
          } else {
            throw createClientConfigurationError(missingSshJwk);
          }
        }
        if (!StringUtils.isEmptyObj(request.claims) || this.config.authOptions.clientCapabilities && this.config.authOptions.clientCapabilities.length > 0) {
          addClaims(parameters, request.claims, this.config.authOptions.clientCapabilities);
        }
        let ccsCred = void 0;
        if (request.clientInfo) {
          try {
            const clientInfo = buildClientInfo(request.clientInfo, this.cryptoUtils.base64Decode);
            ccsCred = {
              credential: `${clientInfo.uid}${CLIENT_INFO_SEPARATOR}${clientInfo.utid}`,
              type: CcsCredentialType.HOME_ACCOUNT_ID
            };
          } catch (e) {
            this.logger.verbose(`Could not parse client info for CCS Header: '${e}'`, request.correlationId);
          }
        } else {
          ccsCred = request.ccsCredential;
        }
        if (this.config.systemOptions.preventCorsPreflight && ccsCred) {
          switch (ccsCred.type) {
            case CcsCredentialType.HOME_ACCOUNT_ID:
              try {
                const clientInfo = buildClientInfoFromHomeAccountId(ccsCred.credential);
                addCcsOid(parameters, clientInfo);
              } catch (e) {
                this.logger.verbose(`Could not parse home account ID for CCS Header: '${e}'`, request.correlationId);
              }
              break;
            case CcsCredentialType.UPN:
              addCcsUpn(parameters, ccsCred.credential);
              break;
          }
        }
        if (request.embeddedClientId) {
          addBrokerParameters(parameters, this.config.authOptions.clientId, this.config.authOptions.redirectUri);
        }
        if (request.extraParameters) {
          addExtraParameters(parameters, request.extraParameters);
        }
        if (request.enableSpaAuthorizationCode && (!request.extraParameters || !request.extraParameters[RETURN_SPA_CODE])) {
          addExtraParameters(parameters, {
            [RETURN_SPA_CODE]: "1"
          });
        }
        instrumentBrokerParams(parameters, request.correlationId, this.performanceClient);
        return mapToQueryString(parameters);
      }
      /**
       * This API validates the `EndSessionRequest` and creates a URL
       * @param request
       */
      createLogoutUrlQueryString(request) {
        const parameters = /* @__PURE__ */ new Map();
        if (request.postLogoutRedirectUri) {
          addPostLogoutRedirectUri(parameters, request.postLogoutRedirectUri);
        }
        if (request.correlationId) {
          addCorrelationId(parameters, request.correlationId);
        }
        if (request.idTokenHint) {
          addIdTokenHint(parameters, request.idTokenHint);
        }
        if (request.state) {
          addState(parameters, request.state);
        }
        if (request.logoutHint) {
          addLogoutHint(parameters, request.logoutHint);
        }
        if (request.extraQueryParameters) {
          addExtraParameters(parameters, request.extraQueryParameters);
        }
        if (this.config.authOptions.instanceAware) {
          addInstanceAware(parameters);
        }
        return mapToQueryString(parameters);
      }
      /**
       * Updates the authority to the cloud instance provided in the authorization response
       * @param cloudInstanceHostName - cloud instance host name from authorization code payload
       * @param correlationId - request correlation id
       */
      async updateTokenEndpointAuthority(cloudInstanceHostName, correlationId) {
        const cloudInstanceAuthorityUri = `https://${cloudInstanceHostName}/${this.authority.tenant}/`;
        const cloudInstanceAuthority = await createDiscoveredInstance(cloudInstanceAuthorityUri, this.networkClient, this.cacheManager, this.authority.options, this.logger, correlationId, this.performanceClient);
        this.authority = cloudInstanceAuthority;
      }
    };
    var DEFAULT_REFRESH_TOKEN_EXPIRATION_OFFSET_SECONDS = 300;
    var RefreshTokenClient = class {
      constructor(configuration, performanceClient) {
        this.config = buildClientConfiguration(configuration);
        this.logger = new Logger(this.config.loggerOptions, name$1, version$1);
        this.cryptoUtils = this.config.cryptoInterface;
        this.cacheManager = this.config.storageInterface;
        this.networkClient = this.config.networkInterface;
        this.serverTelemetryManager = this.config.serverTelemetryManager;
        this.authority = this.config.authOptions.authority;
        this.performanceClient = performanceClient;
      }
      async acquireToken(request, apiId) {
        const reqTimestamp = nowSeconds();
        const response = await invokeAsync(this.executeTokenRequest.bind(this), RefreshTokenClientExecuteTokenRequest, this.logger, this.performanceClient, request.correlationId)(request, this.authority);
        const requestId = response.headers?.[HeaderNames.X_MS_REQUEST_ID];
        const responseHandler = new ResponseHandler(this.config.authOptions.clientId, this.cacheManager, this.cryptoUtils, this.logger, this.performanceClient, this.config.serializableCache, this.config.persistencePlugin);
        responseHandler.validateTokenResponse(response.body, request.correlationId);
        return invokeAsync(responseHandler.handleServerTokenResponse.bind(responseHandler), HandleServerTokenResponse, this.logger, this.performanceClient, request.correlationId)(response.body, this.authority, reqTimestamp, request, apiId, void 0, void 0, true, request.forceCache, requestId);
      }
      /**
       * Gets cached refresh token and attaches to request, then calls acquireToken API
       * @param request
       */
      async acquireTokenByRefreshToken(request, apiId) {
        if (!request) {
          throw createClientConfigurationError(tokenRequestEmpty);
        }
        if (!request.account) {
          throw createClientAuthError(noAccountInSilentRequest);
        }
        const isFOCI = this.cacheManager.isAppMetadataFOCI(request.account.environment, request.correlationId);
        if (isFOCI) {
          try {
            return await invokeAsync(this.acquireTokenWithCachedRefreshToken.bind(this), RefreshTokenClientAcquireTokenWithCachedRefreshToken, this.logger, this.performanceClient, request.correlationId)(request, true, apiId);
          } catch (e) {
            const noFamilyRTInCache = e instanceof InteractionRequiredAuthError && e.errorCode === noTokensFound;
            const clientMismatchErrorWithFamilyRT = e instanceof ServerError && e.errorCode === INVALID_GRANT_ERROR && e.subError === CLIENT_MISMATCH_ERROR;
            if (noFamilyRTInCache || clientMismatchErrorWithFamilyRT) {
              return invokeAsync(this.acquireTokenWithCachedRefreshToken.bind(this), RefreshTokenClientAcquireTokenWithCachedRefreshToken, this.logger, this.performanceClient, request.correlationId)(request, false, apiId);
            } else {
              throw e;
            }
          }
        }
        return invokeAsync(this.acquireTokenWithCachedRefreshToken.bind(this), RefreshTokenClientAcquireTokenWithCachedRefreshToken, this.logger, this.performanceClient, request.correlationId)(request, false, apiId);
      }
      /**
       * makes a network call to acquire tokens by exchanging RefreshToken available in userCache; throws if refresh token is not cached
       * @param request
       */
      async acquireTokenWithCachedRefreshToken(request, foci, apiId) {
        const refreshToken = invoke(this.cacheManager.getRefreshToken.bind(this.cacheManager), CacheManagerGetRefreshToken, this.logger, this.performanceClient, request.correlationId)(request.account, foci, request.correlationId, void 0);
        if (!refreshToken) {
          throw createInteractionRequiredAuthError(noTokensFound);
        }
        if (refreshToken.expiresOn) {
          const offset = request.refreshTokenExpirationOffsetSeconds || DEFAULT_REFRESH_TOKEN_EXPIRATION_OFFSET_SECONDS;
          this.performanceClient?.addFields({
            cacheRtExpiresOnSeconds: Number(refreshToken.expiresOn),
            rtOffsetSeconds: offset
          }, request.correlationId);
          if (isTokenExpired(refreshToken.expiresOn, offset)) {
            throw createInteractionRequiredAuthError(refreshTokenExpired);
          }
        }
        const refreshTokenRequest = {
          ...request,
          refreshToken: refreshToken.secret,
          authenticationScheme: request.authenticationScheme || AuthenticationScheme.BEARER,
          ccsCredential: {
            credential: request.account.homeAccountId,
            type: CcsCredentialType.HOME_ACCOUNT_ID
          }
        };
        try {
          return await invokeAsync(this.acquireToken.bind(this), RefreshTokenClientAcquireToken, this.logger, this.performanceClient, request.correlationId)(refreshTokenRequest, apiId);
        } catch (e) {
          if (e instanceof InteractionRequiredAuthError) {
            if (e.subError === badToken) {
              this.logger.verbose("acquireTokenWithRefreshToken: bad refresh token, removing from cache", request.correlationId);
              const badRefreshTokenKey = this.cacheManager.generateCredentialKey(refreshToken);
              this.cacheManager.removeRefreshToken(badRefreshTokenKey, request.correlationId);
            }
          }
          throw e;
        }
      }
      /**
       * Constructs the network message and makes a NW call to the underlying secure token service
       * @param request
       * @param authority
       */
      async executeTokenRequest(request, authority) {
        const queryParametersString = createTokenQueryParameters(request, this.config.authOptions.clientId, this.config.authOptions.redirectUri, this.performanceClient);
        const endpoint = UrlString.appendQueryString(authority.tokenEndpoint, queryParametersString);
        const requestBody = await invokeAsync(this.createTokenRequestBody.bind(this), RefreshTokenClientCreateTokenRequestBody, this.logger, this.performanceClient, request.correlationId)(request);
        const headers = createTokenRequestHeaders(this.logger, this.config.systemOptions.preventCorsPreflight, request.ccsCredential);
        const thumbprint = getRequestThumbprint(this.config.authOptions.clientId, request);
        return invokeAsync(executePostToTokenEndpoint, RefreshTokenClientExecutePostToTokenEndpoint, this.logger, this.performanceClient, request.correlationId)(endpoint, requestBody, headers, thumbprint, request.correlationId, this.cacheManager, this.networkClient, this.logger, this.performanceClient, this.serverTelemetryManager);
      }
      /**
       * Helper function to create the token request body
       * @param request
       */
      async createTokenRequestBody(request) {
        const parameters = /* @__PURE__ */ new Map();
        addClientId(parameters, request.embeddedClientId || request.extraParameters?.[CLIENT_ID] || this.config.authOptions.clientId);
        if (request.redirectUri) {
          addRedirectUri(parameters, request.redirectUri);
        }
        addScopes(parameters, request.scopes, true, this.config.authOptions.authority.options.OIDCOptions?.defaultScopes);
        addGrantType(parameters, GrantType.REFRESH_TOKEN_GRANT);
        addClientInfo(parameters);
        addLibraryInfo(parameters, this.config.libraryInfo);
        addApplicationTelemetry(parameters, this.config.telemetry.application);
        addThrottling(parameters);
        if (this.serverTelemetryManager && !isOidcProtocolMode(this.config)) {
          addServerTelemetry(parameters, this.serverTelemetryManager);
        }
        addRefreshToken(parameters, request.refreshToken);
        if (this.config.clientCredentials.clientSecret) {
          addClientSecret(parameters, this.config.clientCredentials.clientSecret);
        }
        if (this.config.clientCredentials.clientAssertion) {
          const clientAssertion = this.config.clientCredentials.clientAssertion;
          addClientAssertion(parameters, await getClientAssertion(clientAssertion.assertion, this.config.authOptions.clientId, request.resourceRequestUri));
          addClientAssertionType(parameters, clientAssertion.assertionType);
        }
        if (request.authenticationScheme === AuthenticationScheme.POP) {
          const popTokenGenerator = new PopTokenGenerator(this.cryptoUtils, this.performanceClient);
          let reqCnfData;
          if (!request.popKid) {
            const generatedReqCnfData = await invokeAsync(popTokenGenerator.generateCnf.bind(popTokenGenerator), PopTokenGenerateCnf, this.logger, this.performanceClient, request.correlationId)(request, this.logger);
            reqCnfData = generatedReqCnfData.reqCnfString;
          } else {
            reqCnfData = this.cryptoUtils.encodeKid(request.popKid);
          }
          addPopToken(parameters, reqCnfData);
        } else if (request.authenticationScheme === AuthenticationScheme.SSH) {
          if (request.sshJwk) {
            addSshJwk(parameters, request.sshJwk);
          } else {
            throw createClientConfigurationError(missingSshJwk);
          }
        }
        if (!StringUtils.isEmptyObj(request.claims) || this.config.authOptions.clientCapabilities && this.config.authOptions.clientCapabilities.length > 0) {
          addClaims(parameters, request.claims, this.config.authOptions.clientCapabilities);
        }
        if (this.config.systemOptions.preventCorsPreflight && request.ccsCredential) {
          switch (request.ccsCredential.type) {
            case CcsCredentialType.HOME_ACCOUNT_ID:
              try {
                const clientInfo = buildClientInfoFromHomeAccountId(request.ccsCredential.credential);
                addCcsOid(parameters, clientInfo);
              } catch (e) {
                this.logger.verbose(`Could not parse home account ID for CCS Header: '${e}'`, request.correlationId);
              }
              break;
            case CcsCredentialType.UPN:
              addCcsUpn(parameters, request.ccsCredential.credential);
              break;
          }
        }
        if (request.embeddedClientId) {
          addBrokerParameters(parameters, this.config.authOptions.clientId, this.config.authOptions.redirectUri);
        }
        if (request.extraParameters) {
          addExtraParameters(parameters, {
            ...request.extraParameters
          });
        }
        instrumentBrokerParams(parameters, request.correlationId, this.performanceClient);
        return mapToQueryString(parameters);
      }
    };
    var SilentFlowClient = class {
      constructor(configuration, performanceClient) {
        this.config = buildClientConfiguration(configuration);
        this.logger = new Logger(this.config.loggerOptions, name$1, version$1);
        this.cryptoUtils = this.config.cryptoInterface;
        this.cacheManager = this.config.storageInterface;
        this.networkClient = this.config.networkInterface;
        this.serverTelemetryManager = this.config.serverTelemetryManager;
        this.authority = this.config.authOptions.authority;
        this.performanceClient = performanceClient;
      }
      /**
       * Retrieves token from cache or throws an error if it must be refreshed.
       * @param request
       */
      async acquireCachedToken(request) {
        let lastCacheOutcome = CacheOutcome.NOT_APPLICABLE;
        if (request.forceRefresh || !StringUtils.isEmptyObj(request.claims)) {
          this.setCacheOutcome(CacheOutcome.FORCE_REFRESH_OR_CLAIMS, request.correlationId);
          throw createClientAuthError(tokenRefreshRequired);
        }
        if (!request.account) {
          throw createClientAuthError(noAccountInSilentRequest);
        }
        const requestTenantId = request.account.tenantId || getTenantFromAuthorityString(request.authority);
        const tokenKeys = this.cacheManager.getTokenKeys();
        const cachedAccessToken = this.cacheManager.getAccessToken(request.account, request, tokenKeys, requestTenantId);
        if (!cachedAccessToken) {
          this.setCacheOutcome(CacheOutcome.NO_CACHED_ACCESS_TOKEN, request.correlationId);
          throw createClientAuthError(tokenRefreshRequired);
        } else if (wasClockTurnedBack(cachedAccessToken.cachedAt) || isTokenExpired(cachedAccessToken.expiresOn, this.config.systemOptions.tokenRenewalOffsetSeconds)) {
          this.setCacheOutcome(CacheOutcome.CACHED_ACCESS_TOKEN_EXPIRED, request.correlationId);
          throw createClientAuthError(tokenRefreshRequired);
        } else if (cachedAccessToken.refreshOn && isTokenExpired(cachedAccessToken.refreshOn, 0)) {
          lastCacheOutcome = CacheOutcome.PROACTIVELY_REFRESHED;
        }
        const environment = request.authority || this.authority.getPreferredCache();
        const cacheRecord = {
          account: this.cacheManager.getAccount(this.cacheManager.generateAccountKey(request.account), request.correlationId),
          accessToken: cachedAccessToken,
          idToken: this.cacheManager.getIdToken(request.account, request.correlationId, tokenKeys, requestTenantId),
          refreshToken: null,
          appMetadata: this.cacheManager.readAppMetadataFromCache(environment, request.correlationId)
        };
        this.setCacheOutcome(lastCacheOutcome, request.correlationId);
        if (this.config.serverTelemetryManager) {
          this.config.serverTelemetryManager.incrementCacheHits();
        }
        return [
          await invokeAsync(this.generateResultFromCacheRecord.bind(this), SilentFlowClientGenerateResultFromCacheRecord, this.logger, this.performanceClient, request.correlationId)(cacheRecord, request),
          lastCacheOutcome
        ];
      }
      setCacheOutcome(cacheOutcome, correlationId) {
        this.serverTelemetryManager?.setCacheOutcome(cacheOutcome);
        this.performanceClient?.addFields({
          cacheOutcome
        }, correlationId);
        if (cacheOutcome !== CacheOutcome.NOT_APPLICABLE) {
          this.logger.info(`Token refresh is required due to cache outcome: '${cacheOutcome}'`, correlationId);
        }
      }
      /**
       * Helper function to build response object from the CacheRecord
       * @param cacheRecord
       */
      async generateResultFromCacheRecord(cacheRecord, request) {
        let idTokenClaims;
        if (cacheRecord.idToken) {
          idTokenClaims = extractTokenClaims(cacheRecord.idToken.secret, this.config.cryptoInterface.base64Decode);
        }
        if (request.maxAge || request.maxAge === 0) {
          const authTime = idTokenClaims?.auth_time;
          if (!authTime) {
            throw createClientAuthError(authTimeNotFound);
          }
          checkMaxAge(authTime, request.maxAge);
        }
        return ResponseHandler.generateAuthenticationResult(this.cryptoUtils, this.authority, cacheRecord, true, request, this.performanceClient, idTokenClaims);
      }
    };
    function getStandardAuthorizeRequestParameters(authOptions, request, logger, performanceClient) {
      const correlationId = request.correlationId;
      const parameters = /* @__PURE__ */ new Map();
      addClientId(parameters, request.embeddedClientId || request.extraQueryParameters?.[CLIENT_ID] || authOptions.clientId);
      const requestScopes = [
        ...request.scopes || [],
        ...request.extraScopesToConsent || []
      ];
      addScopes(parameters, requestScopes, true, authOptions.authority.options.OIDCOptions?.defaultScopes);
      addRedirectUri(parameters, request.redirectUri);
      addCorrelationId(parameters, correlationId);
      addResponseMode(parameters, request.responseMode);
      addClientInfo(parameters);
      if (request.prompt) {
        addPrompt(parameters, request.prompt);
      }
      if (request.domainHint) {
        addDomainHint(parameters, request.domainHint);
      }
      if (request.prompt !== PromptValue$1.SELECT_ACCOUNT) {
        if (request.sid && request.prompt === PromptValue$1.NONE) {
          logger.verbose("createAuthCodeUrlQueryString: Prompt is none, adding sid from request", request.correlationId);
          addSid(parameters, request.sid);
        } else if (request.account) {
          const accountSid = extractAccountSid(request.account);
          let accountLoginHintClaim = extractLoginHint(request.account);
          if (accountLoginHintClaim && request.domainHint) {
            logger.warning(`AuthorizationCodeClient.createAuthCodeUrlQueryString: "domainHint" param is set, skipping opaque "login_hint" claim. Please consider not passing domainHint`, request.correlationId);
            accountLoginHintClaim = null;
          }
          if (accountLoginHintClaim) {
            logger.verbose("createAuthCodeUrlQueryString: login_hint claim present on account", request.correlationId);
            addLoginHint(parameters, accountLoginHintClaim);
            try {
              const clientInfo = buildClientInfoFromHomeAccountId(request.account.homeAccountId);
              addCcsOid(parameters, clientInfo);
            } catch (e) {
              logger.verbose("createAuthCodeUrlQueryString: Could not parse home account ID for CCS Header", request.correlationId);
            }
          } else if (accountSid && request.prompt === PromptValue$1.NONE) {
            logger.verbose("createAuthCodeUrlQueryString: Prompt is none, adding sid from account", request.correlationId);
            addSid(parameters, accountSid);
            try {
              const clientInfo = buildClientInfoFromHomeAccountId(request.account.homeAccountId);
              addCcsOid(parameters, clientInfo);
            } catch (e) {
              logger.verbose("createAuthCodeUrlQueryString: Could not parse home account ID for CCS Header", request.correlationId);
            }
          } else if (request.loginHint) {
            logger.verbose("createAuthCodeUrlQueryString: Adding login_hint from request", request.correlationId);
            addLoginHint(parameters, request.loginHint);
            addCcsUpn(parameters, request.loginHint);
          } else if (request.account.username) {
            logger.verbose("createAuthCodeUrlQueryString: Adding login_hint from account", request.correlationId);
            addLoginHint(parameters, request.account.username);
            try {
              const clientInfo = buildClientInfoFromHomeAccountId(request.account.homeAccountId);
              addCcsOid(parameters, clientInfo);
            } catch (e) {
              logger.verbose("createAuthCodeUrlQueryString: Could not parse home account ID for CCS Header", request.correlationId);
            }
          }
        } else if (request.loginHint) {
          logger.verbose("createAuthCodeUrlQueryString: No account, adding login_hint from request", request.correlationId);
          addLoginHint(parameters, request.loginHint);
          addCcsUpn(parameters, request.loginHint);
        }
      } else {
        logger.verbose("createAuthCodeUrlQueryString: Prompt is select_account, ignoring account hints", request.correlationId);
      }
      if (request.nonce) {
        addNonce(parameters, request.nonce);
      }
      if (request.state) {
        addState(parameters, request.state);
      }
      if (request.claims || authOptions.clientCapabilities && authOptions.clientCapabilities.length > 0) {
        addClaims(parameters, request.claims, authOptions.clientCapabilities);
      }
      if (request.embeddedClientId) {
        addBrokerParameters(parameters, authOptions.clientId, authOptions.redirectUri);
      }
      if (authOptions.instanceAware && (!request.extraQueryParameters || !Object.keys(request.extraQueryParameters).includes(INSTANCE_AWARE))) {
        addInstanceAware(parameters);
      }
      return parameters;
    }
    function getAuthorizeUrl(authority, requestParameters) {
      const queryString = mapToQueryString(requestParameters);
      return UrlString.appendQueryString(authority.authorizationEndpoint, queryString);
    }
    function extractAccountSid(account) {
      return account.idTokenClaims?.sid || null;
    }
    function extractLoginHint(account) {
      return account.loginHint || account.idTokenClaims?.login_hint || null;
    }
    var unexpectedError = "unexpected_error";
    var postRequestFailed = "post_request_failed";
    var AuthErrorCodes = /* @__PURE__ */ Object.freeze({
      __proto__: null,
      postRequestFailed,
      unexpectedError
    });
    var skuGroupSeparator = ",";
    var skuValueSeparator = "|";
    function makeExtraSkuString(params) {
      const { skus, libraryName, libraryVersion, extensionName, extensionVersion } = params;
      const skuMap = /* @__PURE__ */ new Map([
        [0, [libraryName, libraryVersion]],
        [2, [extensionName, extensionVersion]]
      ]);
      let skuArr = [];
      if (skus?.length) {
        skuArr = skus.split(skuGroupSeparator);
        if (skuArr.length < 4) {
          return skus;
        }
      } else {
        skuArr = Array.from({ length: 4 }, () => skuValueSeparator);
      }
      skuMap.forEach((value, key) => {
        if (value.length === 2 && value[0]?.length && value[1]?.length) {
          setSku({
            skuArr,
            index: key,
            skuName: value[0],
            skuVersion: value[1]
          });
        }
      });
      return skuArr.join(skuGroupSeparator);
    }
    function setSku(params) {
      const { skuArr, index, skuName, skuVersion } = params;
      if (index >= skuArr.length) {
        return;
      }
      skuArr[index] = [skuName, skuVersion].join(skuValueSeparator);
    }
    var ServerTelemetryManager = class _ServerTelemetryManager {
      constructor(telemetryRequest, cacheManager) {
        this.cacheOutcome = CacheOutcome.NOT_APPLICABLE;
        this.cacheManager = cacheManager;
        this.apiId = telemetryRequest.apiId;
        this.correlationId = telemetryRequest.correlationId;
        this.wrapperSKU = telemetryRequest.wrapperSKU || "";
        this.wrapperVer = telemetryRequest.wrapperVer || "";
        this.telemetryCacheKey = SERVER_TELEM_CACHE_KEY + CACHE_KEY_SEPARATOR + telemetryRequest.clientId;
      }
      /**
       * API to add MSER Telemetry to request
       */
      generateCurrentRequestHeaderValue() {
        const request = `${this.apiId}${SERVER_TELEM_VALUE_SEPARATOR}${this.cacheOutcome}`;
        const platformFieldsArr = [this.wrapperSKU, this.wrapperVer];
        const nativeBrokerErrorCode = this.getNativeBrokerErrorCode();
        if (nativeBrokerErrorCode?.length) {
          platformFieldsArr.push(`broker_error=${nativeBrokerErrorCode}`);
        }
        const platformFields = platformFieldsArr.join(SERVER_TELEM_VALUE_SEPARATOR);
        const regionDiscoveryFields = this.getRegionDiscoveryFields();
        const requestWithRegionDiscoveryFields = [
          request,
          regionDiscoveryFields
        ].join(SERVER_TELEM_VALUE_SEPARATOR);
        return [
          SERVER_TELEM_SCHEMA_VERSION,
          requestWithRegionDiscoveryFields,
          platformFields
        ].join(SERVER_TELEM_CATEGORY_SEPARATOR);
      }
      /**
       * API to add MSER Telemetry for the last failed request
       */
      generateLastRequestHeaderValue() {
        const lastRequests = this.getLastRequests();
        const maxErrors = _ServerTelemetryManager.maxErrorsToSend(lastRequests);
        const failedRequests = lastRequests.failedRequests.slice(0, 2 * maxErrors).join(SERVER_TELEM_VALUE_SEPARATOR);
        const errors = lastRequests.errors.slice(0, maxErrors).join(SERVER_TELEM_VALUE_SEPARATOR);
        const errorCount = lastRequests.errors.length;
        const overflow = maxErrors < errorCount ? SERVER_TELEM_OVERFLOW_TRUE : SERVER_TELEM_OVERFLOW_FALSE;
        const platformFields = [errorCount, overflow].join(SERVER_TELEM_VALUE_SEPARATOR);
        return [
          SERVER_TELEM_SCHEMA_VERSION,
          lastRequests.cacheHits,
          failedRequests,
          errors,
          platformFields
        ].join(SERVER_TELEM_CATEGORY_SEPARATOR);
      }
      /**
       * API to cache token failures for MSER data capture
       * @param error
       */
      cacheFailedRequest(error) {
        const lastRequests = this.getLastRequests();
        if (lastRequests.errors.length >= SERVER_TELEM_MAX_CACHED_ERRORS) {
          lastRequests.failedRequests.shift();
          lastRequests.failedRequests.shift();
          lastRequests.errors.shift();
        }
        lastRequests.failedRequests.push(this.apiId, this.correlationId);
        if (error instanceof Error && !!error && error.toString()) {
          if (error instanceof AuthError) {
            if (error.subError) {
              lastRequests.errors.push(error.subError);
            } else if (error.errorCode) {
              lastRequests.errors.push(error.errorCode);
            } else {
              lastRequests.errors.push(error.toString());
            }
          } else {
            lastRequests.errors.push(error.toString());
          }
        } else {
          lastRequests.errors.push(SERVER_TELEM_UNKNOWN_ERROR);
        }
        this.cacheManager.setServerTelemetry(this.telemetryCacheKey, lastRequests, this.correlationId);
        return;
      }
      /**
       * Update server telemetry cache entry by incrementing cache hit counter
       */
      incrementCacheHits() {
        const lastRequests = this.getLastRequests();
        lastRequests.cacheHits += 1;
        this.cacheManager.setServerTelemetry(this.telemetryCacheKey, lastRequests, this.correlationId);
        return lastRequests.cacheHits;
      }
      /**
       * Get the server telemetry entity from cache or initialize a new one
       */
      getLastRequests() {
        const initialValue = {
          failedRequests: [],
          errors: [],
          cacheHits: 0
        };
        const lastRequests = this.cacheManager.getServerTelemetry(this.telemetryCacheKey, this.correlationId);
        return lastRequests || initialValue;
      }
      /**
       * Remove server telemetry cache entry
       */
      clearTelemetryCache() {
        const lastRequests = this.getLastRequests();
        const numErrorsFlushed = _ServerTelemetryManager.maxErrorsToSend(lastRequests);
        const errorCount = lastRequests.errors.length;
        if (numErrorsFlushed === errorCount) {
          this.cacheManager.removeItem(this.telemetryCacheKey, this.correlationId);
        } else {
          const serverTelemEntity = {
            failedRequests: lastRequests.failedRequests.slice(numErrorsFlushed * 2),
            errors: lastRequests.errors.slice(numErrorsFlushed),
            cacheHits: 0
          };
          this.cacheManager.setServerTelemetry(this.telemetryCacheKey, serverTelemEntity, this.correlationId);
        }
      }
      /**
       * Returns the maximum number of errors that can be flushed to the server in the next network request
       * @param serverTelemetryEntity
       */
      static maxErrorsToSend(serverTelemetryEntity) {
        let i;
        let maxErrors = 0;
        let dataSize = 0;
        const errorCount = serverTelemetryEntity.errors.length;
        for (i = 0; i < errorCount; i++) {
          const apiId = serverTelemetryEntity.failedRequests[2 * i] || "";
          const correlationId = serverTelemetryEntity.failedRequests[2 * i + 1] || "";
          const errorCode = serverTelemetryEntity.errors[i] || "";
          dataSize += apiId.toString().length + correlationId.toString().length + errorCode.length + 3;
          if (dataSize < SERVER_TELEM_MAX_LAST_HEADER_BYTES) {
            maxErrors += 1;
          } else {
            break;
          }
        }
        return maxErrors;
      }
      /**
       * Get the region discovery fields
       *
       * @returns string
       */
      getRegionDiscoveryFields() {
        const regionDiscoveryFields = [];
        regionDiscoveryFields.push(this.regionUsed || "");
        regionDiscoveryFields.push(this.regionSource || "");
        regionDiscoveryFields.push(this.regionOutcome || "");
        return regionDiscoveryFields.join(",");
      }
      /**
       * Update the region discovery metadata
       *
       * @param regionDiscoveryMetadata
       * @returns void
       */
      updateRegionDiscoveryMetadata(regionDiscoveryMetadata) {
        this.regionUsed = regionDiscoveryMetadata.region_used;
        this.regionSource = regionDiscoveryMetadata.region_source;
        this.regionOutcome = regionDiscoveryMetadata.region_outcome;
      }
      /**
       * Set cache outcome
       */
      setCacheOutcome(cacheOutcome) {
        this.cacheOutcome = cacheOutcome;
      }
      setNativeBrokerErrorCode(errorCode) {
        const lastRequests = this.getLastRequests();
        lastRequests.nativeBrokerErrorCode = errorCode;
        this.cacheManager.setServerTelemetry(this.telemetryCacheKey, lastRequests, this.correlationId);
      }
      getNativeBrokerErrorCode() {
        return this.getLastRequests().nativeBrokerErrorCode;
      }
      clearNativeBrokerErrorCode() {
        const lastRequests = this.getLastRequests();
        delete lastRequests.nativeBrokerErrorCode;
        this.cacheManager.setServerTelemetry(this.telemetryCacheKey, lastRequests, this.correlationId);
      }
      static makeExtraSkuString(params) {
        return makeExtraSkuString(params);
      }
    };
    var Deserializer = class {
      /**
       * Parse the JSON blob in memory and deserialize the content
       * @param cachedJson - JSON blob cache
       */
      static deserializeJSONBlob(jsonFile) {
        const deserializedCache = !jsonFile ? {} : JSON.parse(jsonFile);
        return deserializedCache;
      }
      /**
       * Deserializes accounts to AccountEntity objects
       * @param accounts - accounts of type SerializedAccountEntity
       */
      static deserializeAccounts(accounts) {
        const accountObjects = {};
        if (accounts) {
          Object.keys(accounts).map(function(key) {
            const serializedAcc = accounts[key];
            const mappedAcc = {
              homeAccountId: serializedAcc.home_account_id,
              environment: serializedAcc.environment,
              realm: serializedAcc.realm,
              localAccountId: serializedAcc.local_account_id,
              username: serializedAcc.username,
              authorityType: serializedAcc.authority_type,
              name: serializedAcc.name,
              clientInfo: serializedAcc.client_info,
              lastModificationTime: serializedAcc.last_modification_time,
              lastModificationApp: serializedAcc.last_modification_app,
              tenantProfiles: serializedAcc.tenantProfiles?.map((serializedTenantProfile) => {
                return JSON.parse(serializedTenantProfile);
              }),
              lastUpdatedAt: Date.now().toString()
            };
            const account = {};
            CacheManager.toObject(account, mappedAcc);
            accountObjects[key] = account;
          });
        }
        return accountObjects;
      }
      /**
       * Deserializes id tokens to IdTokenEntity objects
       * @param idTokens - credentials of type SerializedIdTokenEntity
       */
      static deserializeIdTokens(idTokens) {
        const idObjects = {};
        if (idTokens) {
          Object.keys(idTokens).map(function(key) {
            const serializedIdT = idTokens[key];
            const idToken = {
              homeAccountId: serializedIdT.home_account_id,
              environment: serializedIdT.environment,
              credentialType: serializedIdT.credential_type,
              clientId: serializedIdT.client_id,
              secret: serializedIdT.secret,
              realm: serializedIdT.realm,
              lastUpdatedAt: Date.now().toString()
            };
            idObjects[key] = idToken;
          });
        }
        return idObjects;
      }
      /**
       * Deserializes access tokens to AccessTokenEntity objects
       * @param accessTokens - access tokens of type SerializedAccessTokenEntity
       */
      static deserializeAccessTokens(accessTokens) {
        const atObjects = {};
        if (accessTokens) {
          Object.keys(accessTokens).map(function(key) {
            const serializedAT = accessTokens[key];
            const accessToken = {
              homeAccountId: serializedAT.home_account_id,
              environment: serializedAT.environment,
              credentialType: serializedAT.credential_type,
              clientId: serializedAT.client_id,
              secret: serializedAT.secret,
              realm: serializedAT.realm,
              target: serializedAT.target,
              cachedAt: serializedAT.cached_at,
              expiresOn: serializedAT.expires_on,
              extendedExpiresOn: serializedAT.extended_expires_on,
              refreshOn: serializedAT.refresh_on,
              keyId: serializedAT.key_id,
              tokenType: serializedAT.token_type,
              userAssertionHash: serializedAT.userAssertionHash,
              lastUpdatedAt: Date.now().toString()
            };
            atObjects[key] = accessToken;
          });
        }
        return atObjects;
      }
      /**
       * Deserializes refresh tokens to RefreshTokenEntity objects
       * @param refreshTokens - refresh tokens of type SerializedRefreshTokenEntity
       */
      static deserializeRefreshTokens(refreshTokens) {
        const rtObjects = {};
        if (refreshTokens) {
          Object.keys(refreshTokens).map(function(key) {
            const serializedRT = refreshTokens[key];
            const refreshToken = {
              homeAccountId: serializedRT.home_account_id,
              environment: serializedRT.environment,
              credentialType: serializedRT.credential_type,
              clientId: serializedRT.client_id,
              secret: serializedRT.secret,
              familyId: serializedRT.family_id,
              target: serializedRT.target,
              realm: serializedRT.realm,
              lastUpdatedAt: Date.now().toString()
            };
            rtObjects[key] = refreshToken;
          });
        }
        return rtObjects;
      }
      /**
       * Deserializes appMetadata to AppMetaData objects
       * @param appMetadata - app metadata of type SerializedAppMetadataEntity
       */
      static deserializeAppMetadata(appMetadata) {
        const appMetadataObjects = {};
        if (appMetadata) {
          Object.keys(appMetadata).map(function(key) {
            const serializedAmdt = appMetadata[key];
            appMetadataObjects[key] = {
              clientId: serializedAmdt.client_id,
              environment: serializedAmdt.environment,
              familyId: serializedAmdt.family_id
            };
          });
        }
        return appMetadataObjects;
      }
      /**
       * Deserialize an inMemory Cache
       * @param jsonCache - JSON blob cache
       */
      static deserializeAllCache(jsonCache) {
        return {
          accounts: jsonCache.Account ? this.deserializeAccounts(jsonCache.Account) : {},
          idTokens: jsonCache.IdToken ? this.deserializeIdTokens(jsonCache.IdToken) : {},
          accessTokens: jsonCache.AccessToken ? this.deserializeAccessTokens(jsonCache.AccessToken) : {},
          refreshTokens: jsonCache.RefreshToken ? this.deserializeRefreshTokens(jsonCache.RefreshToken) : {},
          appMetadata: jsonCache.AppMetadata ? this.deserializeAppMetadata(jsonCache.AppMetadata) : {}
        };
      }
    };
    var internals = /* @__PURE__ */ Object.freeze({
      __proto__: null,
      Deserializer,
      Serializer
    });
    var DEFAULT_MANAGED_IDENTITY_ID = "system_assigned_managed_identity";
    var MANAGED_IDENTITY_DEFAULT_TENANT = "managed_identity";
    var DEFAULT_AUTHORITY_FOR_MANAGED_IDENTITY = `https://login.microsoftonline.com/${MANAGED_IDENTITY_DEFAULT_TENANT}/`;
    var ManagedIdentityHeaders = {
      AUTHORIZATION_HEADER_NAME: "Authorization",
      METADATA_HEADER_NAME: "Metadata",
      APP_SERVICE_SECRET_HEADER_NAME: "X-IDENTITY-HEADER",
      ML_AND_SF_SECRET_HEADER_NAME: "secret"
    };
    var ManagedIdentityQueryParameters = {
      API_VERSION: "api-version",
      RESOURCE: "resource",
      SHA256_TOKEN_TO_REFRESH: "token_sha256_to_refresh",
      XMS_CC: "xms_cc"
    };
    var ManagedIdentityEnvironmentVariableNames = {
      AZURE_POD_IDENTITY_AUTHORITY_HOST: "AZURE_POD_IDENTITY_AUTHORITY_HOST",
      DEFAULT_IDENTITY_CLIENT_ID: "DEFAULT_IDENTITY_CLIENT_ID",
      IDENTITY_ENDPOINT: "IDENTITY_ENDPOINT",
      IDENTITY_HEADER: "IDENTITY_HEADER",
      IDENTITY_SERVER_THUMBPRINT: "IDENTITY_SERVER_THUMBPRINT",
      IMDS_ENDPOINT: "IMDS_ENDPOINT",
      MSI_ENDPOINT: "MSI_ENDPOINT",
      MSI_SECRET: "MSI_SECRET"
    };
    var ManagedIdentitySourceNames = {
      APP_SERVICE: "AppService",
      AZURE_ARC: "AzureArc",
      CLOUD_SHELL: "CloudShell",
      DEFAULT_TO_IMDS: "DefaultToImds",
      IMDS: "Imds",
      MACHINE_LEARNING: "MachineLearning",
      SERVICE_FABRIC: "ServiceFabric"
    };
    var ManagedIdentityIdType = {
      SYSTEM_ASSIGNED: "system-assigned",
      USER_ASSIGNED_CLIENT_ID: "user-assigned-client-id",
      USER_ASSIGNED_RESOURCE_ID: "user-assigned-resource-id",
      USER_ASSIGNED_OBJECT_ID: "user-assigned-object-id"
    };
    var HttpMethod = {
      GET: "GET",
      POST: "POST"
    };
    var REGION_ENVIRONMENT_VARIABLE = "REGION_NAME";
    var MSAL_FORCE_REGION = "MSAL_FORCE_REGION";
    var RANDOM_OCTET_SIZE = 32;
    var Hash = {
      SHA256: "sha256"
    };
    var CharSet = {
      CV_CHARSET: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
    };
    var CACHE = {
      KEY_SEPARATOR: "-"
    };
    var Constants = {
      MSAL_SKU: "msal.js.node",
      JWT_BEARER_ASSERTION_TYPE: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      HTTP_PROTOCOL: "http://",
      LOCALHOST: "localhost"
    };
    var ApiId = {
      acquireTokenSilent: 62,
      acquireTokenByUsernamePassword: 371,
      acquireTokenByDeviceCode: 671,
      acquireTokenByClientCredential: 771,
      acquireTokenByOBO: 772,
      acquireTokenWithManagedIdentity: 773,
      acquireTokenByCode: 871,
      acquireTokenByRefreshToken: 872
    };
    var JwtConstants = {
      RSA_256: "RS256",
      PSS_256: "PS256",
      X5T_256: "x5t#S256",
      X5T: "x5t",
      X5C: "x5c",
      AUDIENCE: "aud",
      EXPIRATION_TIME: "exp",
      ISSUER: "iss",
      SUBJECT: "sub",
      NOT_BEFORE: "nbf",
      JWT_ID: "jti"
    };
    var LOOPBACK_SERVER_CONSTANTS = {
      INTERVAL_MS: 100,
      TIMEOUT_MS: 5e3
    };
    var AZURE_ARC_SECRET_FILE_MAX_SIZE_BYTES = 4096;
    var HttpClient = class {
      /**
       * Sends an HTTP GET request to the specified URL.
       *
       * This method handles GET requests with optional timeout support. The timeout
       * is implemented using AbortController, which provides a clean way to cancel
       * fetch requests that take too long to complete.
       *
       * @param url - The target URL for the GET request
       * @param options - Optional request configuration including headers
       * @param timeout - Optional timeout in milliseconds. If specified, the request
       *                  will be aborted if it doesn't complete within this time
       * @returns Promise that resolves to a NetworkResponse containing headers, body, and status
       * @throws {AuthError} When the request times out or response parsing fails
       * @throws {NetworkError} When the network request fails
       */
      async sendGetRequestAsync(url, options, timeout) {
        return this.sendRequest(url, HttpMethod.GET, options, timeout);
      }
      /**
       * Sends an HTTP POST request to the specified URL.
       *
       * This method handles POST requests with request body support. Currently,
       * timeout functionality is not exposed for POST requests, but the underlying
       * implementation supports it through the shared sendRequest method.
       *
       * @param url - The target URL for the POST request
       * @param options - Optional request configuration including headers and body
       * @returns Promise that resolves to a NetworkResponse containing headers, body, and status
       * @throws {AuthError} When the request times out or response parsing fails
       * @throws {NetworkError} When the network request fails
       */
      async sendPostRequestAsync(url, options) {
        return this.sendRequest(url, HttpMethod.POST, options);
      }
      /**
       * Core HTTP request implementation using native fetch API.
       *
       * This method handles GET and POST HTTP requests with comprehensive
       * timeout support and error handling. The timeout mechanism works as follows:
       *
       * 1. An AbortController is created for each request
       * 2. If a timeout is specified, setTimeout is used to call abort() after the delay
       * 3. The abort signal is passed to fetch, which will reject the promise if aborted
       * 4. Cleanup occurs in both success and error cases to prevent timer leaks
       *
       * Error handling priority:
       * 1. Timeout errors (AbortError) are converted to "Request timeout" messages
       * 2. Network/connection errors are wrapped with "Network request failed" prefix
       * 3. JSON parsing errors are wrapped with "Failed to parse response" prefix
       *
       * @param url - The target URL for the request
       * @param method - HTTP method (GET or POST)
       * @param options - Optional request configuration (headers, body)
       * @param timeout - Optional timeout in milliseconds for request cancellation
       * @returns Promise resolving to NetworkResponse with parsed JSON body
       * @throws {AuthError} For timeouts or JSON parsing errors
       * @throws {NetworkError} For network failures
       */
      async sendRequest(url, method, options, timeout) {
        const controller = new AbortController();
        let timeoutId;
        if (timeout) {
          timeoutId = setTimeout(() => {
            controller.abort();
          }, timeout);
        }
        const fetchOptions = {
          method,
          headers: getFetchHeaders(options),
          signal: controller.signal
          // Enable cancellation via AbortController
        };
        if (method === HttpMethod.POST) {
          fetchOptions.body = options?.body || "";
        }
        let response;
        try {
          response = await fetch(url, fetchOptions);
        } catch (error) {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          if (error instanceof Error && error.name === "AbortError") {
            throw createAuthError(networkError, "Request timeout");
          }
          const baseAuthError = createAuthError(networkError, `Network request failed: ${error instanceof Error ? error.message : "unknown"}`);
          throw createNetworkError(baseAuthError, void 0, void 0, error instanceof Error ? error : void 0);
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        try {
          return {
            headers: getHeaderDict(response.headers),
            body: await response.json(),
            status: response.status
          };
        } catch (error) {
          throw createAuthError(tokenParsingError, `Failed to parse response: ${error instanceof Error ? error.message : "unknown"}`);
        }
      }
    };
    function getHeaderDict(headers) {
      const headerDict = {};
      headers.forEach((value, key) => {
        headerDict[key] = value;
      });
      return headerDict;
    }
    function getFetchHeaders(options) {
      const headers = new Headers();
      if (!(options && options.headers)) {
        return headers;
      }
      Object.entries(options.headers).forEach(([key, value]) => {
        headers.append(key, value);
      });
      return headers;
    }
    var invalidFileExtension = "invalid_file_extension";
    var invalidFilePath = "invalid_file_path";
    var invalidManagedIdentityIdType = "invalid_managed_identity_id_type";
    var invalidSecret = "invalid_secret";
    var missingId = "missing_client_id";
    var networkUnavailable = "network_unavailable";
    var platformNotSupported = "platform_not_supported";
    var unableToCreateAzureArc = "unable_to_create_azure_arc";
    var unableToCreateCloudShell = "unable_to_create_cloud_shell";
    var unableToCreateSource = "unable_to_create_source";
    var unableToReadSecretFile = "unable_to_read_secret_file";
    var userAssignedNotAvailableAtRuntime = "user_assigned_not_available_at_runtime";
    var wwwAuthenticateHeaderMissing = "www_authenticate_header_missing";
    var wwwAuthenticateHeaderUnsupportedFormat = "www_authenticate_header_unsupported_format";
    var MsiEnvironmentVariableUrlMalformedErrorCodes = {
      [ManagedIdentityEnvironmentVariableNames.AZURE_POD_IDENTITY_AUTHORITY_HOST]: "azure_pod_identity_authority_host_url_malformed",
      [ManagedIdentityEnvironmentVariableNames.IDENTITY_ENDPOINT]: "identity_endpoint_url_malformed",
      [ManagedIdentityEnvironmentVariableNames.IMDS_ENDPOINT]: "imds_endpoint_url_malformed",
      [ManagedIdentityEnvironmentVariableNames.MSI_ENDPOINT]: "msi_endpoint_url_malformed"
    };
    var ManagedIdentityErrorMessages = {
      [invalidFileExtension]: "The file path in the WWW-Authenticate header does not contain a .key file.",
      [invalidFilePath]: "The file path in the WWW-Authenticate header is not in a valid Windows or Linux Format.",
      [invalidManagedIdentityIdType]: "More than one ManagedIdentityIdType was provided.",
      [invalidSecret]: "The secret in the file on the file path in the WWW-Authenticate header is greater than 4096 bytes.",
      [platformNotSupported]: "The platform is not supported by Azure Arc. Azure Arc only supports Windows and Linux.",
      [missingId]: "A ManagedIdentityId id was not provided.",
      [MsiEnvironmentVariableUrlMalformedErrorCodes.AZURE_POD_IDENTITY_AUTHORITY_HOST]: `The Managed Identity's '${ManagedIdentityEnvironmentVariableNames.AZURE_POD_IDENTITY_AUTHORITY_HOST}' environment variable is malformed.`,
      [MsiEnvironmentVariableUrlMalformedErrorCodes.IDENTITY_ENDPOINT]: `The Managed Identity's '${ManagedIdentityEnvironmentVariableNames.IDENTITY_ENDPOINT}' environment variable is malformed.`,
      [MsiEnvironmentVariableUrlMalformedErrorCodes.IMDS_ENDPOINT]: `The Managed Identity's '${ManagedIdentityEnvironmentVariableNames.IMDS_ENDPOINT}' environment variable is malformed.`,
      [MsiEnvironmentVariableUrlMalformedErrorCodes.MSI_ENDPOINT]: `The Managed Identity's '${ManagedIdentityEnvironmentVariableNames.MSI_ENDPOINT}' environment variable is malformed.`,
      [networkUnavailable]: "Authentication unavailable. The request to the managed identity endpoint timed out.",
      [unableToCreateAzureArc]: "Azure Arc Managed Identities can only be system assigned.",
      [unableToCreateCloudShell]: "Cloud Shell Managed Identities can only be system assigned.",
      [unableToCreateSource]: "Unable to create a Managed Identity source based on environment variables.",
      [unableToReadSecretFile]: "Unable to read the secret file.",
      [userAssignedNotAvailableAtRuntime]: "Service Fabric user assigned managed identity ClientId or ResourceId is not configurable at runtime.",
      [wwwAuthenticateHeaderMissing]: "A 401 response was received form the Azure Arc Managed Identity, but the www-authenticate header is missing.",
      [wwwAuthenticateHeaderUnsupportedFormat]: "A 401 response was received form the Azure Arc Managed Identity, but the www-authenticate header is in an unsupported format."
    };
    var ManagedIdentityError = class _ManagedIdentityError extends AuthError {
      constructor(errorCode) {
        super(errorCode, ManagedIdentityErrorMessages[errorCode]);
        this.name = "ManagedIdentityError";
        Object.setPrototypeOf(this, _ManagedIdentityError.prototype);
      }
    };
    function createManagedIdentityError(errorCode) {
      return new ManagedIdentityError(errorCode);
    }
    var ManagedIdentityId = class {
      get id() {
        return this._id;
      }
      set id(value) {
        this._id = value;
      }
      get idType() {
        return this._idType;
      }
      set idType(value) {
        this._idType = value;
      }
      constructor(managedIdentityIdParams) {
        const userAssignedClientId = managedIdentityIdParams?.userAssignedClientId;
        const userAssignedResourceId = managedIdentityIdParams?.userAssignedResourceId;
        const userAssignedObjectId = managedIdentityIdParams?.userAssignedObjectId;
        if (userAssignedClientId) {
          if (userAssignedResourceId || userAssignedObjectId) {
            throw createManagedIdentityError(invalidManagedIdentityIdType);
          }
          this.id = userAssignedClientId;
          this.idType = ManagedIdentityIdType.USER_ASSIGNED_CLIENT_ID;
        } else if (userAssignedResourceId) {
          if (userAssignedClientId || userAssignedObjectId) {
            throw createManagedIdentityError(invalidManagedIdentityIdType);
          }
          this.id = userAssignedResourceId;
          this.idType = ManagedIdentityIdType.USER_ASSIGNED_RESOURCE_ID;
        } else if (userAssignedObjectId) {
          if (userAssignedClientId || userAssignedResourceId) {
            throw createManagedIdentityError(invalidManagedIdentityIdType);
          }
          this.id = userAssignedObjectId;
          this.idType = ManagedIdentityIdType.USER_ASSIGNED_OBJECT_ID;
        } else {
          this.id = DEFAULT_MANAGED_IDENTITY_ID;
          this.idType = ManagedIdentityIdType.SYSTEM_ASSIGNED;
        }
      }
    };
    var NodeAuthErrorMessage = {
      invalidLoopbackAddressType: {
        code: "invalid_loopback_server_address_type",
        desc: "Loopback server address is not type string. This is unexpected."
      },
      unableToLoadRedirectUri: {
        code: "unable_to_load_redirectUrl",
        desc: "Loopback server callback was invoked without a url. This is unexpected."
      },
      noAuthCodeInResponse: {
        code: "no_auth_code_in_response",
        desc: "No auth code found in the server response. Please check your network trace to determine what happened."
      },
      noLoopbackServerExists: {
        code: "no_loopback_server_exists",
        desc: "No loopback server exists yet."
      },
      loopbackServerAlreadyExists: {
        code: "loopback_server_already_exists",
        desc: "Loopback server already exists. Cannot create another."
      },
      loopbackServerTimeout: {
        code: "loopback_server_timeout",
        desc: "Timed out waiting for auth code listener to be registered."
      },
      stateNotFoundError: {
        code: "state_not_found",
        desc: "State not found. Please verify that the request originated from msal."
      },
      thumbprintMissing: {
        code: "thumbprint_missing_from_client_certificate",
        desc: "Client certificate does not contain a SHA-1 or SHA-256 thumbprint."
      },
      redirectUriNotSupported: {
        code: "redirect_uri_not_supported",
        desc: "RedirectUri is not supported in this scenario. Please remove redirectUri from the request."
      }
    };
    var NodeAuthError = class _NodeAuthError extends AuthError {
      constructor(errorCode, errorMessage) {
        super(errorCode, errorMessage);
        this.name = "NodeAuthError";
      }
      /**
       * Creates an error thrown if loopback server address is of type string.
       */
      static createInvalidLoopbackAddressTypeError() {
        return new _NodeAuthError(NodeAuthErrorMessage.invalidLoopbackAddressType.code, `${NodeAuthErrorMessage.invalidLoopbackAddressType.desc}`);
      }
      /**
       * Creates an error thrown if the loopback server is unable to get a url.
       */
      static createUnableToLoadRedirectUrlError() {
        return new _NodeAuthError(NodeAuthErrorMessage.unableToLoadRedirectUri.code, `${NodeAuthErrorMessage.unableToLoadRedirectUri.desc}`);
      }
      /**
       * Creates an error thrown if the server response does not contain an auth code.
       */
      static createNoAuthCodeInResponseError() {
        return new _NodeAuthError(NodeAuthErrorMessage.noAuthCodeInResponse.code, `${NodeAuthErrorMessage.noAuthCodeInResponse.desc}`);
      }
      /**
       * Creates an error thrown if the loopback server has not been spun up yet.
       */
      static createNoLoopbackServerExistsError() {
        return new _NodeAuthError(NodeAuthErrorMessage.noLoopbackServerExists.code, `${NodeAuthErrorMessage.noLoopbackServerExists.desc}`);
      }
      /**
       * Creates an error thrown if a loopback server already exists when attempting to create another one.
       */
      static createLoopbackServerAlreadyExistsError() {
        return new _NodeAuthError(NodeAuthErrorMessage.loopbackServerAlreadyExists.code, `${NodeAuthErrorMessage.loopbackServerAlreadyExists.desc}`);
      }
      /**
       * Creates an error thrown if the loopback server times out registering the auth code listener.
       */
      static createLoopbackServerTimeoutError() {
        return new _NodeAuthError(NodeAuthErrorMessage.loopbackServerTimeout.code, `${NodeAuthErrorMessage.loopbackServerTimeout.desc}`);
      }
      /**
       * Creates an error thrown when the state is not present.
       */
      static createStateNotFoundError() {
        return new _NodeAuthError(NodeAuthErrorMessage.stateNotFoundError.code, NodeAuthErrorMessage.stateNotFoundError.desc);
      }
      /**
       * Creates an error thrown when client certificate was provided, but neither the SHA-1 or SHA-256 thumbprints were provided
       */
      static createThumbprintMissingError() {
        return new _NodeAuthError(NodeAuthErrorMessage.thumbprintMissing.code, NodeAuthErrorMessage.thumbprintMissing.desc);
      }
      /**
       * Creates an error thrown when redirectUri is provided in an unsupported scenario
       */
      static createRedirectUriNotSupportedError() {
        return new _NodeAuthError(NodeAuthErrorMessage.redirectUriNotSupported.code, NodeAuthErrorMessage.redirectUriNotSupported.desc);
      }
    };
    var DEFAULT_AUTH_OPTIONS = {
      clientId: "",
      authority: DEFAULT_AUTHORITY,
      clientSecret: "",
      clientAssertion: "",
      clientCertificate: {
        thumbprint: "",
        thumbprintSha256: "",
        privateKey: "",
        x5c: ""
      },
      knownAuthorities: [],
      cloudDiscoveryMetadata: "",
      authorityMetadata: "",
      clientCapabilities: [],
      azureCloudOptions: {
        azureCloudInstance: AzureCloudInstance.None,
        tenant: ""
      }
    };
    var DEFAULT_LOGGER_OPTIONS = {
      loggerCallback: () => {
      },
      piiLoggingEnabled: false,
      logLevel: exports2.LogLevel.Info
    };
    var DEFAULT_SYSTEM_OPTIONS = {
      loggerOptions: DEFAULT_LOGGER_OPTIONS,
      networkClient: new HttpClient(),
      disableInternalRetries: false,
      protocolMode: ProtocolMode.AAD
    };
    var DEFAULT_TELEMETRY_OPTIONS = {
      application: {
        appName: "",
        appVersion: ""
      }
    };
    function buildAppConfiguration({ auth, broker, cache, system, telemetry }) {
      const systemOptions = {
        ...DEFAULT_SYSTEM_OPTIONS,
        networkClient: new HttpClient(),
        loggerOptions: system?.loggerOptions || DEFAULT_LOGGER_OPTIONS,
        disableInternalRetries: system?.disableInternalRetries || false
      };
      if (!!auth.clientCertificate && !!!auth.clientCertificate.thumbprint && !!!auth.clientCertificate.thumbprintSha256) {
        throw NodeAuthError.createStateNotFoundError();
      }
      return {
        auth: { ...DEFAULT_AUTH_OPTIONS, ...auth },
        broker: { ...broker },
        cache: { ...cache },
        system: { ...systemOptions, ...system },
        telemetry: { ...DEFAULT_TELEMETRY_OPTIONS, ...telemetry }
      };
    }
    function buildManagedIdentityConfiguration({ clientCapabilities, managedIdentityIdParams, system }) {
      const managedIdentityId = new ManagedIdentityId(managedIdentityIdParams);
      const loggerOptions = system?.loggerOptions || DEFAULT_LOGGER_OPTIONS;
      let networkClient;
      if (system?.networkClient) {
        networkClient = system.networkClient;
      } else {
        networkClient = new HttpClient();
      }
      return {
        clientCapabilities: clientCapabilities || [],
        managedIdentityId,
        system: {
          loggerOptions,
          networkClient
        },
        disableInternalRetries: system?.disableInternalRetries || false
      };
    }
    var GuidGenerator = class {
      /**
       *
       * RFC4122: The version 4 UUID is meant for generating UUIDs from truly-random or pseudo-random numbers.
       * uuidv4 generates guids from cryprtographically-string random
       */
      generateGuid() {
        return uuid.v4();
      }
      /**
       * verifies if a string is  GUID
       * @param guid
       */
      isGuid(guid) {
        const regexGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return regexGuid.test(guid);
      }
    };
    var EncodingUtils = class _EncodingUtils {
      /**
       * 'utf8': Multibyte encoded Unicode characters. Many web pages and other document formats use UTF-8.
       * 'base64': Base64 encoding.
       *
       * @param str text
       */
      static base64Encode(str, encoding) {
        return Buffer.from(str, encoding).toString(EncodingTypes.BASE64);
      }
      /**
       * encode a URL
       * @param str
       */
      static base64EncodeUrl(str, encoding) {
        return _EncodingUtils.base64Encode(str, encoding).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
      }
      /**
       * 'utf8': Multibyte encoded Unicode characters. Many web pages and other document formats use UTF-8.
       * 'base64': Base64 encoding.
       *
       * @param base64Str Base64 encoded text
       */
      static base64Decode(base64Str) {
        return Buffer.from(base64Str, EncodingTypes.BASE64).toString("utf8");
      }
      /**
       * @param base64Str Base64 encoded Url
       */
      static base64DecodeUrl(base64Str) {
        let str = base64Str.replace(/-/g, "+").replace(/_/g, "/");
        while (str.length % 4) {
          str += "=";
        }
        return _EncodingUtils.base64Decode(str);
      }
    };
    var HashUtils = class {
      /**
       * generate 'SHA256' hash
       * @param buffer
       */
      sha256(buffer) {
        return crypto4.createHash(Hash.SHA256).update(buffer).digest();
      }
    };
    var PkceGenerator = class {
      constructor() {
        this.hashUtils = new HashUtils();
      }
      /**
       * generates the codeVerfier and the challenge from the codeVerfier
       * reference: https://tools.ietf.org/html/rfc7636#section-4.1 and https://tools.ietf.org/html/rfc7636#section-4.2
       */
      async generatePkceCodes() {
        const verifier = this.generateCodeVerifier();
        const challenge = this.generateCodeChallengeFromVerifier(verifier);
        return { verifier, challenge };
      }
      /**
       * generates the codeVerfier; reference: https://tools.ietf.org/html/rfc7636#section-4.1
       */
      generateCodeVerifier() {
        const charArr = [];
        const maxNumber = 256 - 256 % CharSet.CV_CHARSET.length;
        while (charArr.length <= RANDOM_OCTET_SIZE) {
          const byte = crypto4.randomBytes(1)[0];
          if (byte >= maxNumber) {
            continue;
          }
          const index = byte % CharSet.CV_CHARSET.length;
          charArr.push(CharSet.CV_CHARSET[index]);
        }
        const verifier = charArr.join("");
        return EncodingUtils.base64EncodeUrl(verifier);
      }
      /**
       * generate the challenge from the codeVerfier; reference: https://tools.ietf.org/html/rfc7636#section-4.2
       * @param codeVerifier
       */
      generateCodeChallengeFromVerifier(codeVerifier) {
        return EncodingUtils.base64EncodeUrl(this.hashUtils.sha256(codeVerifier).toString(EncodingTypes.BASE64), EncodingTypes.BASE64);
      }
    };
    var CryptoProvider = class {
      constructor() {
        this.pkceGenerator = new PkceGenerator();
        this.guidGenerator = new GuidGenerator();
        this.hashUtils = new HashUtils();
      }
      /**
       * base64 URL safe encoded string
       */
      base64UrlEncode() {
        throw new Error("Method not implemented.");
      }
      /**
       * Stringifies and base64Url encodes input public key
       * @param inputKid - public key id
       * @returns Base64Url encoded public key
       */
      encodeKid() {
        throw new Error("Method not implemented.");
      }
      /**
       * Creates a new random GUID - used to populate state and nonce.
       * @returns string (GUID)
       */
      createNewGuid() {
        return this.guidGenerator.generateGuid();
      }
      /**
       * Encodes input string to base64.
       * @param input - string to be encoded
       */
      base64Encode(input) {
        return EncodingUtils.base64Encode(input);
      }
      /**
       * Decodes input string from base64.
       * @param input - string to be decoded
       */
      base64Decode(input) {
        return EncodingUtils.base64Decode(input);
      }
      /**
       * Generates PKCE codes used in Authorization Code Flow.
       */
      generatePkceCodes() {
        return this.pkceGenerator.generatePkceCodes();
      }
      /**
       * Generates a keypair, stores it and returns a thumbprint - not yet implemented for node
       */
      getPublicKeyThumbprint() {
        throw new Error("Method not implemented.");
      }
      /**
       * Removes cryptographic keypair from key store matching the keyId passed in
       * @param kid - public key id
       */
      removeTokenBindingKey() {
        throw new Error("Method not implemented.");
      }
      /**
       * Removes all cryptographic keys from Keystore
       */
      clearKeystore() {
        throw new Error("Method not implemented.");
      }
      /**
       * Signs the given object as a jwt payload with private key retrieved by given kid - currently not implemented for node
       */
      signJwt() {
        throw new Error("Method not implemented.");
      }
      /**
       * Returns the SHA-256 hash of an input string
       */
      async hashString(plainText) {
        return EncodingUtils.base64EncodeUrl(this.hashUtils.sha256(plainText).toString(EncodingTypes.BASE64), EncodingTypes.BASE64);
      }
    };
    function generateCredentialKey(credential) {
      const familyId = credential.credentialType === CredentialType.REFRESH_TOKEN && credential.familyId || credential.clientId;
      const scheme = credential.tokenType && credential.tokenType.toLowerCase() !== AuthenticationScheme.BEARER.toLowerCase() ? credential.tokenType.toLowerCase() : "";
      const credentialKey = [
        credential.homeAccountId,
        credential.environment,
        credential.credentialType,
        familyId,
        credential.realm || "",
        credential.target || "",
        scheme
      ];
      return credentialKey.join(CACHE.KEY_SEPARATOR).toLowerCase();
    }
    function generateAccountKey(account) {
      const homeTenantId = account.homeAccountId.split(".")[1];
      const accountKey = [
        account.homeAccountId,
        account.environment,
        homeTenantId || account.tenantId || ""
      ];
      return accountKey.join(CACHE.KEY_SEPARATOR).toLowerCase();
    }
    var NodeStorage = class extends CacheManager {
      constructor(logger, clientId, cryptoImpl, staticAuthorityOptions) {
        super(clientId, cryptoImpl, logger, new StubPerformanceClient(), staticAuthorityOptions);
        this.cache = {};
        this.changeEmitters = [];
        this.logger = logger;
      }
      /**
       * Queue up callbacks
       * @param func - a callback function for cache change indication
       */
      registerChangeEmitter(func) {
        this.changeEmitters.push(func);
      }
      /**
       * Invoke the callback when cache changes
       */
      emitChange() {
        this.changeEmitters.forEach((func) => func.call(null));
      }
      /**
       * Converts cacheKVStore to InMemoryCache
       * @param cache - key value store
       */
      cacheToInMemoryCache(cache) {
        const inMemoryCache = {
          accounts: {},
          idTokens: {},
          accessTokens: {},
          refreshTokens: {},
          appMetadata: {}
        };
        for (const key in cache) {
          const value = cache[key];
          if (typeof value !== "object") {
            continue;
          }
          if (isAccountEntity(value)) {
            inMemoryCache.accounts[key] = value;
          } else if (isIdTokenEntity(value)) {
            inMemoryCache.idTokens[key] = value;
          } else if (isAccessTokenEntity(value)) {
            inMemoryCache.accessTokens[key] = value;
          } else if (isRefreshTokenEntity(value)) {
            inMemoryCache.refreshTokens[key] = value;
          } else if (isAppMetadataEntity(key, value)) {
            inMemoryCache.appMetadata[key] = value;
          } else {
            continue;
          }
        }
        return inMemoryCache;
      }
      /**
       * converts inMemoryCache to CacheKVStore
       * @param inMemoryCache - kvstore map for inmemory
       */
      inMemoryCacheToCache(inMemoryCache) {
        let cache = this.getCache();
        cache = {
          ...cache,
          ...inMemoryCache.accounts,
          ...inMemoryCache.idTokens,
          ...inMemoryCache.accessTokens,
          ...inMemoryCache.refreshTokens,
          ...inMemoryCache.appMetadata
        };
        return cache;
      }
      /**
       * gets the current in memory cache for the client
       */
      getInMemoryCache() {
        this.logger.trace("Getting in-memory cache", "");
        const inMemoryCache = this.cacheToInMemoryCache(this.getCache());
        return inMemoryCache;
      }
      /**
       * sets the current in memory cache for the client
       * @param inMemoryCache - key value map in memory
       */
      setInMemoryCache(inMemoryCache) {
        this.logger.trace("Setting in-memory cache", "");
        const cache = this.inMemoryCacheToCache(inMemoryCache);
        this.setCache(cache);
        this.emitChange();
      }
      /**
       * get the current cache key-value store
       */
      getCache() {
        this.logger.trace("Getting cache key-value store", "");
        return this.cache;
      }
      /**
       * sets the current cache (key value store)
       * @param cacheMap - key value map
       */
      setCache(cache) {
        this.logger.trace("Setting cache key value store", "");
        this.cache = cache;
        this.emitChange();
      }
      /**
       * Gets cache item with given key.
       * @param key - lookup key for the cache entry
       */
      getItem(key) {
        this.logger.tracePii(`Item key: ${key}`, "");
        const cache = this.getCache();
        return cache[key];
      }
      /**
       * Gets cache item with given key-value
       * @param key - lookup key for the cache entry
       * @param value - value of the cache entry
       */
      setItem(key, value) {
        this.logger.tracePii(`Item key: ${key}`, "");
        const cache = this.getCache();
        cache[key] = value;
        this.setCache(cache);
      }
      generateCredentialKey(credential) {
        return generateCredentialKey(credential);
      }
      generateAccountKey(account) {
        return generateAccountKey(account);
      }
      getAccountKeys() {
        const inMemoryCache = this.getInMemoryCache();
        const accountKeys = Object.keys(inMemoryCache.accounts);
        return accountKeys;
      }
      getTokenKeys() {
        const inMemoryCache = this.getInMemoryCache();
        const tokenKeys = {
          idToken: Object.keys(inMemoryCache.idTokens),
          accessToken: Object.keys(inMemoryCache.accessTokens),
          refreshToken: Object.keys(inMemoryCache.refreshTokens)
        };
        return tokenKeys;
      }
      /**
       * Reads account from cache, builds it into an account entity and returns it.
       * @param accountKey - lookup key to fetch cache type AccountEntity
       * @returns
       */
      getAccount(accountKey) {
        const cachedAccount = this.getItem(accountKey);
        return cachedAccount && typeof cachedAccount === "object" ? { ...cachedAccount } : null;
      }
      /**
       * set account entity
       * @param account - cache value to be set of type AccountEntity
       */
      async setAccount(account) {
        const accountKey = this.generateAccountKey(getAccountInfo(account));
        this.setItem(accountKey, account);
      }
      /**
       * fetch the idToken credential
       * @param idTokenKey - lookup key to fetch cache type IdTokenEntity
       */
      getIdTokenCredential(idTokenKey) {
        const idToken = this.getItem(idTokenKey);
        if (isIdTokenEntity(idToken)) {
          return idToken;
        }
        return null;
      }
      /**
       * set idToken credential
       * @param idToken - cache value to be set of type IdTokenEntity
       */
      async setIdTokenCredential(idToken) {
        const idTokenKey = this.generateCredentialKey(idToken);
        this.setItem(idTokenKey, idToken);
      }
      /**
       * fetch the accessToken credential
       * @param accessTokenKey - lookup key to fetch cache type AccessTokenEntity
       */
      getAccessTokenCredential(accessTokenKey) {
        const accessToken = this.getItem(accessTokenKey);
        if (isAccessTokenEntity(accessToken)) {
          return accessToken;
        }
        return null;
      }
      /**
       * set accessToken credential
       * @param accessToken -  cache value to be set of type AccessTokenEntity
       */
      async setAccessTokenCredential(accessToken) {
        const accessTokenKey = this.generateCredentialKey(accessToken);
        this.setItem(accessTokenKey, accessToken);
      }
      /**
       * fetch the refreshToken credential
       * @param refreshTokenKey - lookup key to fetch cache type RefreshTokenEntity
       */
      getRefreshTokenCredential(refreshTokenKey) {
        const refreshToken = this.getItem(refreshTokenKey);
        if (isRefreshTokenEntity(refreshToken)) {
          return refreshToken;
        }
        return null;
      }
      /**
       * set refreshToken credential
       * @param refreshToken - cache value to be set of type RefreshTokenEntity
       */
      async setRefreshTokenCredential(refreshToken) {
        const refreshTokenKey = this.generateCredentialKey(refreshToken);
        this.setItem(refreshTokenKey, refreshToken);
      }
      /**
       * fetch appMetadata entity from the platform cache
       * @param appMetadataKey - lookup key to fetch cache type AppMetadataEntity
       */
      getAppMetadata(appMetadataKey) {
        const appMetadata = this.getItem(appMetadataKey);
        if (isAppMetadataEntity(appMetadataKey, appMetadata)) {
          return appMetadata;
        }
        return null;
      }
      /**
       * set appMetadata entity to the platform cache
       * @param appMetadata - cache value to be set of type AppMetadataEntity
       */
      setAppMetadata(appMetadata) {
        const appMetadataKey = generateAppMetadataKey(appMetadata);
        this.setItem(appMetadataKey, appMetadata);
      }
      /**
       * fetch server telemetry entity from the platform cache
       * @param serverTelemetrykey - lookup key to fetch cache type ServerTelemetryEntity
       */
      getServerTelemetry(serverTelemetrykey) {
        const serverTelemetryEntity = this.getItem(serverTelemetrykey);
        if (serverTelemetryEntity && isServerTelemetryEntity(serverTelemetrykey, serverTelemetryEntity)) {
          return serverTelemetryEntity;
        }
        return null;
      }
      /**
       * set server telemetry entity to the platform cache
       * @param serverTelemetryKey - lookup key to fetch cache type ServerTelemetryEntity
       * @param serverTelemetry - cache value to be set of type ServerTelemetryEntity
       */
      setServerTelemetry(serverTelemetryKey, serverTelemetry) {
        this.setItem(serverTelemetryKey, serverTelemetry);
      }
      /**
       * fetch authority metadata entity from the platform cache
       * @param key - lookup key to fetch cache type AuthorityMetadataEntity
       */
      getAuthorityMetadata(key) {
        const authorityMetadataEntity = this.getItem(key);
        if (authorityMetadataEntity && isAuthorityMetadataEntity(key, authorityMetadataEntity)) {
          return authorityMetadataEntity;
        }
        return null;
      }
      /**
       * Get all authority metadata keys
       */
      getAuthorityMetadataKeys() {
        return this.getKeys().filter((key) => {
          return this.isAuthorityMetadata(key);
        });
      }
      /**
       * set authority metadata entity to the platform cache
       * @param key - lookup key to fetch cache type AuthorityMetadataEntity
       * @param metadata - cache value to be set of type AuthorityMetadataEntity
       */
      setAuthorityMetadata(key, metadata) {
        this.setItem(key, metadata);
      }
      /**
       * fetch throttling entity from the platform cache
       * @param throttlingCacheKey - lookup key to fetch cache type ThrottlingEntity
       */
      getThrottlingCache(throttlingCacheKey) {
        const throttlingCache = this.getItem(throttlingCacheKey);
        if (throttlingCache && isThrottlingEntity(throttlingCacheKey, throttlingCache)) {
          return throttlingCache;
        }
        return null;
      }
      /**
       * set throttling entity to the platform cache
       * @param throttlingCacheKey - lookup key to fetch cache type ThrottlingEntity
       * @param throttlingCache - cache value to be set of type ThrottlingEntity
       */
      setThrottlingCache(throttlingCacheKey, throttlingCache) {
        this.setItem(throttlingCacheKey, throttlingCache);
      }
      /**
       * Removes the cache item from memory with the given key.
       * @param key - lookup key to remove a cache entity
       * @param inMemory - key value map of the cache
       */
      removeItem(key) {
        this.logger.tracePii(`Item key: ${key}`, "");
        let result = false;
        const cache = this.getCache();
        if (!!cache[key]) {
          delete cache[key];
          result = true;
        }
        if (result) {
          this.setCache(cache);
          this.emitChange();
        }
        return result;
      }
      /**
       * Remove account entity from the platform cache if it's outdated
       * @param accountKey - lookup key to fetch cache type AccountEntity
       */
      removeOutdatedAccount(accountKey) {
        this.removeItem(accountKey);
      }
      /**
       * Checks whether key is in cache.
       * @param key - look up key for a cache entity
       */
      containsKey(key) {
        return this.getKeys().includes(key);
      }
      /**
       * Gets all keys in window.
       */
      getKeys() {
        this.logger.trace("Retrieving all cache keys", "");
        const cache = this.getCache();
        return [...Object.keys(cache)];
      }
      /**
       * Clears all cache entries created by MSAL (except tokens).
       */
      clear() {
        this.logger.trace("Clearing cache entries created by MSAL", "");
        const cacheKeys = this.getKeys();
        cacheKeys.forEach((key) => {
          this.removeItem(key);
        });
        this.emitChange();
      }
      /**
       * Initialize in memory cache from an exisiting cache vault
       * @param cache - blob formatted cache (JSON)
       */
      static generateInMemoryCache(cache) {
        return Deserializer.deserializeAllCache(Deserializer.deserializeJSONBlob(cache));
      }
      /**
       * retrieves the final JSON
       * @param inMemoryCache - itemised cache read from the JSON
       */
      static generateJsonCache(inMemoryCache) {
        return Serializer.serializeAllCache(inMemoryCache);
      }
      /**
       * Updates a credential's cache key if the current cache key is outdated
       */
      updateCredentialCacheKey(currentCacheKey, credential) {
        const updatedCacheKey = this.generateCredentialKey(credential);
        if (currentCacheKey !== updatedCacheKey) {
          const cacheItem = this.getItem(currentCacheKey);
          if (cacheItem) {
            this.removeItem(currentCacheKey);
            this.setItem(updatedCacheKey, cacheItem);
            this.logger.verbose(`Updated an outdated ${credential.credentialType} cache key`, "");
            return updatedCacheKey;
          } else {
            this.logger.error(`Attempted to update an outdated ${credential.credentialType} cache key but no item matching the outdated key was found in storage`, "");
          }
        }
        return currentCacheKey;
      }
    };
    var defaultSerializedCache = {
      Account: {},
      IdToken: {},
      AccessToken: {},
      RefreshToken: {},
      AppMetadata: {}
    };
    var TokenCache = class {
      constructor(storage, logger, cachePlugin) {
        this.cacheHasChanged = false;
        this.storage = storage;
        this.storage.registerChangeEmitter(this.handleChangeEvent.bind(this));
        if (cachePlugin) {
          this.persistence = cachePlugin;
        }
        this.logger = logger;
      }
      /**
       * Set to true if cache state has changed since last time serialize or writeToPersistence was called
       */
      hasChanged() {
        return this.cacheHasChanged;
      }
      /**
       * Serializes in memory cache to JSON
       */
      serialize() {
        this.logger.trace("Serializing in-memory cache", "");
        let finalState = Serializer.serializeAllCache(this.storage.getInMemoryCache());
        if (this.cacheSnapshot) {
          this.logger.trace("Reading cache snapshot from disk", "");
          finalState = this.mergeState(JSON.parse(this.cacheSnapshot), finalState);
        } else {
          this.logger.trace("No cache snapshot to merge", "");
        }
        this.cacheHasChanged = false;
        return JSON.stringify(finalState);
      }
      /**
       * Deserializes JSON to in-memory cache. JSON should be in MSAL cache schema format
       * @param cache - blob formatted cache
       */
      deserialize(cache) {
        this.logger.trace("Deserializing JSON to in-memory cache", "");
        this.cacheSnapshot = cache;
        if (this.cacheSnapshot) {
          this.logger.trace("Reading cache snapshot from disk", "");
          const deserializedCache = Deserializer.deserializeAllCache(this.overlayDefaults(JSON.parse(this.cacheSnapshot)));
          this.storage.setInMemoryCache(deserializedCache);
        } else {
          this.logger.trace("No cache snapshot to deserialize", "");
        }
      }
      /**
       * Fetches the cache key-value map
       */
      getKVStore() {
        return this.storage.getCache();
      }
      /**
       * Gets cache snapshot in CacheKVStore format
       */
      getCacheSnapshot() {
        const deserializedPersistentStorage = NodeStorage.generateInMemoryCache(this.cacheSnapshot);
        return this.storage.inMemoryCacheToCache(deserializedPersistentStorage);
      }
      /**
       * API that retrieves all accounts currently in cache to the user
       */
      async getAllAccounts(correlationId = new CryptoProvider().createNewGuid()) {
        this.logger.trace("getAllAccounts called", correlationId);
        let cacheContext;
        try {
          if (this.persistence) {
            cacheContext = new TokenCacheContext(this, false);
            await this.persistence.beforeCacheAccess(cacheContext);
          }
          return this.storage.getAllAccounts({}, correlationId);
        } finally {
          if (this.persistence && cacheContext) {
            await this.persistence.afterCacheAccess(cacheContext);
          }
        }
      }
      /**
       * Returns the signed in account matching homeAccountId.
       * (the account object is created at the time of successful login)
       * or null when no matching account is found
       * @param homeAccountId - unique identifier for an account (uid.utid)
       */
      async getAccountByHomeId(homeAccountId) {
        const allAccounts = await this.getAllAccounts();
        if (homeAccountId && allAccounts && allAccounts.length) {
          return allAccounts.filter((accountObj) => accountObj.homeAccountId === homeAccountId)[0] || null;
        } else {
          return null;
        }
      }
      /**
       * Returns the signed in account matching localAccountId.
       * (the account object is created at the time of successful login)
       * or null when no matching account is found
       * @param localAccountId - unique identifier of an account (sub/obj when homeAccountId cannot be populated)
       */
      async getAccountByLocalId(localAccountId) {
        const allAccounts = await this.getAllAccounts();
        if (localAccountId && allAccounts && allAccounts.length) {
          return allAccounts.filter((accountObj) => accountObj.localAccountId === localAccountId)[0] || null;
        } else {
          return null;
        }
      }
      /**
       * API to remove a specific account and the relevant data from cache
       * @param account - AccountInfo passed by the user
       */
      async removeAccount(account, correlationId) {
        this.logger.trace("removeAccount called", correlationId || "");
        let cacheContext;
        try {
          if (this.persistence) {
            cacheContext = new TokenCacheContext(this, true);
            await this.persistence.beforeCacheAccess(cacheContext);
          }
          this.storage.removeAccount(account, correlationId || new GuidGenerator().generateGuid());
        } finally {
          if (this.persistence && cacheContext) {
            await this.persistence.afterCacheAccess(cacheContext);
          }
        }
      }
      /**
       * Overwrites in-memory cache with persistent cache
       */
      async overwriteCache() {
        if (!this.persistence) {
          this.logger.info("No persistence layer specified, cache cannot be overwritten", "");
          return;
        }
        this.logger.info("Overwriting in-memory cache with persistent cache", "");
        this.storage.clear();
        const cacheContext = new TokenCacheContext(this, false);
        await this.persistence.beforeCacheAccess(cacheContext);
        const cacheSnapshot = this.getCacheSnapshot();
        this.storage.setCache(cacheSnapshot);
        await this.persistence.afterCacheAccess(cacheContext);
      }
      /**
       * Called when the cache has changed state.
       */
      handleChangeEvent() {
        this.cacheHasChanged = true;
      }
      /**
       * Merge in memory cache with the cache snapshot.
       * @param oldState - cache before changes
       * @param currentState - current cache state in the library
       */
      mergeState(oldState, currentState) {
        this.logger.trace("Merging in-memory cache with cache snapshot", "");
        const stateAfterRemoval = this.mergeRemovals(oldState, currentState);
        return this.mergeUpdates(stateAfterRemoval, currentState);
      }
      /**
       * Deep update of oldState based on newState values
       * @param oldState - cache before changes
       * @param newState - updated cache
       */
      mergeUpdates(oldState, newState) {
        Object.keys(newState).forEach((newKey) => {
          const newValue = newState[newKey];
          if (!oldState.hasOwnProperty(newKey)) {
            if (newValue !== null) {
              oldState[newKey] = newValue;
            }
          } else {
            const newValueNotNull = newValue !== null;
            const newValueIsObject = typeof newValue === "object";
            const newValueIsNotArray = !Array.isArray(newValue);
            const oldStateNotUndefinedOrNull = typeof oldState[newKey] !== "undefined" && oldState[newKey] !== null;
            if (newValueNotNull && newValueIsObject && newValueIsNotArray && oldStateNotUndefinedOrNull) {
              this.mergeUpdates(oldState[newKey], newValue);
            } else {
              oldState[newKey] = newValue;
            }
          }
        });
        return oldState;
      }
      /**
       * Removes entities in oldState that the were removed from newState. If there are any unknown values in root of
       * oldState that are not recognized, they are left untouched.
       * @param oldState - cache before changes
       * @param newState - updated cache
       */
      mergeRemovals(oldState, newState) {
        this.logger.trace("Remove updated entries in cache", "");
        const accounts = oldState.Account ? this.mergeRemovalsDict(oldState.Account, newState.Account) : oldState.Account;
        const accessTokens = oldState.AccessToken ? this.mergeRemovalsDict(oldState.AccessToken, newState.AccessToken) : oldState.AccessToken;
        const refreshTokens = oldState.RefreshToken ? this.mergeRemovalsDict(oldState.RefreshToken, newState.RefreshToken) : oldState.RefreshToken;
        const idTokens = oldState.IdToken ? this.mergeRemovalsDict(oldState.IdToken, newState.IdToken) : oldState.IdToken;
        const appMetadata = oldState.AppMetadata ? this.mergeRemovalsDict(oldState.AppMetadata, newState.AppMetadata) : oldState.AppMetadata;
        return {
          ...oldState,
          Account: accounts,
          AccessToken: accessTokens,
          RefreshToken: refreshTokens,
          IdToken: idTokens,
          AppMetadata: appMetadata
        };
      }
      /**
       * Helper to merge new cache with the old one
       * @param oldState - cache before changes
       * @param newState - updated cache
       */
      mergeRemovalsDict(oldState, newState) {
        const finalState = { ...oldState };
        Object.keys(oldState).forEach((oldKey) => {
          if (!newState || !newState.hasOwnProperty(oldKey)) {
            delete finalState[oldKey];
          }
        });
        return finalState;
      }
      /**
       * Helper to overlay as a part of cache merge
       * @param passedInCache - cache read from the blob
       */
      overlayDefaults(passedInCache) {
        this.logger.trace("Overlaying input cache with the default cache", "");
        return {
          Account: {
            ...defaultSerializedCache.Account,
            ...passedInCache.Account
          },
          IdToken: {
            ...defaultSerializedCache.IdToken,
            ...passedInCache.IdToken
          },
          AccessToken: {
            ...defaultSerializedCache.AccessToken,
            ...passedInCache.AccessToken
          },
          RefreshToken: {
            ...defaultSerializedCache.RefreshToken,
            ...passedInCache.RefreshToken
          },
          AppMetadata: {
            ...defaultSerializedCache.AppMetadata,
            ...passedInCache.AppMetadata
          }
        };
      }
    };
    var missingTenantIdError = "missing_tenant_id_error";
    var userTimeoutReached = "user_timeout_reached";
    var invalidAssertion = "invalid_assertion";
    var invalidClientCredential = "invalid_client_credential";
    var deviceCodePollingCancelled = "device_code_polling_cancelled";
    var deviceCodeExpired = "device_code_expired";
    var deviceCodeUnknownError = "device_code_unknown_error";
    var ClientAssertion = class _ClientAssertion {
      /**
       * Initialize the ClientAssertion class from the clientAssertion passed by the user
       * @param assertion - refer https://tools.ietf.org/html/rfc7521
       */
      static fromAssertion(assertion) {
        const clientAssertion = new _ClientAssertion();
        clientAssertion.jwt = assertion;
        return clientAssertion;
      }
      /**
       * @deprecated Use fromCertificateWithSha256Thumbprint instead, with a SHA-256 thumprint
       * Initialize the ClientAssertion class from the certificate passed by the user
       * @param thumbprint - identifier of a certificate
       * @param privateKey - secret key
       * @param publicCertificate - electronic document provided to prove the ownership of the public key
       */
      static fromCertificate(thumbprint, privateKey, publicCertificate) {
        const clientAssertion = new _ClientAssertion();
        clientAssertion.privateKey = privateKey;
        clientAssertion.thumbprint = thumbprint;
        clientAssertion.useSha256 = false;
        if (publicCertificate) {
          clientAssertion.publicCertificate = this.parseCertificate(publicCertificate);
        }
        return clientAssertion;
      }
      /**
       * Initialize the ClientAssertion class from the certificate passed by the user
       * @param thumbprint - identifier of a certificate
       * @param privateKey - secret key
       * @param publicCertificate - electronic document provided to prove the ownership of the public key
       */
      static fromCertificateWithSha256Thumbprint(thumbprint, privateKey, publicCertificate) {
        const clientAssertion = new _ClientAssertion();
        clientAssertion.privateKey = privateKey;
        clientAssertion.thumbprint = thumbprint;
        clientAssertion.useSha256 = true;
        if (publicCertificate) {
          clientAssertion.publicCertificate = this.parseCertificate(publicCertificate);
        }
        return clientAssertion;
      }
      /**
       * Update JWT for certificate based clientAssertion, if passed by the user, uses it as is
       * @param cryptoProvider - library's crypto helper
       * @param issuer - iss claim
       * @param jwtAudience - aud claim
       */
      getJwt(cryptoProvider, issuer, jwtAudience) {
        if (this.privateKey && this.thumbprint) {
          if (this.jwt && !this.isExpired() && issuer === this.issuer && jwtAudience === this.jwtAudience) {
            return this.jwt;
          }
          return this.createJwt(cryptoProvider, issuer, jwtAudience);
        }
        if (this.jwt) {
          return this.jwt;
        }
        throw createClientAuthError(invalidAssertion);
      }
      /**
       * JWT format and required claims specified: https://tools.ietf.org/html/rfc7523#section-3
       */
      createJwt(cryptoProvider, issuer, jwtAudience) {
        this.issuer = issuer;
        this.jwtAudience = jwtAudience;
        const issuedAt = nowSeconds();
        this.expirationTime = issuedAt + 600;
        const algorithm = this.useSha256 ? JwtConstants.PSS_256 : JwtConstants.RSA_256;
        const header = {
          alg: algorithm
        };
        const thumbprintHeader = this.useSha256 ? JwtConstants.X5T_256 : JwtConstants.X5T;
        Object.assign(header, {
          [thumbprintHeader]: EncodingUtils.base64EncodeUrl(this.thumbprint, EncodingTypes.HEX)
        });
        if (this.publicCertificate) {
          Object.assign(header, {
            [JwtConstants.X5C]: this.publicCertificate
          });
        }
        const payload = {
          [JwtConstants.AUDIENCE]: this.jwtAudience,
          [JwtConstants.EXPIRATION_TIME]: this.expirationTime,
          [JwtConstants.ISSUER]: this.issuer,
          [JwtConstants.SUBJECT]: this.issuer,
          [JwtConstants.NOT_BEFORE]: issuedAt,
          [JwtConstants.JWT_ID]: cryptoProvider.createNewGuid()
        };
        this.jwt = jwt.sign(payload, this.privateKey, { header });
        return this.jwt;
      }
      /**
       * Utility API to check expiration
       */
      isExpired() {
        return this.expirationTime < nowSeconds();
      }
      /**
       * Extracts the raw certs from a given certificate string and returns them in an array.
       * @param publicCertificate - electronic document provided to prove the ownership of the public key
       */
      static parseCertificate(publicCertificate) {
        const regexToFindCerts = /-----BEGIN CERTIFICATE-----\r*\n(.+?)\r*\n-----END CERTIFICATE-----/gs;
        const certs = [];
        let matches;
        while ((matches = regexToFindCerts.exec(publicCertificate)) !== null) {
          certs.push(matches[1].replace(/\r*\n/g, ""));
        }
        return certs;
      }
    };
    var name = "@azure/msal-node";
    var version2 = "5.0.6";
    var BaseClient = class {
      constructor(configuration) {
        this.config = buildClientConfiguration(configuration);
        this.logger = new Logger(this.config.loggerOptions, name, version2);
        this.cryptoUtils = this.config.cryptoInterface;
        this.cacheManager = this.config.storageInterface;
        this.networkClient = this.config.networkInterface;
        this.serverTelemetryManager = this.config.serverTelemetryManager;
        this.authority = this.config.authOptions.authority;
        this.performanceClient = new StubPerformanceClient();
      }
      /**
       * Creates default headers for requests to token endpoint
       */
      createTokenRequestHeaders(ccsCred) {
        return createTokenRequestHeaders(this.logger, false, ccsCred);
      }
      /**
       * Http post to token endpoint
       * @param tokenEndpoint
       * @param queryString
       * @param headers
       * @param thumbprint
       */
      async executePostToTokenEndpoint(tokenEndpoint, queryString, headers, thumbprint, correlationId) {
        return executePostToTokenEndpoint(tokenEndpoint, queryString, headers, thumbprint, correlationId, this.cacheManager, this.networkClient, this.logger, this.performanceClient, this.serverTelemetryManager);
      }
      /**
       * Wraps sendPostRequestAsync with necessary preflight and postflight logic
       * @param thumbprint - Request thumbprint for throttling
       * @param tokenEndpoint - Endpoint to make the POST to
       * @param options - Body and Headers to include on the POST request
       * @param correlationId - CorrelationId for telemetry
       */
      async sendPostRequest(thumbprint, tokenEndpoint, options, correlationId) {
        return sendPostRequest(thumbprint, tokenEndpoint, options, correlationId, this.cacheManager, this.networkClient, this.logger, this.performanceClient);
      }
      /**
       * Creates query string for the /token request
       * @param request
       */
      createTokenQueryParameters(request) {
        return createTokenQueryParameters(request, this.config.authOptions.clientId, this.config.authOptions.redirectUri, this.performanceClient);
      }
    };
    var UsernamePasswordClient = class extends BaseClient {
      constructor(configuration) {
        super(configuration);
      }
      /**
       * API to acquire a token by passing the username and password to the service in exchage of credentials
       * password_grant
       * @param request - CommonUsernamePasswordRequest
       */
      async acquireToken(request) {
        this.logger.info("in acquireToken call in username-password client", request.correlationId);
        const reqTimestamp = nowSeconds();
        const response = await this.executeTokenRequest(this.authority, request);
        const responseHandler = new ResponseHandler(this.config.authOptions.clientId, this.cacheManager, this.cryptoUtils, this.logger, this.performanceClient, this.config.serializableCache, this.config.persistencePlugin);
        responseHandler.validateTokenResponse(response.body, request.correlationId);
        const tokenResponse = responseHandler.handleServerTokenResponse(response.body, this.authority, reqTimestamp, request, ApiId.acquireTokenByUsernamePassword);
        return tokenResponse;
      }
      /**
       * Executes POST request to token endpoint
       * @param authority - authority object
       * @param request - CommonUsernamePasswordRequest provided by the developer
       */
      async executeTokenRequest(authority, request) {
        const queryParametersString = this.createTokenQueryParameters(request);
        const endpoint = UrlString.appendQueryString(authority.tokenEndpoint, queryParametersString);
        const requestBody = await this.createTokenRequestBody(request);
        const headers = this.createTokenRequestHeaders({
          credential: request.username,
          type: CcsCredentialType.UPN
        });
        const thumbprint = {
          clientId: this.config.authOptions.clientId,
          authority: authority.canonicalAuthority,
          scopes: request.scopes,
          claims: request.claims,
          authenticationScheme: request.authenticationScheme,
          resourceRequestMethod: request.resourceRequestMethod,
          resourceRequestUri: request.resourceRequestUri,
          shrClaims: request.shrClaims,
          sshKid: request.sshKid
        };
        return this.executePostToTokenEndpoint(endpoint, requestBody, headers, thumbprint, request.correlationId);
      }
      /**
       * Generates a map for all the params to be sent to the service
       * @param request - CommonUsernamePasswordRequest provided by the developer
       */
      async createTokenRequestBody(request) {
        const parameters = /* @__PURE__ */ new Map();
        addClientId(parameters, this.config.authOptions.clientId);
        addUsername(parameters, request.username);
        addPassword(parameters, request.password);
        addScopes(parameters, request.scopes);
        addResponseType(parameters, OAuthResponseType.IDTOKEN_TOKEN);
        addGrantType(parameters, GrantType.RESOURCE_OWNER_PASSWORD_GRANT);
        addClientInfo(parameters);
        addLibraryInfo(parameters, this.config.libraryInfo);
        addApplicationTelemetry(parameters, this.config.telemetry.application);
        addThrottling(parameters);
        if (this.serverTelemetryManager) {
          addServerTelemetry(parameters, this.serverTelemetryManager);
        }
        const correlationId = request.correlationId || this.config.cryptoInterface.createNewGuid();
        addCorrelationId(parameters, correlationId);
        if (this.config.clientCredentials.clientSecret) {
          addClientSecret(parameters, this.config.clientCredentials.clientSecret);
        }
        const clientAssertion = this.config.clientCredentials.clientAssertion;
        if (clientAssertion) {
          addClientAssertion(parameters, await getClientAssertion(clientAssertion.assertion, this.config.authOptions.clientId, request.resourceRequestUri));
          addClientAssertionType(parameters, clientAssertion.assertionType);
        }
        if (!StringUtils.isEmptyObj(request.claims) || this.config.authOptions.clientCapabilities && this.config.authOptions.clientCapabilities.length > 0) {
          addClaims(parameters, request.claims, this.config.authOptions.clientCapabilities);
        }
        if (this.config.systemOptions.preventCorsPreflight && request.username) {
          addCcsUpn(parameters, request.username);
        }
        return mapToQueryString(parameters);
      }
    };
    function getAuthCodeRequestUrl(config, authority, request, logger) {
      const parameters = getStandardAuthorizeRequestParameters({
        ...config.auth,
        authority,
        redirectUri: request.redirectUri || ""
      }, request, logger);
      addLibraryInfo(parameters, {
        sku: Constants.MSAL_SKU,
        version: version2,
        cpu: process.arch || "",
        os: process.platform || ""
      });
      if (config.system.protocolMode !== ProtocolMode.OIDC) {
        addApplicationTelemetry(parameters, config.telemetry.application);
      }
      addResponseType(parameters, OAuthResponseType.CODE);
      if (request.codeChallenge && request.codeChallengeMethod) {
        addCodeChallengeParams(parameters, request.codeChallenge, request.codeChallengeMethod);
      }
      addExtraParameters(parameters, request.extraQueryParameters || {});
      return getAuthorizeUrl(authority, parameters);
    }
    var ClientApplication = class {
      /**
       * Constructor for the ClientApplication
       */
      constructor(configuration) {
        this.config = buildAppConfiguration(configuration);
        this.cryptoProvider = new CryptoProvider();
        this.logger = new Logger(this.config.system.loggerOptions, name, version2);
        this.storage = new NodeStorage(this.logger, this.config.auth.clientId, this.cryptoProvider, buildStaticAuthorityOptions(this.config.auth));
        this.tokenCache = new TokenCache(this.storage, this.logger, this.config.cache.cachePlugin);
      }
      /**
       * Creates the URL of the authorization request, letting the user input credentials and consent to the
       * application. The URL targets the /authorize endpoint of the authority configured in the
       * application object.
       *
       * Once the user inputs their credentials and consents, the authority will send a response to the redirect URI
       * sent in the request and should contain an authorization code, which can then be used to acquire tokens via
       * `acquireTokenByCode(AuthorizationCodeRequest)`.
       */
      async getAuthCodeUrl(request) {
        this.logger.info("getAuthCodeUrl called", request.correlationId || "");
        const validRequest = {
          ...request,
          ...await this.initializeBaseRequest(request),
          responseMode: request.responseMode || ResponseMode$1.QUERY,
          authenticationScheme: AuthenticationScheme.BEARER,
          state: request.state || "",
          nonce: request.nonce || ""
        };
        const discoveredAuthority = await this.createAuthority(validRequest.authority, validRequest.correlationId, void 0, request.azureCloudOptions);
        return getAuthCodeRequestUrl(this.config, discoveredAuthority, validRequest, this.logger);
      }
      /**
       * Acquires a token by exchanging the Authorization Code received from the first step of OAuth2.0
       * Authorization Code flow.
       *
       * `getAuthCodeUrl(AuthorizationCodeUrlRequest)` can be used to create the URL for the first step of OAuth2.0
       * Authorization Code flow. Ensure that values for redirectUri and scopes in AuthorizationCodeUrlRequest and
       * AuthorizationCodeRequest are the same.
       */
      async acquireTokenByCode(request, authCodePayLoad) {
        this.logger.info("acquireTokenByCode called", request.correlationId || "");
        if (request.state && authCodePayLoad) {
          this.logger.info("acquireTokenByCode - validating state", request.correlationId || "");
          this.validateState(request.state, authCodePayLoad.state || "");
          authCodePayLoad = { ...authCodePayLoad, state: "" };
        }
        const validRequest = {
          ...request,
          ...await this.initializeBaseRequest(request),
          authenticationScheme: AuthenticationScheme.BEARER
        };
        const serverTelemetryManager = this.initializeServerTelemetryManager(ApiId.acquireTokenByCode, validRequest.correlationId);
        try {
          const discoveredAuthority = await this.createAuthority(validRequest.authority, validRequest.correlationId, void 0, request.azureCloudOptions);
          const authClientConfig = await this.buildOauthClientConfiguration(discoveredAuthority, validRequest.correlationId, validRequest.redirectUri, serverTelemetryManager);
          const authorizationCodeClient = new AuthorizationCodeClient(authClientConfig, new StubPerformanceClient());
          this.logger.verbose("Auth code client created", validRequest.correlationId);
          return await authorizationCodeClient.acquireToken(validRequest, ApiId.acquireTokenByCode, authCodePayLoad);
        } catch (e) {
          if (e instanceof AuthError) {
            e.setCorrelationId(validRequest.correlationId);
          }
          serverTelemetryManager.cacheFailedRequest(e);
          throw e;
        }
      }
      /**
       * Acquires a token by exchanging the refresh token provided for a new set of tokens.
       *
       * This API is provided only for scenarios where you would like to migrate from ADAL to MSAL. Otherwise, it is
       * recommended that you use `acquireTokenSilent()` for silent scenarios. When using `acquireTokenSilent()`, MSAL will
       * handle the caching and refreshing of tokens automatically.
       */
      async acquireTokenByRefreshToken(request) {
        this.logger.info("acquireTokenByRefreshToken called", request.correlationId || "");
        const validRequest = {
          ...request,
          ...await this.initializeBaseRequest(request),
          authenticationScheme: AuthenticationScheme.BEARER
        };
        const serverTelemetryManager = this.initializeServerTelemetryManager(ApiId.acquireTokenByRefreshToken, validRequest.correlationId);
        try {
          const discoveredAuthority = await this.createAuthority(validRequest.authority, validRequest.correlationId, void 0, request.azureCloudOptions);
          const refreshTokenClientConfig = await this.buildOauthClientConfiguration(discoveredAuthority, validRequest.correlationId, validRequest.redirectUri || "", serverTelemetryManager);
          const refreshTokenClient = new RefreshTokenClient(refreshTokenClientConfig, new StubPerformanceClient());
          this.logger.verbose("Refresh token client created", validRequest.correlationId);
          return await refreshTokenClient.acquireToken(validRequest, ApiId.acquireTokenByRefreshToken);
        } catch (e) {
          if (e instanceof AuthError) {
            e.setCorrelationId(validRequest.correlationId);
          }
          serverTelemetryManager.cacheFailedRequest(e);
          throw e;
        }
      }
      /**
       * Acquires a token silently when a user specifies the account the token is requested for.
       *
       * This API expects the user to provide an account object and looks into the cache to retrieve the token if present.
       * There is also an optional "forceRefresh" boolean the user can send to bypass the cache for access_token and id_token.
       * In case the refresh_token is expired or not found, an error is thrown
       * and the guidance is for the user to call any interactive token acquisition API (eg: `acquireTokenByCode()`).
       */
      async acquireTokenSilent(request) {
        const validRequest = {
          ...request,
          ...await this.initializeBaseRequest(request),
          forceRefresh: request.forceRefresh || false
        };
        const serverTelemetryManager = this.initializeServerTelemetryManager(ApiId.acquireTokenSilent, validRequest.correlationId, validRequest.forceRefresh);
        try {
          const discoveredAuthority = await this.createAuthority(validRequest.authority, validRequest.correlationId, void 0, request.azureCloudOptions);
          const clientConfiguration = await this.buildOauthClientConfiguration(discoveredAuthority, validRequest.correlationId, validRequest.redirectUri || "", serverTelemetryManager);
          const silentFlowClient = new SilentFlowClient(clientConfiguration, new StubPerformanceClient());
          this.logger.verbose("Silent flow client created", validRequest.correlationId);
          try {
            await this.tokenCache.overwriteCache();
            return await this.acquireCachedTokenSilent(validRequest, silentFlowClient, clientConfiguration);
          } catch (error) {
            if (error instanceof ClientAuthError && error.errorCode === tokenRefreshRequired) {
              const refreshTokenClient = new RefreshTokenClient(clientConfiguration, new StubPerformanceClient());
              return refreshTokenClient.acquireTokenByRefreshToken(validRequest, ApiId.acquireTokenSilent);
            }
            throw error;
          }
        } catch (error) {
          if (error instanceof AuthError) {
            error.setCorrelationId(validRequest.correlationId);
          }
          serverTelemetryManager.cacheFailedRequest(error);
          throw error;
        }
      }
      async acquireCachedTokenSilent(validRequest, silentFlowClient, clientConfiguration) {
        const [authResponse, cacheOutcome] = await silentFlowClient.acquireCachedToken({
          ...validRequest,
          scopes: validRequest.scopes?.length ? validRequest.scopes : [...OIDC_DEFAULT_SCOPES]
        });
        if (cacheOutcome === CacheOutcome.PROACTIVELY_REFRESHED) {
          this.logger.info("ClientApplication:acquireCachedTokenSilent - Cached access token's refreshOn property has been exceeded'. It's not expired, but must be refreshed.", validRequest.correlationId);
          const refreshTokenClient = new RefreshTokenClient(clientConfiguration, new StubPerformanceClient());
          try {
            await refreshTokenClient.acquireTokenByRefreshToken(validRequest, ApiId.acquireTokenSilent);
          } catch {
          }
        }
        return authResponse;
      }
      /**
       * Acquires tokens with password grant by exchanging client applications username and password for credentials
       *
       * The latest OAuth 2.0 Security Best Current Practice disallows the password grant entirely.
       * More details on this recommendation at https://tools.ietf.org/html/draft-ietf-oauth-security-topics-13#section-3.4
       * Microsoft's documentation and recommendations are at:
       * https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-authentication-flows#usernamepassword
       *
       * @param request - UsenamePasswordRequest
       * @deprecated - Use a more secure flow instead
       */
      async acquireTokenByUsernamePassword(request) {
        this.logger.info("acquireTokenByUsernamePassword called", request.correlationId || "");
        const validRequest = {
          ...request,
          ...await this.initializeBaseRequest(request)
        };
        const serverTelemetryManager = this.initializeServerTelemetryManager(ApiId.acquireTokenByUsernamePassword, validRequest.correlationId);
        try {
          const discoveredAuthority = await this.createAuthority(validRequest.authority, validRequest.correlationId, void 0, request.azureCloudOptions);
          const usernamePasswordClientConfig = await this.buildOauthClientConfiguration(discoveredAuthority, validRequest.correlationId, "", serverTelemetryManager);
          const usernamePasswordClient = new UsernamePasswordClient(usernamePasswordClientConfig);
          this.logger.verbose("Username password client created", validRequest.correlationId);
          return await usernamePasswordClient.acquireToken(validRequest);
        } catch (e) {
          if (e instanceof AuthError) {
            e.setCorrelationId(validRequest.correlationId);
          }
          serverTelemetryManager.cacheFailedRequest(e);
          throw e;
        }
      }
      /**
       * Gets the token cache for the application.
       */
      getTokenCache() {
        this.logger.info("getTokenCache called", "");
        return this.tokenCache;
      }
      /**
       * Validates OIDC state by comparing the user cached state with the state received from the server.
       *
       * This API is provided for scenarios where you would use OAuth2.0 state parameter to mitigate against
       * CSRF attacks.
       * For more information about state, visit https://datatracker.ietf.org/doc/html/rfc6819#section-3.6.
       * @param state - Unique GUID generated by the user that is cached by the user and sent to the server during the first leg of the flow
       * @param cachedState - This string is sent back by the server with the authorization code
       */
      validateState(state, cachedState) {
        if (!state) {
          throw NodeAuthError.createStateNotFoundError();
        }
        if (state !== cachedState) {
          throw createClientAuthError(stateMismatch);
        }
      }
      /**
       * Returns the logger instance
       */
      getLogger() {
        return this.logger;
      }
      /**
       * Replaces the default logger set in configurations with new Logger with new configurations
       * @param logger - Logger instance
       */
      setLogger(logger) {
        this.logger = logger;
      }
      /**
       * Builds the common configuration to be passed to the common component based on the platform configurarion
       * @param authority - user passed authority in configuration
       * @param serverTelemetryManager - initializes servertelemetry if passed
       */
      async buildOauthClientConfiguration(discoveredAuthority, requestCorrelationId, redirectUri, serverTelemetryManager) {
        this.logger.verbose("buildOauthClientConfiguration called", requestCorrelationId);
        this.logger.info(`Building oauth client configuration with the following authority: ${discoveredAuthority.tokenEndpoint}.`, requestCorrelationId);
        serverTelemetryManager?.updateRegionDiscoveryMetadata(discoveredAuthority.regionDiscoveryMetadata);
        const clientConfiguration = {
          authOptions: {
            clientId: this.config.auth.clientId,
            authority: discoveredAuthority,
            clientCapabilities: this.config.auth.clientCapabilities,
            redirectUri
          },
          loggerOptions: {
            logLevel: this.config.system.loggerOptions.logLevel,
            loggerCallback: this.config.system.loggerOptions.loggerCallback,
            piiLoggingEnabled: this.config.system.loggerOptions.piiLoggingEnabled,
            correlationId: requestCorrelationId
          },
          cryptoInterface: this.cryptoProvider,
          networkInterface: this.config.system.networkClient,
          storageInterface: this.storage,
          serverTelemetryManager,
          clientCredentials: {
            clientSecret: this.clientSecret,
            clientAssertion: await this.getClientAssertion(discoveredAuthority)
          },
          libraryInfo: {
            sku: Constants.MSAL_SKU,
            version: version2,
            cpu: process.arch || "",
            os: process.platform || ""
          },
          telemetry: this.config.telemetry,
          persistencePlugin: this.config.cache.cachePlugin,
          serializableCache: this.tokenCache
        };
        return clientConfiguration;
      }
      async getClientAssertion(authority) {
        if (this.developerProvidedClientAssertion) {
          this.clientAssertion = ClientAssertion.fromAssertion(await getClientAssertion(this.developerProvidedClientAssertion, this.config.auth.clientId, authority.tokenEndpoint));
        }
        return this.clientAssertion && {
          assertion: this.clientAssertion.getJwt(this.cryptoProvider, this.config.auth.clientId, authority.tokenEndpoint),
          assertionType: Constants.JWT_BEARER_ASSERTION_TYPE
        };
      }
      /**
       * Generates a request with the default scopes & generates a correlationId.
       * @param authRequest - BaseAuthRequest for initialization
       */
      async initializeBaseRequest(authRequest) {
        const correlationId = authRequest.correlationId || this.cryptoProvider.createNewGuid();
        this.logger.verbose("initializeRequestScopes called", correlationId);
        if (authRequest.authenticationScheme && authRequest.authenticationScheme === AuthenticationScheme.POP) {
          this.logger.verbose("Authentication Scheme 'pop' is not supported yet, setting Authentication Scheme to 'Bearer' for request", correlationId);
        }
        authRequest.authenticationScheme = AuthenticationScheme.BEARER;
        return {
          ...authRequest,
          scopes: [
            ...authRequest && authRequest.scopes || [],
            ...OIDC_DEFAULT_SCOPES
          ],
          correlationId,
          authority: authRequest.authority || this.config.auth.authority
        };
      }
      /**
       * Initializes the server telemetry payload
       * @param apiId - Id for a specific request
       * @param correlationId - GUID
       * @param forceRefresh - boolean to indicate network call
       */
      initializeServerTelemetryManager(apiId, correlationId, forceRefresh) {
        const telemetryPayload = {
          clientId: this.config.auth.clientId,
          correlationId,
          apiId,
          forceRefresh: forceRefresh || false
        };
        return new ServerTelemetryManager(telemetryPayload, this.storage);
      }
      /**
       * Create authority instance. If authority not passed in request, default to authority set on the application
       * object. If no authority set in application object, then default to common authority.
       * @param authorityString - authority from user configuration
       */
      async createAuthority(authorityString, requestCorrelationId, azureRegionConfiguration, azureCloudOptions) {
        this.logger.verbose("createAuthority called", requestCorrelationId);
        const authorityUrl = Authority.generateAuthority(authorityString, azureCloudOptions || this.config.auth.azureCloudOptions);
        const authorityOptions = {
          protocolMode: this.config.system.protocolMode,
          knownAuthorities: this.config.auth.knownAuthorities,
          cloudDiscoveryMetadata: this.config.auth.cloudDiscoveryMetadata,
          authorityMetadata: this.config.auth.authorityMetadata,
          azureRegionConfiguration
        };
        return createDiscoveredInstance(authorityUrl, this.config.system.networkClient, this.storage, authorityOptions, this.logger, requestCorrelationId, new StubPerformanceClient());
      }
      /**
       * Clear the cache
       */
      clearCache() {
        this.storage.clear();
      }
    };
    var LoopbackClient = class {
      /**
       * Spins up a loopback server which returns the server response when the localhost redirectUri is hit
       * @param successTemplate
       * @param errorTemplate
       * @returns
       */
      async listenForAuthCode(successTemplate, errorTemplate) {
        if (this.server) {
          throw NodeAuthError.createLoopbackServerAlreadyExistsError();
        }
        return new Promise((resolve, reject) => {
          this.server = http.createServer((req, res) => {
            const url = req.url;
            if (!url) {
              res.end(errorTemplate || "Error occurred loading redirectUrl");
              reject(NodeAuthError.createUnableToLoadRedirectUrlError());
              return;
            } else if (url === FORWARD_SLASH) {
              res.end(successTemplate || "Auth code was successfully acquired. You can close this window now.");
              return;
            }
            const redirectUri = this.getRedirectUri();
            const parsedUrl = new URL(url, redirectUri);
            const authCodeResponse = getDeserializedResponse(parsedUrl.search) || {};
            if (authCodeResponse.code) {
              res.writeHead(HTTP_REDIRECT, {
                location: redirectUri
              });
              res.end();
            }
            if (authCodeResponse.error) {
              res.end(errorTemplate || `Error occurred: ${authCodeResponse.error}`);
            }
            resolve(authCodeResponse);
          });
          this.server.listen(0, "127.0.0.1");
        });
      }
      /**
       * Get the port that the loopback server is running on
       * @returns
       */
      getRedirectUri() {
        if (!this.server || !this.server.listening) {
          throw NodeAuthError.createNoLoopbackServerExistsError();
        }
        const address = this.server.address();
        if (!address || typeof address === "string" || !address.port) {
          this.closeServer();
          throw NodeAuthError.createInvalidLoopbackAddressTypeError();
        }
        const port = address && address.port;
        return `${Constants.HTTP_PROTOCOL}${Constants.LOCALHOST}:${port}`;
      }
      /**
       * Close the loopback server
       */
      closeServer() {
        if (this.server) {
          this.server.close();
          if (typeof this.server.closeAllConnections === "function") {
            this.server.closeAllConnections();
          }
          this.server.unref();
          this.server = void 0;
        }
      }
    };
    var DeviceCodeClient = class extends BaseClient {
      constructor(configuration) {
        super(configuration);
      }
      /**
       * Gets device code from device code endpoint, calls back to with device code response, and
       * polls token endpoint to exchange device code for tokens
       * @param request - developer provided CommonDeviceCodeRequest
       */
      async acquireToken(request) {
        const deviceCodeResponse = await this.getDeviceCode(request);
        request.deviceCodeCallback(deviceCodeResponse);
        const reqTimestamp = nowSeconds();
        const response = await this.acquireTokenWithDeviceCode(request, deviceCodeResponse);
        const responseHandler = new ResponseHandler(this.config.authOptions.clientId, this.cacheManager, this.cryptoUtils, this.logger, this.performanceClient, this.config.serializableCache, this.config.persistencePlugin);
        responseHandler.validateTokenResponse(response, request.correlationId);
        return responseHandler.handleServerTokenResponse(response, this.authority, reqTimestamp, request, ApiId.acquireTokenByDeviceCode);
      }
      /**
       * Creates device code request and executes http GET
       * @param request - developer provided CommonDeviceCodeRequest
       */
      async getDeviceCode(request) {
        const queryParametersString = this.createExtraQueryParameters(request);
        const endpoint = UrlString.appendQueryString(this.authority.deviceCodeEndpoint, queryParametersString);
        const queryString = this.createQueryString(request);
        const headers = this.createTokenRequestHeaders();
        const thumbprint = {
          clientId: this.config.authOptions.clientId,
          authority: request.authority,
          scopes: request.scopes,
          claims: request.claims,
          authenticationScheme: request.authenticationScheme,
          resourceRequestMethod: request.resourceRequestMethod,
          resourceRequestUri: request.resourceRequestUri,
          shrClaims: request.shrClaims,
          sshKid: request.sshKid
        };
        return this.executePostRequestToDeviceCodeEndpoint(endpoint, queryString, headers, thumbprint, request.correlationId);
      }
      /**
       * Creates query string for the device code request
       * @param request - developer provided CommonDeviceCodeRequest
       */
      createExtraQueryParameters(request) {
        const parameters = /* @__PURE__ */ new Map();
        if (request.extraQueryParameters) {
          addExtraParameters(parameters, request.extraQueryParameters);
        }
        return mapToQueryString(parameters);
      }
      /**
       * Executes POST request to device code endpoint
       * @param deviceCodeEndpoint - token endpoint
       * @param queryString - string to be used in the body of the request
       * @param headers - headers for the request
       * @param thumbprint - unique request thumbprint
       * @param correlationId - correlation id to be used in the request
       */
      async executePostRequestToDeviceCodeEndpoint(deviceCodeEndpoint, queryString, headers, thumbprint, correlationId) {
        const { body: { user_code: userCode, device_code: deviceCode, verification_uri: verificationUri, expires_in: expiresIn, interval, message } } = await this.sendPostRequest(thumbprint, deviceCodeEndpoint, {
          body: queryString,
          headers
        }, correlationId);
        return {
          userCode,
          deviceCode,
          verificationUri,
          expiresIn,
          interval,
          message
        };
      }
      /**
       * Create device code endpoint query parameters and returns string
       * @param request - developer provided CommonDeviceCodeRequest
       */
      createQueryString(request) {
        const parameters = /* @__PURE__ */ new Map();
        addScopes(parameters, request.scopes);
        addClientId(parameters, this.config.authOptions.clientId);
        if (request.extraQueryParameters) {
          addExtraParameters(parameters, request.extraQueryParameters);
        }
        if (request.claims || this.config.authOptions.clientCapabilities && this.config.authOptions.clientCapabilities.length > 0) {
          addClaims(parameters, request.claims, this.config.authOptions.clientCapabilities);
        }
        return mapToQueryString(parameters);
      }
      /**
       * Breaks the polling with specific conditions
       * @param deviceCodeExpirationTime - expiration time for the device code request
       * @param userSpecifiedTimeout - developer provided timeout, to be compared against deviceCodeExpirationTime
       * @param userSpecifiedCancelFlag - boolean indicating the developer would like to cancel the request
       */
      continuePolling(deviceCodeExpirationTime, userSpecifiedTimeout, userSpecifiedCancelFlag) {
        if (userSpecifiedCancelFlag) {
          this.logger.error("Token request cancelled by setting DeviceCodeRequest.cancel = true", "");
          throw createClientAuthError(deviceCodePollingCancelled);
        } else if (userSpecifiedTimeout && userSpecifiedTimeout < deviceCodeExpirationTime && nowSeconds() > userSpecifiedTimeout) {
          this.logger.error(`User defined timeout for device code polling reached. The timeout was set for ${userSpecifiedTimeout}`, "");
          throw createClientAuthError(userTimeoutReached);
        } else if (nowSeconds() > deviceCodeExpirationTime) {
          if (userSpecifiedTimeout) {
            this.logger.verbose(`User specified timeout ignored as the device code has expired before the timeout elapsed. The user specified timeout was set for ${userSpecifiedTimeout}`, "");
          }
          this.logger.error(`Device code expired. Expiration time of device code was ${deviceCodeExpirationTime}`, "");
          throw createClientAuthError(deviceCodeExpired);
        }
        return true;
      }
      /**
       * Creates token request with device code response and polls token endpoint at interval set by the device code response
       * @param request - developer provided CommonDeviceCodeRequest
       * @param deviceCodeResponse - DeviceCodeResponse returned by the security token service device code endpoint
       */
      async acquireTokenWithDeviceCode(request, deviceCodeResponse) {
        const queryParametersString = this.createTokenQueryParameters(request);
        const endpoint = UrlString.appendQueryString(this.authority.tokenEndpoint, queryParametersString);
        const requestBody = this.createTokenRequestBody(request, deviceCodeResponse);
        const headers = this.createTokenRequestHeaders();
        const userSpecifiedTimeout = request.timeout ? nowSeconds() + request.timeout : void 0;
        const deviceCodeExpirationTime = nowSeconds() + deviceCodeResponse.expiresIn;
        const pollingIntervalMilli = deviceCodeResponse.interval * 1e3;
        while (this.continuePolling(deviceCodeExpirationTime, userSpecifiedTimeout, request.cancel)) {
          const thumbprint = {
            clientId: this.config.authOptions.clientId,
            authority: request.authority,
            scopes: request.scopes,
            claims: request.claims,
            authenticationScheme: request.authenticationScheme,
            resourceRequestMethod: request.resourceRequestMethod,
            resourceRequestUri: request.resourceRequestUri,
            shrClaims: request.shrClaims,
            sshKid: request.sshKid
          };
          const response = await this.executePostToTokenEndpoint(endpoint, requestBody, headers, thumbprint, request.correlationId);
          if (response.body && response.body.error) {
            if (response.body.error === AUTHORIZATION_PENDING) {
              this.logger.info("Authorization pending. Continue polling.", request.correlationId);
              await delay(pollingIntervalMilli);
            } else {
              this.logger.info("Unexpected error in polling from the server", request.correlationId);
              throw createAuthError(postRequestFailed, response.body.error);
            }
          } else {
            this.logger.verbose("Authorization completed successfully. Polling stopped.", request.correlationId);
            return response.body;
          }
        }
        this.logger.error("Polling stopped for unknown reasons.", request.correlationId);
        throw createClientAuthError(deviceCodeUnknownError);
      }
      /**
       * Creates query parameters and converts to string.
       * @param request - developer provided CommonDeviceCodeRequest
       * @param deviceCodeResponse - DeviceCodeResponse returned by the security token service device code endpoint
       */
      createTokenRequestBody(request, deviceCodeResponse) {
        const parameters = /* @__PURE__ */ new Map();
        addScopes(parameters, request.scopes);
        addClientId(parameters, this.config.authOptions.clientId);
        addGrantType(parameters, GrantType.DEVICE_CODE_GRANT);
        addDeviceCode(parameters, deviceCodeResponse.deviceCode);
        const correlationId = request.correlationId || this.config.cryptoInterface.createNewGuid();
        addCorrelationId(parameters, correlationId);
        addClientInfo(parameters);
        addLibraryInfo(parameters, this.config.libraryInfo);
        addApplicationTelemetry(parameters, this.config.telemetry.application);
        addThrottling(parameters);
        if (this.serverTelemetryManager) {
          addServerTelemetry(parameters, this.serverTelemetryManager);
        }
        if (!StringUtils.isEmptyObj(request.claims) || this.config.authOptions.clientCapabilities && this.config.authOptions.clientCapabilities.length > 0) {
          addClaims(parameters, request.claims, this.config.authOptions.clientCapabilities);
        }
        return mapToQueryString(parameters);
      }
    };
    var PublicClientApplication = class extends ClientApplication {
      /**
       * Important attributes in the Configuration object for auth are:
       * - clientID: the application ID of your application. You can obtain one by registering your application with our Application registration portal.
       * - authority: the authority URL for your application.
       *
       * AAD authorities are of the form https://login.microsoftonline.com/\{Enter_the_Tenant_Info_Here\}.
       * - If your application supports Accounts in one organizational directory, replace "Enter_the_Tenant_Info_Here" value with the Tenant Id or Tenant name (for example, contoso.microsoft.com).
       * - If your application supports Accounts in any organizational directory, replace "Enter_the_Tenant_Info_Here" value with organizations.
       * - If your application supports Accounts in any organizational directory and personal Microsoft accounts, replace "Enter_the_Tenant_Info_Here" value with common.
       * - To restrict support to Personal Microsoft accounts only, replace "Enter_the_Tenant_Info_Here" value with consumers.
       *
       * Azure B2C authorities are of the form https://\{instance\}/\{tenant\}/\{policy\}. Each policy is considered
       * its own authority. You will have to set the all of the knownAuthorities at the time of the client application
       * construction.
       *
       * ADFS authorities are of the form https://\{instance\}/adfs.
       */
      constructor(configuration) {
        super(configuration);
        if (this.config.broker.nativeBrokerPlugin) {
          if (this.config.broker.nativeBrokerPlugin.isBrokerAvailable) {
            this.nativeBrokerPlugin = this.config.broker.nativeBrokerPlugin;
            this.nativeBrokerPlugin.setLogger(this.config.system.loggerOptions);
          } else {
            this.logger.warning("NativeBroker implementation was provided but the broker is unavailable.", "");
          }
        }
        this.skus = ServerTelemetryManager.makeExtraSkuString({
          libraryName: Constants.MSAL_SKU,
          libraryVersion: version2
        });
      }
      /**
       * Acquires a token from the authority using OAuth2.0 device code flow.
       * This flow is designed for devices that do not have access to a browser or have input constraints.
       * The authorization server issues a DeviceCode object with a verification code, an end-user code,
       * and the end-user verification URI. The DeviceCode object is provided through a callback, and the end-user should be
       * instructed to use another device to navigate to the verification URI to input credentials.
       * Since the client cannot receive incoming requests, it polls the authorization server repeatedly
       * until the end-user completes input of credentials.
       */
      async acquireTokenByDeviceCode(request) {
        this.logger.info("acquireTokenByDeviceCode called", request.correlationId || "");
        const validRequest = Object.assign(request, await this.initializeBaseRequest(request));
        const serverTelemetryManager = this.initializeServerTelemetryManager(ApiId.acquireTokenByDeviceCode, validRequest.correlationId);
        try {
          const discoveredAuthority = await this.createAuthority(validRequest.authority, validRequest.correlationId, void 0, request.azureCloudOptions);
          const deviceCodeConfig = await this.buildOauthClientConfiguration(discoveredAuthority, validRequest.correlationId, "", serverTelemetryManager);
          const deviceCodeClient = new DeviceCodeClient(deviceCodeConfig);
          this.logger.verbose("Device code client created", validRequest.correlationId);
          return await deviceCodeClient.acquireToken(validRequest);
        } catch (e) {
          if (e instanceof AuthError) {
            e.setCorrelationId(validRequest.correlationId);
          }
          serverTelemetryManager.cacheFailedRequest(e);
          throw e;
        }
      }
      /**
       * Acquires a token interactively via the browser by requesting an authorization code then exchanging it for a token.
       */
      async acquireTokenInteractive(request) {
        const correlationId = request.correlationId || this.cryptoProvider.createNewGuid();
        this.logger.trace("acquireTokenInteractive called", correlationId);
        const { openBrowser, successTemplate, errorTemplate, windowHandle, loopbackClient: customLoopbackClient, ...remainingProperties } = request;
        if (this.nativeBrokerPlugin) {
          const brokerRequest = {
            ...remainingProperties,
            clientId: this.config.auth.clientId,
            scopes: request.scopes || OIDC_DEFAULT_SCOPES,
            redirectUri: request.redirectUri || "",
            authority: request.authority || this.config.auth.authority,
            correlationId,
            extraParameters: {
              ...remainingProperties.extraQueryParameters,
              ...remainingProperties.extraParameters,
              [X_CLIENT_EXTRA_SKU]: this.skus
            },
            accountId: remainingProperties.account?.nativeAccountId
          };
          return this.nativeBrokerPlugin.acquireTokenInteractive(brokerRequest, windowHandle);
        }
        if (request.redirectUri) {
          if (!this.config.broker.nativeBrokerPlugin) {
            throw NodeAuthError.createRedirectUriNotSupportedError();
          }
          request.redirectUri = "";
        }
        const { verifier, challenge } = await this.cryptoProvider.generatePkceCodes();
        const loopbackClient = customLoopbackClient || new LoopbackClient();
        let authCodeResponse = {};
        let authCodeListenerError = null;
        try {
          const authCodeListener = loopbackClient.listenForAuthCode(successTemplate, errorTemplate).then((response) => {
            authCodeResponse = response;
          }).catch((e) => {
            authCodeListenerError = e;
          });
          const redirectUri = await this.waitForRedirectUri(loopbackClient);
          const validRequest = {
            ...remainingProperties,
            correlationId,
            scopes: request.scopes || OIDC_DEFAULT_SCOPES,
            redirectUri,
            responseMode: ResponseMode$1.QUERY,
            codeChallenge: challenge,
            codeChallengeMethod: CodeChallengeMethodValues.S256
          };
          const authCodeUrl = await this.getAuthCodeUrl(validRequest);
          await openBrowser(authCodeUrl);
          await authCodeListener;
          if (authCodeListenerError) {
            throw authCodeListenerError;
          }
          if (authCodeResponse.error) {
            throw new ServerError(authCodeResponse.error, authCodeResponse.error_description, authCodeResponse.suberror);
          } else if (!authCodeResponse.code) {
            throw NodeAuthError.createNoAuthCodeInResponseError();
          }
          const clientInfo = authCodeResponse.client_info;
          const tokenRequest = {
            code: authCodeResponse.code,
            codeVerifier: verifier,
            clientInfo: clientInfo || "",
            ...validRequest
          };
          return await this.acquireTokenByCode(tokenRequest);
        } finally {
          loopbackClient.closeServer();
        }
      }
      /**
       * Returns a token retrieved either from the cache or by exchanging the refresh token for a fresh access token. If brokering is enabled the token request will be serviced by the broker.
       * @param request - developer provided SilentFlowRequest
       * @returns
       */
      async acquireTokenSilent(request) {
        const correlationId = request.correlationId || this.cryptoProvider.createNewGuid();
        this.logger.trace("acquireTokenSilent called", correlationId);
        if (this.nativeBrokerPlugin) {
          const brokerRequest = {
            ...request,
            clientId: this.config.auth.clientId,
            scopes: request.scopes || OIDC_DEFAULT_SCOPES,
            redirectUri: request.redirectUri || "",
            authority: request.authority || this.config.auth.authority,
            correlationId,
            extraParameters: {
              ...request.extraQueryParameters,
              ...request.extraParameters,
              [X_CLIENT_EXTRA_SKU]: this.skus
            },
            accountId: request.account.nativeAccountId,
            forceRefresh: request.forceRefresh || false
          };
          return this.nativeBrokerPlugin.acquireTokenSilent(brokerRequest);
        }
        if (request.redirectUri) {
          if (!this.config.broker.nativeBrokerPlugin) {
            throw NodeAuthError.createRedirectUriNotSupportedError();
          }
          request.redirectUri = "";
        }
        return super.acquireTokenSilent(request);
      }
      /**
       * Removes cache artifacts associated with the given account
       * @param request - developer provided SignOutRequest
       * @returns
       */
      async signOut(request) {
        if (this.nativeBrokerPlugin && request.account.nativeAccountId) {
          const signoutRequest = {
            clientId: this.config.auth.clientId,
            accountId: request.account.nativeAccountId,
            correlationId: request.correlationId || this.cryptoProvider.createNewGuid()
          };
          await this.nativeBrokerPlugin.signOut(signoutRequest);
        }
        await this.getTokenCache().removeAccount(request.account, request.correlationId);
      }
      /**
       * Returns all cached accounts for this application. If brokering is enabled this request will be serviced by the broker.
       * @returns
       */
      async getAllAccounts() {
        if (this.nativeBrokerPlugin) {
          const correlationId = this.cryptoProvider.createNewGuid();
          return this.nativeBrokerPlugin.getAllAccounts(this.config.auth.clientId, correlationId);
        }
        return this.getTokenCache().getAllAccounts();
      }
      /**
       * Attempts to retrieve the redirectUri from the loopback server. If the loopback server does not start listening for requests within the timeout this will throw.
       * @param loopbackClient - developer provided custom loopback server implementation
       * @returns
       */
      async waitForRedirectUri(loopbackClient) {
        return new Promise((resolve, reject) => {
          let ticks = 0;
          const id = setInterval(() => {
            if (LOOPBACK_SERVER_CONSTANTS.TIMEOUT_MS / LOOPBACK_SERVER_CONSTANTS.INTERVAL_MS < ticks) {
              clearInterval(id);
              reject(NodeAuthError.createLoopbackServerTimeoutError());
              return;
            }
            try {
              const r = loopbackClient.getRedirectUri();
              clearInterval(id);
              resolve(r);
              return;
            } catch (e) {
              if (e instanceof AuthError && e.errorCode === NodeAuthErrorMessage.noLoopbackServerExists.code) {
                ticks++;
                return;
              }
              clearInterval(id);
              reject(e);
              return;
            }
          }, LOOPBACK_SERVER_CONSTANTS.INTERVAL_MS);
        });
      }
    };
    var ClientCredentialClient = class extends BaseClient {
      constructor(configuration, appTokenProvider) {
        super(configuration);
        this.appTokenProvider = appTokenProvider;
      }
      /**
       * Public API to acquire a token with ClientCredential Flow for Confidential clients
       * @param request - CommonClientCredentialRequest provided by the developer
       */
      async acquireToken(request) {
        if (request.skipCache || request.claims) {
          return this.executeTokenRequest(request, this.authority);
        }
        const [cachedAuthenticationResult, lastCacheOutcome] = await this.getCachedAuthenticationResult(request, this.config, this.cryptoUtils, this.authority, this.cacheManager, this.serverTelemetryManager);
        if (cachedAuthenticationResult) {
          if (lastCacheOutcome === CacheOutcome.PROACTIVELY_REFRESHED) {
            this.logger.info("ClientCredentialClient:getCachedAuthenticationResult - Cached access token's refreshOn property has been exceeded'. It's not expired, but must be refreshed.", request.correlationId);
            const refreshAccessToken = true;
            await this.executeTokenRequest(request, this.authority, refreshAccessToken);
          }
          return cachedAuthenticationResult;
        } else {
          return this.executeTokenRequest(request, this.authority);
        }
      }
      /**
       * looks up cache if the tokens are cached already
       */
      async getCachedAuthenticationResult(request, config, cryptoUtils, authority, cacheManager, serverTelemetryManager) {
        const clientConfiguration = config;
        const managedIdentityConfiguration = config;
        let lastCacheOutcome = CacheOutcome.NOT_APPLICABLE;
        let cacheContext;
        if (clientConfiguration.serializableCache && clientConfiguration.persistencePlugin) {
          cacheContext = new TokenCacheContext(clientConfiguration.serializableCache, false);
          await clientConfiguration.persistencePlugin.beforeCacheAccess(cacheContext);
        }
        const cachedAccessToken = this.readAccessTokenFromCache(authority, managedIdentityConfiguration.managedIdentityId?.id || clientConfiguration.authOptions.clientId, new ScopeSet(request.scopes || []), cacheManager, request.correlationId);
        if (clientConfiguration.serializableCache && clientConfiguration.persistencePlugin && cacheContext) {
          await clientConfiguration.persistencePlugin.afterCacheAccess(cacheContext);
        }
        if (!cachedAccessToken) {
          serverTelemetryManager?.setCacheOutcome(CacheOutcome.NO_CACHED_ACCESS_TOKEN);
          return [null, CacheOutcome.NO_CACHED_ACCESS_TOKEN];
        }
        if (isTokenExpired(cachedAccessToken.expiresOn, clientConfiguration.systemOptions?.tokenRenewalOffsetSeconds || DEFAULT_TOKEN_RENEWAL_OFFSET_SEC)) {
          serverTelemetryManager?.setCacheOutcome(CacheOutcome.CACHED_ACCESS_TOKEN_EXPIRED);
          return [null, CacheOutcome.CACHED_ACCESS_TOKEN_EXPIRED];
        }
        if (cachedAccessToken.refreshOn && isTokenExpired(cachedAccessToken.refreshOn.toString(), 0)) {
          lastCacheOutcome = CacheOutcome.PROACTIVELY_REFRESHED;
          serverTelemetryManager?.setCacheOutcome(CacheOutcome.PROACTIVELY_REFRESHED);
        }
        return [
          await ResponseHandler.generateAuthenticationResult(cryptoUtils, authority, {
            account: null,
            idToken: null,
            accessToken: cachedAccessToken,
            refreshToken: null,
            appMetadata: null
          }, true, request, this.performanceClient),
          lastCacheOutcome
        ];
      }
      /**
       * Reads access token from the cache
       */
      readAccessTokenFromCache(authority, id, scopeSet, cacheManager, correlationId) {
        const accessTokenFilter = {
          homeAccountId: "",
          environment: authority.canonicalAuthorityUrlComponents.HostNameAndPort,
          credentialType: CredentialType.ACCESS_TOKEN,
          clientId: id,
          realm: authority.tenant,
          target: ScopeSet.createSearchScopes(scopeSet.asArray())
        };
        const accessTokens = cacheManager.getAccessTokensByFilter(accessTokenFilter, correlationId);
        if (accessTokens.length < 1) {
          return null;
        } else if (accessTokens.length > 1) {
          throw createClientAuthError(multipleMatchingTokens);
        }
        return accessTokens[0];
      }
      /**
       * Makes a network call to request the token from the service
       * @param request - CommonClientCredentialRequest provided by the developer
       * @param authority - authority object
       */
      async executeTokenRequest(request, authority, refreshAccessToken) {
        let serverTokenResponse;
        let reqTimestamp;
        if (this.appTokenProvider) {
          this.logger.info("Using appTokenProvider extensibility.", request.correlationId);
          const appTokenPropviderParameters = {
            correlationId: request.correlationId,
            tenantId: this.config.authOptions.authority.tenant,
            scopes: request.scopes,
            claims: request.claims
          };
          reqTimestamp = nowSeconds();
          const appTokenProviderResult = await this.appTokenProvider(appTokenPropviderParameters);
          serverTokenResponse = {
            access_token: appTokenProviderResult.accessToken,
            expires_in: appTokenProviderResult.expiresInSeconds,
            refresh_in: appTokenProviderResult.refreshInSeconds,
            token_type: AuthenticationScheme.BEARER
          };
        } else {
          const queryParametersString = this.createTokenQueryParameters(request);
          const endpoint = UrlString.appendQueryString(authority.tokenEndpoint, queryParametersString);
          const requestBody = await this.createTokenRequestBody(request);
          const headers = this.createTokenRequestHeaders();
          const thumbprint = {
            clientId: this.config.authOptions.clientId,
            authority: request.authority,
            scopes: request.scopes,
            claims: request.claims,
            authenticationScheme: request.authenticationScheme,
            resourceRequestMethod: request.resourceRequestMethod,
            resourceRequestUri: request.resourceRequestUri,
            shrClaims: request.shrClaims,
            sshKid: request.sshKid
          };
          this.logger.info("Sending token request to endpoint: " + authority.tokenEndpoint, request.correlationId);
          reqTimestamp = nowSeconds();
          const response = await this.executePostToTokenEndpoint(endpoint, requestBody, headers, thumbprint, request.correlationId);
          serverTokenResponse = response.body;
          serverTokenResponse.status = response.status;
        }
        const responseHandler = new ResponseHandler(this.config.authOptions.clientId, this.cacheManager, this.cryptoUtils, this.logger, this.performanceClient, this.config.serializableCache, this.config.persistencePlugin);
        responseHandler.validateTokenResponse(serverTokenResponse, request.correlationId, refreshAccessToken);
        const tokenResponse = await responseHandler.handleServerTokenResponse(serverTokenResponse, this.authority, reqTimestamp, request, ApiId.acquireTokenByClientCredential);
        return tokenResponse;
      }
      /**
       * generate the request to the server in the acceptable format
       * @param request - CommonClientCredentialRequest provided by the developer
       */
      async createTokenRequestBody(request) {
        const parameters = /* @__PURE__ */ new Map();
        addClientId(parameters, this.config.authOptions.clientId);
        addScopes(parameters, request.scopes, false);
        addGrantType(parameters, GrantType.CLIENT_CREDENTIALS_GRANT);
        addLibraryInfo(parameters, this.config.libraryInfo);
        addApplicationTelemetry(parameters, this.config.telemetry.application);
        addThrottling(parameters);
        if (this.serverTelemetryManager) {
          addServerTelemetry(parameters, this.serverTelemetryManager);
        }
        const correlationId = request.correlationId || this.config.cryptoInterface.createNewGuid();
        addCorrelationId(parameters, correlationId);
        if (this.config.clientCredentials.clientSecret) {
          addClientSecret(parameters, this.config.clientCredentials.clientSecret);
        }
        const clientAssertion = request.clientAssertion || this.config.clientCredentials.clientAssertion;
        if (clientAssertion) {
          addClientAssertion(parameters, await getClientAssertion(clientAssertion.assertion, this.config.authOptions.clientId, request.resourceRequestUri));
          addClientAssertionType(parameters, clientAssertion.assertionType);
        }
        if (!StringUtils.isEmptyObj(request.claims) || this.config.authOptions.clientCapabilities && this.config.authOptions.clientCapabilities.length > 0) {
          addClaims(parameters, request.claims, this.config.authOptions.clientCapabilities);
        }
        return mapToQueryString(parameters);
      }
    };
    var OnBehalfOfClient = class extends BaseClient {
      constructor(configuration) {
        super(configuration);
      }
      /**
       * Public API to acquire tokens with on behalf of flow
       * @param request - developer provided CommonOnBehalfOfRequest
       */
      async acquireToken(request) {
        this.scopeSet = new ScopeSet(request.scopes || []);
        this.userAssertionHash = await this.cryptoUtils.hashString(request.oboAssertion);
        if (request.skipCache || request.claims) {
          return this.executeTokenRequest(request, this.authority, this.userAssertionHash);
        }
        try {
          return await this.getCachedAuthenticationResult(request);
        } catch (e) {
          return await this.executeTokenRequest(request, this.authority, this.userAssertionHash);
        }
      }
      /**
       * look up cache for tokens
       * Find idtoken in the cache
       * Find accessToken based on user assertion and account info in the cache
       * Please note we are not yet supported OBO tokens refreshed with long lived RT. User will have to send a new assertion if the current access token expires
       * This is to prevent security issues when the assertion changes over time, however, longlived RT helps retaining the session
       * @param request - developer provided CommonOnBehalfOfRequest
       */
      async getCachedAuthenticationResult(request) {
        const cachedAccessToken = this.readAccessTokenFromCacheForOBO(this.config.authOptions.clientId, request);
        if (!cachedAccessToken) {
          this.serverTelemetryManager?.setCacheOutcome(CacheOutcome.NO_CACHED_ACCESS_TOKEN);
          this.logger.info("SilentFlowClient:acquireCachedToken - No access token found in cache for the given properties.", request.correlationId);
          throw createClientAuthError(tokenRefreshRequired);
        } else if (isTokenExpired(cachedAccessToken.expiresOn, this.config.systemOptions.tokenRenewalOffsetSeconds)) {
          this.serverTelemetryManager?.setCacheOutcome(CacheOutcome.CACHED_ACCESS_TOKEN_EXPIRED);
          this.logger.info(`OnbehalfofFlow:getCachedAuthenticationResult - Cached access token is expired or will expire within ${this.config.systemOptions.tokenRenewalOffsetSeconds} seconds.`, request.correlationId);
          throw createClientAuthError(tokenRefreshRequired);
        }
        const cachedIdToken = this.readIdTokenFromCacheForOBO(cachedAccessToken.homeAccountId, request.correlationId);
        let idTokenClaims;
        let cachedAccount = null;
        if (cachedIdToken) {
          idTokenClaims = extractTokenClaims(cachedIdToken.secret, EncodingUtils.base64Decode);
          const localAccountId = idTokenClaims.oid || idTokenClaims.sub;
          const accountInfo = {
            homeAccountId: cachedIdToken.homeAccountId,
            environment: cachedIdToken.environment,
            tenantId: cachedIdToken.realm,
            username: "",
            localAccountId: localAccountId || ""
          };
          cachedAccount = this.cacheManager.getAccount(this.cacheManager.generateAccountKey(accountInfo), request.correlationId);
        }
        if (this.config.serverTelemetryManager) {
          this.config.serverTelemetryManager.incrementCacheHits();
        }
        return ResponseHandler.generateAuthenticationResult(this.cryptoUtils, this.authority, {
          account: cachedAccount,
          accessToken: cachedAccessToken,
          idToken: cachedIdToken,
          refreshToken: null,
          appMetadata: null
        }, true, request, this.performanceClient, idTokenClaims);
      }
      /**
       * read idtoken from cache, this is a specific implementation for OBO as the requirements differ from a generic lookup in the cacheManager
       * Certain use cases of OBO flow do not expect an idToken in the cache/or from the service
       * @param atHomeAccountId - account id
       */
      readIdTokenFromCacheForOBO(atHomeAccountId, correlationId) {
        const idTokenFilter = {
          homeAccountId: atHomeAccountId,
          environment: this.authority.canonicalAuthorityUrlComponents.HostNameAndPort,
          credentialType: CredentialType.ID_TOKEN,
          clientId: this.config.authOptions.clientId,
          realm: this.authority.tenant
        };
        const idTokenMap = this.cacheManager.getIdTokensByFilter(idTokenFilter, correlationId);
        if (Object.values(idTokenMap).length < 1) {
          return null;
        }
        return Object.values(idTokenMap)[0];
      }
      /**
       * Fetches the cached access token based on incoming assertion
       * @param clientId - client id
       * @param request - developer provided CommonOnBehalfOfRequest
       */
      readAccessTokenFromCacheForOBO(clientId, request) {
        const authScheme = request.authenticationScheme || AuthenticationScheme.BEARER;
        const credentialType = authScheme.toLowerCase() !== AuthenticationScheme.BEARER.toLowerCase() ? CredentialType.ACCESS_TOKEN_WITH_AUTH_SCHEME : CredentialType.ACCESS_TOKEN;
        const accessTokenFilter = {
          credentialType,
          clientId,
          target: ScopeSet.createSearchScopes(this.scopeSet.asArray()),
          tokenType: authScheme,
          keyId: request.sshKid,
          userAssertionHash: this.userAssertionHash
        };
        const accessTokens = this.cacheManager.getAccessTokensByFilter(accessTokenFilter, request.correlationId);
        const numAccessTokens = accessTokens.length;
        if (numAccessTokens < 1) {
          return null;
        } else if (numAccessTokens > 1) {
          throw createClientAuthError(multipleMatchingTokens);
        }
        return accessTokens[0];
      }
      /**
       * Make a network call to the server requesting credentials
       * @param request - developer provided CommonOnBehalfOfRequest
       * @param authority - authority object
       */
      async executeTokenRequest(request, authority, userAssertionHash) {
        const queryParametersString = this.createTokenQueryParameters(request);
        const endpoint = UrlString.appendQueryString(authority.tokenEndpoint, queryParametersString);
        const requestBody = await this.createTokenRequestBody(request);
        const headers = this.createTokenRequestHeaders();
        const thumbprint = {
          clientId: this.config.authOptions.clientId,
          authority: request.authority,
          scopes: request.scopes,
          claims: request.claims,
          authenticationScheme: request.authenticationScheme,
          resourceRequestMethod: request.resourceRequestMethod,
          resourceRequestUri: request.resourceRequestUri,
          shrClaims: request.shrClaims,
          sshKid: request.sshKid
        };
        const reqTimestamp = nowSeconds();
        const response = await this.executePostToTokenEndpoint(endpoint, requestBody, headers, thumbprint, request.correlationId);
        const responseHandler = new ResponseHandler(this.config.authOptions.clientId, this.cacheManager, this.cryptoUtils, this.logger, this.performanceClient, this.config.serializableCache, this.config.persistencePlugin);
        responseHandler.validateTokenResponse(response.body, request.correlationId);
        const tokenResponse = await responseHandler.handleServerTokenResponse(response.body, this.authority, reqTimestamp, request, ApiId.acquireTokenByOBO, void 0, userAssertionHash);
        return tokenResponse;
      }
      /**
       * generate a server request in accepable format
       * @param request - developer provided CommonOnBehalfOfRequest
       */
      async createTokenRequestBody(request) {
        const parameters = /* @__PURE__ */ new Map();
        addClientId(parameters, this.config.authOptions.clientId);
        addScopes(parameters, request.scopes);
        addGrantType(parameters, GrantType.JWT_BEARER);
        addClientInfo(parameters);
        addLibraryInfo(parameters, this.config.libraryInfo);
        addApplicationTelemetry(parameters, this.config.telemetry.application);
        addThrottling(parameters);
        if (this.serverTelemetryManager) {
          addServerTelemetry(parameters, this.serverTelemetryManager);
        }
        const correlationId = request.correlationId || this.config.cryptoInterface.createNewGuid();
        addCorrelationId(parameters, correlationId);
        addRequestTokenUse(parameters, ON_BEHALF_OF);
        addOboAssertion(parameters, request.oboAssertion);
        if (this.config.clientCredentials.clientSecret) {
          addClientSecret(parameters, this.config.clientCredentials.clientSecret);
        }
        const clientAssertion = this.config.clientCredentials.clientAssertion;
        if (clientAssertion) {
          addClientAssertion(parameters, await getClientAssertion(clientAssertion.assertion, this.config.authOptions.clientId, request.resourceRequestUri));
          addClientAssertionType(parameters, clientAssertion.assertionType);
        }
        if (request.claims || this.config.authOptions.clientCapabilities && this.config.authOptions.clientCapabilities.length > 0) {
          addClaims(parameters, request.claims, this.config.authOptions.clientCapabilities);
        }
        return mapToQueryString(parameters);
      }
    };
    var ConfidentialClientApplication = class extends ClientApplication {
      /**
       * Constructor for the ConfidentialClientApplication
       *
       * Required attributes in the Configuration object are:
       * - clientID: the application ID of your application. You can obtain one by registering your application with our application registration portal
       * - authority: the authority URL for your application.
       * - client credential: Must set either client secret, certificate, or assertion for confidential clients. You can obtain a client secret from the application registration portal.
       *
       * In Azure AD, authority is a URL indicating of the form https://login.microsoftonline.com/\{Enter_the_Tenant_Info_Here\}.
       * If your application supports Accounts in one organizational directory, replace "Enter_the_Tenant_Info_Here" value with the Tenant Id or Tenant name (for example, contoso.microsoft.com).
       * If your application supports Accounts in any organizational directory, replace "Enter_the_Tenant_Info_Here" value with organizations.
       * If your application supports Accounts in any organizational directory and personal Microsoft accounts, replace "Enter_the_Tenant_Info_Here" value with common.
       * To restrict support to Personal Microsoft accounts only, replace "Enter_the_Tenant_Info_Here" value with consumers.
       *
       * In Azure B2C, authority is of the form https://\{instance\}/tfp/\{tenant\}/\{policyName\}/
       * Full B2C functionality will be available in this library in future versions.
       *
       * @param Configuration - configuration object for the MSAL ConfidentialClientApplication instance
       */
      constructor(configuration) {
        super(configuration);
        const clientSecretNotEmpty = !!this.config.auth.clientSecret;
        const clientAssertionNotEmpty = !!this.config.auth.clientAssertion;
        const certificateNotEmpty = (!!this.config.auth.clientCertificate?.thumbprint || !!this.config.auth.clientCertificate?.thumbprintSha256) && !!this.config.auth.clientCertificate?.privateKey;
        if (this.appTokenProvider) {
          return;
        }
        if (clientSecretNotEmpty && clientAssertionNotEmpty || clientAssertionNotEmpty && certificateNotEmpty || clientSecretNotEmpty && certificateNotEmpty) {
          throw createClientAuthError(invalidClientCredential);
        }
        if (this.config.auth.clientSecret) {
          this.clientSecret = this.config.auth.clientSecret;
          return;
        }
        if (this.config.auth.clientAssertion) {
          this.developerProvidedClientAssertion = this.config.auth.clientAssertion;
          return;
        }
        if (!certificateNotEmpty) {
          throw createClientAuthError(invalidClientCredential);
        } else {
          this.clientAssertion = !!this.config.auth.clientCertificate.thumbprintSha256 ? ClientAssertion.fromCertificateWithSha256Thumbprint(this.config.auth.clientCertificate.thumbprintSha256, this.config.auth.clientCertificate.privateKey, this.config.auth.clientCertificate.x5c) : ClientAssertion.fromCertificate(
            // guaranteed to be a string, due to prior error checking in this function
            this.config.auth.clientCertificate.thumbprint,
            this.config.auth.clientCertificate.privateKey,
            this.config.auth.clientCertificate.x5c
          );
        }
        this.appTokenProvider = void 0;
      }
      /**
       * This extensibility point only works for the client_credential flow, i.e. acquireTokenByClientCredential and
       * is meant for Azure SDK to enhance Managed Identity support.
       *
       * @param IAppTokenProvider  - Extensibility interface, which allows the app developer to return a token from a custom source.
       */
      SetAppTokenProvider(provider) {
        this.appTokenProvider = provider;
      }
      /**
       * Acquires tokens from the authority for the application (not for an end user).
       */
      async acquireTokenByClientCredential(request) {
        this.logger.info("acquireTokenByClientCredential called", request.correlationId || "");
        let clientAssertion;
        if (request.clientAssertion) {
          clientAssertion = {
            assertion: await getClientAssertion(
              request.clientAssertion,
              this.config.auth.clientId
              // tokenEndpoint will be undefined. resourceRequestUri is omitted in ClientCredentialRequest
            ),
            assertionType: Constants.JWT_BEARER_ASSERTION_TYPE
          };
        }
        const baseRequest = await this.initializeBaseRequest(request);
        const validBaseRequest = {
          ...baseRequest,
          scopes: baseRequest.scopes.filter((scope) => !OIDC_DEFAULT_SCOPES.includes(scope))
        };
        const validRequest = {
          ...request,
          ...validBaseRequest,
          clientAssertion
        };
        const authority = new UrlString(validRequest.authority);
        const tenantId = authority.getUrlComponents().PathSegments[0];
        if (Object.values(AADAuthority).includes(tenantId)) {
          throw createClientAuthError(missingTenantIdError);
        }
        const ENV_MSAL_FORCE_REGION = process.env[MSAL_FORCE_REGION];
        let region;
        if (validRequest.azureRegion !== "DisableMsalForceRegion") {
          if (!validRequest.azureRegion && ENV_MSAL_FORCE_REGION) {
            region = ENV_MSAL_FORCE_REGION;
          } else {
            region = validRequest.azureRegion;
          }
        }
        const azureRegionConfiguration = {
          azureRegion: region,
          environmentRegion: process.env[REGION_ENVIRONMENT_VARIABLE]
        };
        const serverTelemetryManager = this.initializeServerTelemetryManager(ApiId.acquireTokenByClientCredential, validRequest.correlationId, validRequest.skipCache);
        try {
          const discoveredAuthority = await this.createAuthority(validRequest.authority, validRequest.correlationId, azureRegionConfiguration, request.azureCloudOptions);
          const clientCredentialConfig = await this.buildOauthClientConfiguration(discoveredAuthority, validRequest.correlationId, "", serverTelemetryManager);
          const clientCredentialClient = new ClientCredentialClient(clientCredentialConfig, this.appTokenProvider);
          this.logger.verbose("Client credential client created", validRequest.correlationId);
          return await clientCredentialClient.acquireToken(validRequest);
        } catch (e) {
          if (e instanceof AuthError) {
            e.setCorrelationId(validRequest.correlationId);
          }
          serverTelemetryManager.cacheFailedRequest(e);
          throw e;
        }
      }
      /**
       * Acquires tokens from the authority for the application.
       *
       * Used in scenarios where the current app is a middle-tier service which was called with a token
       * representing an end user. The current app can use the token (oboAssertion) to request another
       * token to access downstream web API, on behalf of that user.
       *
       * The current middle-tier app has no user interaction to obtain consent.
       * See how to gain consent upfront for your middle-tier app from this article.
       * https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-on-behalf-of-flow#gaining-consent-for-the-middle-tier-application
       */
      async acquireTokenOnBehalfOf(request) {
        this.logger.info("acquireTokenOnBehalfOf called", request.correlationId || "");
        const validRequest = {
          ...request,
          ...await this.initializeBaseRequest(request)
        };
        try {
          const discoveredAuthority = await this.createAuthority(validRequest.authority, validRequest.correlationId, void 0, request.azureCloudOptions);
          const onBehalfOfConfig = await this.buildOauthClientConfiguration(discoveredAuthority, validRequest.correlationId, "", void 0);
          const oboClient = new OnBehalfOfClient(onBehalfOfConfig);
          this.logger.verbose("On behalf of client created", validRequest.correlationId);
          return await oboClient.acquireToken(validRequest);
        } catch (e) {
          if (e instanceof AuthError) {
            e.setCorrelationId(validRequest.correlationId);
          }
          throw e;
        }
      }
    };
    function isIso8601(dateString) {
      if (typeof dateString !== "string") {
        return false;
      }
      const date = new Date(dateString);
      return !isNaN(date.getTime()) && date.toISOString() === dateString;
    }
    var HttpClientWithRetries = class {
      constructor(httpClientNoRetries, retryPolicy, logger) {
        this.httpClientNoRetries = httpClientNoRetries;
        this.retryPolicy = retryPolicy;
        this.logger = logger;
      }
      async sendNetworkRequestAsyncHelper(httpMethod, url, options) {
        if (httpMethod === HttpMethod.GET) {
          return this.httpClientNoRetries.sendGetRequestAsync(url, options);
        } else {
          return this.httpClientNoRetries.sendPostRequestAsync(url, options);
        }
      }
      async sendNetworkRequestAsync(httpMethod, url, options) {
        let response = await this.sendNetworkRequestAsyncHelper(httpMethod, url, options);
        if ("isNewRequest" in this.retryPolicy) {
          this.retryPolicy.isNewRequest = true;
        }
        let currentRetry = 0;
        while (await this.retryPolicy.pauseForRetry(response.status, currentRetry, this.logger, response.headers[HeaderNames.RETRY_AFTER])) {
          response = await this.sendNetworkRequestAsyncHelper(httpMethod, url, options);
          currentRetry++;
        }
        return response;
      }
      async sendGetRequestAsync(url, options) {
        return this.sendNetworkRequestAsync(HttpMethod.GET, url, options);
      }
      async sendPostRequestAsync(url, options) {
        return this.sendNetworkRequestAsync(HttpMethod.POST, url, options);
      }
    };
    var ManagedIdentityUserAssignedIdQueryParameterNames = {
      MANAGED_IDENTITY_CLIENT_ID_2017: "clientid",
      MANAGED_IDENTITY_CLIENT_ID: "client_id",
      MANAGED_IDENTITY_OBJECT_ID: "object_id",
      MANAGED_IDENTITY_RESOURCE_ID_IMDS: "msi_res_id",
      MANAGED_IDENTITY_RESOURCE_ID_NON_IMDS: "mi_res_id"
    };
    var BaseManagedIdentitySource = class {
      /**
       * Creates an instance of BaseManagedIdentitySource.
       *
       * @param logger - Logger instance for diagnostic information
       * @param nodeStorage - Storage interface for caching tokens
       * @param networkClient - Network client for making HTTP requests
       * @param cryptoProvider - Cryptographic provider for token operations
       * @param disableInternalRetries - Whether to disable automatic retry logic
       */
      constructor(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries) {
        this.logger = logger;
        this.nodeStorage = nodeStorage;
        this.networkClient = networkClient;
        this.cryptoProvider = cryptoProvider;
        this.disableInternalRetries = disableInternalRetries;
      }
      /**
       * Processes the network response and converts it to a standardized server token response.
       * This async version allows for source-specific response processing logic while maintaining
       * backward compatibility with the synchronous version.
       *
       * @param response - The network response containing the managed identity token
       * @param _networkClient - Network client used for the request (unused in base implementation)
       * @param _networkRequest - The original network request parameters (unused in base implementation)
       * @param _networkRequestOptions - The network request options (unused in base implementation)
       *
       * @returns Promise resolving to a standardized server authorization token response
       */
      async getServerTokenResponseAsync(response, _networkClient, _networkRequest, _networkRequestOptions) {
        return this.getServerTokenResponse(response);
      }
      /**
       * Converts a managed identity token response to a standardized server authorization token response.
       * Handles time format conversion, expiration calculation, and error mapping to ensure
       * compatibility with the MSAL response handling pipeline.
       *
       * @param response - The network response containing the managed identity token
       *
       * @returns Standardized server authorization token response with normalized fields
       */
      getServerTokenResponse(response) {
        let refreshIn, expiresIn;
        if (response.body.expires_on) {
          if (isIso8601(response.body.expires_on)) {
            response.body.expires_on = new Date(response.body.expires_on).getTime() / 1e3;
          }
          expiresIn = response.body.expires_on - nowSeconds();
          if (expiresIn > 2 * 3600) {
            refreshIn = expiresIn / 2;
          }
        }
        const serverTokenResponse = {
          status: response.status,
          // success
          access_token: response.body.access_token,
          expires_in: expiresIn,
          scope: response.body.resource,
          token_type: response.body.token_type,
          refresh_in: refreshIn,
          // error
          correlation_id: response.body.correlation_id || response.body.correlationId,
          error: typeof response.body.error === "string" ? response.body.error : response.body.error?.code,
          error_description: response.body.message || (typeof response.body.error === "string" ? response.body.error_description : response.body.error?.message),
          error_codes: response.body.error_codes,
          timestamp: response.body.timestamp,
          trace_id: response.body.trace_id
        };
        return serverTokenResponse;
      }
      /**
       * Acquires an access token using the managed identity endpoint for the specified resource.
       * This is the primary method for token acquisition, handling the complete flow from
       * request creation through response processing and token caching.
       *
       * @param managedIdentityRequest - The managed identity request containing resource and optional parameters
       * @param managedIdentityId - The managed identity configuration (system or user-assigned)
       * @param fakeAuthority - Authority instance used for token caching (managed identity uses a placeholder authority)
       * @param refreshAccessToken - Whether this is a token refresh operation
       *
       * @returns Promise resolving to an authentication result containing the access token and metadata
       *
       * @throws {AuthError} When network requests fail or token validation fails
       * @throws {ClientAuthError} When network errors occur during the request
       */
      async acquireTokenWithManagedIdentity(managedIdentityRequest, managedIdentityId, fakeAuthority, refreshAccessToken) {
        const networkRequest = this.createRequest(managedIdentityRequest.resource, managedIdentityId);
        if (managedIdentityRequest.revokedTokenSha256Hash) {
          this.logger.info(`[Managed Identity] The following claims are present in the request: ${managedIdentityRequest.claims}`, "");
          networkRequest.queryParameters[ManagedIdentityQueryParameters.SHA256_TOKEN_TO_REFRESH] = managedIdentityRequest.revokedTokenSha256Hash;
        }
        if (managedIdentityRequest.clientCapabilities?.length) {
          const clientCapabilities = managedIdentityRequest.clientCapabilities.toString();
          this.logger.info(`[Managed Identity] The following client capabilities are present in the request: ${clientCapabilities}`, "");
          networkRequest.queryParameters[ManagedIdentityQueryParameters.XMS_CC] = clientCapabilities;
        }
        const headers = networkRequest.headers;
        headers[HeaderNames.CONTENT_TYPE] = URL_FORM_CONTENT_TYPE;
        const networkRequestOptions = { headers };
        if (Object.keys(networkRequest.bodyParameters).length) {
          networkRequestOptions.body = networkRequest.computeParametersBodyString();
        }
        const networkClientHelper = this.disableInternalRetries ? this.networkClient : new HttpClientWithRetries(this.networkClient, networkRequest.retryPolicy, this.logger);
        const reqTimestamp = nowSeconds();
        let response;
        try {
          if (networkRequest.httpMethod === HttpMethod.POST) {
            response = await networkClientHelper.sendPostRequestAsync(networkRequest.computeUri(), networkRequestOptions);
          } else {
            response = await networkClientHelper.sendGetRequestAsync(networkRequest.computeUri(), networkRequestOptions);
          }
        } catch (error) {
          if (error instanceof AuthError) {
            throw error;
          } else {
            throw createClientAuthError(networkError);
          }
        }
        const responseHandler = new ResponseHandler(managedIdentityId.id, this.nodeStorage, this.cryptoProvider, this.logger, new StubPerformanceClient(), null, null);
        const serverTokenResponse = await this.getServerTokenResponseAsync(response, networkClientHelper, networkRequest, networkRequestOptions);
        responseHandler.validateTokenResponse(serverTokenResponse, serverTokenResponse.correlation_id || "", refreshAccessToken);
        return responseHandler.handleServerTokenResponse(serverTokenResponse, fakeAuthority, reqTimestamp, managedIdentityRequest, ApiId.acquireTokenWithManagedIdentity);
      }
      /**
       * Determines the appropriate query parameter name for user-assigned managed identity
       * based on the identity type, API version, and endpoint characteristics.
       * Different Azure services and API versions use different parameter names for the same identity types.
       *
       * @param managedIdentityIdType - The type of user-assigned managed identity (client ID, object ID, or resource ID)
       * @param isImds - Whether the request is being made to the IMDS (Instance Metadata Service) endpoint
       * @param usesApi2017 - Whether the endpoint uses the 2017-09-01 API version (affects client ID parameter name)
       *
       * @returns The correct query parameter name for the specified identity type and endpoint
       *
       * @throws {ManagedIdentityError} When an invalid managed identity ID type is provided
       */
      getManagedIdentityUserAssignedIdQueryParameterKey(managedIdentityIdType, isImds, usesApi2017) {
        switch (managedIdentityIdType) {
          case ManagedIdentityIdType.USER_ASSIGNED_CLIENT_ID:
            this.logger.info(`[Managed Identity] [API version ${usesApi2017 ? "2017+" : "2019+"}] Adding user assigned client id to the request.`, "");
            return usesApi2017 ? ManagedIdentityUserAssignedIdQueryParameterNames.MANAGED_IDENTITY_CLIENT_ID_2017 : ManagedIdentityUserAssignedIdQueryParameterNames.MANAGED_IDENTITY_CLIENT_ID;
          case ManagedIdentityIdType.USER_ASSIGNED_RESOURCE_ID:
            this.logger.info("[Managed Identity] Adding user assigned resource id to the request.", "");
            return isImds ? ManagedIdentityUserAssignedIdQueryParameterNames.MANAGED_IDENTITY_RESOURCE_ID_IMDS : ManagedIdentityUserAssignedIdQueryParameterNames.MANAGED_IDENTITY_RESOURCE_ID_NON_IMDS;
          case ManagedIdentityIdType.USER_ASSIGNED_OBJECT_ID:
            this.logger.info("[Managed Identity] Adding user assigned object id to the request.", "");
            return ManagedIdentityUserAssignedIdQueryParameterNames.MANAGED_IDENTITY_OBJECT_ID;
          default:
            throw createManagedIdentityError(invalidManagedIdentityIdType);
        }
      }
    };
    BaseManagedIdentitySource.getValidatedEnvVariableUrlString = (envVariableStringName, envVariable, sourceName, logger) => {
      try {
        return new UrlString(envVariable).urlString;
      } catch (error) {
        logger.info(`[Managed Identity] ${sourceName} managed identity is unavailable because the '${envVariableStringName}' environment variable is malformed.`, "");
        throw createManagedIdentityError(MsiEnvironmentVariableUrlMalformedErrorCodes[envVariableStringName]);
      }
    };
    var LinearRetryStrategy = class {
      /**
       * Calculates the number of milliseconds to sleep based on the `retry-after` HTTP header.
       *
       * @param retryHeader - The value of the `retry-after` HTTP header. This can be either a number of seconds
       *                      or an HTTP date string.
       * @returns The number of milliseconds to sleep before retrying the request. If the `retry-after` header is not
       *          present or cannot be parsed, returns 0.
       */
      calculateDelay(retryHeader, minimumDelay) {
        if (!retryHeader) {
          return minimumDelay;
        }
        let millisToSleep = Math.round(parseFloat(retryHeader) * 1e3);
        if (isNaN(millisToSleep)) {
          millisToSleep = new Date(retryHeader).valueOf() - (/* @__PURE__ */ new Date()).valueOf();
        }
        return Math.max(minimumDelay, millisToSleep);
      }
    };
    var DEFAULT_MANAGED_IDENTITY_MAX_RETRIES = 3;
    var DEFAULT_MANAGED_IDENTITY_RETRY_DELAY_MS = 1e3;
    var DEFAULT_MANAGED_IDENTITY_HTTP_STATUS_CODES_TO_RETRY_ON = [
      HTTP_NOT_FOUND,
      HTTP_REQUEST_TIMEOUT,
      HTTP_TOO_MANY_REQUESTS,
      HTTP_SERVER_ERROR,
      HTTP_SERVICE_UNAVAILABLE,
      HTTP_GATEWAY_TIMEOUT
    ];
    var DefaultManagedIdentityRetryPolicy = class _DefaultManagedIdentityRetryPolicy {
      constructor() {
        this.linearRetryStrategy = new LinearRetryStrategy();
      }
      /*
       * this is defined here as a static variable despite being defined as a constant outside of the
       * class because it needs to be overridden in the unit tests so that the unit tests run faster
       */
      static get DEFAULT_MANAGED_IDENTITY_RETRY_DELAY_MS() {
        return DEFAULT_MANAGED_IDENTITY_RETRY_DELAY_MS;
      }
      async pauseForRetry(httpStatusCode, currentRetry, logger, retryAfterHeader) {
        if (DEFAULT_MANAGED_IDENTITY_HTTP_STATUS_CODES_TO_RETRY_ON.includes(httpStatusCode) && currentRetry < DEFAULT_MANAGED_IDENTITY_MAX_RETRIES) {
          const retryAfterDelay = this.linearRetryStrategy.calculateDelay(retryAfterHeader, _DefaultManagedIdentityRetryPolicy.DEFAULT_MANAGED_IDENTITY_RETRY_DELAY_MS);
          logger.verbose(`Retrying request in ${retryAfterDelay}ms (retry attempt: ${currentRetry + 1})`, "");
          await new Promise((resolve) => {
            return setTimeout(resolve, retryAfterDelay);
          });
          return true;
        }
        return false;
      }
    };
    var ManagedIdentityRequestParameters = class {
      constructor(httpMethod, endpoint, retryPolicy) {
        this.httpMethod = httpMethod;
        this._baseEndpoint = endpoint;
        this.headers = {};
        this.bodyParameters = {};
        this.queryParameters = {};
        this.retryPolicy = retryPolicy || new DefaultManagedIdentityRetryPolicy();
      }
      computeUri() {
        const parameters = /* @__PURE__ */ new Map();
        if (this.queryParameters) {
          addExtraParameters(parameters, this.queryParameters);
        }
        const queryParametersString = mapToQueryString(parameters);
        return UrlString.appendQueryString(this._baseEndpoint, queryParametersString);
      }
      computeParametersBodyString() {
        const parameters = /* @__PURE__ */ new Map();
        if (this.bodyParameters) {
          addExtraParameters(parameters, this.bodyParameters);
        }
        return mapToQueryString(parameters);
      }
    };
    var APP_SERVICE_MSI_API_VERSION = "2019-08-01";
    var AppService = class _AppService extends BaseManagedIdentitySource {
      /**
       * Creates a new instance of the AppService managed identity source.
       *
       * @param logger - Logger instance for diagnostic output
       * @param nodeStorage - Node.js storage implementation for caching
       * @param networkClient - Network client for making HTTP requests
       * @param cryptoProvider - Cryptographic operations provider
       * @param disableInternalRetries - Whether to disable internal retry logic
       * @param identityEndpoint - The App Service identity endpoint URL
       * @param identityHeader - The secret header value required for authentication
       */
      constructor(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, identityEndpoint, identityHeader) {
        super(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries);
        this.identityEndpoint = identityEndpoint;
        this.identityHeader = identityHeader;
      }
      /**
       * Retrieves the required environment variables for App Service managed identity.
       *
       * App Service managed identity requires two environment variables:
       * - IDENTITY_ENDPOINT: The URL of the local metadata service
       * - IDENTITY_HEADER: A secret header value for authentication
       *
       * @returns An array containing [identityEndpoint, identityHeader] values from environment variables.
       *          Either value may be undefined if the environment variable is not set.
       */
      static getEnvironmentVariables() {
        const identityEndpoint = process.env[ManagedIdentityEnvironmentVariableNames.IDENTITY_ENDPOINT];
        const identityHeader = process.env[ManagedIdentityEnvironmentVariableNames.IDENTITY_HEADER];
        return [identityEndpoint, identityHeader];
      }
      /**
       * Attempts to create an AppService managed identity source if the environment supports it.
       *
       * This method checks for the presence of required environment variables and validates
       * the identity endpoint URL. If the environment is not suitable for App Service managed
       * identity (missing environment variables or invalid endpoint), it returns null.
       *
       * @param logger - Logger instance for diagnostic output
       * @param nodeStorage - Node.js storage implementation for caching
       * @param networkClient - Network client for making HTTP requests
       * @param cryptoProvider - Cryptographic operations provider
       * @param disableInternalRetries - Whether to disable internal retry logic
       *
       * @returns A new AppService instance if the environment is suitable, null otherwise
       */
      static tryCreate(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries) {
        const [identityEndpoint, identityHeader] = _AppService.getEnvironmentVariables();
        if (!identityEndpoint || !identityHeader) {
          logger.info(`[Managed Identity] ${ManagedIdentitySourceNames.APP_SERVICE} managed identity is unavailable because one or both of the '${ManagedIdentityEnvironmentVariableNames.IDENTITY_HEADER}' and '${ManagedIdentityEnvironmentVariableNames.IDENTITY_ENDPOINT}' environment variables are not defined.`, "");
          return null;
        }
        const validatedIdentityEndpoint = _AppService.getValidatedEnvVariableUrlString(ManagedIdentityEnvironmentVariableNames.IDENTITY_ENDPOINT, identityEndpoint, ManagedIdentitySourceNames.APP_SERVICE, logger);
        logger.info(`[Managed Identity] Environment variables validation passed for ${ManagedIdentitySourceNames.APP_SERVICE} managed identity. Endpoint URI: ${validatedIdentityEndpoint}. Creating ${ManagedIdentitySourceNames.APP_SERVICE} managed identity.`, "");
        return new _AppService(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, identityEndpoint, identityHeader);
      }
      /**
       * Creates a managed identity token request for the App Service environment.
       *
       * This method constructs an HTTP GET request to the App Service identity endpoint
       * with the required headers, query parameters, and managed identity configuration.
       * The request includes the secret header for authentication and appropriate API version.
       *
       * @param resource - The target resource/scope for which to request an access token (e.g., "https://graph.microsoft.com/.default")
       * @param managedIdentityId - The managed identity configuration specifying whether to use system-assigned or user-assigned identity
       *
       * @returns A configured ManagedIdentityRequestParameters object ready for network execution
       */
      createRequest(resource, managedIdentityId) {
        const request = new ManagedIdentityRequestParameters(HttpMethod.GET, this.identityEndpoint);
        request.headers[ManagedIdentityHeaders.APP_SERVICE_SECRET_HEADER_NAME] = this.identityHeader;
        request.queryParameters[ManagedIdentityQueryParameters.API_VERSION] = APP_SERVICE_MSI_API_VERSION;
        request.queryParameters[ManagedIdentityQueryParameters.RESOURCE] = resource;
        if (managedIdentityId.idType !== ManagedIdentityIdType.SYSTEM_ASSIGNED) {
          request.queryParameters[this.getManagedIdentityUserAssignedIdQueryParameterKey(managedIdentityId.idType)] = managedIdentityId.id;
        }
        return request;
      }
    };
    var ARC_API_VERSION = "2019-11-01";
    var DEFAULT_AZURE_ARC_IDENTITY_ENDPOINT = "http://127.0.0.1:40342/metadata/identity/oauth2/token";
    var HIMDS_EXECUTABLE_HELPER_STRING = "N/A: himds executable exists";
    var SUPPORTED_AZURE_ARC_PLATFORMS = {
      win32: `${process.env["ProgramData"]}\\AzureConnectedMachineAgent\\Tokens\\`,
      linux: "/var/opt/azcmagent/tokens/"
    };
    var AZURE_ARC_FILE_DETECTION = {
      win32: `${process.env["ProgramFiles"]}\\AzureConnectedMachineAgent\\himds.exe`,
      linux: "/opt/azcmagent/bin/himds"
    };
    var AzureArc = class _AzureArc extends BaseManagedIdentitySource {
      /**
       * Creates a new instance of the AzureArc managed identity source.
       *
       * @param logger - Logger instance for capturing telemetry and diagnostic information
       * @param nodeStorage - Storage implementation for caching tokens and metadata
       * @param networkClient - Network client for making HTTP requests to the identity endpoint
       * @param cryptoProvider - Cryptographic operations provider for token validation and encryption
       * @param disableInternalRetries - Flag to disable automatic retry logic for failed requests
       * @param identityEndpoint - The Azure Arc identity endpoint URL for token requests
       */
      constructor(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, identityEndpoint) {
        super(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries);
        this.identityEndpoint = identityEndpoint;
      }
      /**
       * Retrieves and validates Azure Arc environment variables for managed identity configuration.
       *
       * This method checks for IDENTITY_ENDPOINT and IMDS_ENDPOINT environment variables.
       * If either is missing, it attempts to detect the Azure Arc environment by checking for
       * the HIMDS executable at platform-specific paths. On successful detection, it returns
       * the default identity endpoint and a helper string indicating file-based detection.
       *
       * @returns An array containing [identityEndpoint, imdsEndpoint] where both values are
       *          strings if Azure Arc is available, or undefined if not available.
       */
      static getEnvironmentVariables() {
        let identityEndpoint = process.env[ManagedIdentityEnvironmentVariableNames.IDENTITY_ENDPOINT];
        let imdsEndpoint = process.env[ManagedIdentityEnvironmentVariableNames.IMDS_ENDPOINT];
        if (!identityEndpoint || !imdsEndpoint) {
          const fileDetectionPath = AZURE_ARC_FILE_DETECTION[process.platform];
          try {
            fs7.accessSync(fileDetectionPath, fs7.constants.F_OK | fs7.constants.R_OK);
            identityEndpoint = DEFAULT_AZURE_ARC_IDENTITY_ENDPOINT;
            imdsEndpoint = HIMDS_EXECUTABLE_HELPER_STRING;
          } catch (err) {
          }
        }
        return [identityEndpoint, imdsEndpoint];
      }
      /**
       * Attempts to create an AzureArc managed identity source instance.
       *
       * Validates the Azure Arc environment by checking environment variables
       * and performing file-based detection. It ensures that only system-assigned managed identities
       * are supported for Azure Arc scenarios. The method performs comprehensive validation of
       * endpoint URLs and logs detailed information about the detection process.
       *
       * @param logger - Logger instance for capturing creation and validation steps
       * @param nodeStorage - Storage implementation for the managed identity source
       * @param networkClient - Network client for HTTP communication
       * @param cryptoProvider - Cryptographic operations provider
       * @param disableInternalRetries - Whether to disable automatic retry mechanisms
       * @param managedIdentityId - The managed identity configuration, must be system-assigned
       *
       * @returns AzureArc instance if the environment supports Azure Arc managed identity, null otherwise
       *
       * @throws {ManagedIdentityError} When a user-assigned managed identity is specified (not supported for Azure Arc)
       */
      static tryCreate(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, managedIdentityId) {
        const [identityEndpoint, imdsEndpoint] = _AzureArc.getEnvironmentVariables();
        if (!identityEndpoint || !imdsEndpoint) {
          logger.info(`[Managed Identity] ${ManagedIdentitySourceNames.AZURE_ARC} managed identity is unavailable through environment variables because one or both of '${ManagedIdentityEnvironmentVariableNames.IDENTITY_ENDPOINT}' and '${ManagedIdentityEnvironmentVariableNames.IMDS_ENDPOINT}' are not defined. ${ManagedIdentitySourceNames.AZURE_ARC} managed identity is also unavailable through file detection.`, "");
          return null;
        }
        if (imdsEndpoint === HIMDS_EXECUTABLE_HELPER_STRING) {
          logger.info(`[Managed Identity] ${ManagedIdentitySourceNames.AZURE_ARC} managed identity is available through file detection. Defaulting to known ${ManagedIdentitySourceNames.AZURE_ARC} endpoint: ${DEFAULT_AZURE_ARC_IDENTITY_ENDPOINT}. Creating ${ManagedIdentitySourceNames.AZURE_ARC} managed identity.`, "");
        } else {
          const validatedIdentityEndpoint = _AzureArc.getValidatedEnvVariableUrlString(ManagedIdentityEnvironmentVariableNames.IDENTITY_ENDPOINT, identityEndpoint, ManagedIdentitySourceNames.AZURE_ARC, logger);
          validatedIdentityEndpoint.endsWith("/") ? validatedIdentityEndpoint.slice(0, -1) : validatedIdentityEndpoint;
          _AzureArc.getValidatedEnvVariableUrlString(ManagedIdentityEnvironmentVariableNames.IMDS_ENDPOINT, imdsEndpoint, ManagedIdentitySourceNames.AZURE_ARC, logger);
          logger.info(`[Managed Identity] Environment variables validation passed for ${ManagedIdentitySourceNames.AZURE_ARC} managed identity. Endpoint URI: ${validatedIdentityEndpoint}. Creating ${ManagedIdentitySourceNames.AZURE_ARC} managed identity.`, "");
        }
        if (managedIdentityId.idType !== ManagedIdentityIdType.SYSTEM_ASSIGNED) {
          throw createManagedIdentityError(unableToCreateAzureArc);
        }
        return new _AzureArc(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, identityEndpoint);
      }
      /**
       * Creates a properly formatted HTTP request for acquiring tokens from the Azure Arc identity endpoint.
       *
       * This method constructs a GET request to the Azure Arc HIMDS endpoint with the required metadata header
       * and query parameters. The endpoint URL is normalized to use 127.0.0.1 instead of localhost for
       * consistency. Additional body parameters are calculated by the base class during token acquisition.
       *
       * @param resource - The target resource/scope for which to request an access token (e.g., "https://graph.microsoft.com/.default")
       *
       * @returns A configured ManagedIdentityRequestParameters object ready for network execution
       */
      createRequest(resource) {
        const request = new ManagedIdentityRequestParameters(HttpMethod.GET, this.identityEndpoint.replace("localhost", "127.0.0.1"));
        request.headers[ManagedIdentityHeaders.METADATA_HEADER_NAME] = "true";
        request.queryParameters[ManagedIdentityQueryParameters.API_VERSION] = ARC_API_VERSION;
        request.queryParameters[ManagedIdentityQueryParameters.RESOURCE] = resource;
        return request;
      }
      /**
       * Processes the server response and handles Azure Arc-specific authentication challenges.
       *
       * This method implements the Azure Arc authentication flow which may require reading a secret file
       * for authorization. When the initial request returns HTTP 401 Unauthorized, it extracts the file
       * path from the WWW-Authenticate header, validates the file location and size, reads the secret,
       * and retries the request with Basic authentication. The method includes comprehensive security
       * validations to prevent path traversal and ensure file integrity.
       *
       * @param originalResponse - The initial HTTP response from the identity endpoint
       * @param networkClient - Network client for making the retry request if needed
       * @param networkRequest - The original request parameters (modified with auth header for retry)
       * @param networkRequestOptions - Additional options for network requests
       *
       * @returns A promise that resolves to the server token response with access token and metadata
       *
       * @throws {ManagedIdentityError} When:
       *   - WWW-Authenticate header is missing or has unsupported format
       *   - Platform is not supported (not Windows or Linux)
       *   - Secret file has invalid extension (not .key)
       *   - Secret file path doesn't match expected platform path
       *   - Secret file cannot be read or is too large (>4096 bytes)
       * @throws {ClientAuthError} When network errors occur during retry request
       */
      async getServerTokenResponseAsync(originalResponse, networkClient, networkRequest, networkRequestOptions) {
        let retryResponse;
        if (originalResponse.status === HTTP_UNAUTHORIZED) {
          const wwwAuthHeader = originalResponse.headers["www-authenticate"];
          if (!wwwAuthHeader) {
            throw createManagedIdentityError(wwwAuthenticateHeaderMissing);
          }
          if (!wwwAuthHeader.includes("Basic realm=")) {
            throw createManagedIdentityError(wwwAuthenticateHeaderUnsupportedFormat);
          }
          const secretFilePath = wwwAuthHeader.split("Basic realm=")[1];
          if (!SUPPORTED_AZURE_ARC_PLATFORMS.hasOwnProperty(process.platform)) {
            throw createManagedIdentityError(platformNotSupported);
          }
          const expectedSecretFilePath = SUPPORTED_AZURE_ARC_PLATFORMS[process.platform];
          const fileName = path3.basename(secretFilePath);
          if (!fileName.endsWith(".key")) {
            throw createManagedIdentityError(invalidFileExtension);
          }
          if (expectedSecretFilePath + fileName !== secretFilePath) {
            throw createManagedIdentityError(invalidFilePath);
          }
          let secretFileSize;
          try {
            secretFileSize = await fs7.statSync(secretFilePath).size;
          } catch (e) {
            throw createManagedIdentityError(unableToReadSecretFile);
          }
          if (secretFileSize > AZURE_ARC_SECRET_FILE_MAX_SIZE_BYTES) {
            throw createManagedIdentityError(invalidSecret);
          }
          let secret;
          try {
            secret = fs7.readFileSync(secretFilePath, EncodingTypes.UTF8);
          } catch (e) {
            throw createManagedIdentityError(unableToReadSecretFile);
          }
          const authHeaderValue = `Basic ${secret}`;
          this.logger.info(`[Managed Identity] Adding authorization header to the request.`, "");
          networkRequest.headers[ManagedIdentityHeaders.AUTHORIZATION_HEADER_NAME] = authHeaderValue;
          try {
            retryResponse = await networkClient.sendGetRequestAsync(networkRequest.computeUri(), networkRequestOptions);
          } catch (error) {
            if (error instanceof AuthError) {
              throw error;
            } else {
              throw createClientAuthError(networkError);
            }
          }
        }
        return this.getServerTokenResponse(retryResponse || originalResponse);
      }
    };
    var CloudShell = class _CloudShell extends BaseManagedIdentitySource {
      /**
       * Creates a new CloudShell managed identity source instance.
       *
       * @param logger - Logger instance for diagnostic logging
       * @param nodeStorage - Node.js storage implementation for caching
       * @param networkClient - HTTP client for making requests to the managed identity endpoint
       * @param cryptoProvider - Cryptographic operations provider
       * @param disableInternalRetries - Whether to disable automatic retry logic for failed requests
       * @param msiEndpoint - The MSI endpoint URL obtained from environment variables
       */
      constructor(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, msiEndpoint) {
        super(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries);
        this.msiEndpoint = msiEndpoint;
      }
      /**
       * Retrieves the required environment variables for Cloud Shell managed identity.
       *
       * Cloud Shell requires the MSI_ENDPOINT environment variable to be set, which
       * contains the URL of the managed identity service endpoint.
       *
       * @returns An array containing the MSI_ENDPOINT environment variable value (or undefined if not set)
       */
      static getEnvironmentVariables() {
        const msiEndpoint = process.env[ManagedIdentityEnvironmentVariableNames.MSI_ENDPOINT];
        return [msiEndpoint];
      }
      /**
       * Attempts to create a CloudShell managed identity source instance.
       *
       * This method validates that the required environment variables are present and
       * creates a CloudShell instance if the environment is properly configured.
       * Cloud Shell only supports system-assigned managed identities.
       *
       * @param logger - Logger instance for diagnostic logging
       * @param nodeStorage - Node.js storage implementation for caching
       * @param networkClient - HTTP client for making requests
       * @param cryptoProvider - Cryptographic operations provider
       * @param disableInternalRetries - Whether to disable automatic retry logic
       * @param managedIdentityId - The managed identity configuration (must be system-assigned)
       *
       * @returns A CloudShell instance if the environment is valid, null otherwise
       *
       * @throws {ManagedIdentityError} When a user-assigned managed identity is requested,
       *         as Cloud Shell only supports system-assigned identities
       */
      static tryCreate(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, managedIdentityId) {
        const [msiEndpoint] = _CloudShell.getEnvironmentVariables();
        if (!msiEndpoint) {
          logger.info(`[Managed Identity] ${ManagedIdentitySourceNames.CLOUD_SHELL} managed identity is unavailable because the '${ManagedIdentityEnvironmentVariableNames.MSI_ENDPOINT} environment variable is not defined.`, "");
          return null;
        }
        const validatedMsiEndpoint = _CloudShell.getValidatedEnvVariableUrlString(ManagedIdentityEnvironmentVariableNames.MSI_ENDPOINT, msiEndpoint, ManagedIdentitySourceNames.CLOUD_SHELL, logger);
        logger.info(`[Managed Identity] Environment variable validation passed for ${ManagedIdentitySourceNames.CLOUD_SHELL} managed identity. Endpoint URI: ${validatedMsiEndpoint}. Creating ${ManagedIdentitySourceNames.CLOUD_SHELL} managed identity.`, "");
        if (managedIdentityId.idType !== ManagedIdentityIdType.SYSTEM_ASSIGNED) {
          throw createManagedIdentityError(unableToCreateCloudShell);
        }
        return new _CloudShell(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, msiEndpoint);
      }
      /**
       * Creates an HTTP request to acquire an access token from the Cloud Shell managed identity endpoint.
       *
       * This method constructs a POST request to the MSI endpoint with the required headers and
       * body parameters for Cloud Shell authentication. The request includes the target resource
       * for which the access token is being requested.
       *
       * @param resource - The target resource/scope for which to request an access token (e.g., "https://graph.microsoft.com/.default")
       *
       * @returns A configured ManagedIdentityRequestParameters object ready for network execution
       */
      createRequest(resource) {
        const request = new ManagedIdentityRequestParameters(HttpMethod.POST, this.msiEndpoint);
        request.headers[ManagedIdentityHeaders.METADATA_HEADER_NAME] = "true";
        request.bodyParameters[ManagedIdentityQueryParameters.RESOURCE] = resource;
        return request;
      }
    };
    var ExponentialRetryStrategy = class {
      constructor(minExponentialBackoff, maxExponentialBackoff, exponentialDeltaBackoff) {
        this.minExponentialBackoff = minExponentialBackoff;
        this.maxExponentialBackoff = maxExponentialBackoff;
        this.exponentialDeltaBackoff = exponentialDeltaBackoff;
      }
      /**
       * Calculates the exponential delay based on the current retry attempt.
       *
       * @param {number} currentRetry - The current retry attempt number.
       * @returns {number} - The calculated exponential delay in milliseconds.
       *
       * The delay is calculated using the formula:
       * - If `currentRetry` is 0, it returns the minimum backoff time.
       * - Otherwise, it calculates the delay as the minimum of:
       *   - `(2^(currentRetry - 1)) * deltaBackoff`
       *   - `maxBackoff`
       *
       * This ensures that the delay increases exponentially with each retry attempt,
       * but does not exceed the maximum backoff time.
       */
      calculateDelay(currentRetry) {
        if (currentRetry === 0) {
          return this.minExponentialBackoff;
        }
        const exponentialDelay = Math.min(Math.pow(2, currentRetry - 1) * this.exponentialDeltaBackoff, this.maxExponentialBackoff);
        return exponentialDelay;
      }
    };
    var HTTP_STATUS_400_CODES_FOR_EXPONENTIAL_STRATEGY = [
      HTTP_NOT_FOUND,
      HTTP_REQUEST_TIMEOUT,
      HTTP_GONE,
      HTTP_TOO_MANY_REQUESTS
    ];
    var EXPONENTIAL_STRATEGY_NUM_RETRIES = 3;
    var LINEAR_STRATEGY_NUM_RETRIES = 7;
    var MIN_EXPONENTIAL_BACKOFF_MS = 1e3;
    var MAX_EXPONENTIAL_BACKOFF_MS = 4e3;
    var EXPONENTIAL_DELTA_BACKOFF_MS = 2e3;
    var HTTP_STATUS_GONE_RETRY_AFTER_MS = 10 * 1e3;
    var ImdsRetryPolicy = class _ImdsRetryPolicy {
      constructor() {
        this.exponentialRetryStrategy = new ExponentialRetryStrategy(_ImdsRetryPolicy.MIN_EXPONENTIAL_BACKOFF_MS, _ImdsRetryPolicy.MAX_EXPONENTIAL_BACKOFF_MS, _ImdsRetryPolicy.EXPONENTIAL_DELTA_BACKOFF_MS);
      }
      /*
       * these are defined here as static variables despite being defined as constants outside of the
       * class because they need to be overridden in the unit tests so that the unit tests run faster
       */
      static get MIN_EXPONENTIAL_BACKOFF_MS() {
        return MIN_EXPONENTIAL_BACKOFF_MS;
      }
      static get MAX_EXPONENTIAL_BACKOFF_MS() {
        return MAX_EXPONENTIAL_BACKOFF_MS;
      }
      static get EXPONENTIAL_DELTA_BACKOFF_MS() {
        return EXPONENTIAL_DELTA_BACKOFF_MS;
      }
      static get HTTP_STATUS_GONE_RETRY_AFTER_MS() {
        return HTTP_STATUS_GONE_RETRY_AFTER_MS;
      }
      set isNewRequest(value) {
        this._isNewRequest = value;
      }
      /**
       * Pauses execution for a calculated delay before retrying a request.
       *
       * @param httpStatusCode - The HTTP status code of the response.
       * @param currentRetry - The current retry attempt number.
       * @param retryAfterHeader - The value of the "retry-after" header from the response.
       * @returns A promise that resolves to a boolean indicating whether a retry should be attempted.
       */
      async pauseForRetry(httpStatusCode, currentRetry, logger) {
        if (this._isNewRequest) {
          this._isNewRequest = false;
          this.maxRetries = httpStatusCode === HTTP_GONE ? LINEAR_STRATEGY_NUM_RETRIES : EXPONENTIAL_STRATEGY_NUM_RETRIES;
        }
        if ((HTTP_STATUS_400_CODES_FOR_EXPONENTIAL_STRATEGY.includes(httpStatusCode) || httpStatusCode >= HTTP_SERVER_ERROR_RANGE_START && httpStatusCode <= HTTP_SERVER_ERROR_RANGE_END && currentRetry < this.maxRetries) && currentRetry < this.maxRetries) {
          const retryAfterDelay = httpStatusCode === HTTP_GONE ? _ImdsRetryPolicy.HTTP_STATUS_GONE_RETRY_AFTER_MS : this.exponentialRetryStrategy.calculateDelay(currentRetry);
          logger.verbose(`Retrying request in ${retryAfterDelay}ms (retry attempt: ${currentRetry + 1})`, "");
          await new Promise((resolve) => {
            return setTimeout(resolve, retryAfterDelay);
          });
          return true;
        }
        return false;
      }
    };
    var IMDS_TOKEN_PATH = "/metadata/identity/oauth2/token";
    var DEFAULT_IMDS_ENDPOINT = `http://169.254.169.254${IMDS_TOKEN_PATH}`;
    var IMDS_API_VERSION = "2018-02-01";
    var Imds = class _Imds extends BaseManagedIdentitySource {
      /**
       * Constructs an Imds instance with the specified configuration.
       *
       * @param logger - Logger instance for recording debug information and errors
       * @param nodeStorage - NodeStorage instance used for token caching operations
       * @param networkClient - Network client implementation for making HTTP requests to IMDS
       * @param cryptoProvider - CryptoProvider for generating correlation IDs and other cryptographic operations
       * @param disableInternalRetries - When true, disables the built-in retry logic for IMDS requests
       * @param identityEndpoint - The complete IMDS endpoint URL including the token path
       */
      constructor(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, identityEndpoint) {
        super(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries);
        this.identityEndpoint = identityEndpoint;
      }
      /**
       * Creates an Imds instance with the appropriate endpoint configuration.
       *
       * This method checks for the presence of the AZURE_POD_IDENTITY_AUTHORITY_HOST environment
       * variable, which is used in Azure Kubernetes Service (AKS) environments with Azure AD
       * Pod Identity. If found, it uses that endpoint; otherwise, it falls back to the standard
       * IMDS endpoint (169.254.169.254).
       *
       * @param logger - Logger instance for recording endpoint discovery and validation
       * @param nodeStorage - NodeStorage instance for token caching
       * @param networkClient - Network client for HTTP requests
       * @param cryptoProvider - CryptoProvider for cryptographic operations
       * @param disableInternalRetries - Whether to disable built-in retry logic
       *
       * @returns A configured Imds instance ready to make token requests
       */
      static tryCreate(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries) {
        let validatedIdentityEndpoint;
        if (process.env[ManagedIdentityEnvironmentVariableNames.AZURE_POD_IDENTITY_AUTHORITY_HOST]) {
          logger.info(`[Managed Identity] Environment variable ${ManagedIdentityEnvironmentVariableNames.AZURE_POD_IDENTITY_AUTHORITY_HOST} for ${ManagedIdentitySourceNames.IMDS} returned endpoint: ${process.env[ManagedIdentityEnvironmentVariableNames.AZURE_POD_IDENTITY_AUTHORITY_HOST]}`, "");
          validatedIdentityEndpoint = _Imds.getValidatedEnvVariableUrlString(ManagedIdentityEnvironmentVariableNames.AZURE_POD_IDENTITY_AUTHORITY_HOST, `${process.env[ManagedIdentityEnvironmentVariableNames.AZURE_POD_IDENTITY_AUTHORITY_HOST]}${IMDS_TOKEN_PATH}`, ManagedIdentitySourceNames.IMDS, logger);
        } else {
          logger.info(`[Managed Identity] Unable to find ${ManagedIdentityEnvironmentVariableNames.AZURE_POD_IDENTITY_AUTHORITY_HOST} environment variable for ${ManagedIdentitySourceNames.IMDS}, using the default endpoint.`, "");
          validatedIdentityEndpoint = DEFAULT_IMDS_ENDPOINT;
        }
        return new _Imds(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, validatedIdentityEndpoint);
      }
      /**
       * Creates a properly configured HTTP request for acquiring an access token from IMDS.
       *
       * This method builds a complete request object with all necessary headers, query parameters,
       * and retry policies required by the Azure Instance Metadata Service.
       *
       * Key request components:
       * - HTTP GET method to the IMDS token endpoint
       * - Metadata header set to "true" (required by IMDS)
       * - API version parameter (currently "2018-02-01")
       * - Resource parameter specifying the target audience
       * - Identity-specific parameters for user-assigned managed identities
       * - IMDS-specific retry policy
       *
       * @param resource - The target resource/scope for which to request an access token (e.g., "https://graph.microsoft.com/.default")
       * @param managedIdentityId - The managed identity configuration specifying whether to use system-assigned or user-assigned identity
       *
       * @returns A configured ManagedIdentityRequestParameters object ready for network execution
       */
      createRequest(resource, managedIdentityId) {
        const request = new ManagedIdentityRequestParameters(HttpMethod.GET, this.identityEndpoint);
        request.headers[ManagedIdentityHeaders.METADATA_HEADER_NAME] = "true";
        request.queryParameters[ManagedIdentityQueryParameters.API_VERSION] = IMDS_API_VERSION;
        request.queryParameters[ManagedIdentityQueryParameters.RESOURCE] = resource;
        if (managedIdentityId.idType !== ManagedIdentityIdType.SYSTEM_ASSIGNED) {
          request.queryParameters[this.getManagedIdentityUserAssignedIdQueryParameterKey(
            managedIdentityId.idType,
            true
            // indicates source is IMDS
          )] = managedIdentityId.id;
        }
        request.retryPolicy = new ImdsRetryPolicy();
        return request;
      }
    };
    var SERVICE_FABRIC_MSI_API_VERSION = "2019-07-01-preview";
    var ServiceFabric = class _ServiceFabric extends BaseManagedIdentitySource {
      /**
       * Constructs a new ServiceFabric managed identity source for acquiring tokens from Azure Service Fabric clusters.
       *
       * Service Fabric managed identity allows applications running in Service Fabric clusters to authenticate
       * without storing credentials in code. This source handles token acquisition using the Service Fabric
       * Managed Identity Token Service (MITS).
       *
       * @param logger - Logger instance for logging authentication events and debugging information
       * @param nodeStorage - NodeStorage instance for caching tokens and other authentication artifacts
       * @param networkClient - Network client for making HTTP requests to the Service Fabric identity endpoint
       * @param cryptoProvider - Crypto provider for cryptographic operations like token validation
       * @param disableInternalRetries - Whether to disable internal retry logic for failed requests
       * @param identityEndpoint - The Service Fabric managed identity endpoint URL
       * @param identityHeader - The Service Fabric managed identity secret header value
       */
      constructor(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, identityEndpoint, identityHeader) {
        super(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries);
        this.identityEndpoint = identityEndpoint;
        this.identityHeader = identityHeader;
      }
      /**
       * Retrieves the environment variables required for Service Fabric managed identity authentication.
       *
       * Service Fabric managed identity requires three specific environment variables to be set by the
       * Service Fabric runtime:
       * - IDENTITY_ENDPOINT: The endpoint URL for the Managed Identity Token Service (MITS)
       * - IDENTITY_HEADER: A secret value used for authentication with the MITS
       * - IDENTITY_SERVER_THUMBPRINT: The thumbprint of the MITS server certificate for secure communication
       *
       * @returns An array containing the identity endpoint, identity header, and identity server thumbprint values.
       *          Elements will be undefined if the corresponding environment variables are not set.
       */
      static getEnvironmentVariables() {
        const identityEndpoint = process.env[ManagedIdentityEnvironmentVariableNames.IDENTITY_ENDPOINT];
        const identityHeader = process.env[ManagedIdentityEnvironmentVariableNames.IDENTITY_HEADER];
        const identityServerThumbprint = process.env[ManagedIdentityEnvironmentVariableNames.IDENTITY_SERVER_THUMBPRINT];
        return [identityEndpoint, identityHeader, identityServerThumbprint];
      }
      /**
       * Attempts to create a ServiceFabric managed identity source if the runtime environment supports it.
       *
       * Checks for the presence of all required Service Fabric environment variables
       * and validates the endpoint URL format. It will only create a ServiceFabric instance if the application
       * is running in a properly configured Service Fabric cluster with managed identity enabled.
       *
       * Note: User-assigned managed identities must be configured at the cluster level, not at runtime.
       * This method will log a warning if a user-assigned identity is requested.
       *
       * @param logger - Logger instance for logging creation events and validation results
       * @param nodeStorage - NodeStorage instance for caching tokens and authentication artifacts
       * @param networkClient - Network client for making HTTP requests to the identity endpoint
       * @param cryptoProvider - Crypto provider for cryptographic operations
       * @param disableInternalRetries - Whether to disable internal retry logic for failed requests
       * @param managedIdentityId - Managed identity identifier specifying system-assigned or user-assigned identity
       *
       * @returns A ServiceFabric instance if all environment variables are valid and present, otherwise null
       */
      static tryCreate(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, managedIdentityId) {
        const [identityEndpoint, identityHeader, identityServerThumbprint] = _ServiceFabric.getEnvironmentVariables();
        if (!identityEndpoint || !identityHeader || !identityServerThumbprint) {
          logger.info(`[Managed Identity] ${ManagedIdentitySourceNames.SERVICE_FABRIC} managed identity is unavailable because one or all of the '${ManagedIdentityEnvironmentVariableNames.IDENTITY_HEADER}', '${ManagedIdentityEnvironmentVariableNames.IDENTITY_ENDPOINT}' or '${ManagedIdentityEnvironmentVariableNames.IDENTITY_SERVER_THUMBPRINT}' environment variables are not defined.`, "");
          return null;
        }
        const validatedIdentityEndpoint = _ServiceFabric.getValidatedEnvVariableUrlString(ManagedIdentityEnvironmentVariableNames.IDENTITY_ENDPOINT, identityEndpoint, ManagedIdentitySourceNames.SERVICE_FABRIC, logger);
        logger.info(`[Managed Identity] Environment variables validation passed for ${ManagedIdentitySourceNames.SERVICE_FABRIC} managed identity. Endpoint URI: ${validatedIdentityEndpoint}. Creating ${ManagedIdentitySourceNames.SERVICE_FABRIC} managed identity.`, "");
        if (managedIdentityId.idType !== ManagedIdentityIdType.SYSTEM_ASSIGNED) {
          logger.warning(`[Managed Identity] ${ManagedIdentitySourceNames.SERVICE_FABRIC} user assigned managed identity is configured in the cluster, not during runtime. See also: https://learn.microsoft.com/en-us/azure/service-fabric/configure-existing-cluster-enable-managed-identity-token-service.`, "");
        }
        return new _ServiceFabric(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, identityEndpoint, identityHeader);
      }
      /**
       * Creates HTTP request parameters for acquiring an access token from the Service Fabric Managed Identity Token Service (MITS).
       *
       * This method constructs a properly formatted HTTP GET request that includes:
       * - The secret header for authentication with MITS
       * - API version parameter for the Service Fabric MSI endpoint
       * - Resource parameter specifying the target Azure service
       * - Optional identity parameters for user-assigned managed identities
       *
       * The request follows the Service Fabric managed identity protocol and uses the 2019-07-01-preview API version.
       * For user-assigned identities, the appropriate query parameter (client_id, object_id, or resource_id) is added
       * based on the identity type.
       *
       * @param resource - The Azure resource URI for which the access token is requested (e.g., "https://vault.azure.net/")
       * @param managedIdentityId - The managed identity configuration specifying system-assigned or user-assigned identity details
       *
       * @returns A configured ManagedIdentityRequestParameters object ready for network execution
       */
      createRequest(resource, managedIdentityId) {
        const request = new ManagedIdentityRequestParameters(HttpMethod.GET, this.identityEndpoint);
        request.headers[ManagedIdentityHeaders.ML_AND_SF_SECRET_HEADER_NAME] = this.identityHeader;
        request.queryParameters[ManagedIdentityQueryParameters.API_VERSION] = SERVICE_FABRIC_MSI_API_VERSION;
        request.queryParameters[ManagedIdentityQueryParameters.RESOURCE] = resource;
        if (managedIdentityId.idType !== ManagedIdentityIdType.SYSTEM_ASSIGNED) {
          request.queryParameters[this.getManagedIdentityUserAssignedIdQueryParameterKey(managedIdentityId.idType)] = managedIdentityId.id;
        }
        return request;
      }
    };
    var MACHINE_LEARNING_MSI_API_VERSION = "2017-09-01";
    var MANAGED_IDENTITY_MACHINE_LEARNING_UNSUPPORTED_ID_TYPE_ERROR = `Only client id is supported for user-assigned managed identity in ${ManagedIdentitySourceNames.MACHINE_LEARNING}.`;
    var MachineLearning = class _MachineLearning extends BaseManagedIdentitySource {
      /**
       * Creates a new MachineLearning managed identity source instance.
       *
       * @param logger - Logger instance for diagnostic information
       * @param nodeStorage - Node storage implementation for caching
       * @param networkClient - Network client for making HTTP requests
       * @param cryptoProvider - Cryptographic operations provider
       * @param disableInternalRetries - Whether to disable automatic request retries
       * @param msiEndpoint - The MSI endpoint URL from environment variables
       * @param secret - The MSI secret from environment variables
       */
      constructor(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, msiEndpoint, secret) {
        super(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries);
        this.msiEndpoint = msiEndpoint;
        this.secret = secret;
      }
      /**
       * Retrieves the required environment variables for Azure Machine Learning managed identity.
       *
       * This method checks for the presence of MSI_ENDPOINT and MSI_SECRET environment variables
       * that are automatically set by the Azure Machine Learning platform when managed identity
       * is enabled for the compute instance or cluster.
       *
       * @returns An array containing [msiEndpoint, secret] where either value may be undefined
       *          if the corresponding environment variable is not set
       */
      static getEnvironmentVariables() {
        const msiEndpoint = process.env[ManagedIdentityEnvironmentVariableNames.MSI_ENDPOINT];
        const secret = process.env[ManagedIdentityEnvironmentVariableNames.MSI_SECRET];
        return [msiEndpoint, secret];
      }
      /**
       * Attempts to create a MachineLearning managed identity source.
       *
       * This method validates the Azure Machine Learning environment by checking for the required
       * MSI_ENDPOINT and MSI_SECRET environment variables. If both are present and valid,
       * it creates and returns a MachineLearning instance. If either is missing or invalid,
       * it returns null, indicating that this managed identity source is not available
       * in the current environment.
       *
       * @param logger - Logger instance for diagnostic information
       * @param nodeStorage - Node storage implementation for caching
       * @param networkClient - Network client for making HTTP requests
       * @param cryptoProvider - Cryptographic operations provider
       * @param disableInternalRetries - Whether to disable automatic request retries
       *
       * @returns A new MachineLearning instance if the environment is valid, null otherwise
       */
      static tryCreate(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries) {
        const [msiEndpoint, secret] = _MachineLearning.getEnvironmentVariables();
        if (!msiEndpoint || !secret) {
          logger.info(`[Managed Identity] ${ManagedIdentitySourceNames.MACHINE_LEARNING} managed identity is unavailable because one or both of the '${ManagedIdentityEnvironmentVariableNames.MSI_ENDPOINT}' and '${ManagedIdentityEnvironmentVariableNames.MSI_SECRET}' environment variables are not defined.`, "");
          return null;
        }
        const validatedMsiEndpoint = _MachineLearning.getValidatedEnvVariableUrlString(ManagedIdentityEnvironmentVariableNames.MSI_ENDPOINT, msiEndpoint, ManagedIdentitySourceNames.MACHINE_LEARNING, logger);
        logger.info(`[Managed Identity] Environment variables validation passed for ${ManagedIdentitySourceNames.MACHINE_LEARNING} managed identity. Endpoint URI: ${validatedMsiEndpoint}. Creating ${ManagedIdentitySourceNames.MACHINE_LEARNING} managed identity.`, "");
        return new _MachineLearning(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, msiEndpoint, secret);
      }
      /**
       * Creates a managed identity token request for Azure Machine Learning environments.
       *
       * This method constructs the HTTP request parameters needed to acquire an access token
       * from the Azure Machine Learning managed identity endpoint. It handles both system-assigned
       * and user-assigned managed identities with specific logic for each type:
       *
       * - System-assigned: Uses the DEFAULT_IDENTITY_CLIENT_ID environment variable
       * - User-assigned: Only supports client ID-based identification (not object ID or resource ID)
       *
       * The request uses the 2017-09-01 API version and includes the required secret header
       * for authentication with the MSI endpoint.
       *
       * @param resource - The target resource/scope for which to request an access token (e.g., "https://graph.microsoft.com/.default")
       * @param managedIdentityId - The managed identity configuration specifying whether to use system-assigned or user-assigned identity
       *
       * @returns A configured ManagedIdentityRequestParameters object ready for network execution
       *
       * @throws Error if an unsupported managed identity ID type is specified (only client ID is supported for user-assigned)
       */
      createRequest(resource, managedIdentityId) {
        const request = new ManagedIdentityRequestParameters(HttpMethod.GET, this.msiEndpoint);
        request.headers[ManagedIdentityHeaders.METADATA_HEADER_NAME] = "true";
        request.headers[ManagedIdentityHeaders.ML_AND_SF_SECRET_HEADER_NAME] = this.secret;
        request.queryParameters[ManagedIdentityQueryParameters.API_VERSION] = MACHINE_LEARNING_MSI_API_VERSION;
        request.queryParameters[ManagedIdentityQueryParameters.RESOURCE] = resource;
        if (managedIdentityId.idType === ManagedIdentityIdType.SYSTEM_ASSIGNED) {
          request.queryParameters[ManagedIdentityUserAssignedIdQueryParameterNames.MANAGED_IDENTITY_CLIENT_ID_2017] = process.env[ManagedIdentityEnvironmentVariableNames.DEFAULT_IDENTITY_CLIENT_ID];
        } else if (managedIdentityId.idType === ManagedIdentityIdType.USER_ASSIGNED_CLIENT_ID) {
          request.queryParameters[this.getManagedIdentityUserAssignedIdQueryParameterKey(
            managedIdentityId.idType,
            false,
            // isIMDS
            true
            // uses2017API
          )] = managedIdentityId.id;
        } else {
          throw new Error(MANAGED_IDENTITY_MACHINE_LEARNING_UNSUPPORTED_ID_TYPE_ERROR);
        }
        return request;
      }
    };
    var ManagedIdentityClient = class _ManagedIdentityClient {
      constructor(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries) {
        this.logger = logger;
        this.nodeStorage = nodeStorage;
        this.networkClient = networkClient;
        this.cryptoProvider = cryptoProvider;
        this.disableInternalRetries = disableInternalRetries;
      }
      async sendManagedIdentityTokenRequest(managedIdentityRequest, managedIdentityId, fakeAuthority, refreshAccessToken) {
        if (!_ManagedIdentityClient.identitySource) {
          _ManagedIdentityClient.identitySource = this.selectManagedIdentitySource(this.logger, this.nodeStorage, this.networkClient, this.cryptoProvider, this.disableInternalRetries, managedIdentityId);
        }
        return _ManagedIdentityClient.identitySource.acquireTokenWithManagedIdentity(managedIdentityRequest, managedIdentityId, fakeAuthority, refreshAccessToken);
      }
      allEnvironmentVariablesAreDefined(environmentVariables) {
        return Object.values(environmentVariables).every((environmentVariable) => {
          return environmentVariable !== void 0;
        });
      }
      /**
       * Determine the Managed Identity Source based on available environment variables. This API is consumed by ManagedIdentityApplication's getManagedIdentitySource.
       * @returns ManagedIdentitySourceNames - The Managed Identity source's name
       */
      getManagedIdentitySource() {
        _ManagedIdentityClient.sourceName = this.allEnvironmentVariablesAreDefined(ServiceFabric.getEnvironmentVariables()) ? ManagedIdentitySourceNames.SERVICE_FABRIC : this.allEnvironmentVariablesAreDefined(AppService.getEnvironmentVariables()) ? ManagedIdentitySourceNames.APP_SERVICE : this.allEnvironmentVariablesAreDefined(MachineLearning.getEnvironmentVariables()) ? ManagedIdentitySourceNames.MACHINE_LEARNING : this.allEnvironmentVariablesAreDefined(CloudShell.getEnvironmentVariables()) ? ManagedIdentitySourceNames.CLOUD_SHELL : this.allEnvironmentVariablesAreDefined(AzureArc.getEnvironmentVariables()) ? ManagedIdentitySourceNames.AZURE_ARC : ManagedIdentitySourceNames.DEFAULT_TO_IMDS;
        return _ManagedIdentityClient.sourceName;
      }
      /**
       * Tries to create a managed identity source for all sources
       * @returns the managed identity Source
       */
      selectManagedIdentitySource(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, managedIdentityId) {
        const source = ServiceFabric.tryCreate(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, managedIdentityId) || AppService.tryCreate(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries) || MachineLearning.tryCreate(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries) || CloudShell.tryCreate(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, managedIdentityId) || AzureArc.tryCreate(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, managedIdentityId) || Imds.tryCreate(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries);
        if (!source) {
          throw createManagedIdentityError(unableToCreateSource);
        }
        return source;
      }
    };
    var SOURCES_THAT_SUPPORT_TOKEN_REVOCATION = [ManagedIdentitySourceNames.SERVICE_FABRIC];
    var ManagedIdentityApplication = class _ManagedIdentityApplication {
      constructor(configuration) {
        this.config = buildManagedIdentityConfiguration(configuration || {});
        this.logger = new Logger(this.config.system.loggerOptions, name, version2);
        const fakeStatusAuthorityOptions = {
          canonicalAuthority: DEFAULT_AUTHORITY
        };
        if (!_ManagedIdentityApplication.nodeStorage) {
          _ManagedIdentityApplication.nodeStorage = new NodeStorage(this.logger, this.config.managedIdentityId.id, DEFAULT_CRYPTO_IMPLEMENTATION, fakeStatusAuthorityOptions);
        }
        this.networkClient = this.config.system.networkClient;
        this.cryptoProvider = new CryptoProvider();
        const fakeAuthorityOptions = {
          protocolMode: ProtocolMode.AAD,
          knownAuthorities: [DEFAULT_AUTHORITY_FOR_MANAGED_IDENTITY],
          cloudDiscoveryMetadata: "",
          authorityMetadata: ""
        };
        this.fakeAuthority = new Authority(
          DEFAULT_AUTHORITY_FOR_MANAGED_IDENTITY,
          this.networkClient,
          _ManagedIdentityApplication.nodeStorage,
          fakeAuthorityOptions,
          this.logger,
          this.cryptoProvider.createNewGuid(),
          // correlationID
          new StubPerformanceClient(),
          true
        );
        this.fakeClientCredentialClient = new ClientCredentialClient({
          authOptions: {
            clientId: this.config.managedIdentityId.id,
            authority: this.fakeAuthority
          }
        });
        this.managedIdentityClient = new ManagedIdentityClient(this.logger, _ManagedIdentityApplication.nodeStorage, this.networkClient, this.cryptoProvider, this.config.disableInternalRetries);
        this.hashUtils = new HashUtils();
      }
      /**
       * Acquire an access token from the cache or the managed identity
       * @param managedIdentityRequest - the ManagedIdentityRequestParams object passed in by the developer
       * @returns the access token
       */
      async acquireToken(managedIdentityRequestParams) {
        if (!managedIdentityRequestParams.resource) {
          throw createClientConfigurationError(urlEmptyError);
        }
        const managedIdentityRequest = {
          forceRefresh: managedIdentityRequestParams.forceRefresh,
          resource: managedIdentityRequestParams.resource.replace("/.default", ""),
          scopes: [
            managedIdentityRequestParams.resource.replace("/.default", "")
          ],
          authority: this.fakeAuthority.canonicalAuthority,
          correlationId: this.cryptoProvider.createNewGuid(),
          claims: managedIdentityRequestParams.claims,
          clientCapabilities: this.config.clientCapabilities
        };
        if (managedIdentityRequest.forceRefresh) {
          return this.acquireTokenFromManagedIdentity(managedIdentityRequest, this.config.managedIdentityId, this.fakeAuthority);
        }
        const [cachedAuthenticationResult, lastCacheOutcome] = await this.fakeClientCredentialClient.getCachedAuthenticationResult(managedIdentityRequest, this.config, this.cryptoProvider, this.fakeAuthority, _ManagedIdentityApplication.nodeStorage);
        if (managedIdentityRequest.claims) {
          const sourceName = this.managedIdentityClient.getManagedIdentitySource();
          if (cachedAuthenticationResult && SOURCES_THAT_SUPPORT_TOKEN_REVOCATION.includes(sourceName)) {
            const revokedTokenSha256Hash = this.hashUtils.sha256(cachedAuthenticationResult.accessToken).toString(EncodingTypes.HEX);
            managedIdentityRequest.revokedTokenSha256Hash = revokedTokenSha256Hash;
          }
          return this.acquireTokenFromManagedIdentity(managedIdentityRequest, this.config.managedIdentityId, this.fakeAuthority);
        }
        if (cachedAuthenticationResult) {
          if (lastCacheOutcome === CacheOutcome.PROACTIVELY_REFRESHED) {
            this.logger.info("ClientCredentialClient:getCachedAuthenticationResult - Cached access token's refreshOn property has been exceeded'. It's not expired, but must be refreshed.", managedIdentityRequest.correlationId);
            const refreshAccessToken = true;
            await this.acquireTokenFromManagedIdentity(managedIdentityRequest, this.config.managedIdentityId, this.fakeAuthority, refreshAccessToken);
          }
          return cachedAuthenticationResult;
        } else {
          return this.acquireTokenFromManagedIdentity(managedIdentityRequest, this.config.managedIdentityId, this.fakeAuthority);
        }
      }
      /**
       * Acquires a token from a managed identity endpoint.
       *
       * @param managedIdentityRequest - The request object containing parameters for the managed identity token request.
       * @param managedIdentityId - The identifier for the managed identity (e.g., client ID or resource ID).
       * @param fakeAuthority - A placeholder authority used for the token request.
       * @param refreshAccessToken - Optional flag indicating whether to force a refresh of the access token.
       * @returns A promise that resolves to an AuthenticationResult containing the acquired token and related information.
       */
      async acquireTokenFromManagedIdentity(managedIdentityRequest, managedIdentityId, fakeAuthority, refreshAccessToken) {
        return this.managedIdentityClient.sendManagedIdentityTokenRequest(managedIdentityRequest, managedIdentityId, fakeAuthority, refreshAccessToken);
      }
      /**
       * Determine the Managed Identity Source based on available environment variables. This API is consumed by Azure Identity SDK.
       * @returns ManagedIdentitySourceNames - The Managed Identity source's name
       */
      getManagedIdentitySource() {
        return ManagedIdentityClient.sourceName || this.managedIdentityClient.getManagedIdentitySource();
      }
    };
    var DistributedCachePlugin = class {
      constructor(client, partitionManager) {
        this.client = client;
        this.partitionManager = partitionManager;
      }
      /**
       * Deserializes the cache before accessing it
       * @param cacheContext - TokenCacheContext
       */
      async beforeCacheAccess(cacheContext) {
        const partitionKey = await this.partitionManager.getKey();
        const cacheData = await this.client.get(partitionKey);
        cacheContext.tokenCache.deserialize(cacheData);
      }
      /**
       * Serializes the cache after accessing it
       * @param cacheContext - TokenCacheContext
       */
      async afterCacheAccess(cacheContext) {
        if (cacheContext.cacheHasChanged) {
          const kvStore = cacheContext.tokenCache.getKVStore();
          const accountEntities = Object.values(kvStore).filter((value) => isAccountEntity(value));
          let partitionKey;
          if (accountEntities.length > 0) {
            const accountEntity = accountEntities[0];
            partitionKey = await this.partitionManager.extractKey(accountEntity);
          } else {
            partitionKey = await this.partitionManager.getKey();
          }
          await this.client.set(partitionKey, cacheContext.tokenCache.serialize());
        }
      }
    };
    var PromptValue = PromptValue$1;
    var ResponseMode = ResponseMode$1;
    exports2.AuthError = AuthError;
    exports2.AuthErrorCodes = AuthErrorCodes;
    exports2.AzureCloudInstance = AzureCloudInstance;
    exports2.ClientAssertion = ClientAssertion;
    exports2.ClientAuthError = ClientAuthError;
    exports2.ClientAuthErrorCodes = ClientAuthErrorCodes;
    exports2.ClientConfigurationError = ClientConfigurationError;
    exports2.ClientConfigurationErrorCodes = ClientConfigurationErrorCodes;
    exports2.ConfidentialClientApplication = ConfidentialClientApplication;
    exports2.CryptoProvider = CryptoProvider;
    exports2.DistributedCachePlugin = DistributedCachePlugin;
    exports2.InteractionRequiredAuthError = InteractionRequiredAuthError;
    exports2.InteractionRequiredAuthErrorCodes = InteractionRequiredAuthErrorCodes;
    exports2.Logger = Logger;
    exports2.ManagedIdentityApplication = ManagedIdentityApplication;
    exports2.ManagedIdentitySourceNames = ManagedIdentitySourceNames;
    exports2.PromptValue = PromptValue;
    exports2.ProtocolMode = ProtocolMode;
    exports2.PublicClientApplication = PublicClientApplication;
    exports2.ResponseMode = ResponseMode;
    exports2.ServerError = ServerError;
    exports2.TokenCache = TokenCache;
    exports2.TokenCacheContext = TokenCacheContext;
    exports2.internals = internals;
    exports2.version = version2;
  }
});

// node_modules/is-docker/index.js
function hasDockerEnv() {
  try {
    import_node_fs.default.statSync("/.dockerenv");
    return true;
  } catch {
    return false;
  }
}
function hasDockerCGroup() {
  try {
    return import_node_fs.default.readFileSync("/proc/self/cgroup", "utf8").includes("docker");
  } catch {
    return false;
  }
}
function isDocker() {
  if (isDockerCached === void 0) {
    isDockerCached = hasDockerEnv() || hasDockerCGroup();
  }
  return isDockerCached;
}
var import_node_fs, isDockerCached;
var init_is_docker = __esm({
  "node_modules/is-docker/index.js"() {
    import_node_fs = __toESM(require("node:fs"), 1);
  }
});

// node_modules/is-inside-container/index.js
function isInsideContainer() {
  if (cachedResult === void 0) {
    cachedResult = hasContainerEnv() || isDocker();
  }
  return cachedResult;
}
var import_node_fs2, cachedResult, hasContainerEnv;
var init_is_inside_container = __esm({
  "node_modules/is-inside-container/index.js"() {
    import_node_fs2 = __toESM(require("node:fs"), 1);
    init_is_docker();
    hasContainerEnv = () => {
      try {
        import_node_fs2.default.statSync("/run/.containerenv");
        return true;
      } catch {
        return false;
      }
    };
  }
});

// node_modules/is-wsl/index.js
var import_node_process, import_node_os, import_node_fs3, isWsl, is_wsl_default;
var init_is_wsl = __esm({
  "node_modules/is-wsl/index.js"() {
    import_node_process = __toESM(require("node:process"), 1);
    import_node_os = __toESM(require("node:os"), 1);
    import_node_fs3 = __toESM(require("node:fs"), 1);
    init_is_inside_container();
    isWsl = () => {
      if (import_node_process.default.platform !== "linux") {
        return false;
      }
      if (import_node_os.default.release().toLowerCase().includes("microsoft")) {
        if (isInsideContainer()) {
          return false;
        }
        return true;
      }
      try {
        if (import_node_fs3.default.readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft")) {
          return !isInsideContainer();
        }
      } catch {
      }
      if (import_node_fs3.default.existsSync("/proc/sys/fs/binfmt_misc/WSLInterop") || import_node_fs3.default.existsSync("/run/WSL")) {
        return !isInsideContainer();
      }
      return false;
    };
    is_wsl_default = import_node_process.default.env.__IS_WSL_TEST__ ? isWsl : isWsl();
  }
});

// node_modules/powershell-utils/index.js
var import_node_process2, import_node_buffer, import_node_util, import_node_child_process, execFile, powerShellPath, executePowerShell;
var init_powershell_utils = __esm({
  "node_modules/powershell-utils/index.js"() {
    import_node_process2 = __toESM(require("node:process"), 1);
    import_node_buffer = require("node:buffer");
    import_node_util = require("node:util");
    import_node_child_process = __toESM(require("node:child_process"), 1);
    execFile = (0, import_node_util.promisify)(import_node_child_process.default.execFile);
    powerShellPath = () => `${import_node_process2.default.env.SYSTEMROOT || import_node_process2.default.env.windir || String.raw`C:\Windows`}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
    executePowerShell = async (command, options = {}) => {
      const {
        powerShellPath: psPath,
        ...execFileOptions
      } = options;
      const encodedCommand = executePowerShell.encodeCommand(command);
      return execFile(
        psPath ?? powerShellPath(),
        [
          ...executePowerShell.argumentsPrefix,
          encodedCommand
        ],
        {
          encoding: "utf8",
          ...execFileOptions
        }
      );
    };
    executePowerShell.argumentsPrefix = [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-EncodedCommand"
    ];
    executePowerShell.encodeCommand = (command) => import_node_buffer.Buffer.from(command, "utf16le").toString("base64");
    executePowerShell.escapeArgument = (value) => `'${String(value).replaceAll("'", "''")}'`;
  }
});

// node_modules/wsl-utils/utilities.js
function parseMountPointFromConfig(content) {
  for (const line of content.split("\n")) {
    if (/^\s*#/.test(line)) {
      continue;
    }
    const match = /^\s*root\s*=\s*(?<mountPoint>"[^"]*"|'[^']*'|[^#]*)/.exec(line);
    if (!match) {
      continue;
    }
    return match.groups.mountPoint.trim().replaceAll(/^["']|["']$/g, "");
  }
}
var init_utilities = __esm({
  "node_modules/wsl-utils/utilities.js"() {
  }
});

// node_modules/wsl-utils/index.js
var import_node_util2, import_node_child_process2, import_promises, execFile2, wslDrivesMountPoint, powerShellPathFromWsl, powerShellPath2, canAccessPowerShellPromise, canAccessPowerShell, wslDefaultBrowser, convertWslPathToWindows;
var init_wsl_utils = __esm({
  "node_modules/wsl-utils/index.js"() {
    import_node_util2 = require("node:util");
    import_node_child_process2 = __toESM(require("node:child_process"), 1);
    import_promises = __toESM(require("node:fs/promises"), 1);
    init_is_wsl();
    init_powershell_utils();
    init_utilities();
    init_is_wsl();
    execFile2 = (0, import_node_util2.promisify)(import_node_child_process2.default.execFile);
    wslDrivesMountPoint = /* @__PURE__ */ (() => {
      const defaultMountPoint = "/mnt/";
      let mountPoint;
      return async function() {
        if (mountPoint) {
          return mountPoint;
        }
        const configFilePath = "/etc/wsl.conf";
        let isConfigFileExists = false;
        try {
          await import_promises.default.access(configFilePath, import_promises.constants.F_OK);
          isConfigFileExists = true;
        } catch {
        }
        if (!isConfigFileExists) {
          return defaultMountPoint;
        }
        const configContent = await import_promises.default.readFile(configFilePath, { encoding: "utf8" });
        const parsedMountPoint = parseMountPointFromConfig(configContent);
        if (parsedMountPoint === void 0) {
          return defaultMountPoint;
        }
        mountPoint = parsedMountPoint;
        mountPoint = mountPoint.endsWith("/") ? mountPoint : `${mountPoint}/`;
        return mountPoint;
      };
    })();
    powerShellPathFromWsl = async () => {
      const mountPoint = await wslDrivesMountPoint();
      return `${mountPoint}c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe`;
    };
    powerShellPath2 = is_wsl_default ? powerShellPathFromWsl : powerShellPath;
    canAccessPowerShell = async () => {
      canAccessPowerShellPromise ??= (async () => {
        try {
          const psPath = await powerShellPath2();
          await import_promises.default.access(psPath, import_promises.constants.X_OK);
          return true;
        } catch {
          return false;
        }
      })();
      return canAccessPowerShellPromise;
    };
    wslDefaultBrowser = async () => {
      const psPath = await powerShellPath2();
      const command = String.raw`(Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice").ProgId`;
      const { stdout } = await executePowerShell(command, { powerShellPath: psPath });
      return stdout.trim();
    };
    convertWslPathToWindows = async (path3) => {
      if (/^[a-z]+:\/\//i.test(path3)) {
        return path3;
      }
      try {
        const { stdout } = await execFile2("wslpath", ["-aw", path3], { encoding: "utf8" });
        return stdout.trim();
      } catch {
        return path3;
      }
    };
  }
});

// node_modules/define-lazy-prop/index.js
function defineLazyProperty(object, propertyName, valueGetter) {
  const define = (value) => Object.defineProperty(object, propertyName, { value, enumerable: true, writable: true });
  Object.defineProperty(object, propertyName, {
    configurable: true,
    enumerable: true,
    get() {
      const result = valueGetter();
      define(result);
      return result;
    },
    set(value) {
      define(value);
    }
  });
  return object;
}
var init_define_lazy_prop = __esm({
  "node_modules/define-lazy-prop/index.js"() {
  }
});

// node_modules/default-browser-id/index.js
async function defaultBrowserId() {
  if (import_node_process3.default.platform !== "darwin") {
    throw new Error("macOS only");
  }
  const { stdout } = await execFileAsync("defaults", ["read", "com.apple.LaunchServices/com.apple.launchservices.secure", "LSHandlers"]);
  const match = /LSHandlerRoleAll = "(?!-)(?<id>[^"]+?)";\s+?LSHandlerURLScheme = (?:http|https);/.exec(stdout);
  const browserId = match?.groups.id ?? "com.apple.Safari";
  if (browserId === "com.apple.safari") {
    return "com.apple.Safari";
  }
  return browserId;
}
var import_node_util3, import_node_process3, import_node_child_process3, execFileAsync;
var init_default_browser_id = __esm({
  "node_modules/default-browser-id/index.js"() {
    import_node_util3 = require("node:util");
    import_node_process3 = __toESM(require("node:process"), 1);
    import_node_child_process3 = require("node:child_process");
    execFileAsync = (0, import_node_util3.promisify)(import_node_child_process3.execFile);
  }
});

// node_modules/run-applescript/index.js
async function runAppleScript(script, { humanReadableOutput = true, signal } = {}) {
  if (import_node_process4.default.platform !== "darwin") {
    throw new Error("macOS only");
  }
  const outputArguments = humanReadableOutput ? [] : ["-ss"];
  const execOptions = {};
  if (signal) {
    execOptions.signal = signal;
  }
  const { stdout } = await execFileAsync2("osascript", ["-e", script, outputArguments], execOptions);
  return stdout.trim();
}
var import_node_process4, import_node_util4, import_node_child_process4, execFileAsync2;
var init_run_applescript = __esm({
  "node_modules/run-applescript/index.js"() {
    import_node_process4 = __toESM(require("node:process"), 1);
    import_node_util4 = require("node:util");
    import_node_child_process4 = require("node:child_process");
    execFileAsync2 = (0, import_node_util4.promisify)(import_node_child_process4.execFile);
  }
});

// node_modules/bundle-name/index.js
async function bundleName(bundleId) {
  return runAppleScript(`tell application "Finder" to set app_path to application file id "${bundleId}" as string
tell application "System Events" to get value of property list item "CFBundleName" of property list file (app_path & ":Contents:Info.plist")`);
}
var init_bundle_name = __esm({
  "node_modules/bundle-name/index.js"() {
    init_run_applescript();
  }
});

// node_modules/default-browser/windows.js
async function defaultBrowser(_execFileAsync = execFileAsync3) {
  const { stdout } = await _execFileAsync("reg", [
    "QUERY",
    " HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice",
    "/v",
    "ProgId"
  ]);
  const match = /ProgId\s*REG_SZ\s*(?<id>\S+)/.exec(stdout);
  if (!match) {
    throw new UnknownBrowserError(`Cannot find Windows browser in stdout: ${JSON.stringify(stdout)}`);
  }
  const { id } = match.groups;
  const dotIndex = id.lastIndexOf(".");
  const hyphenIndex = id.lastIndexOf("-");
  const baseIdByDot = dotIndex === -1 ? void 0 : id.slice(0, dotIndex);
  const baseIdByHyphen = hyphenIndex === -1 ? void 0 : id.slice(0, hyphenIndex);
  return windowsBrowserProgIds[id] ?? windowsBrowserProgIds[baseIdByDot] ?? windowsBrowserProgIds[baseIdByHyphen] ?? { name: id, id };
}
var import_node_util5, import_node_child_process5, execFileAsync3, windowsBrowserProgIds, _windowsBrowserProgIdMap, UnknownBrowserError;
var init_windows = __esm({
  "node_modules/default-browser/windows.js"() {
    import_node_util5 = require("node:util");
    import_node_child_process5 = require("node:child_process");
    execFileAsync3 = (0, import_node_util5.promisify)(import_node_child_process5.execFile);
    windowsBrowserProgIds = {
      MSEdgeHTM: { name: "Edge", id: "com.microsoft.edge" },
      // The missing `L` is correct.
      MSEdgeBHTML: { name: "Edge Beta", id: "com.microsoft.edge.beta" },
      MSEdgeDHTML: { name: "Edge Dev", id: "com.microsoft.edge.dev" },
      AppXq0fevzme2pys62n3e0fbqa7peapykr8v: { name: "Edge", id: "com.microsoft.edge.old" },
      ChromeHTML: { name: "Chrome", id: "com.google.chrome" },
      ChromeBHTML: { name: "Chrome Beta", id: "com.google.chrome.beta" },
      ChromeDHTML: { name: "Chrome Dev", id: "com.google.chrome.dev" },
      ChromiumHTM: { name: "Chromium", id: "org.chromium.Chromium" },
      BraveHTML: { name: "Brave", id: "com.brave.Browser" },
      BraveBHTML: { name: "Brave Beta", id: "com.brave.Browser.beta" },
      BraveDHTML: { name: "Brave Dev", id: "com.brave.Browser.dev" },
      BraveSSHTM: { name: "Brave Nightly", id: "com.brave.Browser.nightly" },
      FirefoxURL: { name: "Firefox", id: "org.mozilla.firefox" },
      OperaStable: { name: "Opera", id: "com.operasoftware.Opera" },
      VivaldiHTM: { name: "Vivaldi", id: "com.vivaldi.Vivaldi" },
      "IE.HTTP": { name: "Internet Explorer", id: "com.microsoft.ie" }
    };
    _windowsBrowserProgIdMap = new Map(Object.entries(windowsBrowserProgIds));
    UnknownBrowserError = class extends Error {
    };
  }
});

// node_modules/default-browser/index.js
async function defaultBrowser2() {
  if (import_node_process5.default.platform === "darwin") {
    const id = await defaultBrowserId();
    const name = await bundleName(id);
    return { name, id };
  }
  if (import_node_process5.default.platform === "linux") {
    const { stdout } = await execFileAsync4("xdg-mime", ["query", "default", "x-scheme-handler/http"]);
    const id = stdout.trim();
    const name = titleize(id.replace(/.desktop$/, "").replace("-", " "));
    return { name, id };
  }
  if (import_node_process5.default.platform === "win32") {
    return defaultBrowser();
  }
  throw new Error("Only macOS, Linux, and Windows are supported");
}
var import_node_util6, import_node_process5, import_node_child_process6, execFileAsync4, titleize;
var init_default_browser = __esm({
  "node_modules/default-browser/index.js"() {
    import_node_util6 = require("node:util");
    import_node_process5 = __toESM(require("node:process"), 1);
    import_node_child_process6 = require("node:child_process");
    init_default_browser_id();
    init_bundle_name();
    init_windows();
    init_windows();
    execFileAsync4 = (0, import_node_util6.promisify)(import_node_child_process6.execFile);
    titleize = (string) => string.toLowerCase().replaceAll(/(?:^|\s|-)\S/g, (x) => x.toUpperCase());
  }
});

// node_modules/is-in-ssh/index.js
var import_node_process6, isInSsh, is_in_ssh_default;
var init_is_in_ssh = __esm({
  "node_modules/is-in-ssh/index.js"() {
    import_node_process6 = __toESM(require("node:process"), 1);
    isInSsh = Boolean(import_node_process6.default.env.SSH_CONNECTION || import_node_process6.default.env.SSH_CLIENT || import_node_process6.default.env.SSH_TTY);
    is_in_ssh_default = isInSsh;
  }
});

// node_modules/open/index.js
var open_exports = {};
__export(open_exports, {
  apps: () => apps,
  default: () => open_default,
  openApp: () => openApp
});
function detectArchBinary(binary) {
  if (typeof binary === "string" || Array.isArray(binary)) {
    return binary;
  }
  const { [arch]: archBinary } = binary;
  if (!archBinary) {
    throw new Error(`${arch} is not supported`);
  }
  return archBinary;
}
function detectPlatformBinary({ [platform]: platformBinary }, { wsl } = {}) {
  if (wsl && is_wsl_default) {
    return detectArchBinary(wsl);
  }
  if (!platformBinary) {
    throw new Error(`${platform} is not supported`);
  }
  return detectArchBinary(platformBinary);
}
var import_node_process7, import_node_path, import_node_url, import_node_child_process7, import_promises2, import_meta, fallbackAttemptSymbol, __dirname, localXdgOpenPath, platform, arch, tryEachApp, baseOpen, open, openApp, apps, open_default;
var init_open = __esm({
  "node_modules/open/index.js"() {
    import_node_process7 = __toESM(require("node:process"), 1);
    import_node_path = __toESM(require("node:path"), 1);
    import_node_url = require("node:url");
    import_node_child_process7 = __toESM(require("node:child_process"), 1);
    import_promises2 = __toESM(require("node:fs/promises"), 1);
    init_wsl_utils();
    init_powershell_utils();
    init_define_lazy_prop();
    init_default_browser();
    init_is_inside_container();
    init_is_in_ssh();
    import_meta = {};
    fallbackAttemptSymbol = Symbol("fallbackAttempt");
    __dirname = import_meta.url ? import_node_path.default.dirname((0, import_node_url.fileURLToPath)(import_meta.url)) : "";
    localXdgOpenPath = import_node_path.default.join(__dirname, "xdg-open");
    ({ platform, arch } = import_node_process7.default);
    tryEachApp = async (apps2, opener) => {
      if (apps2.length === 0) {
        return;
      }
      const errors = [];
      for (const app of apps2) {
        try {
          return await opener(app);
        } catch (error) {
          errors.push(error);
        }
      }
      throw new AggregateError(errors, "Failed to open in all supported apps");
    };
    baseOpen = async (options) => {
      options = {
        wait: false,
        background: false,
        newInstance: false,
        allowNonzeroExitCode: false,
        ...options
      };
      const isFallbackAttempt = options[fallbackAttemptSymbol] === true;
      delete options[fallbackAttemptSymbol];
      if (Array.isArray(options.app)) {
        return tryEachApp(options.app, (singleApp) => baseOpen({
          ...options,
          app: singleApp,
          [fallbackAttemptSymbol]: true
        }));
      }
      let { name: app, arguments: appArguments = [] } = options.app ?? {};
      appArguments = [...appArguments];
      if (Array.isArray(app)) {
        return tryEachApp(app, (appName) => baseOpen({
          ...options,
          app: {
            name: appName,
            arguments: appArguments
          },
          [fallbackAttemptSymbol]: true
        }));
      }
      if (app === "browser" || app === "browserPrivate") {
        const ids = {
          "com.google.chrome": "chrome",
          "google-chrome.desktop": "chrome",
          "com.brave.browser": "brave",
          "org.mozilla.firefox": "firefox",
          "firefox.desktop": "firefox",
          "com.microsoft.msedge": "edge",
          "com.microsoft.edge": "edge",
          "com.microsoft.edgemac": "edge",
          "microsoft-edge.desktop": "edge",
          "com.apple.safari": "safari"
        };
        const flags = {
          chrome: "--incognito",
          brave: "--incognito",
          firefox: "--private-window",
          edge: "--inPrivate"
          // Safari doesn't support private mode via command line
        };
        let browser;
        if (is_wsl_default) {
          const progId = await wslDefaultBrowser();
          const browserInfo = _windowsBrowserProgIdMap.get(progId);
          browser = browserInfo ?? {};
        } else {
          browser = await defaultBrowser2();
        }
        if (browser.id in ids) {
          const browserName = ids[browser.id.toLowerCase()];
          if (app === "browserPrivate") {
            if (browserName === "safari") {
              throw new Error("Safari doesn't support opening in private mode via command line");
            }
            appArguments.push(flags[browserName]);
          }
          return baseOpen({
            ...options,
            app: {
              name: apps[browserName],
              arguments: appArguments
            }
          });
        }
        throw new Error(`${browser.name} is not supported as a default browser`);
      }
      let command;
      const cliArguments = [];
      const childProcessOptions = {};
      let shouldUseWindowsInWsl = false;
      if (is_wsl_default && !isInsideContainer() && !is_in_ssh_default && !app) {
        shouldUseWindowsInWsl = await canAccessPowerShell();
      }
      if (platform === "darwin") {
        command = "open";
        if (options.wait) {
          cliArguments.push("--wait-apps");
        }
        if (options.background) {
          cliArguments.push("--background");
        }
        if (options.newInstance) {
          cliArguments.push("--new");
        }
        if (app) {
          cliArguments.push("-a", app);
        }
      } else if (platform === "win32" || shouldUseWindowsInWsl) {
        command = await powerShellPath2();
        cliArguments.push(...executePowerShell.argumentsPrefix);
        if (!is_wsl_default) {
          childProcessOptions.windowsVerbatimArguments = true;
        }
        if (is_wsl_default && options.target) {
          options.target = await convertWslPathToWindows(options.target);
        }
        const encodedArguments = ["$ProgressPreference = 'SilentlyContinue';", "Start"];
        if (options.wait) {
          encodedArguments.push("-Wait");
        }
        if (app) {
          encodedArguments.push(executePowerShell.escapeArgument(app));
          if (options.target) {
            appArguments.push(options.target);
          }
        } else if (options.target) {
          encodedArguments.push(executePowerShell.escapeArgument(options.target));
        }
        if (appArguments.length > 0) {
          appArguments = appArguments.map((argument) => executePowerShell.escapeArgument(argument));
          encodedArguments.push("-ArgumentList", appArguments.join(","));
        }
        options.target = executePowerShell.encodeCommand(encodedArguments.join(" "));
        if (!options.wait) {
          childProcessOptions.stdio = "ignore";
        }
      } else {
        if (app) {
          command = app;
        } else {
          const isBundled = !__dirname || __dirname === "/";
          let exeLocalXdgOpen = false;
          try {
            await import_promises2.default.access(localXdgOpenPath, import_promises2.constants.X_OK);
            exeLocalXdgOpen = true;
          } catch {
          }
          const useSystemXdgOpen = import_node_process7.default.versions.electron ?? (platform === "android" || isBundled || !exeLocalXdgOpen);
          command = useSystemXdgOpen ? "xdg-open" : localXdgOpenPath;
        }
        if (appArguments.length > 0) {
          cliArguments.push(...appArguments);
        }
        if (!options.wait) {
          childProcessOptions.stdio = "ignore";
          childProcessOptions.detached = true;
        }
      }
      if (platform === "darwin" && appArguments.length > 0) {
        cliArguments.push("--args", ...appArguments);
      }
      if (options.target) {
        cliArguments.push(options.target);
      }
      const subprocess = import_node_child_process7.default.spawn(command, cliArguments, childProcessOptions);
      if (options.wait) {
        return new Promise((resolve, reject) => {
          subprocess.once("error", reject);
          subprocess.once("close", (exitCode) => {
            if (!options.allowNonzeroExitCode && exitCode !== 0) {
              reject(new Error(`Exited with code ${exitCode}`));
              return;
            }
            resolve(subprocess);
          });
        });
      }
      if (isFallbackAttempt) {
        return new Promise((resolve, reject) => {
          subprocess.once("error", reject);
          subprocess.once("spawn", () => {
            subprocess.once("close", (exitCode) => {
              subprocess.off("error", reject);
              if (exitCode !== 0) {
                reject(new Error(`Exited with code ${exitCode}`));
                return;
              }
              subprocess.unref();
              resolve(subprocess);
            });
          });
        });
      }
      subprocess.unref();
      return new Promise((resolve, reject) => {
        subprocess.once("error", reject);
        subprocess.once("spawn", () => {
          subprocess.off("error", reject);
          resolve(subprocess);
        });
      });
    };
    open = (target, options) => {
      if (typeof target !== "string") {
        throw new TypeError("Expected a `target`");
      }
      return baseOpen({
        ...options,
        target
      });
    };
    openApp = (name, options) => {
      if (typeof name !== "string" && !Array.isArray(name)) {
        throw new TypeError("Expected a valid `name`");
      }
      const { arguments: appArguments = [] } = options ?? {};
      if (appArguments !== void 0 && appArguments !== null && !Array.isArray(appArguments)) {
        throw new TypeError("Expected `appArguments` as Array type");
      }
      return baseOpen({
        ...options,
        app: {
          name,
          arguments: appArguments
        }
      });
    };
    apps = {
      browser: "browser",
      browserPrivate: "browserPrivate"
    };
    defineLazyProperty(apps, "chrome", () => detectPlatformBinary({
      darwin: "google chrome",
      win32: "chrome",
      // `chromium-browser` is the older deb package name used by Ubuntu/Debian before snap.
      linux: ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]
    }, {
      wsl: {
        ia32: "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe",
        x64: ["/mnt/c/Program Files/Google/Chrome/Application/chrome.exe", "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"]
      }
    }));
    defineLazyProperty(apps, "brave", () => detectPlatformBinary({
      darwin: "brave browser",
      win32: "brave",
      linux: ["brave-browser", "brave"]
    }, {
      wsl: {
        ia32: "/mnt/c/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe",
        x64: ["/mnt/c/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe", "/mnt/c/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe"]
      }
    }));
    defineLazyProperty(apps, "firefox", () => detectPlatformBinary({
      darwin: "firefox",
      win32: String.raw`C:\Program Files\Mozilla Firefox\firefox.exe`,
      linux: "firefox"
    }, {
      wsl: "/mnt/c/Program Files/Mozilla Firefox/firefox.exe"
    }));
    defineLazyProperty(apps, "edge", () => detectPlatformBinary({
      darwin: "microsoft edge",
      win32: "msedge",
      linux: ["microsoft-edge", "microsoft-edge-dev"]
    }, {
      wsl: "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
    }));
    defineLazyProperty(apps, "safari", () => detectPlatformBinary({
      darwin: "Safari"
    }));
    open_default = open;
  }
});

// src/shared-auth.js
var require_shared_auth = __commonJS({
  "src/shared-auth.js"(exports2, module2) {
    var { log: log2 } = require_shared_utils();
    var { createCachePlugin } = require_msal_cache();
    var VSCODE_CLIENT_ID2 = "51f81489-12ee-4a9e-aaae-a2591f45987d";
    var ISLAND_RESOURCE_IDS = {
      0: "a522f059-bb65-47c0-8934-7db6e5286414",
      1: "a522f059-bb65-47c0-8934-7db6e5286414",
      2: "a522f059-bb65-47c0-8934-7db6e5286414",
      3: "a522f059-bb65-47c0-8934-7db6e5286414",
      4: "96ff4394-9197-43aa-b393-6a41652e21f8",
      5: "96ff4394-9197-43aa-b393-6a41652e21f8",
      6: "9315aedd-209b-43b3-b149-2abff6a95d59",
      7: "69c6e40c-465f-4154-987d-da5cba10734e",
      8: "bd4a9f18-e349-4c74-a6b7-65dd465ea9ab"
    };
    function getIslandResourceId(clusterCategory) {
      const id = ISLAND_RESOURCE_IDS[clusterCategory];
      if (!id) throw new Error(`Unknown cluster category: ${clusterCategory}`);
      return id;
    }
    var _cachePlugin = null;
    var _msalApps = /* @__PURE__ */ new Map();
    async function getDefaultCachePlugin() {
      if (!_cachePlugin) {
        _cachePlugin = await createCachePlugin("manage-agent");
      }
      return _cachePlugin;
    }
    async function createMsalApp(tenantId, clientId, cacheSlot) {
      const msal = require_msal_node();
      if (cacheSlot) {
        const plugin = await createCachePlugin(cacheSlot);
        return new msal.PublicClientApplication({
          auth: {
            clientId,
            authority: `https://login.microsoftonline.com/${tenantId}`
          },
          cache: { cachePlugin: plugin }
        });
      }
      const key = `${tenantId}:${clientId}`;
      if (_msalApps.has(key)) return _msalApps.get(key);
      const cachePlugin = await getDefaultCachePlugin();
      const app = new msal.PublicClientApplication({
        auth: {
          clientId,
          authority: `https://login.microsoftonline.com/${tenantId}`
        },
        cache: { cachePlugin }
      });
      _msalApps.set(key, app);
      return app;
    }
    function buildTokenInfo(result) {
      return {
        accessToken: result.accessToken,
        expiresOn: result.expiresOn ? result.expiresOn.toISOString() : new Date(Date.now() + 3600 * 1e3).toISOString(),
        scopes: result.scopes,
        account: result.account ? {
          homeAccountId: result.account.homeAccountId,
          environment: result.account.environment,
          tenantId: result.account.tenantId,
          username: result.account.username
        } : void 0
      };
    }
    async function acquireTokenDeviceCode2(tenantId, clientId, scopes, cacheSlot) {
      const app = await createMsalApp(tenantId, clientId, cacheSlot);
      const result = await app.acquireTokenByDeviceCode({
        scopes,
        deviceCodeCallback: (response) => {
          log2("");
          log2(`  ${response.message}`);
          log2("");
          process.stdout.write(
            JSON.stringify({
              status: "device_code",
              userCode: response.userCode,
              verificationUri: response.verificationUri,
              message: response.message,
              expiresIn: response.expiresIn
            }) + "\n"
          );
        }
      });
      if (!result) throw new Error("Device code flow returned no result");
      return buildTokenInfo(result);
    }
    async function acquireTokenInteractive(tenantId, clientId, scopes, cacheSlot) {
      const app = await createMsalApp(tenantId, clientId, cacheSlot);
      const result = await app.acquireTokenInteractive({
        scopes,
        openBrowser: async (url) => {
          log2("");
          log2(`  Open this URL to sign in: ${url}`);
          log2("");
          const open2 = (await Promise.resolve().then(() => (init_open(), open_exports))).default;
          await open2(url);
        },
        successTemplate: "<html><body><h1>Login successful. You can close this tab.</h1></body></html>"
      });
      if (!result) throw new Error("Interactive flow returned no result");
      return buildTokenInfo(result);
    }
    async function acquireTokenSilent2(tenantId, clientId, scopes, cacheSlot) {
      const app = await createMsalApp(tenantId, clientId, cacheSlot);
      const allAccounts = await app.getTokenCache().getAllAccounts();
      const accounts = allAccounts.filter((a) => a.tenantId === tenantId);
      if (accounts.length > 0) {
        try {
          const result = await app.acquireTokenSilent({
            scopes,
            account: accounts[0]
          });
          if (result) {
            const scopeKey = scopes[0];
            log2(`${scopeKey}: silently refreshed (expires ${result.expiresOn?.toISOString()})`);
            return buildTokenInfo(result);
          }
        } catch (e) {
          log2(`Silent refresh failed: ${e.message}`);
        }
      }
      return null;
    }
    async function getOrAcquireToken2(tenantId, clientId, scopes, label, cacheSlot) {
      const silent = await acquireTokenSilent2(tenantId, clientId, scopes, cacheSlot);
      if (silent) {
        log2(`${label}: using cached token (expires ${silent.expiresOn})`);
        return silent;
      }
      log2(`${label}: starting interactive login...`);
      return acquireTokenInteractive(tenantId, clientId, scopes, cacheSlot);
    }
    async function getOrAcquireIslandToken(tenantId, clusterCategory, label) {
      const resourceId = getIslandResourceId(clusterCategory);
      return getOrAcquireToken2(
        tenantId,
        VSCODE_CLIENT_ID2,
        [`api://${resourceId}/.default`],
        label
      );
    }
    module2.exports = {
      VSCODE_CLIENT_ID: VSCODE_CLIENT_ID2,
      ISLAND_RESOURCE_IDS,
      getIslandResourceId,
      createMsalApp,
      buildTokenInfo,
      acquireTokenDeviceCode: acquireTokenDeviceCode2,
      acquireTokenInteractive,
      acquireTokenSilent: acquireTokenSilent2,
      getOrAcquireToken: getOrAcquireToken2,
      getOrAcquireIslandToken
    };
  }
});

// src/eval-api.js
var fs6 = require("fs");
var path2 = require("path");
var { log, die } = require_shared_utils();
var {
  VSCODE_CLIENT_ID,
  acquireTokenSilent,
  acquireTokenDeviceCode,
  getOrAcquireToken
} = require_shared_auth();
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    command: null,
    workspace: null,
    environmentId: null,
    agentId: null,
    tenantId: null,
    clientId: null,
    testsetId: null,
    runId: null,
    published: false,
    runName: null
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--workspace":
        parsed.workspace = args[++i];
        break;
      case "--environment-id":
        parsed.environmentId = args[++i];
        break;
      case "--agent-id":
        parsed.agentId = args[++i];
        break;
      case "--tenant-id":
        parsed.tenantId = args[++i];
        break;
      case "--client-id":
        parsed.clientId = args[++i];
        break;
      case "--testset-id":
        parsed.testsetId = args[++i];
        break;
      case "--run-id":
        parsed.runId = args[++i];
        break;
      case "--published":
        parsed.published = true;
        break;
      case "--run-name":
        parsed.runName = args[++i];
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
      "Usage: eval-api <command> [options]\nCommands: list-testsets, start-run, get-run, get-results, list-runs"
    );
  }
  return parsed;
}
function findConnJson(startDir) {
  const resolvedStart = path2.resolve(startDir || process.cwd());
  const direct = path2.join(resolvedStart, ".mcs", "conn.json");
  if (fs6.existsSync(direct)) return direct;
  function search(dir, depth) {
    if (depth > 5) return null;
    let entries;
    try {
      entries = fs6.readdirSync(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      if (entry.isDirectory()) {
        const connPath = path2.join(dir, entry.name, ".mcs", "conn.json");
        if (fs6.existsSync(connPath)) return connPath;
        const deeper = search(path2.join(dir, entry.name), depth + 1);
        if (deeper) return deeper;
      }
    }
    return null;
  }
  return search(resolvedStart, 0);
}
function loadConfig(args) {
  let environmentId = args.environmentId;
  let agentId = args.agentId;
  let tenantId = args.tenantId;
  if (!environmentId || !agentId || !tenantId) {
    const connPath = findConnJson(args.workspace);
    if (connPath) {
      try {
        const conn = JSON.parse(fs6.readFileSync(connPath, "utf8"));
        log(`Found ${connPath}`);
        if (!environmentId) environmentId = conn.EnvironmentId;
        if (!agentId) agentId = conn.AgentId;
        if (!tenantId) tenantId = conn.AccountInfo?.TenantId;
      } catch (e) {
        log(`Warning: Could not parse conn.json: ${e.message}`);
      }
    }
  }
  if (!environmentId) die("Cannot determine environment ID. Provide --environment-id or --workspace with .mcs/conn.json.");
  if (!agentId) die("Cannot determine agent ID. Provide --agent-id or --workspace with .mcs/conn.json.");
  if (!tenantId) die("Cannot determine tenant ID. Provide --tenant-id or --workspace with .mcs/conn.json.");
  return { environmentId, agentId, tenantId, clientId: args.clientId };
}
var PP_API_SCOPE = "https://api.powerplatform.com/.default";
async function getToken(config) {
  const clientId = config.clientId || VSCODE_CLIENT_ID;
  const silent = await acquireTokenSilent(config.tenantId, clientId, [PP_API_SCOPE]);
  if (silent) {
    log(`Using cached Power Platform API token (expires ${silent.expiresOn})`);
    return silent.accessToken;
  }
  if (config.clientId) {
    log("No cached token \u2014 starting device code authentication...");
    const token2 = await acquireTokenDeviceCode(config.tenantId, clientId, [PP_API_SCOPE]);
    return token2.accessToken;
  }
  log("No cached token \u2014 starting interactive login...");
  const token = await getOrAcquireToken(
    config.tenantId,
    VSCODE_CLIENT_ID,
    [PP_API_SCOPE],
    "Power Platform API"
  );
  return token.accessToken;
}
var PP_API_VERSION = "2024-10-01";
function buildBaseUrl(environmentId, agentId) {
  return `https://api.powerplatform.com/copilotstudio/environments/${environmentId}/bots/${agentId}/api/makerevaluation`;
}
function withApiVersion(url) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}api-version=${PP_API_VERSION}`;
}
async function ppApiRequest(method, url, body, accessToken) {
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    signal: AbortSignal.timeout(3e4)
  };
  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  if (res.status === 401 || res.status === 403) {
    const errBody = await res.text().catch(() => "");
    die(`Authentication failed (HTTP ${res.status}). Re-run 'manage-agent auth' to refresh tokens.
${errBody.substring(0, 300)}`);
  }
  if (res.status === 409) {
    const errBody = await res.text().catch(() => "");
    die(`Conflict (HTTP 409): A run is already in progress for this bot. Use 'get-run' with the existing runId, or wait for it to complete.
${errBody.substring(0, 300)}`);
  }
  if (res.status === 429) {
    const errBody = await res.text().catch(() => "");
    die(`Rate limited (HTTP 429): Maximum 20 evaluation runs per bot per 24 hours.
${errBody.substring(0, 300)}`);
  }
  if (res.status === 404) {
    const errBody = await res.text().catch(() => "");
    die(`Not found (HTTP 404). Verify the environment ID, agent ID, and resource IDs are correct.
${errBody.substring(0, 300)}`);
  }
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    die(`HTTP ${res.status}: ${errBody.substring(0, 500)}`);
  }
  const text = await res.text();
  if (!text.trim()) return null;
  return JSON.parse(text);
}
async function cmdListTestsets(config, accessToken) {
  const url = withApiVersion(`${buildBaseUrl(config.environmentId, config.agentId)}/testsets`);
  log(`GET ${url}`);
  const data = await ppApiRequest("GET", url, null, accessToken);
  const testsets = data && data.value || [];
  process.stdout.write(JSON.stringify({
    status: "ok",
    testsets: testsets.map((ts) => ({
      id: ts.id,
      displayName: ts.displayName,
      description: ts.description || null,
      state: ts.state,
      totalTestCases: ts.totalTestCases
    }))
  }, null, 2) + "\n");
}
async function cmdStartRun(config, accessToken, args) {
  if (!args.testsetId) die("--testset-id is required for start-run.");
  const url = withApiVersion(`${buildBaseUrl(config.environmentId, config.agentId)}/testsets/${args.testsetId}/run`);
  const body = {
    runOnPublishedBot: args.published
  };
  if (args.runName) {
    body.evaluationRunName = args.runName;
  }
  log(`POST ${url}`);
  log(`  runOnPublishedBot: ${args.published}`);
  if (args.runName) log(`  evaluationRunName: ${args.runName}`);
  const data = await ppApiRequest("POST", url, body, accessToken);
  process.stdout.write(JSON.stringify({
    status: "ok",
    run: {
      runId: data.runId,
      state: data.state,
      executionState: data.executionState,
      totalTestCases: data.totalTestCases,
      testCasesProcessed: data.testCasesProcessed || 0,
      callbackUri: data.callbackUri || null
    }
  }, null, 2) + "\n");
}
async function cmdGetRun(config, accessToken, args) {
  if (!args.runId) die("--run-id is required for get-run.");
  const url = withApiVersion(`${buildBaseUrl(config.environmentId, config.agentId)}/testruns/${args.runId}`);
  log(`GET ${url}`);
  const data = await ppApiRequest("GET", url, null, accessToken);
  process.stdout.write(JSON.stringify({
    status: "ok",
    run: {
      runId: data.id,
      state: data.state,
      executionState: data.executionState || null,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      name: data.name || null,
      totalTestCases: data.totalTestCases,
      testCasesProcessed: data.testCasesProcessed || 0
    }
  }, null, 2) + "\n");
}
async function cmdGetResults(config, accessToken, args) {
  if (!args.runId) die("--run-id is required for get-results.");
  const url = withApiVersion(`${buildBaseUrl(config.environmentId, config.agentId)}/testruns/${args.runId}`);
  log(`GET ${url}`);
  const data = await ppApiRequest("GET", url, null, accessToken);
  process.stdout.write(JSON.stringify({
    status: "ok",
    run: {
      runId: data.id,
      state: data.state,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      name: data.name || null,
      totalTestCases: data.totalTestCases,
      testCasesResults: data.testCasesResults || []
    }
  }, null, 2) + "\n");
}
async function cmdListRuns(config, accessToken) {
  const url = withApiVersion(`${buildBaseUrl(config.environmentId, config.agentId)}/testruns`);
  log(`GET ${url}`);
  const data = await ppApiRequest("GET", url, null, accessToken);
  const runs = data && data.value || [];
  process.stdout.write(JSON.stringify({
    status: "ok",
    runs: runs.map((r) => ({
      runId: r.id,
      state: r.state,
      startTime: r.startTime || null,
      endTime: r.endTime || null,
      name: r.name || null,
      totalTestCases: r.totalTestCases,
      testSetId: r.testSetId || null
    }))
  }, null, 2) + "\n");
}
async function cmdGetTestset(config, accessToken, args) {
  if (!args.testsetId) die("--testset-id is required for get-testset.");
  const url = withApiVersion(`${buildBaseUrl(config.environmentId, config.agentId)}/testsets/${args.testsetId}`);
  log(`GET ${url}`);
  const data = await ppApiRequest("GET", url, null, accessToken);
  process.stdout.write(JSON.stringify({ status: "ok", testset: data }, null, 2) + "\n");
}
async function main() {
  const args = parseArgs();
  const config = loadConfig(args);
  const accessToken = await getToken(config);
  switch (args.command) {
    case "list-testsets":
      await cmdListTestsets(config, accessToken);
      break;
    case "start-run":
      await cmdStartRun(config, accessToken, args);
      break;
    case "get-run":
      await cmdGetRun(config, accessToken, args);
      break;
    case "get-results":
      await cmdGetResults(config, accessToken, args);
      break;
    case "list-runs":
      await cmdListRuns(config, accessToken);
      break;
    case "get-testset":
      await cmdGetTestset(config, accessToken, args);
      break;
    default:
      die(`Unknown command: ${args.command}
Commands: list-testsets, get-testset, start-run, get-run, get-results, list-runs`);
  }
}
main().catch((e) => die(`Unexpected error: ${e.message}`));
/*! Bundled license information:

safe-buffer/index.js:
  (*! safe-buffer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> *)

@azure/msal-node/lib/msal-node.cjs:
  (*! @azure/msal-node v5.0.6 2026-03-02 *)
  (*! @azure/msal-common v16.2.0 2026-03-02 *)
*/
