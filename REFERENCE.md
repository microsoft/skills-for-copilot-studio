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
| `variables/*.mcs.yml` | Global variables (kind: GlobalVariableComponent) |
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
| `OnKnowledgeRequested` | Custom knowledge source search triggered (YAML-only, no UI) |
| `OnGeneratedResponse` | Intercept AI-generated response before sending |

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
| `SearchKnowledgeSources` | Search knowledge sources (returns raw results, no AI summary) |
| `CreateSearchQuery` | AI-generated search query from user input |

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
| `System.SearchQuery` | AI-rewritten search query (available in `OnKnowledgeRequested`) |
| `System.KeywordSearchQuery` | Keyword version of search query (available in `OnKnowledgeRequested`) |
| `System.SearchResults` | Table to populate with custom search results — schema: Content, ContentLocation, Title (available in `OnKnowledgeRequested`) |
| `System.ContinueResponse` | Set to `false` in `OnGeneratedResponse` to suppress auto-send |
| `System.Response.FormattedText` | The AI-generated response text (available in `OnGeneratedResponse`) |

### Variable Scopes

| Prefix | Scope | Lifetime |
|--------|-------|----------|
| `Topic.<name>` | Topic variable | Current topic only |
| `Global.<name>` | Global variable | Entire conversation (defined in `variables/` folder) |
| `System.<name>` | System variable | Built-in, read-only |

Global variables are defined as YAML files in `variables/<Name>.mcs.yml` (kind: `GlobalVariableComponent`). Set `aIVisibility: UseInAIContext` to make them visible to the AI orchestrator.

## Prebuilt Entities

| Entity | Use Case |
|--------|----------|
| `BooleanPrebuiltEntity` | Yes/No questions |
| `NumberPrebuiltEntity` | Numeric inputs |
| `StringPrebuiltEntity` | Free text |
| `DateTimePrebuiltEntity` | Date/time |
| `EMailPrebuiltEntity` | Email addresses |

## Power Fx Expression Reference

**Only use functions from the supported list below.** Copilot Studio supports a subset of Power Fx — using unsupported functions will cause errors.

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

### Supported Power Fx Functions

These are **all** the Power Fx functions available in Copilot Studio. Do NOT use any function not on this list.

**Math**: `Abs`, `Acos`, `Acot`, `Asin`, `Atan`, `Atan2`, `Cos`, `Cot`, `Degrees`, `Exp`, `Int`, `Ln`, `Log`, `Mod`, `Pi`, `Power`, `Radians`, `Rand`, `RandBetween`, `Round`, `RoundDown`, `RoundUp`, `Sin`, `Sqrt`, `Sum`, `Tan`, `Trunc`

**Text**: `Char`, `Concat`, `Concatenate`, `EncodeHTML`, `EncodeUrl`, `EndsWith`, `Find`, `Left`, `Len`, `Lower`, `Match`, `MatchAll`, `Mid`, `PlainText`, `Proper`, `Replace`, `Right`, `Search`, `Split`, `StartsWith`, `Substitute`, `Text`, `Trim`, `TrimEnds`, `UniChar`, `Upper`, `Value`

**Date/Time**: `Date`, `DateAdd`, `DateDiff`, `DateTime`, `DateTimeValue`, `DateValue`, `Day`, `EDate`, `EOMonth`, `Hour`, `IsToday`, `Minute`, `Month`, `Now`, `Second`, `Time`, `TimeValue`, `TimeZoneOffset`, `Today`, `Weekday`, `WeekNum`, `Year`

**Logical**: `And`, `Coalesce`, `If`, `IfError`, `IsBlank`, `IsBlankOrError`, `IsEmpty`, `IsError`, `IsMatch`, `IsNumeric`, `IsType`, `Not`, `Or`, `Switch`

**Table**: `AddColumns`, `Column`, `ColumnNames`, `Count`, `CountA`, `CountIf`, `CountRows`, `Distinct`, `DropColumns`, `Filter`, `First`, `FirstN`, `ForAll`, `Index`, `Last`, `LastN`, `LookUp`, `Patch`, `Refresh`, `RenameColumns`, `Sequence`, `ShowColumns`, `Shuffle`, `Sort`, `SortByColumns`, `Summarize`, `Table`

