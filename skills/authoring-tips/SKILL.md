---
user-invocable: false
name: authoring-tips
description: "Index of practical authoring tips and workarounds for Copilot Studio agents. When a request may need best-practice guidance, an authoring technique, or a workaround for improving an agent's behavior, retrieve this index before deciding what detailed guidance is relevant. Do not decide from this frontmatter alone; use the index summaries, then open only the specific tip file if needed. Do not use for repeatable implementation patterns, general knowledge sources, or topic creation. USE FOR: date context, Today(), DateTimeFormat, Switch, BeginDialog, dynamic redirect, child agent, SendMessageTool, output variables, connected agents, completion setting, OnError, ContentFiltered, Azure OpenAI, RAI subcodes, OpenAIViolence, OpenAIHate, OpenAISexual, OpenAISelfHarm, OpenAIJailBreak, OpenAIndirectAttack, content filter, line breaks, <br />, paragraph spacing, wall of text, SendActivity formatting, Question node formatting, OnKnowledgeRequested, hold message, typing indicator, knowledge search latency, random message, Power Fx Table, MCP server, MCP tool, deterministic tool call, forced tool invocation, child agent intent routing, chain of thought, CoT, thinking messages, AutomaticTaskInput, modelDescription, reasoning trace, conversation history, transcript, Recognize intent, ConversationHistory, escalation, live agent handoff."
context: fork
agent: copilot-studio-author
---

# Copilot Studio — Authoring Tips

Practical tips and techniques learned from building agents with Copilot Studio. These enhance the current authoring experience or provide workarounds for platform limitations.

**Only read the file relevant to the current task** — do NOT read all files.

## Date Context → [date-context.md](date-context.md)

Provides the current date to the orchestrator through agent instructions using Power FX (`{Text(Today(),DateTimeFormat.LongDate)}`). Enables accurate responses to date-related questions by giving the orchestrator explicit awareness of "today" for interpreting relative timeframes.

**Read this tip when:**
- Users ask date-relative questions ("What's next week?", "upcoming events", "recent announcements")
- The agent needs to filter time-sensitive knowledge sources
- Date interpretation is causing confusion or hallucinations
- The agent handles schedules, calendars, deadlines, or time-sensitive content

## Dynamic Topic Redirect with Variable → [Topic-redirect-withvariable.md](Topic-redirect-withvariable.md)

Uses a `Switch()` Power Fx expression inside a `BeginDialog` node to dynamically redirect to different topics based on a variable value. Replaces complex if/then/else condition chains with a single, maintainable YAML pattern.

**Read this tip when:**
- The user needs to route to one of several topics based on a variable
- The user wants to replace nested ConditionGroup nodes with a cleaner approach
- The user asks about dynamic topic redirects or Switch expressions in BeginDialog

## Prevent Child Agent Responses → [prevent-child-agent-responses.md](prevent-child-agent-responses.md)

Prevents child agents (connected agents) from sending messages directly to the user. Clarifies the common misconception about the completion setting and provides the instruction block to force child agents to use output variables instead of `SendMessageTool`.

**Read this tip when:**
- The user wants a child agent to return data without messaging the user
- The user is confused about the completion setting on a child agent
- The parent agent needs to control all user-facing responses

## RAI Error Handling in OnError → [rai-error-handling.md](rai-error-handling.md)

Catches Azure OpenAI Responsible AI content-filter errors in the `OnError` topic, classifies them by subcode (`OpenAIViolence`, `OpenAIHate`, `OpenAISexual`, `OpenAISelfHarm`, `OpenAIJailBreak`, `OpenAIndirectAttack`) via an AI Builder prompt, and delivers category-specific messages instead of a generic error.

**Read this tip when:**
- The user needs industry-specific or empathetic RAI error messages (healthcare, education, government)
- The user wants category-specific handling (e.g., crisis resources for self-harm, security notifications for jailbreak attempts)
- The user needs telemetry on which filter categories are triggering
- The user asks about `OnError`, `ContentFiltered`, Azure OpenAI content filters, or RAI subcodes

## Line Breaks in Messages → [line-breaks-in-messages.md](line-breaks-in-messages.md)

Inserts `<br /><br />` inside `SendActivity` and `Question` node `activity`/`prompt` fields to render consistent paragraph spacing across Teams, web chat, and other channels. Plain YAML newlines render as spaces in most channels.

**Read this tip when:**
- The user reports long messages feel like walls of text
- Multi-part questions or welcome messages need visual separation
- The user wants consistent paragraph spacing across channels
- The user asks about line breaks, `<br />`, or formatting in messages/questions

## Hold Message During Knowledge Search → [knowledge-hold-message.md](knowledge-hold-message.md)

Sends a randomized "please hold" message during knowledge search via a custom `OnKnowledgeRequested` topic. Uses an inline Power Fx `Table()` of ~40 messages and `Rand()/Index()` for random selection — no connector calls, runs in milliseconds.

**Read this tip when:**
- The user's agent has noticeable knowledge-search latency
- The user wants to avoid silent wait times during retrieval
- Users are abandoning conversations or resending questions during delays
- The user asks about `OnKnowledgeRequested`, typing indicators, or hold messages

## Deterministic MCP Server Tool Calls → [deterministic-mcp-calls.md](deterministic-mcp-calls.md)

Two workarounds for forcing MCP server tools to fire reliably for a specific intent: (1) name the tool explicitly in agent instructions, or (2) wrap the tool in a dedicated child agent with trigger phrases. Covers the current platform limitations (no `/` syntax, no MCP nodes in topics).

**Read this tip when:**
- An MCP tool must fire every time for a specific intent (compliance, data accuracy)
- The user observes the orchestrator skipping an MCP tool
- The user asks about `/` syntax with MCP tools, MCP tools in topics, or forcing tool invocation
- The user needs to guarantee MCP tool calls for business-critical workflows

## Chain of Thought (CoT) Logging → [chain-of-thought-logging.md](chain-of-thought-logging.md)

Surfaces the orchestrator's intermediate reasoning as italicized "Thinking: …" chat messages during multi-step, multi-tool, or multi-agent orchestration. Uses an `AutomaticTaskInput` whose description doubles as an instruction telling the orchestrator what to log.

**Read this tip when:**
- The agent uses multiple tools, MCP servers, or child agents that chain together
- Users experience 10–30s silences during multi-step reasoning
- The user wants a debug/observability tool to trace orchestrator behavior
- The agent uses reasoning models (GPT-5 Reasoning, Claude Opus) with long thinking times
- The user asks about streaming, typing indicators, or progress messages for complex flows

## Conversation History as a Variable → [conversation-history-variable.md](conversation-history-variable.md)

Captures the conversation transcript at runtime via an `AutomaticTaskInput` whose description tells the orchestrator to dump the full history. Enables summarization, live-agent handoff, ticket attachments, email recaps, or passing context to downstream tools.

**Read this tip when:**
- The user needs to capture conversation context for live-agent escalation
- A downstream tool/connector requires conversation history as input
- The user wants to log conversations to Dataverse, a ticketing system, or email
- The user asks about saving, exporting, or accessing the conversation transcript at runtime
