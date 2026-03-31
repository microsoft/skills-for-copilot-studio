#!/usr/bin/env node
/**
 * Copilot Studio YAML Schema Lookup Tool
 *
 * This script provides utilities to query the Copilot Studio YAML schema
 * without loading the entire file into memory. It supports:
 * - Looking up specific definitions
 * - Searching for definitions by keyword
 * - Resolving $ref chains to get complete definitions
 * - Listing all available definitions
 * - Validating YAML files against schema and best practices
 *
 * Usage:
 *     node schema-lookup.js lookup <definition-name>
 *     node schema-lookup.js search <keyword>
 *     node schema-lookup.js list
 *     node schema-lookup.js resolve <definition-name>
 *     node schema-lookup.js kinds
 *     node schema-lookup.js summary <definition-name>
 *     node schema-lookup.js validate <path-to-yaml-file>
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

// --- Path helpers ---

function getSchemaPath() {
  const scriptDir = __dirname;
  // When bundled, __dirname is scripts/; go up one level to project root
  // When running from src/, go up two levels
  let projectRoot = path.resolve(scriptDir, "..");
  let schemaPath = path.join(projectRoot, "reference", "bot.schema.yaml-authoring.json");

  if (!fs.existsSync(schemaPath)) {
    // Try two levels up (running from scripts/src/)
    projectRoot = path.resolve(scriptDir, "..", "..");
    schemaPath = path.join(projectRoot, "reference", "bot.schema.yaml-authoring.json");
  }

  if (!fs.existsSync(schemaPath)) {
    console.error(`Error: Schema file not found at ${schemaPath}`);
    console.error("Please place 'bot.schema.yaml-authoring.json' in the 'reference/' directory.");
    process.exit(1);
  }

  return schemaPath;
}

function loadSchema() {
  const schemaPath = getSchemaPath();
  const raw = fs.readFileSync(schemaPath, "utf-8");
  return JSON.parse(raw);
}

function getDefinitions(schema) {
  return schema.definitions || {};
}

// --- Lookup & search ---

function lookupDefinition(name, definitions) {
  if (definitions[name]) return definitions[name];

  const nameLower = name.toLowerCase();
  for (const key of Object.keys(definitions)) {
    if (key.toLowerCase() === nameLower) return definitions[key];
  }
  return null;
}

function searchDefinitions(keyword, definitions) {
  const keywordLower = keyword.toLowerCase();
  return Object.keys(definitions)
    .filter((k) => k.toLowerCase().includes(keywordLower))
    .sort();
}

// --- $ref resolution ---

function resolveDefinition(name, definitions, visited, depth, maxDepth) {
  visited = visited || new Set();
  depth = depth || 0;
  maxDepth = maxDepth || 5;

  if (depth > maxDepth) {
    return { _note: `Max depth (${maxDepth}) reached, stopping recursion` };
  }
  if (visited.has(name)) {
    return { _ref: name, _note: "Circular reference detected" };
  }

  visited.add(name);

  const definition = lookupDefinition(name, definitions);
  if (!definition) {
    return { _error: `Definition '${name}' not found` };
  }

  return resolveObject(definition, definitions, new Set(visited), depth, maxDepth);
}

function resolveObject(obj, definitions, visited, depth, maxDepth) {
  if (Array.isArray(obj)) {
    return obj.map((item) => resolveObject(item, definitions, visited, depth, maxDepth));
  }
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  // Handle standalone $ref
  if (obj.$ref && Object.keys(obj).length === 1) {
    const ref = obj.$ref;
    if (ref.startsWith("#/definitions/")) {
      const defName = ref.slice("#/definitions/".length);
      if (visited.has(defName)) {
        return { _ref: defName, _note: "Circular reference" };
      }
      return resolveDefinition(defName, definitions, visited, depth + 1, maxDepth);
    }
    return obj;
  }

  // Recursively resolve all properties
  const resolved = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "$ref") {
      resolved[key] = value;
    } else {
      resolved[key] = resolveObject(value, definitions, visited, depth, maxDepth);
    }
  }
  return resolved;
}

// --- Model reference ---

/**
 * Outputs model configuration data extracted purely from the schema.
 * Resolves the agent-level model type and its referenced definitions.
 */
