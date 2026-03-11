---
sidebar_position: 3
title: Troubleshoot Agent
---

# Troubleshoot Agent

The **troubleshoot** agent is a debugging specialist for Copilot Studio agents. It diagnoses issues, validates YAML, and proposes targeted fixes.

## Invocation

```
/copilot-studio:troubleshoot <your request>
```

## What It Does

The troubleshoot agent follows a structured debugging workflow:

1. **Understand the symptom** -- wrong topic, no response, error, unexpected output
2. **Search known issues first** -- checks the known issues database for matching symptoms
3. **Validate YAML files** -- runs schema validation on relevant files
4. **Look up schema definitions** -- verifies kinds, node types, and required fields
5. **Check triggers and model descriptions** -- inspects routing configuration
6. **Propose specific fixes** -- generates corrected YAML using the appropriate skill
7. **Validate the fix** -- confirms the proposed changes pass schema validation

## Skills Used

| Task | Skill |
|------|-------|
| Search known issues | `/copilot-studio:known-issues` |
| Validate a YAML file | `/copilot-studio:validate` |
| Look up a schema definition | `/copilot-studio:lookup-schema` |
| List valid kind values | `/copilot-studio:list-kinds` |
| List all topics | `/copilot-studio:list-topics` |
| Edit agent settings | `/copilot-studio:edit-agent` |
| Modify trigger phrases | `/copilot-studio:edit-triggers` |
| Send a test message (verify fix) | `/copilot-studio:chat-with-agent` |
| Run full test suite (verify fix) | `/copilot-studio:run-tests` |

## Examples

### Diagnose hallucination

```
/copilot-studio:troubleshoot The agent is making up product details that aren't accurate
```

### Validate all topics

```
/copilot-studio:troubleshoot Validate all topics in my agent
```

### Fix wrong topic routing

```
/copilot-studio:troubleshoot The agent keeps triggering the wrong topic when I ask about billing
```

### Debug validation errors

```
/copilot-studio:troubleshoot I'm getting a validation error when I try to push my changes
```

## Agent Discovery

The troubleshoot agent never hardcodes agent names or paths. It auto-discovers agents via the `**/agent.mcs.yml` glob pattern. If multiple agents are found, it asks which one to debug.

## Known Issues Integration

Before deep debugging, the agent searches the [known issues database](https://github.com/microsoft/skills-for-copilot-studio/issues) for matching symptoms. If a match is found, it shares the issue number, link, and any available mitigation.

If no known issue matches and the problem appears to be a bug in the plugin itself, the agent suggests opening a new issue with reproduction steps, expected vs. actual behavior, and environment details.
