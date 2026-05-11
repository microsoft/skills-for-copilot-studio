---
user-invocable: false
agent-types: modern
description: List all skills and tools in a modern Copilot Studio agent. Use when the user wants to see what capabilities their agent has.
allowed-tools: Read, Glob, Grep
agent: copilot-studio-author
---

# List skills and tools in a modern agent

## Pre-checks

1. Run `Glob: **/settings.mcs.yml` to find the agent workspace.
2. Confirm it's a modern agent (look for `template: cliagent-1.0.0` or `$kind: CLICopilotRecognizer` in `settings.mcs.yml`).

## Discover components

Scan two directories for `.mcs.yml` files:

1. `topics/*.mcs.yml` — skills and tools with `DialogComponent` registration (invocable by the orchestrator)
2. `translations/*.mcs.yml` — content-only components (`TranslationsComponent` — may not be invocable)

For each file, extract:
- **componentName** from `mcs.metadata.componentName`
- **description** from `mcs.metadata.description`
- **kind** — the top-level `kind:` value (`InlineAgentSkill`, `ConnectorTool`, `McpTool`, `WorkflowTool`, `FabricTool`, `ConnectedAgentTool`)

## Display results

Present as a table:

```
| Name | Kind | Location | Description |
|------|------|----------|-------------|
| WeatherSkill | InlineAgentSkill | topics/ | Responds to weather questions |
| MSN Weather | ConnectorTool | topics/ | Gets current weather for a location |
| TravelBooking | InlineAgentSkill | translations/ | Helps plan trips (content only — not invocable) |
```

Note for the user:
- Components in `topics/` are registered as `DialogComponent` and can be invoked by the orchestrator
- Components in `translations/` are content-only (`TranslationsComponent`) — they exist but the orchestrator cannot see them. If a skill should be invocable, it needs to be in `topics/`.

## Also show agent settings summary

From `settings.mcs.yml`, show:
- **Display name**: from `displayName`
- **Instructions**: first 100 chars of the instruction segments
- **Output type**: `TextAgentOutput` or `StructuredAgentOutput` (or "not set" if absent)
- **Conversation starters**: list titles if present
- **Knowledge sources**: list any `knowledge/*.mcs.yml` files with their source type and URL
