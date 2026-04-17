# Orchestrator-Generated Variables

## What It Is

Copilot Studio's generative orchestrator can populate topic input variables **at orchestration time**, before the topic body executes. This is the same mechanism used for `AutomaticTaskInput` — but instead of collecting information from the user, you define inputs that the **orchestrator's LLM fills in by interpreting the conversation**.

This lets you extract structured data (classifications, entities, flags) from the user's message without:
- An explicit `Question` node asking the user
- A separate AI Prompt action consuming additional credits
- An extra tool call adding latency

The variable is generated **inline during orchestration** at no additional cost — it reuses the same LLM call the orchestrator already makes to decide which topic to invoke.

## Why Use This Instead of AI Prompt

| Approach | Cost | Latency | When to use |
|---|---|---|---|
| **Orchestrator-generated variable** | Free (reuses orchestration LLM call) | Zero extra latency | Classify or extract from the current user message during topic selection |
| **AI Prompt action** | Consumes credits per call | Extra round-trip to LLM | Complex multi-step reasoning, structured output from long text, transformations needing a full prompt |
| **`Question` node** | Free | Requires user response | When you need the user to explicitly provide a value |

Use orchestrator-generated variables when you need light classification or extraction that can be inferred directly from the user's intent — not for heavy reasoning tasks.

## Key Use Case: Controlling Knowledge Search by Category

The most powerful application is routing knowledge searches. Without this pattern, `UniversalSearchTool` applies the same search strategy to every query. With an orchestrator-generated classification variable, you can:

1. Classify the user's query into a category (e.g. `"HR"`, `"IT"`, `"Finance"`)
2. Store that category in a global variable
3. Use an `OnKnowledgeRequested` topic with a `ConditionGroup` to route the search — each branch calls `SearchAndSummarizeContent` scoped to only the relevant knowledge sources
4. Avoid polluting a sensitive knowledge source with unrelated queries

This solves a real limitation: a knowledge source with a broad description gets included in too many searches. A classification variable lets you apply precise control without forcing the user to navigate menus or answer questions.

## How It Works (Architecture)

1. **Define a topic input** with a description that tells the orchestrator what to extract or classify
2. The orchestrator reads the user's message + conversation history and fills the input variable using its LLM
3. The topic body receives the pre-populated variable and uses it in conditions, `triggerCondition` references, or `SearchAndSummarizeContent` nodes
4. No user-facing question is asked — the extraction is invisible to the user

The description you write on the input is the prompt the orchestrator uses. Write it precisely — it directly determines extraction quality.

## Patterns

### Classification for Knowledge Routing

Use an orchestrator-generated variable to classify the query, then use the classification inside an `OnKnowledgeRequested` topic — routing to different `SearchAndSummarizeContent` nodes scoped to specific knowledge sources based on the category.

The key fields are:
- `kind: AutomaticTaskInput` — tells the orchestrator to fill this variable from the conversation, not by asking the user
- `shouldPromptUser: false` — **critical**: suppresses any user-facing question; the orchestrator resolves the value silently
- `description` — the extraction prompt sent to the orchestrator LLM. List the exact allowed values so the orchestrator knows the vocabulary
- The input must be declared in **both** `inputs` and `inputType.properties` — they must match

```yaml
kind: AdaptiveDialog
inputs:
  - kind: AutomaticTaskInput
    propertyName: searchCategory
    description: |-
      Recognize User input from his prompt and assign a category from this list:
      HR, IT, Accounty, Tech Support, Manufacturing floor question, other topics
    shouldPromptUser: false

beginDialog:
  kind: OnRecognizedIntent
  id: main
  intent: {}
  actions:
    # Use the classification to set a global variable for use in triggerCondition
    # or in a ConditionGroup to route to different SearchAndSummarizeContent nodes
    - kind: SetVariable
      id: setVariable_HL26cV
      variable: Global.searchCategory
      value: =Topic.searchCategory

inputType:
  properties:
    searchCategory:
      displayName: searchCategory
      description: |-
        Recognize User input from his prompt and assign a category from this list:
        HR, IT, Accounty, Tech Support, Manufacturing floor question, other topics
      type: String

outputType: {}
```

**How to wire this to knowledge routing:**

1. Set `Global.searchCategory` from `Topic.searchCategory` (as above)
2. Create an `OnKnowledgeRequested` topic that reads `Global.searchCategory` and routes the search to the correct knowledge source using a `ConditionGroup` at the top

> **Important:** `triggerCondition` on a knowledge source file **cannot** dynamically reference a global variable set at runtime. Knowledge source filtering based on a runtime variable must be done inside an `OnKnowledgeRequested` topic using a condition and explicit `SearchAndSummarizeContent` nodes scoped to specific sources.

```yaml
# OnKnowledgeRequested topic — routes search by category
kind: AdaptiveDialog
beginDialog:
  kind: OnKnowledgeRequested
  id: main
  actions:
    - kind: ConditionGroup
      id: conditionGroup_route
      conditions:
        - id: condition_hr
          condition: =Global.searchCategory = "HR"
          actions:
            - kind: SearchAndSummarizeContent
              id: search_hr
              variable: System.SearchResults
              userInput: =System.SearchQuery
              knowledgeSources:
                kind: SearchSpecificKnowledgeSources
                knowledgeSources:
                  - <schemaName>.knowledge.hr-policies
        - id: condition_it
          condition: =Global.searchCategory = "IT"
          actions:
            - kind: SearchAndSummarizeContent
              id: search_it
              variable: System.SearchResults
              userInput: =System.SearchQuery
              knowledgeSources:
                kind: SearchSpecificKnowledgeSources
                knowledgeSources:
                  - <schemaName>.knowledge.it-documentation
      elseActions:
        # Fallback: search all sources for unrecognized categories
        - kind: SearchAndSummarizeContent
          id: search_fallback
          variable: System.SearchResults
          userInput: =System.SearchQuery
```

