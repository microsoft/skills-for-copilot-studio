# Copilot Studio YAML Reference

This file contains reference tables for Copilot Studio YAML authoring. For workflow instructions, see [CLAUDE.md](./CLAUDE.md).

## Core File Types

| File | Purpose |
|------|---------|
| `agent.mcs.yml` | Main agent metadata (kind: GptComponentMetadata) |
| `settings.mcs.yml` | Agent settings and configuration |
| `connectionreferences.mcs.yml` | Connector references |
| `topics/*.mcs.yml` | Conversation topics (kind: AdaptiveDialog) |
| `actions/*.mcs.yml` | Connector-based actions (kind: TaskDialog) |
| `knowledge/*.mcs.yml` | Knowledge sources (kind: KnowledgeSourceConfiguration) |
| `agents/*.mcs.yml` | Child agents (kind: AgentDialog) |

## Trigger Types

| Kind | Purpose |
|------|---------|
| `OnRecognizedIntent` | Trigger phrases matched |
| `OnConversationStart` | Conversation begins |
| `OnUnknownIntent` | No topic matched (fallback) |
| `OnEscalate` | User requests human agent |
| `OnError` | Error handling |
| `OnSystemRedirect` | Triggered by redirect only |
| `OnSelectIntent` | Multiple topics matched (disambiguation) |
| `OnSignIn` | Authentication required |
| `OnToolSelected` | Child agent invocation |

## Action Types

| Kind | Purpose |
|------|---------|
| `SendActivity` | Send a message |
| `Question` | Ask user for input |
| `SetVariable` | Set/compute a variable |
| `SetTextVariable` | Set text directly |
| `ConditionGroup` | Branching logic |
| `BeginDialog` | Call another topic |
| `ReplaceDialog` | Replace current topic |
| `EndDialog` | End current topic |
| `CancelAllDialogs` | Cancel all topics |
| `ClearAllVariables` | Clear variables |
| `SearchAndSummarizeContent` | Generative answers (grounded in knowledge) |
| `AnswerQuestionWithAI` | AI answer (conversation history + general knowledge only) |
| `EditTable` | Modify a collection |
| `CSATQuestion` | Customer satisfaction |
| `LogCustomTelemetryEvent` | Logging |
| `OAuthInput` | Sign-in prompt |

## System Variables

| Variable | Description |
|----------|-------------|
| `System.Bot.Name` | Agent's name |
| `System.Activity.Text` | User's current message |
| `System.Conversation.Id` | Conversation identifier |
| `System.Conversation.InTestMode` | True if in test chat |
| `System.FallbackCount` | Number of consecutive fallbacks |
| `System.Error.Message` | Error message |
| `System.Error.Code` | Error code |
| `System.SignInReason` | Why sign-in was triggered |
| `System.Recognizer.IntentOptions` | Matched intents for disambiguation |
| `System.Recognizer.SelectedIntent` | User's selected intent |

## Prebuilt Entities

| Entity | Use Case |
|--------|----------|
| `BooleanPrebuiltEntity` | Yes/No questions |
| `NumberPrebuiltEntity` | Numeric inputs |
| `StringPrebuiltEntity` | Free text |
| `DateTimePrebuiltEntity` | Date/time |
| `EMailPrebuiltEntity` | Email addresses |

## Power Fx Expression Reference

```yaml
# Arithmetic
value: =Text(Topic.number1 + Topic.number2)

# Date formatting
value: =Text(Now(), DateTimeFormat.UTC)

# Conditions
condition: =System.FallbackCount < 3
condition: =Topic.EndConversation = true
condition: =!IsBlank(Topic.Answer)
condition: =System.Conversation.InTestMode = true
condition: =System.SignInReason = SignInReason.SignInRequired
condition: =System.Recognizer.SelectedIntent.TopicId = "NoTopic"

# String interpolation in activity (uses {} without =)
activity: "Error: {System.Error.Message}"
activity: "Error code: {System.Error.Code}, Time (UTC): {Topic.CurrentTime}"

# Record creation
value: "={ DisplayName: Topic.NoneOfTheseDisplayName, TopicId: \"NoTopic\", TriggerId: \"NoTrigger\", Score: 1.0 }"

# Variable initialization (first assignment uses init: prefix)
variable: init:Topic.UserEmail
variable: init:Topic.CurrentTime
# Subsequent assignments omit init:
variable: Topic.UserEmail
```

