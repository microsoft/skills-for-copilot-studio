---
user-invocable: false
name: best-practices
description: "Best practices for Copilot Studio agents. Covers JIT glossary loading (customer acronyms, terminology), JIT user context provisioning (M365 profile, country, department), the shared OnActivity initialization pattern, dynamic topic redirects with Switch expressions, preventing child agents from responding directly to users, RAI error handling with categorized responses, deterministic MCP server tool calls, citations in Adaptive Cards for Teams, hold messages during knowledge search, channel-aware Start Over with Adaptive Cards, line breaks in message and question nodes, chain of thought logging for complex orchestration, and conversation history capture as a variable. USE FOR: glossary, acronyms, user context, user profile, country-aware answers, JIT initialization, OnActivity provisioning, conversation-init, personalized knowledge, dynamic redirect, Switch, BeginDialog, if/then/else replacement, child agent responses, completion setting, SendMessageTool, output variables, connected agents, RAI, responsible AI, content filtering, OpenAI errors, ContentFiltered, OnError, jailbreak, self-harm, hate, violence, sexual content, indirect attack, MCP, MCP server, MCP tool, deterministic tool call, generative actions, child agent MCP, citations, adaptive card, Teams citations, references, citation sources, collapsible references, ForAll, CitationSources, hold message, please wait, OnKnowledgeRequested, knowledge search delay, loading message, random message, start over, restart, reset conversation, channel check, msteams, messageBack, Action.Submit, debug menu, ChannelId, ClearAllVariables, ConversationHistory, ConversationScopedVariables, OnSystemRedirect, line break, br tag, paragraph spacing, SendActivity formatting, Question prompt formatting, long message, wall of text, chain of thought, CoT, thinking, streaming, reasoning steps, tool chain, multi-step orchestration, intermediate reasoning, show your work, logger topic, conversation history, transcript, save conversation, export conversation, escalation context, Recognize intent, conversation variable, ConversationHistory, ticket context, live agent handoff. DO NOT USE FOR: general knowledge sources (use add-knowledge), topic creation (use new-topic)."
context: fork
agent: copilot-studio-author
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
## Date Context → [date-context.md](date-context.md)

Provides the current date to the orchestrator through agent instructions using Power FX (`{Text(Today(),DateTimeFormat.LongDate)}`). Enables accurate responses to date-related questions by giving the orchestrator explicit awareness of "today" for interpreting relative timeframes.

**Read this best-practice when:**
- Users ask date-relative questions ("What's next week?", "upcoming events", "recent announcements")
- The agent needs to filter time-sensitive knowledge sources
- Date interpretation is causing confusion or hallucinations
- The agent handles schedules, calendars, deadlines, or time-sensitive content

## Deterministic MCP Server Tool Calls → [deterministic-mcp-calls.md](deterministic-mcp-calls.md)

Ensures MCP server tools fire reliably for specific intents despite platform limitations (no `/` syntax in instructions, no MCP tool nodes in topics). Covers two approaches: naming the tool explicitly in agent instructions (simple, high reliability) or wrapping the MCP tool in a dedicated child agent with trigger phrases (near-deterministic, more setup).

**Read this best-practice when:**
- The user wants an MCP tool to always fire for a specific intent
- The orchestrator is inconsistently calling an MCP server tool
- The user asks how to call MCP tools deterministically or from topics
- The user wants to force a generative action to execute reliably

## RAI Error Handling → [rai-error-handling.md](rai-error-handling.md)

Catches Azure OpenAI RAI content filtering errors in the `OnError` topic, classifies them by subcode (violence, hate, sexual, self-harm, jailbreak, indirect attack), and returns targeted, user-friendly responses instead of generic error messages. Uses an AI Builder prompt node to classify the subcode and a single switch-style `ConditionGroup` to branch on the result.

**Read this best-practice when:**
- The user wants to customize error messages for RAI content filtering violations
- The user needs category-specific responses (e.g., crisis resources for self-harm triggers)
- The user asks about handling `ContentFiltered` errors, OpenAI subcodes, or the `OnError` topic
- The user wants visibility into which RAI filter categories are triggering

## Citations in Adaptive Cards for Teams → [adaptive-card-citations.md](adaptive-card-citations.md)

Replaces the default Teams citation rendering with a collapsible Adaptive Card that displays numbered, clickable references. Uses `ForAll()` over `Topic.Answer.Text.CitationSources` to dynamically generate citation rows with emoji badges and `Action.ToggleVisibility` for expand/collapse.

**Read this best-practice when:**
- The user wants to customize how citations appear in the Teams channel
- Users are unhappy with the default citation rendering in Teams
- The user asks about putting citations or references in an Adaptive Card
- The user wants a collapsible references section for knowledge-grounded answers

