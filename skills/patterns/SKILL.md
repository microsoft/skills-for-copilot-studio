---
user-invocable: false
name: patterns
description: "Repeatable reference architectures for building specific capabilities in Copilot Studio agents. Covers JIT glossary loading (customer acronyms, terminology), JIT user context provisioning (M365 profile, country, department), the shared OnActivity initialization pattern, and orchestrator-generated variables for knowledge routing. USE FOR: glossary, acronyms, user context, user profile, country-aware answers, JIT initialization, OnActivity provisioning, conversation-init, personalized knowledge, orchestrator variables, AutomaticTaskInput, knowledge routing, classification, category routing, country routing. DO NOT USE FOR: general knowledge sources (use add-knowledge), topic creation (use new-topic), dynamic topic redirects with Switch (use authoring-tips), preventing child agent responses (use authoring-tips)."
context: fork
agent: copilot-studio-author
---

# Copilot Studio — Repeatable Patterns

Reference architectures for building specific capabilities in MCS agents. Each pattern is a proven, end-to-end implementation guide.

**Only read the file relevant to the current task** — do NOT read all files.

## JIT Glossary → [jit-glossary.md](jit-glossary.md)

Automatically loads a CSV of customer-specific acronyms and terminology into a global variable (`Global.Glossary`) on the first user message. The orchestrator uses it to silently expand acronyms before searching knowledge sources — improving retrieval quality without the user having to explain internal jargon.

**Read this pattern when:**
- The user wants to add a glossary, acronym list, or terminology table
- Knowledge search quality is poor because the agent doesn't understand internal abbreviations
- The user asks about loading CSV/text data from SharePoint into a variable at conversation start

## JIT User Context → [jit-user-context.md](jit-user-context.md)

Loads the current user's Microsoft 365 profile (country, department, display name, etc.) into global variables on the first user message. The orchestrator uses these to personalize answers — e.g., returning the correct country-specific WFH policy without asking the user where they are.

**Read this pattern when:**
- The user wants country-aware, department-aware, or role-aware answers
- The agent needs to call the M365 Users connector (`GetMyProfile` / `UserGet_V2`)
- The user asks about personalizing responses based on who is chatting

## Orchestrator-Generated Variables → [orchestrator-variables.md](orchestrator-variables.md)

Uses `AutomaticTaskInput` to let the orchestrator's LLM classify or extract structured data from the user's message at orchestration time — no extra AI Prompt call, no extra latency, no extra cost. The primary use case is routing knowledge searches by category or country inside an `OnKnowledgeRequested` topic.

**Read this pattern when:**
- The user needs to route knowledge searches to different sources based on query category or country
- The user wants to classify user intent without an explicit question or AI Prompt
- The user asks about `AutomaticTaskInput`, `shouldPromptUser`, or orchestrator-generated inputs

## Combining Patterns

You can combine more than one pattern. For example, when using both glossary and user context, merge them into a **single** `conversation-init` topic rather than creating separate OnActivity topics. Use the template at `${CLAUDE_SKILL_DIR}/../../templates/topics/conversation-init.topic.mcs.yml`. The individual files explain the details.
