---
description: Create a new Copilot Studio topic YAML file. Use when the user asks to create a new topic, conversation flow, or dialog for their agent.
argument-hint: <topic description>
allowed-tools: Bash(python scripts/schema-lookup.py *), Read, Write, Glob
---

# Create New Topic

Generate a new Copilot Studio topic YAML file based on user requirements.

## Instructions

1. **Auto-discover the agent directory**:
   ```
   Glob: src/**/agent.mcs.yml
   ```
   If multiple agents found, ask which one. NEVER hardcode an agent name.

2. **Check for matching templates** in `templates/topics/` first:
   - `greeting.topic.mcs.yml` — OnConversationStart greeting
   - `fallback.topic.mcs.yml` — OnUnknownIntent fallback with escalation
   - `arithmeticsum.topic.mcs.yml` — Topic with inputs/outputs and computation
   - `question-topic.topic.mcs.yml` — Question with branching logic
   - `search-topic.topic.mcs.yml` — Generative answers from knowledge
   - `auth-topic.topic.mcs.yml` — Authentication flow
   - `error-handler.topic.mcs.yml` — Error handling
   - `disambiguation.topic.mcs.yml` — Multiple topics matched
   If a template matches, use it as the starting point.

3. **Look up the schema** for the trigger and action types you'll use:
   ```bash
   python scripts/schema-lookup.py resolve AdaptiveDialog
   python scripts/schema-lookup.py resolve <TriggerType>
   ```

4. **Determine the trigger type** from the user's description:
   - `OnRecognizedIntent` — For topics triggered by user phrases (most common)
   - `OnConversationStart` — For welcome/greeting topics
   - `OnUnknownIntent` — For fallback topics
   - `OnEscalate` — For escalation to human agent
   - `OnError` — For error handling

5. **Generate the topic YAML** with:
   - A `# Name:` comment at the top
   - `kind: AdaptiveDialog`
   - Appropriate `beginDialog` with correct trigger
   - **Unique IDs** for ALL nodes (format: `<nodeType>_<6-8 random alphanumeric>`)
   - If using a template, replace ALL `_REPLACE` placeholders with unique IDs

6. **Check settings.mcs.yml** for `GenerativeActionsEnabled`. Read the agent's `settings.mcs.yml` to check.

7. **Save** to `src/<agent-name>/topics/<topic-name>.topic.mcs.yml`

## Generative Orchestration Guidelines

When the agent has `GenerativeActionsEnabled: true` in settings:

**Use Topic Inputs** (AutomaticTaskInput) instead of Question nodes to auto-collect user info:
```yaml
inputs:
  - kind: AutomaticTaskInput
    propertyName: userName
    description: "The user's name"
    entity: StringPrebuiltEntity
    shouldPromptUser: true
```
- The orchestrator auto-collects inputs based on the description — no explicit Question node needed.
- Still use Question nodes when: conditional asks (ask X only if Y), or end-of-flow confirmations.

**Use Topic Outputs** instead of SendActivity for final results:
```yaml
outputType:
  properties:
    result:
      displayName: result
      description: The computed result
      type: String
```
- The orchestrator generates the user-facing message from outputs.
- Do NOT use SendActivity to show final outputs (rare exceptions: precise mid-flow messages).

**Include inputType/outputType schemas** when using inputs/outputs:
```yaml
inputType:
  properties:
    userName:
      displayName: userName
      description: "The user's name"
      type: String
outputType:
  properties:
    result:
      displayName: result
      type: String
```

## Power Fx Quick Reference

- Expressions start with `=`: `value: =Text(Topic.num1 + Topic.num2)`
- String interpolation uses `{}`: `activity: "Hello {Topic.UserName}"`
- Common functions: `Text()`, `Now()`, `IsBlank()`, `!IsBlank()`, `DateTimeFormat.UTC`
- Variable init: `variable: init:Topic.MyVar` (first assignment uses `init:`)