## Generative Orchestration Patterns

When `GenerativeActionsEnabled: true` in `settings.mcs.yml`:

### Topic Inputs (AutomaticTaskInput)

Auto-collect user info — the orchestrator prompts the user based on the description. No explicit Question node needed.

```yaml
inputs:
  - kind: AutomaticTaskInput
    propertyName: userName
    description: "The user's name"
    entity: StringPrebuiltEntity
    shouldPromptUser: true

  - kind: AutomaticTaskInput
    propertyName: orderNumber
    description: "The order number to look up"
    entity: NumberPrebuiltEntity
    shouldPromptUser: true
```

**When to still use Question nodes instead of inputs:**
- Conditional asks: ask X only if condition Y is met (input is only needed in a specific branch)
- End-of-flow confirmations: "Are you satisfied?" (can't answer before seeing the outcome)

### Topic Outputs

Return values to the orchestrator, which generates the user-facing message.

```yaml
outputType:
  properties:
    result:
      displayName: result
      description: The computed result
      type: String
```

- Do NOT use `SendActivity` to show final outputs (rare exception: precise mid-flow messages).
- The orchestrator phrases the response based on the agent instructions.

### inputType/outputType Schema

Always define schemas that match your inputs/outputs:

```yaml
inputType:
  properties:
    userName:
      displayName: userName
      description: "The user's name"
      type: String
    orderNumber:
      displayName: orderNumber
      type: Number

outputType:
  properties:
    result:
      displayName: result
      description: The lookup result
      type: String
```

## Generative Answers Pattern

### SearchAndSummarizeContent (grounded in knowledge)

```yaml
- kind: SearchAndSummarizeContent
  id: search-content_abc123
  variable: Topic.Answer
  userInput: =System.Activity.Text

- kind: ConditionGroup
  id: conditionGroup_def456
  conditions:
    - id: conditionItem_ghi789
      condition: =!IsBlank(Topic.Answer)
      actions:
        - kind: EndDialog
          id: endDialog_jkl012
          clearTopicQueue: true
```

Always follow `SearchAndSummarizeContent` with a `ConditionGroup` to check if an answer was found.

### AnswerQuestionWithAI (no knowledge sources)

Use only when you want the model to respond from conversation history and general knowledge — no external data.

## Available Templates

| Template | File | Pattern |
|----------|------|---------|
| Greeting | `templates/topics/greeting.topic.mcs.yml` | OnConversationStart welcome |
| Fallback | `templates/topics/fallback.topic.mcs.yml` | OnUnknownIntent with escalation |
| Arithmetic | `templates/topics/arithmeticsum.topic.mcs.yml` | Inputs/outputs with computation |
| Question + Branching | `templates/topics/question-topic.topic.mcs.yml` | Question with ConditionGroup |
| Knowledge Search | `templates/topics/search-topic.topic.mcs.yml` | SearchAndSummarizeContent fallback |
| Authentication | `templates/topics/auth-topic.topic.mcs.yml` | OnSignIn with OAuthInput |
| Error Handler | `templates/topics/error-handler.topic.mcs.yml` | OnError with telemetry |
| Disambiguation | `templates/topics/disambiguation.topic.mcs.yml` | OnSelectIntent flow |
| Agent | `templates/agents/agent.mcs.yml` | GptComponentMetadata |
| Connector Action | `templates/actions/connector-action.mcs.yml` | TaskDialog with connector |
| Knowledge Source | `templates/knowledge/public-website.knowledge.mcs.yml` | Public website |
