---
user-invocable: false
name: patterns
description: "Index of repeatable implementation patterns for Copilot Studio agents. When a request may need a best-practice architecture or reusable pattern for building an agent capability, retrieve this index before deciding what detailed guidance is relevant. Do not decide from this frontmatter alone; use the index summaries, then open only the specific pattern file if needed. Do not use for general knowledge sources or topic creation. USE FOR: glossary, acronyms, terminology, CSV, SharePoint, JIT, user context, country, department, M365 profile, GetMyProfile, AutomaticTaskInput, shouldPromptUser, orchestrator-generated inputs, conversation-init, Teams deployment, Microsoft Teams, Teams agent, production hardening, OnInstallationUpdate, app reinstall, OnInactivity, stale context, clear ConversationHistory, Global.InactiveConversation, cross-channel context, Microsoft 365 Copilot, M365 Copilot, Global.UserContext, IsBlank context, Reset Conversation, OnSystemRedirect, Start Over, YesNo entity, Adaptive Card confirmation, OnError card, self-serve troubleshooting, diagnostics panel, System.Bot.Id, System.Conversation.Id, LogCustomTelemetryEvent, OnErrorLog, suggested prompts, conversationStarters."
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

## Teams Production Hardening → [teams-production-hardening.md](teams-production-hardening.md)

Coordinated framework of eight production patterns for Copilot Studio agents deployed to Microsoft Teams and Microsoft 365 Copilot. Covers app reinstalls (`OnActivity InstallationUpdate`), stale-context handling (`OnInactivity` + follow-up notification), cross-channel context initialization (`Global.UserContext` via priority-based `OnActivity` guarded by `IsBlank`), rebuilt Reset Conversation and Start Over system topics with Adaptive Card confirmation and diagnostics panel, rich `OnError` card with self-serve troubleshooting and telemetry, and agent-level suggested prompts.

**Read this pattern when:**
- The user is deploying (or hardening) a Copilot Studio agent on Microsoft Teams
- Users report stale context after returning to a long-running Teams conversation
- Context variables (country, language, department) work on web chat but not in Microsoft 365 Copilot
- The user wants richer `OnError` or Start Over experiences with diagnostic info for help-desk escalation
- The user asks about `OnInstallationUpdate`, `OnInactivity`, `OnSystemRedirect`, suggested prompts, or Teams-specific agent behavior
- The user wants to reduce token usage by clearing idle conversation history