**Aggregate**: `Average`, `Max`, `Min`, `StdevP`, `VarP`

**Type conversion**: `AsType`, `Boolean`, `Dec2Hex`, `Decimal`, `Float`, `GUID`, `Hex2Dec`, `JSON`, `ParseJSON`

**Other**: `Blank`, `ColorFade`, `ColorValue`, `Error`, `Language`, `OptionSetInfo`, `RGBA`, `Trace`, `With`

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

### Dynamic Knowledge URLs

Knowledge source URLs support `{VariableName}` placeholders for dynamic routing based on user context. For example:

```yaml
source:
  kind: PublicSiteSearchSource
  site: "https://docs.example.com/{Global.Region}/api"
```

Use global variables combined with Power Fx `LookUp()` to set region or context-based values, then reference them in knowledge source URLs.

## Response Post-Processing Patterns

### Citation Removal via OnGeneratedResponse

Use the `OnGeneratedResponse` trigger to intercept AI responses and strip citation markers (`[1]`, `[2]`, etc.) before sending to the user.

**Pattern: Suppress auto-send and clean up**

```yaml
kind: AdaptiveDialog
beginDialog:
  kind: OnGeneratedResponse
  id: main
  actions:
    - kind: SetVariable
      id: setVariable_<random>
      variable: System.ContinueResponse
      value: =false

    - kind: SetVariable
      id: setVariable_<random>
      variable: Topic.CleanedText
      value: "=Substitute(Substitute(Substitute(Substitute(Substitute(System.Response.FormattedText, \"[1]\", \"\"), \"[2]\", \"\"), \"[3]\", \"\"), \"[4]\", \"\"), \"[5]\", \"\")"

    - kind: SendActivity
      id: sendActivity_<random>
      activity: "{Topic.CleanedText}"
```

This sets `System.ContinueResponse = false` to prevent the original response from being sent, then uses nested `Substitute()` calls to strip citation markers and sends the cleaned text manually.

See also: the **Remove Citations** template in Available Templates.

## Available Templates

| Template | File | Pattern |
|----------|------|---------|
| Greeting | `templates/topics/greeting.topic.mcs.yml` | OnConversationStart welcome |
| Fallback | `templates/topics/fallback.topic.mcs.yml` | OnUnknownIntent with escalation |
| Arithmetic | `templates/topics/arithmeticsum.topic.mcs.yml` | Inputs/outputs with computation |
| Question + Branching | `templates/topics/question-topic.topic.mcs.yml` | Question with ConditionGroup |
| Knowledge Search | `templates/topics/search-topic.topic.mcs.yml` | SearchAndSummarizeContent fallback |
| Custom Knowledge Source | `templates/topics/custom-knowledge-source.topic.mcs.yml` | OnKnowledgeRequested with custom API (YAML-only) |
| Remove Citations | `templates/topics/remove-citations.topic.mcs.yml` | OnGeneratedResponse citation stripping |
| Authentication | `templates/topics/auth-topic.topic.mcs.yml` | OnSignIn with OAuthInput |
| Error Handler | `templates/topics/error-handler.topic.mcs.yml` | OnError with telemetry |
| Disambiguation | `templates/topics/disambiguation.topic.mcs.yml` | OnSelectIntent flow |
| Agent | `templates/agents/agent.mcs.yml` | GptComponentMetadata |
| Connector Action | `templates/actions/connector-action.mcs.yml` | TaskDialog with connector |
| Knowledge (Public Website) | `templates/knowledge/public-website.knowledge.mcs.yml` | PublicSiteSearchSource |
| Knowledge (SharePoint) | `templates/knowledge/sharepoint.knowledge.mcs.yml` | SharePointSearchSource |
| Global Variable | `templates/variables/global-variable.variable.mcs.yml` | GlobalVariableComponent |


