# Line Breaks in Message and Question Nodes

When sending longer messages or asking multi-part questions in Copilot Studio topics, the default single-block text rendering can be hard for users to read. This best practice shows how to insert line breaks using `<br /><br />` to visually separate content within `SendActivity` (message) and `Question` nodes.

## The Challenge

Long messages and complex questions rendered as a single block of text are difficult to scan:

- Users may miss important details buried in a wall of text
- Multi-step instructions blend together without visual separation
- Questions with context or preamble feel overwhelming when presented as one paragraph

## The Solution

Use `<br /><br />` tags within the `activity` or `prompt` field to insert line breaks. Combined with the YAML `|-` block scalar (which preserves newlines), this gives you full control over text formatting in the rendered message.

### How It Works

- `<br />` inserts a single line break
- `<br /><br />` inserts a double line break (paragraph spacing)
- The YAML `|-` indicator preserves literal newlines in the text block

## Implementation

### Line Breaks in a Message Node (SendActivity)

```yaml
- kind: SendActivity
  id: sendActivity_QVhMj2
  activity: |-
    Hello! I'm a cool bot.
    <br /><br />
    I'm here to help you!
```

This renders as two visually separated paragraphs in the chat:

> Hello! I'm a cool bot.
>
> I'm here to help you!

### Line Breaks in a Question Node

```yaml
- kind: Question
  id: question_example
  alwaysPrompt: true
  variable: init:Topic.UserChoice
  prompt: |-
    I need a few details to get started.
    <br /><br />
    Please select one of the options below to continue.
  entity:
    kind: ClosedListEntityReference
    entityId: yourAgentName.entity.YourEntity
```

### Multiple Sections with Line Breaks

For longer messages with several distinct sections, chain multiple `<br /><br />` tags:

```yaml
- kind: SendActivity
  id: sendActivity_multiSection
  activity: |-
    Welcome to the HR Support Bot!
    <br /><br />
    I can help you with:
    - Leave requests
    - Benefits enrollment
    - Payroll questions
    <br /><br />
    Just type your question or select an option below to get started.
```

## Key Details

| Syntax | Effect |
|---|---|
| `<br />` | Single line break |
| `<br /><br />` | Double line break (paragraph spacing) |
| `|-` (YAML block scalar) | Preserves newlines in the YAML source — required for multi-line `activity` and `prompt` fields |
| Regular YAML newline (without `<br />`) | Rendered as a space, not a line break, in most channels |

> **Note:** A plain newline in the YAML source (even with `|-`) may not render as a visible line break in all channels. Using `<br /><br />` ensures consistent paragraph spacing across Teams, web chat, and other deployment targets.

## When to Use This Pattern

- The agent sends longer messages that benefit from visual separation (welcome messages, instructions, summaries)
- Question nodes include context or preamble before the actual question
- Users report that bot messages feel like walls of text
- You want consistent paragraph spacing across Teams, web chat, and other channels
