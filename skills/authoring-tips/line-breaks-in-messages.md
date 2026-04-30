# Line Breaks in Message and Question Nodes

Insert `<br /><br />` inside `SendActivity` (message) and `Question` nodes to render paragraph breaks consistently across Teams, web chat, and other channels. Plain YAML newlines alone are rendered as spaces in most channels, so long messages turn into unreadable walls of text.

## When to Use This Pattern

- The agent sends longer messages that benefit from visual separation (welcome messages, instructions, summaries)
- `Question` nodes include context or preamble before the actual question
- Users report that bot messages feel like walls of text
- You want consistent paragraph spacing across Teams, web chat, and other channels

## How It Works

- `<br />` — single line break
- `<br /><br />` — double line break (paragraph spacing)
- YAML `|-` block scalar preserves the literal newlines in the source file
- Plain newlines (without `<br />`) are rendered as a single space in most channels

## YAML Example

**Message node:**

```yaml
- kind: SendActivity
  id: sendActivity_QVhMj2
  activity: |-
    Hello! I'm a cool bot.
    <br /><br />
    I'm here to help you!
```

Renders as two visually separated paragraphs:

> Hello! I'm a cool bot.
>
> I'm here to help you!

**Question node with preamble:**

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

**Multi-section message** — chain additional `<br /><br />` tags:

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

## Key Points

| Syntax | Effect |
|---|---|
| `<br />` | Single line break |
| `<br /><br />` | Paragraph spacing (double break) |
| `|-` (YAML block scalar) | Preserves source newlines — required for multi-line `activity` / `prompt` |
| Plain YAML newline (without `<br />`) | Rendered as a space in most channels |

- **Always pair `<br /><br />` with `|-`** — the block scalar keeps the source readable; the `<br />` makes the rendered output consistent
- **Use for both `SendActivity` and `Question`** — the same trick applies to the `activity` and `prompt` fields
- **Works across channels** — Teams, Copilot web chat, and custom channels all render `<br />` reliably, whereas raw newlines are channel-dependent