## How Knowledge Works

### Retrieval Pipeline
When a user sends a message, Copilot Studio:
1. **Splits** each knowledge source into overlapping text chunks at index time
2. **Embeds** the user's query and all chunks as vectors
3. **Ranks** chunks by semantic similarity to the query
4. **Passes** the top-ranked chunks as context into the language model
5. **Generates** a response grounded in those chunks, with citations

The quality of the answer depends on: chunk relevance, document structure, and the `instructions` field guiding the model's behavior.

### Automatic vs Explicit Retrieval
Copilot Studio has two modes:

| Mode | How it works |
|---|---|
| **Automatic** (`GenerativeActionsEnabled: true`) | The orchestrator decides when to search knowledge based on the user's message. No topic needed for simple Q&A. |
| **Explicit** (via `SearchAndSummarizeContent` node) | A topic explicitly triggers a knowledge search. Use when you need to control which sources are searched, scope the query, or process the result before sending. |

For most agents, automatic mode is sufficient. Add explicit topics only when you need flow control or source scoping.

### The UniversalSearchTool
When the orchestrator detects a knowledge search intent in the user's message, it calls a single internal tool: **`UniversalSearchTool`**.

**How it works:**
- It searches **all configured knowledge sources** simultaneously, regardless of their type (public website, SharePoint, Dataverse, uploaded files, AI Search, etc.)
- It returns the best-matching results for the query — the number of results surfaced is controlled by the **Content Moderation slider** in the agent's Generative AI settings (higher = more results included, lower = more selective)
- The orchestrator then passes those results to the language model to generate the final grounded answer

**The 25-source limit:**
- `UniversalSearchTool` supports up to **25 knowledge sources**
- If the agent has **≤ 25 sources**: all sources are always searched on every call
- If the agent has **> 25 sources**: the orchestrator **selects up to 25 sources** that best match the search intent — the selection is driven by each knowledge source's **`# Name:` and description comment**

**Implication for authoring:**
- **Line 1 (`# Name:`)** is the display name shown in the Copilot Studio UI
- **Line 2 (plain comment)** is the description of the knowledge source — no `Description:` prefix, just the text directly (e.g. `# HR leave policies and employee entitlements`). This is what the orchestrator reads to decide which sources to include when the agent exceeds 25 sources. Write it to clearly describe the subject matter covered
- Vague or missing descriptions cause sources to be deprioritized for relevant queries when the agent exceeds 25 sources

### Role of `instructions` in Knowledge Usage
The `instructions` field in `agent.mcs.yml` is the system prompt. It is the most powerful lever for improving knowledge-based responses. It directly controls:
- **Grounding**: whether the agent sticks to knowledge sources or adds general model knowledge
- **Tone & format**: how answers are structured (bullet points, concise, formal, etc.)
- **Citation behavior**: whether the agent explicitly references sources
- **Fallback behavior**: what the agent says when no relevant information is found
- **Scope enforcement**: whether the agent stays on-topic or answers anything

### Writing Knowledge-Aware Instructions
Use these directives in `instructions` to shape knowledge behavior:

**Inject the current date:**
```
Today's date is {Today()}. Use it when answering questions about deadlines, validity, upcoming events, or anything time-sensitive.
```
`Today()` is a Power Fx function that resolves at runtime — no topic or global variable needed. Use it directly in the `instructions` field. For time-of-day precision use `Now()` instead.

**Ground answers in knowledge sources:**
```
Always base your answers on the provided knowledge sources.
Do not use general model knowledge to answer questions about [topic].
If the answer is not in the knowledge sources, say: "I don't have information about that. You can contact [support channel] for help."
```

**Control citation behavior:**
```
Always cite the source document when providing an answer.
Do not fabricate sources or links that are not in the search results.
```

**Enforce topic scope:**
```
You only answer questions about [subject]. If the user asks about something outside this scope,
politely redirect them: "I can only help with [subject]. For other questions, please contact [resource]."
```