function printModelReference(definitions) {
  const result = {};

  // Resolve the model structure used at agent level (no kind property)
  const noKind = resolveDefinition("CurrentModelsNoKind", definitions);
  if (noKind) result.CurrentModelsNoKind = noKind;

  // Resolve valid providers
  const providerDef = resolveDefinition("ModelProvider", definitions);
  if (providerDef) result.ModelProvider = providerDef;

  // Resolve valid API types
  const apiTypeDef = resolveDefinition("ModelApiType", definitions);
  if (apiTypeDef) result.ModelApiType = apiTypeDef;

  console.log(JSON.stringify(result, null, 2));
}

// --- Kind extraction ---

function findKindValues(definitions) {
  const kinds = new Set();

  function extractKinds(obj) {
    if (Array.isArray(obj)) {
      obj.forEach(extractKinds);
      return;
    }
    if (typeof obj !== "object" || obj === null) return;

    // Check for kind enum
    if (obj.kind && typeof obj.kind === "object") {
      if (obj.kind.const) kinds.add(obj.kind.const);
      if (obj.kind.enum) obj.kind.enum.forEach((k) => kinds.add(k));
    }

    // Check for properties.kind
    if (obj.properties && typeof obj.properties === "object" && obj.properties.kind) {
      const kindProp = obj.properties.kind;
      if (typeof kindProp === "object") {
        if (kindProp.const) kinds.add(kindProp.const);
        if (kindProp.enum) kindProp.enum.forEach((k) => kinds.add(k));
      }
    }

    // Recurse into nested objects
    for (const value of Object.values(obj)) {
      extractKinds(value);
    }
  }

  for (const definition of Object.values(definitions)) {
    extractKinds(definition);
  }

  return [...kinds].sort();
}

// --- Formatting ---

function formatDefinition(name, definition, compact) {
  if (!compact) {
    return JSON.stringify({ [name]: definition }, null, 2);
  }

  const output = [`Definition: ${name}`];

  if (definition.description) {
    output.push(`Description: ${definition.description}`);
  }

  if (definition.properties) {
    output.push("Properties:");
    for (const [propName, propDef] of Object.entries(definition.properties)) {
      let propType = propDef.type || "";
      if (propDef.$ref) propType = propDef.$ref.split("/").pop();
      output.push(`  - ${propName}: ${propType}`);
    }
  }

  if (definition.required) {
    output.push(`Required: ${definition.required.join(", ")}`);
  }

  if (definition.oneOf) {
    output.push("OneOf:");
    for (const item of definition.oneOf) {
      if (item.$ref) output.push(`  - ${item.$ref.split("/").pop()}`);
    }
  }

  if (definition.allOf) {
    output.push("AllOf:");
    for (const item of definition.allOf) {
      if (item.$ref) output.push(`  - ${item.$ref.split("/").pop()}`);
    }
  }

  return output.join("\n");
}

// --- Validation ---

