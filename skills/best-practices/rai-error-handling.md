# RAI Error Handling in OnError Topic

Microsoft Copilot Studio's platform-level Responsible AI guardrails are calibrated for a general audience — not industry-specific use cases. Customers in various industries may want to manage RAI error handling on their own to deliver responses that are appropriate, empathetic, and professionally sound for their context.

This best practice allows customers to catch OpenAI RAI errors before they are delivered to users, categorize them, and send a response based on the error category. This will not change the built-in RAI filtering in the platform and will not let RAI content-filtered messages be sent or received, but it allows customers to send customized messages to users who have triggered an OpenAI Content Filtering error instead of directly presenting the error to the end user. For example: if a user asks something related to self-harm and Copilot Studio filters the message with an OpenAI RAI content filtering code of Self-Harm, this topic will enable you to send a message guiding the user to mental health related resources instead of presenting them with a generic error message.

Azure OpenAI's Responsible AI (RAI) content filters surface as generic `ContentFiltered` errors in Copilot Studio. By default, the `OnError` system topic shows a generic error message with no distinction between filter categories. This pattern classifies the RAI subcode and returns a targeted, user-friendly response for each filter type — improving user experience and giving administrators visibility into which filters are triggering.

## Azure OpenAI RAI Subcodes

All RAI errors arrive as `ContentFiltered` at the top level, but internally they break down into specific subcodes:

| Subcode | Category | What It Catches |
|---------|----------|-----------------|
| `OpenAIViolence` | Core Content | Violent content, weapons, physical harm |
| `OpenAIHate` | Core Content | Hateful or discriminatory content based on identity |
| `OpenAISexual` | Core Content | Sexually explicit or inappropriate content |
| `OpenAISelfHarm` | Core Content | Content related to self-injury or suicide |
| `OpenAIJailBreak` | Security | User attempts to override system instructions, role-play attacks, prompt injection |
| `OpenAIndirectAttack` | Security | Indirect prompt attacks embedded in external/grounded data (documents, knowledge sources) |

**Key distinction:**
- `OpenAIJailBreak` = the **user** is trying to manipulate the model
- `OpenAIndirectAttack` = a **document or data source** the agent is using contains the attack

> **Note:** The subcode is `OpenAIndirectAttack` (not `OpenAIIndirectAttack`) — this matches the actual Azure OpenAI API spelling.

## Pattern Overview

```
OnError topic fires
        |
        v
Set timestamp variable
        |
        v
AI Builder model classifies error subcode
  (input: System.Activity.Text -> output: Topic.ContentFilteringreason)
        |
        v
Single ConditionGroup (switch-style) on Topic.ContentFilteringreason.text
  |-- "OpenAIViolence"      -> violence-specific message
  |-- "OpenAIHate"          -> hate-specific message
  |-- "OpenAISexual"        -> sexual content message
  |-- "OpenAISelfHarm"      -> self-harm message + crisis resources
  |-- "OpenAIJailBreak"     -> jailbreak attempt message
  |-- "OpenAIndirectAttack" -> indirect attack message
  |-- else                  -> generic content policy message
        |
        v
Error details message (else fallback)
        |
        v
Log telemetry -> CancelAllDialogs
```

## Why Use a Single ConditionGroup (Switch-Style)

Only one RAI subcode can match per error. Using separate sequential `ConditionGroup` nodes for each subcode is wasteful — each one evaluates independently even after a match. A single `ConditionGroup` with all subcodes as branches in its `conditions` array:

- **Evaluates top-to-bottom and enters the first match** — like a switch/case statement
- **Enables `elseActions`** — a fallback for unrecognized or new subcodes that may be added in the future
- **Is easier to maintain** — all RAI handling is in one node, not scattered across 6 separate nodes
- **Matches the pattern used elsewhere** (e.g., knowledge routing in orchestrator-variables best practice)

## Implementation

### Step 1 — Add the AI Builder Prompt Node (Manual)

> **This step must be done manually in the Copilot Studio UI.** The plugin cannot create or configure AI Builder models — the user must add the AI Builder prompt node themselves.

1. Open the **OnError** topic in the Copilot Studio authoring canvas
2. Add an **AI Builder prompt** node after the timestamp variable and before the condition group
3. Configure the prompt to classify the error subcode from the user's message
4. Set the input to the user's message (`System.Activity.Text`)
5. Map the output to a topic variable (e.g., `Topic.ContentFilteringreason`)

Use the following for the AI Builder prompt:

```
Analyze the following user message and identify which Azure OpenAI Content Filter subcode
would be triggered. Output **only** the exact subcode — nothing else.

---

## User Message

  User Message

---

## Azure OpenAI Content Filter Subcodes

### Core Content Categories

| Subcode | What It Catches |
|---|---|
| `OpenAIViolence` | Violent content, weapons, physical harm |
| `OpenAIHate` | Hateful or discriminatory content based on identity |
| `OpenAISexual` | Sexually explicit or inappropriate content |
| `OpenAISelfHarm` | Content related to self-injury or suicide |

### Security / Attack Detection

| Subcode | What It Catches |
|---|---|
| `OpenAIJailBreak` | Attempts to override system instructions, role-play attacks, prompt injection **from the user** |
| `OpenAIndirectAttack` | Prompt attacks embedded in external/grounded data (documents, knowledge sources) attempting to manipulate content, exfiltrate data, block capabilities, execute code, or commit fraud |

> **Key distinction:**
> - `OpenAIJailBreak` = the **user** is trying to manipulate the model
> - `OpenAIndirectAttack` = a **document or data source** contains the attack

---

## Output Instruction

Output only the exact matching subcode. Example: `OpenAIViolence`
```

