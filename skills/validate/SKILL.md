---
user-invocable: false
description: Validate Copilot Studio agent YAML files using the LSP binary's full diagnostics (YAML structure, Power Fx, schema, cross-file references). Use when the user asks to check, validate, or verify YAML files.
argument-hint: <path-to-agent-workspace>
allowed-tools: Bash(node *manage-agent.bundle.js *), Bash(node *schema-lookup.bundle.js *), Read, Glob
---

# Validate Agent YAML

Validate Copilot Studio agent YAML files using the LanguageServerHost binary's full diagnostics — the same validation engine used by the VS Code Copilot Studio extension.

## Instructions

1. **Locate the agent workspace.** Find the directory containing `.mcs/conn.json`. If a specific file was requested, use the workspace that contains it.

2. **Run LSP-based validation**:
   ```bash
   node ${CLAUDE_SKILL_DIR}/../../scripts/manage-agent.bundle.js validate \
     --workspace "<path-to-agent-folder>" \
     --tenant-id "<tenantId>" \
     --environment-id "<envId>" \
     --environment-url "<envUrl>" \
     --agent-mgmt-url "<mgmtUrl>"
   ```
   This validates all `.mcs.yml` files in the workspace using the LSP binary's full diagnostics: YAML structure, Power Fx expressions, schema validation, cross-file references, and environment-specific checks.

   Connection details come from `.mcs/conn.json` — read it to get tenant-id, environment-id, environment-url, and agent-mgmt-url.

3. **Parse the JSON output**:
   - `valid: true` → all files pass (may still have warnings)
   - `valid: false` + `summary.errors > 0` → report errors as FAIL items
   - `summary.warnings > 0` → report as WARN items
   - Each file with diagnostics is listed with severity, message, code, and line range

4. **If the user asked about a specific file**, filter the output to show only that file's diagnostics.

5. **For additional context on specific errors**, use schema lookup:
   ```bash
   node ${CLAUDE_SKILL_DIR}/../../scripts/schema-lookup.bundle.js resolve <kind>
   ```

6. **Report findings**:

   ```
   Validation Results for: <agent-name>

   [PASS] <filename> — no issues
   [FAIL] <filename> — <error message> (line X)
   [WARN] <filename> — <warning message> (line X)

   Summary: X files checked, Y errors, Z warnings
   ```
