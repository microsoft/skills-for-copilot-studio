---
user-invocable: false
name: best-practices
description: "Best practices for Copilot Studio agents. Covers JIT glossary loading (customer acronyms, terminology), JIT user context provisioning (M365 profile, country, department), the shared OnActivity initialization pattern, dynamic topic redirects with Switch expressions, preventing child agents from responding directly to users, and Dataverse knowledge retrieval patterns. USE FOR: glossary, acronyms, user context, user profile, country-aware answers, JIT initialization, OnActivity provisioning, conversation-init, personalized knowledge, dynamic redirect, Switch, BeginDialog, if/then/else replacement, child agent responses, completion setting, SendMessageTool, output variables, connected agents, Dataverse, Table Knowledge, List Rows, SearchQuery, Dataverse MCP, cached rows, AI Prompt, DV Table. DO NOT USE FOR: general knowledge sources (use add-knowledge), topic creation (use new-topic)."
context: fork
agent: author
---

# Copilot Studio Best Practices

**Only read the file relevant to the current task** — do NOT read all files.

## JIT Glossary → [jit-glossary.md](jit-glossary.md)

Automatically loads a CSV of customer-specific acronyms and terminology into a global variable (`Global.Glossary`) on the first user message. The orchestrator uses it to silently expand acronyms before searching knowledge sources — improving retrieval quality without the user having to explain internal jargon.

**Read this best-practice when:**
- The user wants to add a glossary, acronym list, or terminology table
- Knowledge search quality is poor because the agent doesn't understand internal abbreviations
- The user asks about loading CSV/text data from SharePoint into a variable at conversation start

## JIT User Context → [jit-user-context.md](jit-user-context.md)

Loads the current user's Microsoft 365 profile (country, department, display name, etc.) into global variables on the first user message. The orchestrator uses these to personalize answers — e.g., returning the correct country-specific WFH policy without asking the user where they are.

**Read best-practice this when:**
- The user wants country-aware, department-aware, or role-aware answers
- The agent needs to call the M365 Users connector (`GetMyProfile` / `UserGet_V2`)
- The user asks about personalizing responses based on who is chatting

## Dynamic Topic Redirect with Variable → [Topic-redirect-withvariable.md](Topic-redirect-withvariable.md)

Uses a `Switch()` Power Fx expression inside a `BeginDialog` node to dynamically redirect to different topics based on a variable value. Replaces complex if/then/else condition chains with a single, maintainable YAML pattern.

**Read this best-practice when:**
- The user needs to route to one of several topics based on a variable
- The user wants to replace nested ConditionGroup nodes with a cleaner approach
- The user asks about dynamic topic redirects or Switch expressions in BeginDialog

## Prevent Child Agent Responses → [prevent-child-agent-responses.md](prevent-child-agent-responses.md)

Prevents child agents (connected agents) from sending messages directly to the user. Clarifies the common misconception about the completion setting and provides the instruction block to force child agents to use output variables instead of `SendMessageTool`.

**Read this best-practice when:**
- The user wants a child agent to return data without messaging the user
- The user is confused about the completion setting on a child agent
- The parent agent needs to control all user-facing responses

## Dataverse Knowledge Retrieval → [dataverse-knowledge-retrieval.md](dataverse-knowledge-retrieval.md)

Decision matrix for choosing the right approach to retrieve knowledge from Dataverse tables. Covers Table Knowledge, List Rows, Dataverse MCP, SearchQuery, Topic + cached rows variable, and AI Prompt + DV Table Rows — with escalation paths between each.

**Read this best-practice when:**
- The user needs to query or retrieve data from Dataverse tables
- The user is choosing between Table Knowledge, List Rows, SearchQuery, or Dataverse MCP
- The user is experiencing latency, throttling, or control issues with their current Dataverse retrieval approach
- The user asks about caching rows, ranked search, or LLM reasoning over Dataverse data

## Combining patterns

You can also combine more than one best pratice. For example, when using both glossary and user context, merge them into a **single** `conversation-init` topic rather than creating separate OnActivity topics. Use the template at `${CLAUDE_SKILL_DIR}/../../templates/topics/conversation-init.topic.mcs.yml`. The individual files explain the details.