**Control response format:**
```
Keep answers concise — 3 sentences or fewer unless the user asks for more detail.
Use bullet points when listing steps or multiple items.
Avoid jargon. Write for a general audience.
```

**Handle no-answer gracefully:**
```
If you cannot find a relevant answer in the knowledge sources, do not guess.
Instead, offer to connect the user with a human agent or provide a contact method.
```

### What Instructions Cannot Do
- They cannot override the model's safety guardrails
- They cannot force the agent to search a specific knowledge source — use `knowledgeSourceIds` in a `SearchAndSummarizeContent` node for that
- They cannot guarantee the agent will never hallucinate — grounding reduces it but does not eliminate it
- They cannot change chunking or embedding behavior — that is controlled by the knowledge source content quality

## Knowledge Best Practices

### Source Selection
- Use **PublicSiteSearchSource** for publicly accessible websites (docs, marketing sites, FAQs)
- Use **SharePointSearchSource** for internal company content
- Use **GraphConnectorSearchSource** for enterprise systems indexed via Microsoft Graph connectors (ServiceNow, Salesforce, Jira, custom connectors, etc.) — see below
- All other types (Dataverse, AI Search, uploaded files, SQL) must be configured via the Copilot Studio UI

### Graph Connector Knowledge Sources

Microsoft Graph connectors index content from enterprise systems into the Microsoft 365 index, making it searchable by Copilot Studio agents. Examples: ServiceNow, Salesforce, Jira, Azure DevOps, or any custom connector registered in the M365 admin center.

**Prerequisites — cannot be done in YAML:**
1. The Graph connector must be registered and enabled in the **M365 admin center** (Search & Intelligence → Data Sources)
2. The connector's `connectionId` must be stored as a **Power Platform environment variable** in the solution — this is the value referenced in the YAML

**YAML structure:**
```yaml
# Name: ServiceNow Knowledge Base
# ServiceNow tickets and knowledge articles indexed via Microsoft Graph connector.
kind: KnowledgeSourceConfiguration
source:
  kind: GraphConnectorSearchSource
  connectionId:
    schemaName: cr123_GraphConnectorId_ServiceNow   # Power Platform environment variable
  connectionName: servicenow-connection             # Logical name from M365 admin center
  contentSourceDisplayName: ServiceNow              # Shown in citations
  publisherName: ServiceNow
```

**Key fields:**
- `connectionId.schemaName` — references a Power Platform environment variable (not a raw GUID). Read the variable's schema name from the solution's environment variables or the Copilot Studio UI after the connector is added.
- `connectionName` — the logical name of the Graph connection as registered in M365 admin center
- `contentSourceDisplayName` — the label shown on citations in the agent's answers
- `publisherName` — optional; shown in the Copilot Studio UI
- `triggerCondition` — supported; use `=false` to opt out of automatic `UniversalSearchTool` searches

Use the template at `templates/knowledge/graph-connector.knowledge.mcs.yml`.

### Naming & Organization
- **Line 1 — `# Name:`** — the display name shown in the Copilot Studio UI
- **Line 2 — plain comment** — the description of the knowledge source (no `Description:` prefix, just the text directly). This is what the orchestrator's `UniversalSearchTool` reads to decide which sources to include when the agent has more than 25 knowledge sources. Write it to clearly describe the subject matter covered: `# HR leave policies and employee entitlements` is better than `# HR docs`
- Use one knowledge source per distinct content domain (e.g. one for HR policies, one for IT docs)
- Avoid overlapping sources covering the same content — it degrades answer quality
- Use descriptive, lowercase, hyphenated filenames: `hr-policies.knowledge.mcs.yml` not `ks1.knowledge.mcs.yml`

### URL Guidelines
**Public websites:**
- Provide the most specific URL that covers the needed content (e.g. `https://docs.example.com/products/` not `https://example.com/`)
- The site must be publicly crawlable — no login required
- Avoid URLs that return dynamic content or require JavaScript rendering
- Subdomains are treated as separate sources; add them individually if needed

