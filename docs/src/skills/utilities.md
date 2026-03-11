---
sidebar_position: 4
title: Utility Skills
---

# Utility Skills

Utility skills validate, inspect, and provide reference information. They are used by all three agents.

## validate

Validates a YAML file against the official Copilot Studio authoring schema.

**Usage:**
```
/copilot-studio:troubleshoot Validate all topics in my agent
```

**What it checks:**
- YAML syntax correctness
- Required fields present
- Valid kind values
- Proper node structure
- ID uniqueness

## lookup-schema

Looks up a specific definition in the Copilot Studio YAML authoring schema.

**Usage:**
```
/copilot-studio:troubleshoot Look up the schema for SendActivity
```

**Returns:** The full schema definition including properties, required fields, and valid values.

## list-kinds

Lists all valid `kind` discriminator values in the schema. These are the concrete node types that can appear in YAML topic files.

**Usage:**
```
/copilot-studio:author What node kinds are available?
```

**Returns:** A complete list of valid kind values with descriptions.

## list-topics

Lists all topics currently defined in the agent.

**Usage:**
```
/copilot-studio:author What topics does this agent have?
```

**Returns:** A list of all topic files with their names and trigger phrases.

## known-issues

Searches the known issues database for symptoms matching the described problem.

**Usage:**
```
/copilot-studio:troubleshoot The topic editor shows a blank canvas after import
```

**Behavior:**
- If a matching issue is found: shares the issue number, link, and mitigation
- If no match: suggests opening a new issue with reproduction steps

## best-practices

Provides just-in-time guidance on Copilot Studio YAML authoring best practices, glossary terms, and contextual information.

**Usage:**
```
/copilot-studio:author What are the best practices for trigger phrases?
```

## Internal Skills

The following skills are used internally by agents and are not typically invoked directly:

| Skill | Purpose |
|-------|---------|
| `_project-context` | Auto-discovers agent files and loads project context |
| `_reference` | Loads schema reference tables for agents |
