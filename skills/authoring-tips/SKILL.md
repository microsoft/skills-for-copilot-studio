---
user-invocable: false
name: authoring-tips
description: "Practical tips and workarounds learned from building Copilot Studio agents. Covers injecting date context via Power FX, dynamic topic redirects with Switch expressions, and preventing child agents from responding directly to users. USE FOR: date context, Today(), date-aware answers, dynamic redirect, Switch, BeginDialog, if/then/else replacement, child agent responses, completion setting, SendMessageTool, output variables, connected agents, workarounds, platform limitations. DO NOT USE FOR: JIT glossary or user context patterns (use patterns), knowledge routing with orchestrator variables (use patterns), general knowledge sources (use add-knowledge), topic creation (use new-topic)."
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