**SharePoint:**
- Use the deepest folder path that covers the needed documents (avoid sharing the root site)
- Encode spaces as `%20` in the URL
- Supported document types: PDF, Word (.docx), PowerPoint (.pptx), plain text
- Ensure the agent's service account has read access to the SharePoint site
- Example: `https://contoso.sharepoint.com/sites/HR/Shared%20Documents/Policies`

### Content Quality
- Documents should have clear headings and titles — Copilot Studio uses these for chunking and citation
- Avoid sources that are mostly tables, images, or charts with no surrounding text — they produce poor answers
- Scanned PDFs without OCR text are not searchable — ensure PDFs have selectable text
- Keep documents focused on a single topic — a full company handbook produces lower-quality answers than individual policy documents
- Avoid duplicate content across multiple documents — it confuses relevance ranking
- Short documents (< 1 page) may not provide enough context; consider combining related short docs

### Quantity & Quality
- Keep the number of knowledge sources reasonable (ideally ≤ 10 per agent) — too many degrade relevance ranking
- Prefer narrower, well-scoped sources over broad ones
- Test knowledge sources with representative user queries after adding them

### Security Considerations
- **SharePoint**: the agent uses a service account — all users receive answers from all content the service account can access, regardless of the user's own SharePoint permissions
- Do not index folders containing confidential or restricted documents unless every user of the agent is authorized to see them
- For multi-audience agents (e.g. HR + general staff), use separate knowledge sources per audience and control access at the topic level

### Maintenance
- Public websites are re-crawled periodically — URL changes silently break indexing; monitor source URLs for redirects or removal
- SharePoint: new files added to the indexed folder are picked up automatically; renaming or moving files breaks existing citations
- Review all knowledge sources quarterly — remove or update stale sources to avoid outdated answers
- When a source URL changes, update the YAML file and push via the VS Code extension; do not create a duplicate source

### Testing & Validation
- After adding a source, ask the agent a representative question to verify retrieval from the new source
- If the agent says "I don't have information about that", check: (1) URL is correct and accessible, (2) site is publicly crawlable or SharePoint permissions are in place, (3) content is text-based and not image-only
- Use multiple test queries per source — a single passing test is not sufficient
- Check that citations returned by the agent point to the expected documents

### `triggerCondition` — Controlling When a Source Is Searched

Every knowledge source supports an optional `triggerCondition` field (a Power Fx `BoolExpression`). The `UniversalSearchTool` only includes the source in a search when this condition evaluates to `true`.

**`triggerCondition: =false`** — the most important pattern. It permanently disables automatic search for this source. The orchestrator will never include it in the `UniversalSearchTool` automatically. This is useful for:

1. **Explicit topic-controlled search** — the source is only used when a topic explicitly references it in a `SearchAndSummarizeContent` node. Gives you full control over when and how the source is queried.

2. **Startup topic initialization** — a greeting or `OnConversationStart` topic sets a global variable (e.g. `Global.UserDepartment`), then other sources use that variable in their `triggerCondition` to activate conditionally.

3. **`OnKnowledgeRequested` topic** — a topic with this trigger fires every time the orchestrator calls the `UniversalSearchTool`. Combined with `triggerCondition: =false`, you can intercept all knowledge requests and route them through custom logic before the search runs.

```yaml
# Example: source only searched for HR department users
kind: KnowledgeSourceConfiguration
source:
  kind: SharePointSearchSource
  triggerCondition: =Global.UserDepartment = "HR"
  site: https://contoso.sharepoint.com/sites/HR/Shared%20Documents
```

```yaml
# Example: source never auto-searched — only used when explicitly referenced in a topic
kind: KnowledgeSourceConfiguration
source:
  kind: SharePointSearchSource
  triggerCondition: =false
  site: https://contoso.sharepoint.com/sites/Confidential/Shared%20Documents
```

### `OnKnowledgeRequested` Trigger

This trigger fires on a topic every time the orchestrator calls the `UniversalSearchTool` (i.e. every time a knowledge search intent is detected). Use it to:
- Intercept knowledge requests and run custom logic before or after the search
- Load context, set variables, or pre-process the query
- Route the search to specific knowledge sources based on user context