Once the AI Builder prompt node is in place and the output variable is set, the ConditionGroup will reference that output variable to branch on the RAI subcode.

### Step 2 — Full Topic YAML

Below is the complete OnError topic YAML with the timestamp variable, AI Builder classification, RAI switch ConditionGroup, telemetry logging, and dialog cancellation. Paste this into the Code editor view of your OnError topic:

```yaml
kind: AdaptiveDialog
startBehavior: UseLatestPublishedContentAndCancelOtherTopics
beginDialog:
  kind: OnError
  id: main
  actions:
    - kind: SetVariable
      id: setVariable_timestamp
      variable: init:Topic.CurrentTime
      value: =Text(Now(), DateTimeFormat.UTC)

    - kind: InvokeAIBuilderModelAction
      id: invokeAIBuilderModelAction_xxoZmJ
      input:
        binding:
          User_20Message: =System.Activity.Text
      output:
        binding:
          predictionOutput: Topic.ContentFilteringreason
      aIModelId: 216b2153-49c5-4291-a730-6bccd47710d2

    - kind: ConditionGroup
      id: conditionGroup_raiSwitch
      conditions:
        - id: cond_Vl8mRk
          condition: =Topic.ContentFilteringreason.text = "OpenAIViolence"
          actions:
            - kind: SendActivity
              id: sendMessage_Vl8mRk
              activity: "[PLACEHOLDER] Your message was flagged for violent content. Please rephrase your request without references to violence, weapons, or physical harm."

        - id: cond_Ht4nQw
          condition: =Topic.ContentFilteringreason.text = "OpenAIHate"
          actions:
            - kind: SendActivity
              id: sendMessage_Ht4nQw
              activity: "[PLACEHOLDER] Your message was flagged for hateful or discriminatory content. Please rephrase your request without references to identity-based hate or discrimination."

        - id: cond_Sx7pLe
          condition: =Topic.ContentFilteringreason.text = "OpenAISexual"
          actions:
            - kind: SendActivity
              id: sendMessage_Sx7pLe
              activity: "[PLACEHOLDER] Your message was flagged for sexually explicit or inappropriate content. Please rephrase your request."

        - id: cond_Sh9tWz
          condition: =Topic.ContentFilteringreason.text = "OpenAISelfHarm"
          actions:
            - kind: SendActivity
              id: sendMessage_Sh9tWz
              activity: "[PLACEHOLDER] Your message was flagged for content related to self-harm. If you or someone you know is in crisis, please contact emergency services or a crisis helpline."

        - id: cond_Jb2kAx
          condition: =Topic.ContentFilteringreason.text = "OpenAIJailBreak"
          actions:
            - kind: SendActivity
              id: sendMessage_Jb2kAx
              activity: "[PLACEHOLDER] Your message was flagged as an attempt to override the system instructions. This type of prompt manipulation is not allowed."

        - id: cond_Ia5rNv
          condition: =Topic.ContentFilteringreason.text = "OpenAIndirectAttack"
          actions:
            - kind: SendActivity
              id: sendMessage_Ia5rNv
              activity: "[PLACEHOLDER] A prompt injection attack was detected in external data (document or knowledge source). The request has been blocked for safety."

      elseActions:
        - kind: SendActivity
          id: sendMessage_dZ0gaF
          activity:
            text:
              - |-
                An error has occurred.
                Error code: {System.Error.Code}
                Conversation Id: {System.Conversation.Id}
                Time (UTC): {Topic.CurrentTime}.
            speak:
              - An error has occurred, please try again.

    - kind: LogCustomTelemetryEvent
      id: 9KwEAn
      eventName: OnErrorLog
      properties: "={ErrorMessage: System.Error.Message, ErrorCode: System.Error.Code, TimeUTC: Topic.CurrentTime, ConversationId: System.Conversation.Id}"

    - kind: CancelAllDialogs
      id: NW7NyY
```

**Replace:**
- All `[PLACEHOLDER]` messages with your organization's approved response text
- The `aIModelId` value with your own AI Builder model ID

> **Note:** The variable name is `Topic.ContentFilteringreason` (lowercase "r") — this must match exactly between the AI Builder output binding and the ConditionGroup conditions.

## When to Use This Pattern

- Your agent handles sensitive topics where generic error messages are insufficient
- You need category-specific responses (e.g., crisis resources for self-harm, security notifications for jailbreak attempts)
- Administrators need visibility into which RAI filter categories are triggering most often
- Your industry requires tailored messaging for content policy violations (healthcare, education, government)
