---
user-invocable: false
name: best-practices
description: "Best practices for Copilot Studio agents. Covers JIT glossary loading (customer acronyms, terminology), JIT user context provisioning (M365 profile, country, department), and the shared OnActivity initialization pattern. USE FOR: glossary, acronyms, user context, user profile, country-aware answers, JIT initialization, OnActivity provisioning, conversation-init, personalized knowledge. DO NOT USE FOR: general knowledge sources (use add-knowledge), topic creation (use new-topic)."
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

## Combining patterns

You can also combine more than one best pratice. For example, when using both glossary and user context, merge them into a **single** `conversation-init` topic rather than creating separate OnActivity topics. Use the template at `${CLAUDE_SKILL_DIR}/../../templates/topics/conversation-init.topic.mcs.yml`. The individual files explain the details.