function validateYamlFile(filepath, definitions) {
  if (!fs.existsSync(filepath)) {
    console.log(`[FAIL] File not found: ${filepath}`);
    process.exit(1);
  }

  let passes = 0;
  let warnings = 0;
  let failures = 0;

  // 1. YAML parsing
  const rawText = fs.readFileSync(filepath, "utf-8");
  let data;
  try {
    data = yaml.load(rawText);
    if (data == null) {
      console.log("[FAIL] File is empty or not valid YAML");
      process.exit(1);
    }
    console.log("[PASS] YAML parsing successful");
    passes++;
  } catch (e) {
    console.log(`[FAIL] YAML parsing error: ${e.message}`);
    process.exit(1);
  }

  // 2. Kind detection
  const kind = data.kind;
  if (kind) {
    console.log(`[PASS] Kind detected: ${kind}`);
    passes++;
    const knownKinds = findKindValues(definitions);
    if (knownKinds.includes(kind)) {
      console.log(`[PASS] Kind '${kind}' exists in schema`);
      passes++;
    } else {
      console.log(`[WARN] Kind '${kind}' not found in schema kind values`);
      warnings++;
    }
  } else {
    console.log("[FAIL] No 'kind' property found at root level");
    failures++;
  }

  // 3. Required properties check based on kind
  if (kind === "AdaptiveDialog") {
    if (data.beginDialog) {
      console.log("[PASS] Required 'beginDialog' property present");
      passes++;
      const bd = data.beginDialog;
      if (typeof bd === "object" && bd !== null) {
        if (bd.kind) {
          console.log(`[PASS] beginDialog.kind: ${bd.kind}`);
          passes++;
        } else {
          console.log("[FAIL] beginDialog missing 'kind' property");
          failures++;
        }
        if (bd.id) {
          console.log(`[PASS] beginDialog.id: ${bd.id}`);
          passes++;
        } else {
          console.log("[FAIL] beginDialog missing 'id' property");
          failures++;
        }
      }
    } else {
      console.log("[FAIL] AdaptiveDialog missing required 'beginDialog' property");
      failures++;
    }
  } else if (kind === "GptComponentMetadata") {
    for (const prop of ["displayName", "instructions"]) {
      if (data[prop]) {
        console.log(`[PASS] Required '${prop}' property present`);
        passes++;
      } else {
        console.log(`[WARN] Missing '${prop}' property (recommended)`);
        warnings++;
      }
    }
  } else if (kind === "KnowledgeSourceConfiguration") {
    if (data.source) {
      console.log("[PASS] Required 'source' property present");
      passes++;
    } else {
      console.log("[FAIL] Missing required 'source' property");
      failures++;
    }
  } else if (kind === "AgentDialog") {
    // AgentDialog (child agent) validation
    if (data.beginDialog) {
      console.log("[PASS] Required 'beginDialog' property present");
      passes++;
      const bd = data.beginDialog;
      if (bd.kind === "OnToolSelected") {
        console.log("[PASS] beginDialog.kind: OnToolSelected");
        passes++;
      } else {
        console.log(`[WARN] beginDialog.kind is '${bd.kind}' — expected 'OnToolSelected' for child agents`);
        warnings++;
      }
      if (bd.description) {
        console.log("[PASS] beginDialog.description present (used by parent orchestrator for routing)");
        passes++;
      } else {
        console.log("[WARN] beginDialog.description missing — the parent orchestrator needs this to know when to route to this child agent");
        warnings++;
      }
      // AgentDialog must NOT have actions — child agents use generative orchestration
      if (bd.actions && Array.isArray(bd.actions) && bd.actions.length > 0) {
        const actionKinds = bd.actions
          .filter((a) => a && a.kind)
          .map((a) => a.kind);
        console.log(`[FAIL] AgentDialog must NOT have beginDialog.actions (found ${bd.actions.length}: ${actionKinds.join(", ")}). Child agents use generative orchestration via settings.instructions — they cannot contain hardcoded action nodes like Question, SendActivity, BeginDialog, etc. Remove the actions array and define the agent's behavior in settings.instructions instead.`);
        failures++;
      } else {
        console.log("[PASS] No hardcoded actions in beginDialog (correct for AgentDialog)");
        passes++;
      }
    } else {
      console.log("[FAIL] AgentDialog missing required 'beginDialog' property");
      failures++;
    }
    if (data.settings && data.settings.instructions) {
      console.log("[PASS] settings.instructions present");
      passes++;
    } else {
      console.log("[WARN] Missing settings.instructions — child agents need instructions for generative orchestration");
      warnings++;
    }
  }

  // 4. Duplicate ID detection
  const idsFound = [];
  function collectIds(obj) {
    if (Array.isArray(obj)) {
      obj.forEach(collectIds);
      return;
    }
    if (typeof obj !== "object" || obj === null) return;
    if (typeof obj.id === "string") idsFound.push(obj.id);
    for (const v of Object.values(obj)) collectIds(v);
  }
  collectIds(data);

  const seen = new Set();
  const duplicates = new Set();
  for (const id of idsFound) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }

  if (duplicates.size > 0) {
    for (const dup of [...duplicates].sort()) {
      console.log(`[FAIL] Duplicate ID found: ${dup}`);
      failures++;
    }
  } else if (idsFound.length > 0) {
    console.log(`[PASS] All ${idsFound.length} node IDs are unique`);
    passes++;
  }

  // 5. _REPLACE placeholder check
  const replaceCount = (rawText.match(/_REPLACE/g) || []).length;
  if (replaceCount > 0) {
    console.log(`[FAIL] Found ${replaceCount} unresolved '_REPLACE' placeholder(s)`);
    failures++;
  } else {
    console.log("[PASS] No '_REPLACE' placeholders remaining");
    passes++;
  }

  // 6. Power Fx = prefix check
  function checkPowerfx(obj, pathStr) {
    const issues = [];
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => issues.push(...checkPowerfx(item, `${pathStr}[${i}]`)));
      return issues;
    }
    if (typeof obj !== "object" || obj === null) return issues;

    for (const [key, val] of Object.entries(obj)) {
      if (key === "condition" && typeof val === "string" && !val.startsWith("=")) {
        issues.push(`  condition at ${pathStr}.${key}: '${val}' (may need '=' prefix)`);
      }
      issues.push(...checkPowerfx(val, `${pathStr}.${key}`));
    }
    return issues;
  }

  const pfxIssues = checkPowerfx(data, "");
  if (pfxIssues.length > 0) {
    for (const issue of pfxIssues) {
      console.log(`[WARN] Possible missing '=' prefix: ${issue}`);
      warnings++;
    }
  } else {
    console.log("[PASS] No Power Fx prefix issues detected");
    passes++;
  }

  // 7. Variable scope check
  function checkVariables(obj) {
    const issues = [];
    if (Array.isArray(obj)) {
      obj.forEach((item) => issues.push(...checkVariables(item)));
      return issues;
    }
    if (typeof obj !== "object" || obj === null) return issues;

    if (typeof obj.variable === "string") {
      const cleanVar = obj.variable.replace("init:", "");
      if (
        !cleanVar.startsWith("Topic.") &&
        !cleanVar.startsWith("System.") &&
        !cleanVar.startsWith("Global.") &&
        !cleanVar.startsWith("User.")
      ) {
        issues.push(`Variable '${obj.variable}' missing scope prefix (Topic., System., Global., User.)`);
      }
    }
    for (const v of Object.values(obj)) issues.push(...checkVariables(v));
    return issues;
  }

  const varIssues = checkVariables(data);
  if (varIssues.length > 0) {
    for (const issue of varIssues) {
      console.log(`[WARN] ${issue}`);
      warnings++;
    }
  } else {
    console.log("[PASS] Variable scopes look correct");
    passes++;
  }

  // 8. inputType/outputType consistency
  if (data.inputs && data.inputType) {
    const inputNames = new Set();
    for (const inp of data.inputs) {
      if (inp && typeof inp === "object" && inp.propertyName) {
        inputNames.add(inp.propertyName);
      }
    }
    const inputTypeProps = new Set(
      Object.keys((data.inputType && data.inputType.properties) || {})
    );

    const setsEqual =
      inputNames.size === inputTypeProps.size &&
      [...inputNames].every((n) => inputTypeProps.has(n));

    if (setsEqual) {
      console.log("[PASS] inputs and inputType.properties are consistent");
      passes++;
    } else {
      const missingInType = [...inputNames].filter((n) => !inputTypeProps.has(n));
      const missingInInputs = [...inputTypeProps].filter((n) => !inputNames.has(n));
      if (missingInType.length > 0) {
        console.log(`[WARN] inputs defined but missing from inputType: {${missingInType.join(", ")}}`);
        warnings++;
      }
      if (missingInInputs.length > 0) {
        console.log(`[WARN] inputType properties missing from inputs: {${missingInInputs.join(", ")}}`);
        warnings++;
      }
    }
  }

  // Summary
  console.log(`\nSummary: ${passes} passed, ${warnings} warnings, ${failures} failures`);
  if (failures > 0) process.exit(1);
}

