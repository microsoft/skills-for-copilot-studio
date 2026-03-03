# SearchAndSummarizeContent Patterns

## Pattern 1: Direct Response (autoSend: false + manual send)

Use when you want to control how the response is displayed (custom formatting, adaptive cards, or processing the result before showing it).

```yaml
actions:
  - kind: SearchAndSummarizeContent
    id: searchContent_<random>
    autoSend: false
    variable: Topic.Answer
    userInput: =System.Activity.Text
    fileSearchDataSource:
      searchFilesMode:
        kind: DoNotSearchFiles
    knowledgeSources:
      kind: SearchSpecificKnowledgeSources
      knowledgeSources:
        - <schemaName>.topic.<KnowledgeSourceName>
    applyModelKnowledgeSetting: false
    responseCaptureType: FullResponse

  - kind: ConditionGroup
    id: conditionGroup_<random>
    conditions:
      - id: conditionItem_<random>
        condition: =!IsBlank(Topic.Answer)
        actions:
          - kind: SendActivity
            id: sendActivity_<random>
            activity: "{Topic.Answer.Text.MarkdownContent}"
```

Since `autoSend: false`, the response is stored in `Topic.Answer`. The ConditionGroup checks if an answer was found, then SendActivity displays it using `{Topic.Answer.Text.MarkdownContent}`.

## Pattern 2: Orchestrator Pattern (inputs/outputs)

Use when the agent has `GenerativeActionsEnabled: true` and you want the orchestrator to incorporate the search result into its response. The topic takes an input question, searches knowledge, and returns the result as an output — the orchestrator then formulates the final user-facing message.

```yaml
kind: AdaptiveDialog
inputs:
  - kind: AutomaticTaskInput
    propertyName: QuestionToBeAnswered
    description: Your question about <topic subject>
    shouldPromptUser: true

modelDescription: This topic provides information about <topic subject>
beginDialog:
  kind: OnRecognizedIntent
  id: main
  intent: {}
  actions:
    - kind: SearchAndSummarizeContent
      id: searchContent_<random>
      autoSend: false
      variable: Topic.SearchResult
      userInput: =Topic.QuestionToBeAnswered
      fileSearchDataSource:
        searchFilesMode:
          kind: DoNotSearchFiles
      knowledgeSources:
        kind: SearchSpecificKnowledgeSources
        knowledgeSources:
          - <schemaName>.topic.<KnowledgeSourceName>
      applyModelKnowledgeSetting: false
      responseCaptureType: FullResponse

    - kind: SetVariable
      id: setVariable_<random>
      variable: Topic.Response
      value: =Topic.SearchResult.Text.Content

inputType:
  properties:
    QuestionToBeAnswered:
      displayName: QuestionToBeAnswered
      description: Your question about <topic subject>
      type: String

outputType:
  properties:
    Response:
      displayName: Response
      description: The answer to the provided question
      type: String
```

This works because the orchestrator collects `QuestionToBeAnswered` from the user, the topic searches knowledge and extracts the content into `Topic.Response`, and the orchestrator uses that output to formulate a response. No explicit SendActivity needed — the orchestrator handles it.

## Pattern 3: Fallback Search (all knowledge, autoSend default)

The simplest pattern — a fallback topic that searches all agent knowledge when no other topic matches. This is the pattern used in the agent's default Search topic.

```yaml
# Name: Knowledge Search
kind: AdaptiveDialog
beginDialog:
  kind: OnUnknownIntent
  id: main
  priority: -1
  actions:
    - kind: SearchAndSummarizeContent
      id: searchContent_<random>
      variable: Topic.Answer
      userInput: =System.Activity.Text

    - kind: ConditionGroup
      id: conditionGroup_<random>
      conditions:
        - id: conditionItem_<random>
          condition: =!IsBlank(Topic.Answer)
          actions:
            - kind: EndDialog
              id: endDialog_<random>
              clearTopicQueue: true
```

The `priority: -1` ensures this runs before the standard fallback, giving knowledge sources a chance to answer before the "I don't understand" message. This pattern searches **all** agent knowledge sources (no `knowledgeSources` restriction).

## Pattern 4: Precision Search (raw results, no AI summary)

Use when you need verbatim/exact content from knowledge sources — insurance policies, HR documents, legal text, compliance references — where AI summarization could lose critical details.

This pattern uses `SearchKnowledgeSources` (returns raw search results without AI summarization) combined with `CreateSearchQuery` (AI-generated search query from user input).

```yaml
actions:
  # Step 1: Generate an optimized search query from the user's input
  - kind: CreateSearchQuery
    id: createSearchQuery_<random>
    userInput: =System.Activity.Text
    result: Topic.SearchQuery

  # Step 2: Search knowledge sources with the optimized query (no AI summary)
  - kind: SearchKnowledgeSources
    id: searchKnowledge_<random>
    userInput: =Topic.SearchQuery
    result: Topic.RawResults
    knowledgeSources:
      kind: SearchSpecificKnowledgeSources
      knowledgeSources:
        - <schemaName>.topic.<KnowledgeSourceName>

  # Step 3: Send raw results to the user
  - kind: ConditionGroup
    id: conditionGroup_<random>
    conditions:
      - id: conditionItem_<random>
        condition: =!IsBlank(Topic.RawResults)
        actions:
          - kind: SendActivity
            id: sendActivity_<random>
            activity: "{Topic.RawResults}"
```

**When to use Pattern 4 over Pattern 1:**
- Pattern 1 (`SearchAndSummarizeContent`) uses AI to summarize the search results into a coherent response — good for most Q&A scenarios
- Pattern 4 (`SearchKnowledgeSources`) returns raw, unsummarized results — use when summarization could lose important details or when you need to process the raw data yourself

**Citation removal tip:** If using Pattern 1 but want to remove citation markers (`[1]`, `[2]`), set `autoSend: false` and use `Substitute()` to strip them before sending. See the Response Post-Processing Patterns section in REFERENCE.md.
