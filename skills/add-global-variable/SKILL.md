---
user-invocable: false
description: Add a global variable to a Copilot Studio agent. Use when the user needs a variable that persists across topics in the same conversation and can optionally be visible to the AI orchestrator.
argument-hint: <variable name and purpose>
allowed-tools: Read, Write, Glob, Grep
context: fork
agent: copilot-studio-author
---

# Add Global Variable

Create a global variable that persists across all topics within a conversation.

## Instructions

1. **Auto-discover the agent directory**:
   ```
   Glob: **/agent.mcs.yml
   ```
   Use the top-level agent. NEVER hardcode an agent name.

2. **Read `settings.mcs.yml`** to get the `schemaName` prefix:
   ```
   Read: <agent-dir>/settings.mcs.yml
   ```
   Extract the root-level `schemaName` value (e.g., `copilots_header_cre3c_fullagent`).

3. **Determine from the user**:
   - Variable name (PascalCase, e.g., `LastDiscussedCity`)
   - Description of what it stores
   - Whether the AI orchestrator should be aware of it (`aIVisibility`)
   - Default value (if any)
   - DO NOT skip any of these properties. If the user doesn't provide them, ask follow-up questions to get the necessary information.

4. **Create the variable file** at `<agent-dir>/variables/<VariableName>.mcs.yml`:

```yaml
# Name: <Human-readable Name>
# <Description>
name: <VariableName>
aIVisibility: <UseInAIContext or HideFromAIContext>
scope: Conversation
description: <Description of what the variable stores>
schemaName: <prefix>.globalvariable.<VariableName>
kind: GlobalVariableComponent
defaultValue: <DEFAULT or specific value>
```

5. **Key fields explained**:
   - `name` — PascalCase identifier. This is how topics reference the variable: `Global.<name>` (e.g., `Global.LastDiscussedCity`).
   - `aIVisibility` — Controls orchestrator awareness:
     - `UseInAIContext` — The orchestrator can read and reason about this variable. Use when the variable influences routing or response generation (e.g., user preferences, conversation state the AI should track).
     - `HideFromAIContext` — The variable exists but the orchestrator doesn't see it. Use for internal bookkeeping (e.g., counters, flags) that topics use but the AI doesn't need to reason about.
   - `scope: Conversation` — Always `Conversation` for global variables (persists for the session).
   - `schemaName` — Must follow the pattern `<agent-schemaName>.globalvariable.<VariableName>`. Read the prefix from `settings.mcs.yml`.
   - `defaultValue` — Initial value. Use `DEFAULT` if no specific initial value is needed.

## How Topics Use Global Variables

Topics reference global variables with the `Global.` prefix:

```yaml
# Reading a global variable in a condition
- kind: ConditionGroup
  id: conditionGroup_Xk9mPq
  conditions:
    - id: conditionItem_Lw3nRs
      condition: =!IsBlank(Global.LastDiscussedCity)
      actions:
        - kind: SendActivity
          id: sendMessage_Yt7vBw
          activity:
            text:
              - "Last time we discussed {Global.LastDiscussedCity}."

# Setting a global variable from a topic
- kind: SetTextVariable
  id: setTextVariable_Qp4kMn
  variable: Global.LastDiscussedCity
  value: =Topic.CityName
```

## When to Use Global Variables

- **Cross-topic state**: A value set in one topic needs to be read in another (e.g., user's preferred language, last search query)
- **AI-aware context**: The orchestrator should know something about the conversation state to make better routing decisions (use `UseInAIContext`)
- **Conversation-wide defaults**: A default value that multiple topics can read and optionally override
- **Dynamic knowledge sources**: A global variable can hold a URL that a knowledge source references via `=$"{Global.VarName}"`. This enables routing to different SharePoint folders or websites per user (e.g., by geolocation or department). See `/copilot-studio:add-knowledge` for the full pattern. **Important**: the variable value must be a clean, direct URL — not a SharePoint AllItems.aspx link with query parameters.
