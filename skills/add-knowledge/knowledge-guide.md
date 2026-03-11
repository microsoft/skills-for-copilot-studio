# Knowledge Architecture & Best Practices

Detailed guidance on how knowledge retrieval works, source selection, content quality, security, maintenance, and advanced patterns.

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
- **Crawl depth:** limit the crawl to a maximum of 2 levels deep. This prevents the error message "The website can't be more than two levels deep". (e.g. `https://docs.example.com/en-us/products/` not `https://example.com/en-us/products/categories/one`)

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

## Advanced Patterns

### `triggerCondition` — Controlling When a Source Is Searched

Every knowledge source supports an optional `triggerCondition` field (a Power Fx `BoolExpression`). The `UniversalSearchTool` only includes the source in a search when this condition evaluates to `true`.

**`triggerCondition: =false`** — the most important pattern. It permanently disables automatic search for this source. The orchestrator will never include it in the `UniversalSearchTool` automatically. This is useful for:

1. **Explicit topic-controlled search** — the source is only used when a topic explicitly references it in a `SearchAndSummarizeContent` node. Gives you full control over when and how the source is queried.

2. **Startup topic initialization** — a greeting or `OnConversationStart` topic sets a global variable (e.g. `Global.UserDepartment`), then other sources use that variable in their `triggerCondition` to activate conditionally.

3. **`OnKnowledgeRequested` topic** — a topic with this trigger fires every time the orchestrator calls the `UniversalSearchTool`. Combined with `triggerCondition: =false`, you can intercept all knowledge requests and route them through custom logic before the search runs. It extends the knowledge retrieval with a more controled approach but it adds latency as it adds and extra search in the knowledge retrieval pipeline. Try to use it only when you need to run custom logic on every search request, and it is good to put a condition on the trigger to only run it when is really needed (e.g. only for users in the HR department, or only for certain types of queries).

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

#### Special System Variables (only available in `OnKnowledgeRequested` topics)

These variables are **exclusively available** inside topics with an `OnKnowledgeRequested` trigger — they do not exist in regular topics.

| Variable | Type | Description |
|---|---|---|
| `System.SearchQuery` | String | A rewritten version of the user's query optimized for **semantic/vector search**. Produced by the orchestrator using intent recognition and the agent's `instructions`. You can read it, inspect it, and override it if the rewrite is insufficient for your use case. |
| `System.KeywordSearchQuery` | String | A rewritten query optimized for **lexical/keyword-based search**. Use this when calling a search API that relies on keyword matching (e.g. Azure AI Search with keyword mode). |
| `System.SearchResults` | Object | The output variable where you write your custom search results. It starts empty — you must populate it with results in the required format for the orchestrator to use them in its response. |

**Query rewriting includes conversation history.** The orchestrator automatically incorporates context from previous messages when rewriting the query — so `System.SearchQuery` is already context-aware. For example, if the user previously asked "What is the WFH policy?" and then says "And for contractors?", the rewritten query will include the understood subject, not just the word "contractors".

**`System.SearchResults` format:** The results you write must conform to the expected schema so the orchestrator can cite them correctly. Each result is a record with the following fields:

```yaml
- kind: SetVariable
  id: setResults_abc123
  variable: System.SearchResults
  value: =Table(
    {
      snippet: "The retrieved text content of the result",
      title: "Document or page title",
      url: "https://link-to-the-source-document"
    }
  )
```

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

### Routing Searches by Category or Country

When the `UniversalSearchTool` returns too many results from unrelated sources (causing hallucinations or answer blending), use **orchestrator-generated variables** to classify the query and route to a specific source inside an `OnKnowledgeRequested` topic.

Common scenarios:
- **By department/topic** (HR vs IT vs Finance) — classify query category, route to matching source
- **By country** — extract or infer the target country from the conversation, route to the country-specific SharePoint site, fall back to a global source for unmatched countries

See [best-practices/orchestrator-variables.md](../../best-practices/orchestrator-variables.md) for full YAML examples of both patterns, including how to combine country routing with the JIT user context pattern (`Global.UserCountry` as default).