# Dataverse Knowledge Retrieval Best Practices

Choosing the right approach for retrieving knowledge from Dataverse tables is critical to agent performance, latency, and user experience. There is no single best method — the right choice depends on your data shape, control requirements, and conversation pattern.

In this best practice we're speaking exclusively about structured data: tables structured with columns and rows. We are not considering unstructured data like documents, PDFs and more.
All structured query approaches share a common foundation: the **List Rows Connector** (FetchXML & OData) and the **ReadQuery API** (SQL) provide deterministic, retrieval APIs for Dataverse tables. Those are actions that can be added into Copilot Studio by the related skill. They support OData, FetchXML (joins), or SQL and are powerful for precise filtering queries. The agent generates the filter query while keeping most other parameters fixed (top count, select columns, order by), returning a manageable result size so AI answers grounded on the result have predictable performance.

## Decision Matrix for Functional Agents over Dataverse Tables

### Dataverse Table Knowledge

**Start here when you need:** Easiest out-of-the-box grounded answers, added in the agent native knowledge. Data can be filtered down.

**Why:** Natural language input is converted to smart filtering and summarization automatically. Knowledge is a whole agentic process — it does NL-to-filter with structured queries, but also adds layers of AI intelligence by adding context and variations, and by reasoning over the glossary and over the returned data before answering.

