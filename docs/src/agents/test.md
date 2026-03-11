---
sidebar_position: 2
title: Test Agent
---

# Test Agent

The **test** agent is a testing specialist for published Copilot Studio agents. It runs tests, analyzes failures, and proposes YAML fixes.

## Invocation

```
/copilot-studio:test <your request>
```

## Testing Approaches

The test agent supports three distinct testing methods:

| Approach | Skill | How It Works | Requires |
|----------|-------|-------------|----------|
| **Point-test** | `/copilot-studio:chat-with-agent` | Sends a single utterance directly to the published agent via the Copilot Studio Client SDK and returns the full response. Best for quick checks and multi-turn conversations. | App Registration with `CopilotStudio.Copilots.Invoke` permission |
| **Batch test suite** | `/copilot-studio:run-tests` (Kit mode) | Runs pre-defined test sets with expected responses via the Dataverse API using the [Power CAT Copilot Studio Kit](https://github.com/microsoft/Power-CAT-Copilot-Studio-Kit). Produces pass/fail results with latencies. | Copilot Studio Kit installed + App Registration with Dataverse permissions |
| **Analyze evaluations** | `/copilot-studio:run-tests` (eval mode) | Analyzes evaluation results exported as CSV from the Copilot Studio UI. Proposes fixes for failures. | Agent published + evaluations run in Copilot Studio UI |

## When to Use Each

- User provides a specific utterance (e.g., "test 'what's the PTO policy'") -- point-test
- User says "run the test suite" or "run tests" -- batch test suite
- User shares a CSV or says "analyze these results" -- evaluation analysis
- User says "validate the YAML" -- validation (delegates to troubleshoot agent)

## Agent Connection

- **Point-test** (`/chat-with-agent`): Connection details are auto-discovered from the VS Code extension's `.mcs/conn.json` and `settings.mcs.yml`. The only value the user must provide is their App Registration Client ID.
- **Batch tests** (`/run-tests`): Requires a separate `tests/settings.json` with the Dataverse environment URL, tenant ID, client ID, agent configuration ID, and test set ID.

## Examples

### Send a point-test

```
/copilot-studio:test Send "What products do you offer?" to the published agent
```

### Run a batch suite

```
/copilot-studio:test Run my test suite
```

### Analyze evaluation results

```
/copilot-studio:test Analyze my evaluation results from ~/Downloads/Evaluate MyAgent.csv
```

## Agent Lifecycle

Only **published** agents are reachable by tests. The lifecycle is:

1. **Clone** the agent with the VS Code Extension
2. **Author** changes in YAML
3. **Push** changes with the VS Code Extension (creates a draft)
4. *(Optional)* Test draft in the Copilot Studio UI Test tab
5. **Publish** in Copilot Studio UI (agent is now live and testable)

Always push AND publish before testing with `/copilot-studio:test`.
