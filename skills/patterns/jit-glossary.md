# JIT Glossary Best Practice

A **JIT glossary** loads a list of customer-specific acronyms into a global variable the first time each conversation receives a user message. The orchestrator then uses that variable to interpret acronyms correctly before searching knowledge sources or generating answers — improving retrieval quality without adding noise to automatic searches.

## Available Approaches

The JIT glossary pattern has **current platform limitations** that affect which approach you can use based on your data source:

### Approach 1: Dataverse-Based (Supported Today)

**Works with:** Dataverse files or SharePoint documents migrated to Dataverse

```
CSV file in Dataverse
        ↓
Knowledge source (triggerCondition: =false)    ← never auto-searched
        ↓
Global variable: Global.Glossary               ← loaded once per conversation
        ↓
OnActivity topic (type: Message)               ← fires on first user message
  condition: =IsBlank(Global.Glossary)         ← JIT: only runs if not loaded yet
        ↓
Agent instructions reference {Global.Glossary} ← orchestrator uses it for context
```

**Pros:**
- ✅ Can retrieve full file content needed for orchestration
- ✅ Supported by current skill implementation
- ✅ No custom development required

**Cons:**
- ❌ SharePoint to Dataverse sync has indexing delays
- ❌ Requires UI configuration for SharePoint sync
- ❌ Additional complexity for pure SharePoint scenarios

### Approach 2: Real-Time SharePoint with Agent Flow (Future Enhancement)

**Current limitation:** SharePoint Online knowledge sources use semantic search that cannot output the full file content needed at the orchestration step.

**Solution under development:** Agent Flow using SharePoint connector to directly retrieve file content, transform to string, and return to the JIT topic.

```
CSV file on SharePoint (.txt in CSV format)
        ↓
Global variable: Global.Glossary               ← loaded once per conversation
        ↓
OnActivity topic (type: Message)               ← fires on first user message
  condition: =IsBlank(Global.Glossary)         ← JIT: only runs if not loaded yet
        ↓
Agent Flow: Get SharePoint file content        ← retrieves complete file via connector
  transform to string → return to topic       ← bypasses semantic search limitations
        ↓
Set Global.Glossary = flow result             ← stores full CSV content
        ↓
Agent instructions reference {Global.Glossary} ← orchestrator uses it for context
```

**Pros:**
- ✅ True real-time access to SharePoint files
- ✅ No sync delays or indexing dependencies
- ✅ Direct file access without migration

**Cons:**
- ❌ Not yet supported by current skill implementation
- ❌ Requires custom Agent Flow development
- ❌ More complex setup and maintenance

> **Note:** These limitations are temporary. Full SharePoint Online support is planned for future skill releases.

## Choosing Your Approach

- **Use Approach 1** if you need JIT glossary functionality today and can work with Dataverse storage or accept sync delays
- **Consider Approach 2** if real-time SharePoint access is critical and you can develop custom Agent Flows
- **Wait for future updates** if neither approach meets your current requirements

## Why `OnActivity (type: Message)` and not `OnConversationStart`

- **`OnConversationStart` is not channel-universal.** It is not fired by M365 Copilot or other channel-embedded surfaces — any initialization placed there silently does not run for those users.
- **`type: Message` confirms real usage intent.** There is no value in loading a glossary for a session that never produces a user message. Deferring until the first message avoids wasted connector calls and token consumption.
- The `condition: =IsBlank(Global.Glossary)` guard ensures the topic runs exactly once per conversation regardless of how many messages follow.

## When to Use This Pattern

- The customer uses internal acronyms that are not in public knowledge
- You want to improve the quality of knowledge searches by helping the orchestrator understand user intent
- The glossary content is stable and load-once per session is sufficient (no per-message refresh needed)
- You do **not** want the glossary returned directly as an answer — it is context-only

## Implementation Steps (Approach 1: Dataverse-Based)

### Step 1 — Prepare and Store the CSV File

Create a plain-text file in CSV format with a header row. Two columns only:

```
ACRONYM,Definition
ETA,Estimated Time of Arrival
SLA,Service Level Agreement
PO,Purchase Order
UAT,User Acceptance Testing
```

A starter template is available at `templates/knowledge/glossary.csv`.

**File requirements:**
- Use **ACRONYM** and **Definition** as the exact column headers
- One acronym per row
- Save as a `.txt` file (not `.csv`) — this ensures Copilot Studio treats it as a document

**Storage options for Dataverse approach:**
1. **Direct Dataverse upload:** Upload the file directly to a Dataverse knowledge source through the Copilot Studio UI
2. **SharePoint to Dataverse sync:** Upload to SharePoint, then configure Dataverse sync in the Copilot Studio UI (note: sync delays may occur)

### Step 2 — Create the Knowledge Source

> **Important:** This approach requires Dataverse storage. SharePoint knowledge sources cannot be used for JIT glossary due to semantic search limitations.

Create a file in `agents/<AGENT-NAME>/knowledge/` for the glossary source. Example: `glossary.knowledge.mcs.yml`.

For Dataverse-stored files, you **must configure the knowledge source through the Copilot Studio UI** first, then reference it in YAML:

```yaml
# Name: Customer Glossary
# Customer-specific acronyms in CSV format. Two columns: ACRONYM,Definition with a header row. Load this source explicitly — do not include in automatic searches. REQUIRES DATAVERSE STORAGE.
kind: KnowledgeSourceConfiguration
source:
  # Configure via Copilot Studio UI, then reference here
  # SharePointSearchSource NOT supported for JIT glossary due to semantic search limitations
  triggerCondition: false
```