// --- Adaptive Cards schema ---

function getAdaptiveCardSchemaPath() {
  const scriptDir = __dirname;
  let projectRoot = path.resolve(scriptDir, "..");
  let schemaPath = path.join(projectRoot, "reference", "adaptive-card.schema.json");

  if (!fs.existsSync(schemaPath)) {
    projectRoot = path.resolve(scriptDir, "..", "..");
    schemaPath = path.join(projectRoot, "reference", "adaptive-card.schema.json");
  }

  if (!fs.existsSync(schemaPath)) {
    console.error(`Error: Adaptive Card schema not found at ${schemaPath}`);
    process.exit(1);
  }

  return schemaPath;
}

function loadAdaptiveCardSchema() {
  const schemaPath = getAdaptiveCardSchemaPath();
  return JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
}

function getAdaptiveCardDefinitions(schema) {
  return schema.definitions || {};
}

// --- Help ---

function printHelp() {
  console.log(`
Copilot Studio YAML Schema Lookup Tool

Copilot Studio schema:
    node schema-lookup.js lookup <definition-name>
    node schema-lookup.js search <keyword>
    node schema-lookup.js list
    node schema-lookup.js resolve <definition-name>
    node schema-lookup.js kinds
    node schema-lookup.js summary <definition-name>
    node schema-lookup.js models
    node schema-lookup.js validate <path-to-yaml-file>

Adaptive Cards schema:
    node schema-lookup.js ac-lookup <element-name>     (e.g., TextBlock, Input.Text)
    node schema-lookup.js ac-search <keyword>           (e.g., input, action)
    node schema-lookup.js ac-list
    node schema-lookup.js ac-resolve <element-name>
    node schema-lookup.js ac-summary <element-name>
`);
}