```yaml
kind: AdaptiveDialog
beginDialog:
  kind: OnKnowledgeRequested
  id: main
  actions:
    # Custom logic here — runs every time a knowledge search is triggered
    - kind: SearchAndSummarizeContent
      id: searchContent_REPLACE1
      variable: Topic.Answer
      userInput: =System.Activity.Text
      knowledgeSources:
        kind: SearchSpecificKnowledgeSources
        knowledgeSources:
          - <schemaName>.topic.<KnowledgeSourceName>
```

### Topic-Level Knowledge Control
- Use `triggerCondition: =false` on a knowledge source to opt it out of automatic `UniversalSearchTool` searches — it will only be used when explicitly referenced in a `SearchAndSummarizeContent` node
- Use the `knowledgeSourceIds` filter in a `SearchAndSummarizeContent` node to restrict search to specific sources for a given topic
- Use `OnKnowledgeRequested` to intercept all knowledge searches and apply custom routing or pre-processing
- If a topic must never use knowledge (e.g. pure transactional flows), explicitly avoid `SearchAndSummarizeContent` nodes in it

### JIT Glossary Pattern
A **JIT (Just-In-Time) glossary** silently loads customer-specific acronyms into a global variable the first time each conversation receives a user message. The orchestrator uses the variable to interpret acronyms before searching knowledge sources — improving retrieval quality without polluting automatic searches.

**Why `OnActivity (type: Message)` and not `OnConversationStart`:**
- `OnConversationStart` is not fired by all channels — notably **M365 Copilot does not trigger it**. Any initialization placed there will silently not run for users coming through M365 Copilot or similar channel-embedded surfaces.
- `OnActivity (type: Message)` fires when the user actually sends a message, which also confirms real usage intent. There is no point loading a glossary or profile for a session that never goes anywhere.

**Architecture at a glance:**
1. **CSV file** (`.txt` on SharePoint, `ACRONYM,Definition` with header row)
2. **Knowledge source** with `triggerCondition: =false` — never auto-searched, explicitly loaded only
3. **Global variable** `Global.Glossary` — empty string to start, set once per session
4. **Provisioning topic** — `OnActivity` with `type: Message` and `condition: =IsBlank(Global.Glossary)` — fires JIT on the first user message only
5. **`SearchAndSummarizeContent`** with `userInput: ='*'` and `applyModelKnowledgeSetting: false` — retrieves full raw CSV text without summarizing
6. **Agent instructions** — reference `{Global.Glossary}` with a directive to look up acronyms silently before interpreting user intent

See `skills/add-glossary/SKILL.md` for the full step-by-step guide, YAML templates, and validation checklist.

### JIT User Context Pattern

The same `OnActivity` / `IsBlank` pattern can provision Microsoft 365 user profile data (country, department, display name) at the start of each conversation. This allows a knowledge agent to answer location-sensitive questions ("What is my WFH policy?") without asking the user for their country — the orchestrator already knows it from `Global.UserCountry`.

**Architecture at a glance:**
1. `OnActivity` topic with `type: Message` and `condition: =IsBlank(Global.UserCountry)` — fires JIT on first message
2. `InvokeConnectorAction` with `operationId: UserGet_V2` on the M365 Users connector — fetches the signed-in user's Azure AD profile inline (no separate action file needed)
3. `SetVariable` extracts the `.country` field with an `If(IsBlank(...), "Unknown", ...)` fallback
4. `Global.UserCountry` set to `aIVisibility: UseInAIContext` — the orchestrator includes it in its reasoning
5. Agent instructions reference `{Global.UserCountry}` with a directive to use it for location-sensitive questions

**Key difference from the glossary pattern:** `aIVisibility: UseInAIContext` instead of `HideFromAIContext` — the orchestrator needs to reason about the country, not just use it as lookup context.

See `skills/add-user-context/SKILL.md` for the full step-by-step guide including available M365 profile fields.