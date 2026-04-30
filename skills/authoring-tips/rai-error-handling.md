# RAI Error Handling in OnError Topic

Catch Azure OpenAI Responsible AI content-filter errors in the `OnError` topic, classify them by subcode, and deliver tailored, user-friendly messages instead of a generic error. Platform-level RAI filters are tuned for a general audience — this tip lets industry-specific agents (healthcare, education, government) provide empathetic, professional responses per filter category without weakening the filter itself.

## When to Use This Pattern

- Your agent handles sensitive topics where generic error messages are insufficient
- You need category-specific responses (e.g., crisis resources for self-harm, security notifications for jailbreak attempts)
- Administrators need visibility into which RAI categories trigger most often
- Your industry requires tailored messaging for content-policy violations

## Azure OpenAI RAI Subcodes

All RAI errors arrive as `ContentFiltered`, but the subcode identifies the exact category:

| Subcode | What It Catches |
|---|---|
| `OpenAIViolence` | Violent content, weapons, physical harm |
| `OpenAIHate` | Hateful or discriminatory content |
| `OpenAISexual` | Sexually explicit content |
| `OpenAISelfHarm` | Self-injury or suicide content |
| `OpenAIJailBreak` | **User** attempts to override system instructions / prompt injection |
| `OpenAIndirectAttack` | Prompt attacks embedded in **external data** (documents, knowledge sources) |

> **Note:** The subcode is `OpenAIndirectAttack` (not `OpenAIIndirectAttack`) — this matches the Azure OpenAI API spelling exactly. `OpenAIJailBreak` = the user attacks the model; `OpenAIndirectAttack` = a grounded document contains the attack.

## How It Works

1. `OnError` fires → capture a UTC timestamp for telemetry
2. **AI Builder prompt** classifies the user's message into one of the subcodes (output → `Topic.ContentFilteringreason`)
3. **Single `ConditionGroup`** evaluates the subcode switch-style and sends the matching response (fallback in `elseActions`)
4. `LogCustomTelemetryEvent` records the incident, then `CancelAllDialogs` closes cleanly

## Why a Single ConditionGroup (Switch-Style)

Only one subcode matches per error. Putting each subcode in its own sequential `ConditionGroup` node evaluates them all independently, even after a match. A single `ConditionGroup` with all branches in `conditions` stops on first match, enables an `elseActions` fallback for future/unknown subcodes, and keeps all RAI handling in one node.

## YAML Example

Paste into the Code editor view of your **OnError** system topic:

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
      aIModelId: <YOUR_AI_BUILDER_MODEL_ID>

    - kind: ConditionGroup
      id: conditionGroup_raiSwitch
      conditions:
        - id: cond_Vl8mRk
          condition: =Topic.ContentFilteringreason.text = "OpenAIViolence"
          actions:
            - kind: SendActivity
              id: sendMessage_Vl8mRk
              activity: "[PLACEHOLDER] Your message was flagged for violent content. Please rephrase your request."

        - id: cond_Ht4nQw
          condition: =Topic.ContentFilteringreason.text = "OpenAIHate"
          actions:
            - kind: SendActivity
              id: sendMessage_Ht4nQw
              activity: "[PLACEHOLDER] Your message was flagged for hateful or discriminatory content."

        - id: cond_Sx7pLe
          condition: =Topic.ContentFilteringreason.text = "OpenAISexual"
          actions:
            - kind: SendActivity
              id: sendMessage_Sx7pLe
              activity: "[PLACEHOLDER] Your message was flagged for sexually explicit content."

        - id: cond_Sh9tWz
          condition: =Topic.ContentFilteringreason.text = "OpenAISelfHarm"
          actions:
            - kind: SendActivity
              id: sendMessage_Sh9tWz
              activity: "[PLACEHOLDER] If you or someone you know is in crisis, please contact emergency services or a crisis helpline."

        - id: cond_Jb2kAx
          condition: =Topic.ContentFilteringreason.text = "OpenAIJailBreak"
          actions:
            - kind: SendActivity
              id: sendMessage_Jb2kAx
              activity: "[PLACEHOLDER] Your message was flagged as an attempt to override system instructions."

        - id: cond_Ia5rNv
          condition: =Topic.ContentFilteringreason.text = "OpenAIndirectAttack"
          actions:
            - kind: SendActivity
              id: sendMessage_Ia5rNv
              activity: "[PLACEHOLDER] A prompt injection attack was detected in external data. The request has been blocked."

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

## AI Builder Classifier Prompt

The plugin cannot create AI Builder models — add the prompt node manually in the Copilot Studio UI with input `System.Activity.Text` and output `Topic.ContentFilteringreason`. Use this prompt body:

```
Analyze the following user message and identify which Azure OpenAI Content Filter subcode
would be triggered. Output **only** the exact subcode — nothing else.

Subcodes: OpenAIViolence, OpenAIHate, OpenAISexual, OpenAISelfHarm,
          OpenAIJailBreak, OpenAIndirectAttack

OpenAIJailBreak = user tries to manipulate the model.
OpenAIndirectAttack = external/grounded data contains the attack.

Output only the exact matching subcode. Example: OpenAIViolence
```

## Key Points

- **Platform RAI filtering is untouched** — this pattern only changes the *message delivered to the user* after the platform filters fire
- **Variable name must match exactly** — `Topic.ContentFilteringreason` (lowercase "r") in both the AI Builder output binding and ConditionGroup conditions
- **Replace every `[PLACEHOLDER]`** with your organization's approved response text, and replace `aIModelId` with your own AI Builder model ID
- **`elseActions` catches new subcodes** — Azure OpenAI may add categories; the fallback ensures graceful handling until you add a branch