// --- Main ---

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    printHelp();
    process.exit(1);
  }

  const command = args[0].toLowerCase();

  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  const schema = loadSchema();
  const definitions = getDefinitions(schema);

  switch (command) {
    case "lookup": {
      if (args.length < 2) {
        console.error("Error: Please provide a definition name");
        console.error("Usage: node schema-lookup.js lookup <definition-name>");
        process.exit(1);
      }
      const name = args[1];
      const definition = lookupDefinition(name, definitions);
      if (definition) {
        console.log(formatDefinition(name, definition, false));
      } else {
        const similar = searchDefinitions(name, definitions).slice(0, 10);
        console.log(`Definition '${name}' not found.`);
        if (similar.length > 0) {
          console.log("Did you mean one of these?");
          similar.forEach((s) => console.log(`  - ${s}`));
        }
      }
      break;
    }

    case "search": {
      if (args.length < 2) {
        console.error("Error: Please provide a search keyword");
        console.error("Usage: node schema-lookup.js search <keyword>");
        process.exit(1);
      }
      const keyword = args[1];
      const matches = searchDefinitions(keyword, definitions);
      if (matches.length > 0) {
        console.log(`Found ${matches.length} definitions matching '${keyword}':`);
        matches.forEach((m) => console.log(`  - ${m}`));
      } else {
        console.log(`No definitions found matching '${keyword}'`);
      }
      break;
    }

    case "list": {
      const allDefs = Object.keys(definitions).sort();
      console.log(`Available definitions (${allDefs.length} total):`);
      allDefs.forEach((name) => console.log(`  - ${name}`));
      break;
    }

    case "resolve": {
      if (args.length < 2) {
        console.error("Error: Please provide a definition name");
        console.error("Usage: node schema-lookup.js resolve <definition-name>");
        process.exit(1);
      }
      const name = args[1];
      const resolved = resolveDefinition(name, definitions);
      console.log(JSON.stringify({ [name]: resolved }, null, 2));
      break;
    }

    case "kinds": {
      const kinds = findKindValues(definitions);
      console.log(`Available 'kind' values (${kinds.length} total):`);
      kinds.forEach((k) => console.log(`  - ${k}`));
      break;
    }

    case "summary": {
      if (args.length < 2) {
        console.error("Error: Please provide a definition name");
        console.error("Usage: node schema-lookup.js summary <definition-name>");
        process.exit(1);
      }
      const name = args[1];
      const definition = lookupDefinition(name, definitions);
      if (definition) {
        console.log(formatDefinition(name, definition, true));
      } else {
        console.log(`Definition '${name}' not found.`);
      }
      break;
    }

    case "models": {
      printModelReference(definitions);
      break;
    }

    case "validate": {
      if (args.length < 2) {
        console.error("Error: Please provide a YAML file path");
        console.error("Usage: node schema-lookup.js validate <path-to-yaml-file>");
        process.exit(1);
      }
      validateYamlFile(args[1], definitions);
      break;
    }

    case "ac-lookup": {
      if (args.length < 2) {
        console.error("Usage: node schema-lookup.js ac-lookup <element-name>");
        process.exit(1);
      }
      const acSchema = loadAdaptiveCardSchema();
      const acDefs = getAdaptiveCardDefinitions(acSchema);
      const name = args[1];
      const definition = lookupDefinition(name, acDefs);
      if (definition) {
        console.log(formatDefinition(name, definition, false));
      } else {
        const similar = searchDefinitions(name, acDefs).slice(0, 10);
        console.log(`Definition '${name}' not found in Adaptive Cards schema.`);
        if (similar.length > 0) {
          console.log("Did you mean one of these?");
          similar.forEach((s) => console.log(`  - ${s}`));
        }
      }
      break;
    }

    case "ac-search": {
      if (args.length < 2) {
        console.error("Usage: node schema-lookup.js ac-search <keyword>");
        process.exit(1);
      }
      const acSchema = loadAdaptiveCardSchema();
      const acDefs = getAdaptiveCardDefinitions(acSchema);
      const keyword = args[1];
      const matches = searchDefinitions(keyword, acDefs);
      if (matches.length > 0) {
        console.log(`Found ${matches.length} Adaptive Card definitions matching '${keyword}':`);
        matches.forEach((m) => console.log(`  - ${m}`));
      } else {
        console.log(`No Adaptive Card definitions found matching '${keyword}'`);
      }
      break;
    }

    case "ac-list": {
      const acSchema = loadAdaptiveCardSchema();
      const acDefs = getAdaptiveCardDefinitions(acSchema);
      const allDefs = Object.keys(acDefs).sort();
      console.log(`Adaptive Card definitions (${allDefs.length} total):`);
      allDefs.forEach((name) => console.log(`  - ${name}`));
      break;
    }

    case "ac-resolve": {
      if (args.length < 2) {
        console.error("Usage: node schema-lookup.js ac-resolve <element-name>");
        process.exit(1);
      }
      const acSchema = loadAdaptiveCardSchema();
      const acDefs = getAdaptiveCardDefinitions(acSchema);
      const name = args[1];
      const resolved = resolveDefinition(name, acDefs);
      console.log(JSON.stringify({ [name]: resolved }, null, 2));
      break;
    }

    case "ac-summary": {
      if (args.length < 2) {
        console.error("Usage: node schema-lookup.js ac-summary <element-name>");
        process.exit(1);
      }
      const acSchema = loadAdaptiveCardSchema();
      const acDefs = getAdaptiveCardDefinitions(acSchema);
      const name = args[1];
      const definition = lookupDefinition(name, acDefs);
      if (definition) {
        console.log(formatDefinition(name, definition, true));
      } else {
        console.log(`Definition '${name}' not found in Adaptive Cards schema.`);
      }
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main();
