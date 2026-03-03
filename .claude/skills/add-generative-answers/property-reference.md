# SearchAndSummarizeContent Property Reference

## Base Properties

```yaml
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
      - <schemaName>.topic.<KnowledgeSourceFileName>
  applyModelKnowledgeSetting: false
  responseCaptureType: FullResponse
```

## Property Reference

| Property | Description |
|----------|-------------|
| `autoSend` | If `true`, the node automatically sends the response to the chat. If `false`, the response is saved into `variable` for manual handling (send a message, build an adaptive card, pass to orchestrator, etc.). |
| `variable` | Where the response is stored. With `responseCaptureType: FullResponse`, access it via `Variable.Text.Content`, `Variable.Text.MarkdownContent`, and `Variable.Text.CitationSources`. |
| `userInput` | The input from which the response is generated. Common options: `=System.Activity.Text` (user's last message), `=Topic.SomeInput` (a topic input variable), or a crafted expression combining strings and variables. |
| `responseCaptureType` | Set to `FullResponse` to capture the full structured response (content, markdown, citations). |
| `knowledgeSources` | Restrict the search to specific knowledge sources. Use `kind: SearchSpecificKnowledgeSources` with a list of knowledge source references. Omit this property to search all agent knowledge. **The knowledge source must already exist** (added via `/add-knowledge`). Reference format: filename without `.mcs.yml`. |
| `applyModelKnowledgeSetting` | If `true`, also uses general model knowledge in addition to the specified knowledge sources. If `false`, only searches the configured knowledge sources. |
| `fileSearchDataSource` | Controls file search behavior. `kind: DoNotSearchFiles` disables file search. |

## `userInput` Options

`System.Activity.Text` is the last message sent by the user. But other options exist:

- **User's last message**: `userInput: =System.Activity.Text` — most common for direct Q&A
- **Topic input variable**: `userInput: =Topic.QuestionToBeAnswered` — when the orchestrator or a previous node provides the question
- **Crafted expression**: You can combine strings with variables to build a specific query, e.g., ask the user for a topic and then search for "Give me information about " & that topic

## SearchKnowledgeSources Property Reference

Returns raw search results from knowledge sources **without AI summarization**. Use for precision/verbatim scenarios.

```yaml
- kind: SearchKnowledgeSources
  id: searchKnowledge_<random>
  userInput: =System.Activity.Text
  result: Topic.RawResults
  knowledgeSources:
    kind: SearchSpecificKnowledgeSources
    knowledgeSources:
      - <schemaName>.topic.<KnowledgeSourceFileName>
```

| Property | Description |
|----------|-------------|
| `userInput` | The search query expression. Same options as `SearchAndSummarizeContent.userInput`. |
| `result` | Variable where raw search results are stored. |
| `knowledgeSources` | Restrict the search to specific knowledge sources. Same format as `SearchAndSummarizeContent`. Omit to search all. |
| `webBrowsing` | If `true`, also searches the web via Bing. |
| `fileSearchDataSource` | Controls file search behavior. `kind: DoNotSearchFiles` disables file search. |
| `historyType` | Controls conversation history inclusion. |

## CreateSearchQuery Property Reference

Uses AI to generate an optimized search query from the user's input. Pair with `SearchKnowledgeSources` for better search accuracy.

```yaml
- kind: CreateSearchQuery
  id: createSearchQuery_<random>
  userInput: =System.Activity.Text
  result: Topic.SearchQuery
```

| Property | Description |
|----------|-------------|
| `userInput` | The user's raw input to rewrite into a search query. |
| `result` | Variable where the AI-generated search query is stored. |
| `historyType` | Controls conversation history inclusion for query generation. |