This ensures only the relevant source is searched for each query — no cross-domain noise, no irrelevant citations.

### Country-Specific Knowledge Routing (Real-World Example)

**Problem:** A customer had separate SharePoint sites per country (FR, UK, DE, etc.) for policies like WFH, leave entitlement, and expense rules. The `UniversalSearchTool` was searching all country sources simultaneously, returning conflicting results (e.g. UK and FR leave policies together), causing the model to hallucinate or blend rules from different countries.

**Solution:** Use an orchestrator-generated variable to extract the target country from the conversation — falling back to the user's profile country if the query doesn't mention one — then route to the matching country knowledge source in an `OnKnowledgeRequested` topic.

**Step 1 — Orchestrator-generated variable topic** (sets `Global.searchCountry`):

```yaml
kind: AdaptiveDialog
inputs:
  - kind: AutomaticTaskInput
    propertyName: searchCountry
    description: |-
      Identify the country this query is about. If the user explicitly mentions a country, use that.
      If not, use the value of Global.UserCountry as the default.
      Return the ISO 2-letter country code in uppercase: FR, UK, DE, US, Other
    shouldPromptUser: false

beginDialog:
  kind: OnRecognizedIntent
  id: main
  intent: {}
  actions:
    - kind: SetVariable
      id: setVariable_country
      variable: Global.searchCountry
      value: =Topic.searchCountry

inputType:
  properties:
    searchCountry:
      displayName: searchCountry
      description: |-
        Identify the country this query is about. If the user explicitly mentions a country, use that.
        If not, use the value of Global.UserCountry as the default.
        Return the ISO 2-letter country code in uppercase: FR, UK, DE, US, Other
      type: String

outputType: {}
```

**Step 2 — `OnKnowledgeRequested` topic** routes to the correct country source, with a general fallback:

```yaml
kind: AdaptiveDialog
beginDialog:
  kind: OnKnowledgeRequested
  id: main
  actions:
    - kind: ConditionGroup
      id: conditionGroup_country
      conditions:
        - id: condition_fr
          condition: =Global.searchCountry = "FR"
          actions:
            - kind: SearchAndSummarizeContent
              id: search_fr
              variable: System.SearchResults
              userInput: =System.SearchQuery
              knowledgeSources:
                kind: SearchSpecificKnowledgeSources
                knowledgeSources:
                  - <schemaName>.knowledge.policies-fr
        - id: condition_uk
          condition: =Global.searchCountry = "UK"
          actions:
            - kind: SearchAndSummarizeContent
              id: search_uk
              variable: System.SearchResults
              userInput: =System.SearchQuery
              knowledgeSources:
                kind: SearchSpecificKnowledgeSources
                knowledgeSources:
                  - <schemaName>.knowledge.policies-uk
        - id: condition_de
          condition: =Global.searchCountry = "DE"
          actions:
            - kind: SearchAndSummarizeContent
              id: search_de
              variable: System.SearchResults
              userInput: =System.SearchQuery
              knowledgeSources:
                kind: SearchSpecificKnowledgeSources
                knowledgeSources:
                  - <schemaName>.knowledge.policies-de
      elseActions:
        # Fallback for unknown or unmatched countries — search global/general source
        - kind: SearchAndSummarizeContent
          id: search_global
          variable: System.SearchResults
          userInput: =System.SearchQuery
          knowledgeSources:
            kind: SearchSpecificKnowledgeSources
            knowledgeSources:
              - <schemaName>.knowledge.policies-global
```

**Key design decisions:**
- The orchestrator description tells the LLM to **fall back to `Global.UserCountry`** when no country is mentioned — combining the orchestrator-variable pattern with the JIT user context pattern
- All country-specific knowledge sources should have `triggerCondition: =false` so they are **never** included in automatic `UniversalSearchTool` searches — only the `OnKnowledgeRequested` topic controls them
- The `elseActions` fallback prevents silent failures for users in unconfigured countries
- This pattern scales: add a new condition branch and a new knowledge source file per country, no other changes needed


## Authoring Guidelines

- **Write the input description as a precise extraction instruction** — the orchestrator uses it as the prompt. Vague descriptions produce unreliable classifications.
- **Use an enum-style description for classifications** — list the exact allowed values in the description so the orchestrator knows the vocabulary (e.g. `"Classify the query as one of: HR, IT, Finance, Other"`).
- **Always provide a fallback value** — the orchestrator may not always be confident. Define a default (e.g. `"Other"`) and handle it in a `ConditionGroup`.
- **Keep the classification space small** — 3–6 categories work well. More than 10 degrades accuracy.
- **Do not use this for complex reasoning** — if the extraction requires reading a long document or multi-step inference, use an AI Prompt action instead.

## Limitations

- The variable is populated once at topic invocation — it cannot be updated mid-topic by re-running orchestration
- The orchestrator uses the current message + conversation history, but not external data sources — it cannot look up a value from SharePoint or a connector
- Accuracy depends on how well the description guides the LLM — test with representative queries before shipping