**Key points:**
- `triggerCondition: false` — this source is **never** included in automatic `UniversalSearchTool` searches. It can only be called explicitly via `SearchAndSummarizeContent`.
- **Dataverse requirement:** The file must be stored in Dataverse (directly uploaded or synced from SharePoint via UI configuration)
- **SharePoint limitation:** Direct SharePoint knowledge sources cannot retrieve full file content needed for JIT variables
- Line 2 (plain comment) describes the content so the orchestrator can identify it in the template list — write it clearly.

## Step 3 — Create the Global Variable

Create `agents/<AGENT-NAME>/variables/Glossary.mcs.yml`. Read `settings.mcs.yml` first to get the agent's `schemaName` prefix.

```yaml
# Name: Glossary
# Customer-specific acronyms loaded JIT at the start of each conversation.
name: Glossary
scope: Conversation
description: Customer-specific acronyms loaded JIT at the start of each conversation.
schemaName: <agent-schemaName>.globalvariable.Glossary
kind: GlobalVariableComponent
defaultValue: DEFAULT
```

**Key points:**
- `schemaName` — must be `<agent-schemaName>.globalvariable.Glossary`; read the prefix from `settings.mcs.yml`
- Topics reference this variable as `Global.Glossary`

Or use the `add-global-variable` skill to generate this file.

## Step 4 — Create the Provisioning Topic

> **If you are also loading user context**, use the combined template at `templates/topics/conversation-init.topic.mcs.yml` instead. It merges both patterns into a single OnActivity topic with one `=IsBlank(Global.UserCountry)` condition.

Create `agents/<AGENT-NAME>/topics/conversation-init.topic.mcs.yml`:

```yaml
kind: AdaptiveDialog
modelDescription: null
beginDialog:
  kind: OnActivity
  id: main
  type: Message
  condition: =IsBlank(Global.Glossary)
  actions:
    - kind: SearchAndSummarizeContent
      id: searchGlossary_REPLACE1
      autoSend: false
      variable: Topic.GlossaryResult
      userInput: ='*'
      responseCaptureType: FullResponse
      applyModelKnowledgeSetting: false
      knowledgeSources:
        kind: SearchSpecificKnowledgeSources
        knowledgeSources:
          - <AGENT-SCHEMA-NAME>.knowledge.glossary
    - kind: SetVariable
      id: setGlossary_REPLACE2
      variable: Global.Glossary
      value: =Topic.GlossaryResult
```

**Replace these placeholders:**
- `REPLACE1`, `REPLACE2` — generate unique IDs (6-8 random alphanumeric characters)
- `<AGENT-SCHEMA-NAME>` — the schema name of your agent (e.g. `cr123_myAgent`)
- The knowledge source reference `glossary` — must match the filename of the `.mcs.yml` file created in Step 2 (without the `.knowledge.mcs.yml` suffix)

## Step 5 — Update Agent Instructions

In `agents/<AGENT-NAME>/agents/agent.mcs.yml` or `settings.mcs.yml`, add a glossary usage section to the agent's instructions:

```yaml
instructions: |
  ## Glossary
  {Global.Glossary}
  The above is the customer glossary (format: ACRONYM,Definition, one per line).
  Silently expand any acronym found in it before interpreting the user's message or searching knowledge sources.
  Do not mention the glossary to the user unless they explicitly ask for a list of acronyms.
```

**Why only one reference to `{Global.Glossary}`:** each reference injects the full variable value into the orchestrator prompt. If the glossary is large, multiple references multiply token consumption significantly. Place it once at the top of the section and write all instructions beneath it as plain text.

## Validation Checklist

Before testing:
- [ ] The CSV file is stored in **Dataverse** (not directly on SharePoint) and is accessible by the agent
- [ ] `triggerCondition: =false` is on the knowledge source
- [ ] The knowledge source is configured via Copilot Studio UI for Dataverse access
- [ ] The knowledge source reference in `SearchAndSummarizeContent` matches the exact `.mcs.yml` filename
- [ ] All `REPLACE` IDs are replaced with unique generated IDs
- [ ] `Global.Glossary` variable exists at `agents/<AGENT-NAME>/variables/Glossary.mcs.yml` with `schemaName` matching the agent prefix
- [ ] Agent instructions reference `{Global.Glossary}` with clear usage rules

## Real-Time SharePoint Approach (Future Implementation)

For scenarios requiring direct real-time SharePoint access, the following Agent Flow pattern will be supported in future releases:

1. **Agent Flow Creation:** Build a flow using SharePoint connector's "Get file content" action
2. **Content Transformation:** Convert file content to string format using appropriate transformations
3. **Topic Integration:** Call the Agent Flow from the JIT topic and store result in `Global.Glossary`
4. **Error Handling:** Implement fallback behavior for file access failures

This approach bypasses the semantic search limitations by directly accessing file content through connector actions rather than knowledge source retrieval.

> **Coming soon:** Step-by-step instructions for this approach will be added when skill support is available.

## Testing

1. Start a conversation with the agent
2. Type a message that includes a known acronym (e.g. "What is the ETA for my PO?")
3. Verify the agent interprets the acronym correctly without being told what it means
4. Ask the agent a second question — confirm `Global.Glossary` is not re-loaded (condition `=IsBlank` prevents it)
5. Use the test panel's variable inspector to confirm `Global.Glossary` is populated with the CSV content