## Hold Message During Knowledge Search → [knowledge-hold-message.md](knowledge-hold-message.md)

Sends a randomized "please hold" message to the user while the agent searches knowledge sources, using an `OnKnowledgeRequested` topic with a Power Fx `Table()` of 40 messages and `Rand()` selection. Includes alternative approaches: static single message or AI-generated messages.

**Read this best-practice when:**
- The user complains about the lack of activity or streaming UI during knowledge search
- The agent has a high volume of knowledge sources (500+ documents) or large SharePoint libraries
- The user asks about the `OnKnowledgeRequested` trigger or customizing the knowledge search experience

**Do NOT proactively suggest this pattern** — only use it when the user reports latency issues with knowledge search, when the knowledge source volume is high enough (500+ documents, large SharePoint sites) to cause noticeable delays, or when the agent uses a deep reasoning or thinking model (e.g., o1, o3, GPT-5 reasoning, Claude Opus 4.6) that introduces additional latency due to increased reasoning time during knowledge summarization.

## Start Over & Reset Conversation v2 — Channel-Aware with Adaptive Cards → [start-over-v2-teams.md](start-over-v2-teams.md)

Replaces the default Start Over system topic with a channel-aware version that checks `System.Activity.ChannelId` and serves the correct Adaptive Card format — `messageBack` for Teams, simple string data for other channels. Includes a companion Reset Conversation topic that clears all conversation-scoped variables, wipes conversation history, and redirects to Conversation Start. Also includes a hidden debug menu with Clear State, Clear History, and Conversation ID actions.

**Read this best-practice when:**
- The user's Start Over topic buttons are not working in Teams
- The user wants an Adaptive Card-based restart confirmation instead of plain text
- The user deploys to both Teams and another channel and needs channel-specific submit formats
- The user asks about `Action.Submit` not working in Teams or `messageBack` format

**Important:** When implementing this pattern, both the standard **Start Over** and **Reset Conversation** system topics must be **disabled** to avoid conflicts. Both share trigger phrases or functionality with the v2 topics and will cause unpredictable intent routing if left enabled.

## Chain of Thought (CoT) Logging → [chain-of-thought-logging.md](chain-of-thought-logging.md)

Surfaces intermediate reasoning steps as italicized "Thinking: ..." messages during complex multi-step orchestration. Creates a lightweight logger topic that the orchestrator calls after each tool, child agent, or MCP server step. Works with GPT-4.1, GPT-5 Chat/Auto/Reasoning, and Claude (Sonnet + Opus).

**Read this best-practice when:**
- The user's agent uses many tools, MCP servers, or child agents with complex orchestration
- Users experience long silences during multi-step reasoning or tool chains
- The user wants to show "thinking" or "working on it" progress during agent execution
- The user asks about chain of thought, streaming, or intermediate reasoning visibility

**Do NOT use for pure knowledge agents** — use [Hold Message During Knowledge Search](knowledge-hold-message.md) instead. CoT logging is for multi-step orchestration, not simple knowledge retrieval.

## Conversation History as a Variable → [conversation-history-variable.md](conversation-history-variable.md)

Captures the full conversation history at runtime by having the orchestrator dump the transcript into an input variable on demand. Supports sending the history as a message, storing it as a variable for tool input, or passing it during escalation. Uses the same input-description-as-instruction pattern as CoT logging.

**Read this best-practice when:**
- The user needs to capture conversation context for escalation, ticketing, or email
- A downstream tool or connector requires conversation history as input
- The user asks about saving, exporting, or accessing the conversation transcript
- The user wants to pass conversational context to another agent, flow, or Dataverse record

**Do NOT use for compliance-grade transcripts** — this is a best-effort reconstruction from the orchestrator's context window. Use a dedicated logging solution for audit requirements.

## Line Breaks in Message and Question Nodes → [line-breaks-in-messages.md](line-breaks-in-messages.md)

Shows how to use `<br /><br />` tags to insert line breaks and paragraph spacing in `SendActivity` (message) and `Question` node text. Ensures consistent formatting across Teams, web chat, and other channels.

**Read this best-practice when:**
- The user wants to add line breaks or paragraph spacing in bot messages or questions
- Messages appear as walls of text and need visual separation
- The user asks about formatting text in SendActivity or Question prompt fields
- The user is writing longer messages with multiple sections or instructions

## Combining patterns

You can also combine more than one best pratice. For example, when using both glossary and user context, merge them into a **single** `conversation-init` topic rather than creating separate OnActivity topics. Use the template at `${CLAUDE_SKILL_DIR}/../../templates/topics/conversation-init.topic.mcs.yml`. The individual files explain the details.