**How to configure:**
0. IMPORTANT: You can't configure Dataverse knowledge at the moment. See the add-knowledge skill. If you thing this is the most appropriate pattern, here are the istructions to be told to the user:
1. Turn Dataverse Search ON in the environment (you can't do this via YAML, ask the user do manually do so)
2. Add Dataverse tables to agent knowledge (not yet supported via YAML, ask the user do manually do so)
3. Define Synonyms (Business Vocabulary) (not yet supported via YAML, ask the user do manually do so)
4. Define Glossary (powerful AI inference from column descriptions) (not yet supported via YAML, ask the user do manually do so)

**Known constraints:**
- No follow-up input questions
- No maker authentication, no anonymous access
- Limit: 15 tables per knowledge source
- Can be slower when many sources are searched by knowledge
- NOT a full retrieval — may truncate or randomize
- Limited output control (columns/rows)

**Common escalation:** When you need maker auth or more control over query and outputs, move to **List Rows**.

---

### List Rows Connector (action)

**Start here when you need:** Control, low latency, deterministic retrieval, and data that can be filtered down for orchestration.

**Why:** Using the List Rows connector in Copilot Studio can would allow the agent to have a "query API" at its disposal. The orchestrator adds AI reasoning over output rows. Supports unauthenticated patterns via maker credentials. Fast, full retrieval control. Can create multiple tool variants for domain-specific functions.

**How to configure:**
1. Add the List Rows Tool (via the action/connector skill)
2. Change the name, description, input and output settings
3. Write a great input instruction to generate the OData or FetchXML query on the fly
   - **Must** include table glossary and synonyms
   - Can instruct input to add more keywords
4. Parameters: columns, filters, ordering, paging, top — maker can control or use instructions to generate

**Pro tip — when to use child agents:**
- As a **domain-specific tool** to isolate a large glossary prompt for a subset of tables
- As a **paged data exploration tool** so that top-level context is preserved and not filled with data

**Common escalation:** When you need fuzzy discovery over text columns in large tables before retrieval, move to **Dataverse MCP**.

---

### Dataverse MCP (action)

**Start here when you need:** To "converse over" large tables and text columns. Discovery and retrieval in one. Low instruction effort.

**Why:** You can use this special action to provide Copilot Studio with Dataverse toolsets with OOB semantic range, tool versatility, good starter descriptions, and glossary access. Great entry point when you want to quickly converse over tables and search text across many columns.

**Available MCP tools:** `create_record`, `create_table`, `delete_record`, `delete_table`, `describe_table`, `fetch`, `list_tables`, `read_query`, `search`, `update_record`, `update_table`

**How to configure:**
1. Turn Dataverse Search ON in the environment (not yet supported via YAML, ask the user do manually do so)
2. Configure the table's Quick Search view to select searchable, filterable, and viewable columns (not yet supported via YAML, ask the user do manually do so)
3. Publish table changes, wait for indexing (not yet supported via YAML, ask the user do manually do so)
4. Add Dataverse MCP Server as an agent tool (check if this can be done with the action/connector skill)
5. Start chatting

**Pro tips:**
- Modify which MCP tools are available in the agent — keep `read_query`, `search`, `fetch`, `list_tables`, and `describe_table` (glossary). Only expose what you need.
- Add/remove tables from Solution index. Only expose what you need.

**Known constraints:**
- DLP is per MCP or per Connector, not per MCP tool
- Cannot control query, filter, specific inputs, or descriptions
- Cannot control number of agent calls — may loop and refilter
- Discovery and retrieval are blended
- Cannot write domain-aware and agent-specific tool descriptions for added business process value
- Cannot create multiple specialized versions of a search tool

**Common escalation:** When you need scoped tables, specialized tool versions, query control, DLP on tools, limited plan steps, or raw output for agentic behaviors, move to **SearchQuery**.

---

### SearchQuery (action)

**Start here when you need:** Ranked discovery in text columns, explicit controls, or to explore a very large data set.

**Why:** This is another Dataverse action. It differs from the List Row because it's a different action under the same connector (Dataverse). It is a lower-level, higher-control primitive. Dataverse Relevance Search is designed for indexed discovery at scale. Ideal when user language is fuzzy and tables are large with text fields. Note: search indexes the first 2MB of text from attached files.

**Important:** SearchQuery returns probabilistic results, not guaranteed to be complete. The minimum input parameter is the search string. SearchQuery returns relevance-based parameters that agents can use — fuzzy matching to surface best candidates, count and facets to narrow results, score and highlights to confirm intent and justify choices.

**How to configure:**
1. Dataverse Search ON (not yet supported via YAML, ask the user do manually do so)
2. Quick Search view: pick searchable, filterable, and viewable columns (not yet supported via YAML, ask the user do manually do so)
3. Publish table changes, wait for indexing (not yet supported via YAML, ask the user do manually do so)
4. Add an action to Copilot Studio: Dataverse Unbound Connector — SearchQuery Action (check if this can be done with the action/connector skill)
5. Add and configure inputs:
   - **Search:** mandatory search string used to search
   - **Filter:** optional post-filter and select columns (OData-like constraint inside the same search execution)
   - **Other controls:** entities scope, facets, orderby, top, skip, count

**With a glossary, the agent can:**
- Translate follow-ups into precise filters
- Choose the right columns to retrieve with List Rows
- Avoid guessing or hallucinating
- Example: "Is it open now?" — Glossary maps to `openinghours`, `timezone`, `statuscode` for a deterministic query

**Rate-limit reality:**
- Search API can throttle (HTTP 429)
- Default rate limit: 150 calls per minute per org
- Must design for efficiency and caching

**Best practice:** Use SearchQuery for discovery and intent resolution, then pair it with deterministic APIs (List Rows) for precision and trust. SearchQuery = "Help me figure out what the user means." List Rows = "I know what I'm looking for."

**Common escalation:** Throttling or latency in follow-ups — move to **Topic + cached rows variable**. Dataverse storage cost, need for list rows step for retrievals, or results too probabilistic — move to **AI Prompt** or back to **List Rows**.

---

### Topic + Cached Rows Variable

**Start here when you need:** Fast multi-turn follow-ups on a small table, or a subset of ranked data.

**Why:** Create a specific topic to handle retrieval. Reduce API calls by caching results. Use Power Fx on cached data for agentic narrowing across conversation turns. Topics behave like tools (inputs, outputs, descriptions), and topic inputs/outputs map to variables for added control. Supercharge a connector tool by adding the connector in a topic.

**How to configure:**
1. Configure the topic according to below specification

**Enterprise-grade requirement:**
- Avoid re-querying SearchQuery repeatedly
- Fewer slow calls = lower latency
- Default limit: 150 requests per org per minute

**Multi-turn pattern on cached value:**
1. **First question:** Topic collects inputs, calls SearchQuery connector with an OData filter, stores result in a variable (caching)
2. **Follow-up discovery questions:** Topic runs a Power Fx filter over cached variable data. Retrieval question for unindexed field calls List Rows.

**Example flow:**
- "Which civic centre did I visit?" → Topic (SearchQuery + cache)
- "Show me the downtown one" → Topic (Power Fx filter on cached data)
- "What about the other one?" → Topic (Power Fx filter on cached data)
- "Give me the address" → **GetRow** (deterministic retrieval)

**Common escalation:** When you need LLM reasoning decisions on full row contents, move to **AI Prompt on DV Table**.

---

### AI Prompt + DV Table Rows

**Start here when you need:** An LLM to decide over a large number of rows, or asynchronous LLM analytics on source data.

**Why:** Adds an AI Prompt action that has Dataverse knowledge into it. Reasons over complete prefiltered data, not a probabilistic set. Smarter, more conversational, and still fast if transactional.

**How to configure:**
1. Create an AI Prompt action (check if this can be done with the action/connector skill)
2. Configure that action to use Dataverse as knowledge (not yet supported via YAML, ask the user do manually do so)

**Common escalation:** 1000 row limit, latency, token limits, or need for deeper analytics on bigger data — move to **Autonomous**, **Code Interpreter**, or **Fabric Data**.

## How to Choose

1. **Start simple** — if Table Knowledge meets your needs, use it. It requires the least configuration and covers a LOT of use cases.
2. **Escalate only when needed** — each approach in the matrix addresses a specific limitation of the one above it. Follow the "Common escalation" path when you hit a wall.
3. **Consider your data shape** — small, structured tables with filterable columns favor List Rows. Large tables with free-text columns favor SearchQuery or Dataverse MCP.
4. **Consider your conversation pattern** — single-turn lookups favor List Rows or Table Knowledge. Multi-turn exploration favors Topic + cached rows or Dataverse MCP.
5. **Consider your control requirements** — if you need DLP, scoped access, or deterministic outputs, favor List Rows or SearchQuery over the more autonomous options.
6. **Combine approaches** — SearchQuery for discovery + List Rows for precision is a powerful pattern. Cache results in topic variables to reduce API calls on follow-ups.
