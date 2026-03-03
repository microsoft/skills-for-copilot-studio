---
name: add-glossary
description: "Add a JIT (Just-In-Time) glossary to a Copilot Studio agent so it automatically loads customer-specific acronyms at the start of each conversation. USE FOR: add glossary, customer acronyms, terminology, abbreviations, JIT glossary, OnActivity initialize, load glossary on start. DO NOT USE FOR: general knowledge sources (use add-knowledge), SharePoint or website indexing."
---

# Add a JIT Glossary to a Copilot Studio Agent

A **JIT glossary** loads a list of customer-specific acronyms into a global variable the first time each conversation receives a user message. The orchestrator then uses that variable to interpret acronyms correctly before searching knowledge sources or generating answers — improving retrieval quality without adding noise to automatic searches.

## Pattern Overview

```
CSV file on SharePoint (.txt in CSV format)
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

## When to Use This Pattern

- The customer uses internal acronyms that are not in public knowledge
- You want to improve the quality of knowledge searches by helping the orchestrator understand user intent
- The glossary content is stable and load-once per session is sufficient (no per-message refresh needed)
- You do **not** want the glossary returned directly as an answer — it is context-only

## Why `OnActivity (type: Message)` and not `OnConversationStart`

- **`OnConversationStart` is not channel-universal.** It is not fired by M365 Copilot or other channel-embedded surfaces — any initialization placed there silently does not run for those users.
- **`type: Message` confirms real usage intent.** There is no value in loading a glossary (or profile data) for a session that never produces a user message. Deferring until the first message avoids wasted connector calls and token consumption.
- The `condition: =IsBlank(Global.Glossary)` guard ensures the topic runs exactly once per conversation regardless of how many messages follow.

## Step 1 — Prepare the CSV File

Create a plain-text file in CSV format with a header row. Two columns only:

```
ACRONYM,Definition
ETA,Estimated Time of Arrival
SLA,Service Level Agreement
PO,Purchase Order
UAT,User Acceptance Testing
```

A starter template is available at `templates/knowledge/glossary.csv`.

- Use **ACRONYM** and **Definition** as the exact column headers
- One acronym per row
- Save as a `.txt` file (not `.csv`) — this ensures Copilot Studio treats it as a document
- Upload the file to SharePoint and **note the full URL to the file** (e.g. `.../Glossary/acronyms.txt`) — you will use the file URL, not the folder URL, in the knowledge source

## Step 2 — Create the Knowledge Source

Create a file in `src/<AGENT-NAME>/knowledge/` for the glossary source. Example: `glossary.knowledge.mcs.yml`.

```yaml
# Name: Customer Glossary
# Customer-specific acronyms in CSV format. Two columns: ACRONYM,Definition with a header row. Load this source explicitly — do not include in automatic searches.
kind: KnowledgeSourceConfiguration
source:
  kind: SharePointSearchSource
  triggerCondition: false
  site: https://contoso.sharepoint.com/sites/Internal/Shared%20Documents/Glossary/acronyms.txt
```

**Key points:**
- `triggerCondition: false` — this source is **never** included in automatic `UniversalSearchTool` searches. It can only be called explicitly via `SearchAndSummarizeContent`.
- Replace the `site` URL with the **full path to the specific `.txt` file** on SharePoint — not the folder. Pointing to the folder would index all documents in it.
- Line 2 (plain comment) describes the content so the orchestrator can identify it in the template list — write it clearly.

## Step 3 — Create the Global Variable

Create `src/<AGENT-NAME>/variables/Glossary.mcs.yml`. Read `settings.mcs.yml` first to get the agent's `schemaName` prefix.

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

> **If you are also loading user context (country, department) via the `add-user-context` pattern, do not create a separate topic. Merge both into a single `conversation-init` topic — see below.**

### Combined topic (glossary + user context)

When both patterns are active, use a single `OnActivity` topic to provision everything in one pass. Use the template at `templates/topics/conversation-init.topic.mcs.yml` and replace all `REPLACE` IDs and `<AGENT-SCHEMA-NAME>` placeholders.

The single condition `=IsBlank(Global.UserCountry)` is sufficient — both variables are always provisioned together, so checking one is enough.

### Standalone topic (glossary only)

If you are only using the glossary pattern without user context, create `src/<AGENT-NAME>/topics/conversation-init.topic.mcs.yml`:

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
- `REPLACE1`, `REPLACE2` — generate unique IDs using the ID Generation rules in `SKILL.md`
- `<AGENT-SCHEMA-NAME>` — the schema name of your agent (e.g. `cr123_myAgent`)
- The knowledge source reference `glossary` — must match the filename of the `.mcs.yml` file created in Step 2 (without the `.knowledge.mcs.yml` suffix)

> **If combining with user context:** use the combined template and a single condition `=IsBlank(Global.UserCountry)`. Both variables are loaded in one topic pass. — Update Agent Instructions

In `src/<AGENT-NAME>/agents/agent.mcs.yml` or `settings.mcs.yml`, add a glossary usage section to the agent's instructions:

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
- [ ] The CSV file is a `.txt` file on SharePoint (not a `.csv` file) and is readable by the agent service account
- [ ] The `site` URL in the knowledge source points to the **specific file** (e.g. `.../Glossary/acronyms.txt`), not the folder
- [ ] `triggerCondition: =false` is on the knowledge source
- [ ] The knowledge source reference in `SearchAndSummarizeContent` matches the exact `.mcs.yml` filename
- [ ] All `REPLACE` IDs are replaced with unique generated IDs
- [ ] `Global.Glossary` variable exists at `src/<AGENT-NAME>/variables/Glossary.mcs.yml` with `schemaName` matching the agent prefix
- [ ] Agent instructions reference `{Global.Glossary}` with clear usage rules

## Testing

1. Start a conversation with the agent
2. Type a message that includes a known acronym (e.g. "What is the ETA for my PO?")
3. Verify the agent interprets the acronym correctly without being told what it means
4. Ask the agent a second question — confirm `Global.Glossary` is not re-loaded (condition `=IsBlank` prevents it)
5. Use the test panel's variable inspector to confirm `Global.Glossary` is populated with the CSV content
