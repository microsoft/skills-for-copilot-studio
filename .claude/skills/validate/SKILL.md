---
description: Validate a Copilot Studio YAML file against the schema and best practices. Use when the user asks to check, validate, or verify a YAML file.
argument-hint: <path-to-yaml-file>
allowed-tools: Bash(python *), Read, Glob
---

# Validate YAML Structure

Validate a Copilot Studio YAML file against the schema and best practices.

## Instructions

1. **If a file path is provided**, use it. Otherwise, ask the user which file to validate.

2. **Run the automated validation script first**:
   ```bash
   python scripts/schema-lookup.py validate $ARGUMENTS
   ```
   This checks: YAML parsing, kind detection, required properties, duplicate IDs, Power Fx `=` prefix, variable scope.

3. **Read the file** to perform context-aware checks the script can't do:

4. **Identify the file type** by checking the `kind` property:
   - `AdaptiveDialog` — Topic file
   - `GptComponentMetadata` — Agent metadata
   - `TaskDialog` — Connector action
   - `AgentDialog` — Child agent
   - `KnowledgeSourceConfiguration` — Knowledge source

5. **Look up the schema** for context-aware validation:
   ```bash
   python scripts/schema-lookup.py resolve <kind>
   ```

6. **Perform additional manual checks**:

   **Structure Validation:**
   - `kind` property is present and valid
   - All required properties are present
   - Property types match schema expectations

   **ID Validation:**
   - All nodes have unique IDs
   - IDs follow naming convention (`<nodeType>_<random>`)
   - No `_REPLACE` placeholders remain

   **Reference Validation:**
   - Dialog references use correct fully-qualified format (`<schemaName>.topic.<TopicName>`)
   - Variable names use correct scope prefix (Topic., System.)

   **Power Fx Validation:**
   - Expressions start with `=` prefix
   - Parentheses are balanced
   - String interpolation uses `{}` correctly

   **Generative Orchestration (if applicable):**
   - If `inputType`/`outputType` defined, check matching `inputs` entries
   - If `AutomaticTaskInput` used, check `propertyName` matches `inputType.properties`

7. **Report findings**:

   ```
   Validation Results for: <filename>

   [PASS] <check description>
   [WARN] <check description>
   [FAIL] <check description>

   Summary: X passed, Y warnings, Z failures
   ```
