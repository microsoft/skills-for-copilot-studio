---
description: Generate and insert an Adaptive Card into a Copilot Studio topic using AdaptiveCardPrompt. Use when the user asks to add an adaptive card, rich card, form card, info card, confirmation card, or interactive card to a topic.
argument-hint: <card-type> in <topic-name>
allowed-tools: Bash(python scripts/schema-lookup.py *), Read, Write, Edit, Glob
context: fork
agent: author
---

# Add Adaptive Card

Add an `AdaptiveCardPrompt` node to an existing Copilot Studio topic. Use this for all Adaptive Card scenarios — display-only cards, input forms, and confirmation flows.

## Instructions

1. **Auto-discover the agent directory**:
   ```
   Glob: agents/**/agent.mcs.yml
   ```
   NEVER hardcode an agent name.

2. **Clarify requirements** from the user if not specified:
   - Which topic should the card be added to?
   - Which card type (form, info, confirmation)?
   - What fields, labels, and placeholders are needed?
   - Which topic variables should receive the submitted values?

3. **Read the target topic file** to understand its structure and find the correct insertion point.

4. **Verify the schema** if needed:
   ```bash
   python scripts/schema-lookup.py summary AdaptiveCardPrompt
   ```

5. **Select and adapt the template** from [card-templates.md](card-templates.md) matching the requested type.

6. **Generate unique IDs** for all new nodes (format: `<nodeType>_<6-8 random alphanumeric>`).

7. **Insert the node(s)** at the correct position in the `actions` array using Edit.

8. **Validate** the updated topic file:
   ```bash
   python scripts/schema-lookup.py validate <topic-file.yml>
   ```

9. **Inform the user** that they must push (VS Code Extension) and publish (Copilot Studio UI) before testing with `/chat-with-agent` or `/run-tests`.

## AdaptiveCardPrompt Structure

`AdaptiveCardPrompt` is the correct node kind for all Adaptive Cards in Copilot Studio. The card JSON is embedded as a **multiline YAML literal string** under `card: |`.

```yaml
- kind: AdaptiveCardPrompt
  id: adaptiveCardPrompt_m9Kp2x
  card: |
    {
      "type": "AdaptiveCard",
      "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
      "version": "1.5",
      "body": [...],
      "actions": [...]
    }
  output:
    binding:
      fieldId: Topic.MyVariable
  outputType:
    properties:
      fieldId:
        type: String
```

**Rules**:
- `card: |` — the literal block scalar is mandatory. Do not use `card: >` or inline the JSON without it.
- `$schema` and `version` are required inside the card JSON.
- The `output.binding` maps each card input `id` to a topic variable (`Topic.VarName`, no `=` prefix).
- `outputType.properties` must declare a type for every bound field.
- Use plain `binding:` — no `kind:` property inside it.
- **Every `AdaptiveCardPrompt` must have `output`, `outputType`, and an `Action.Submit` button** — including display-only info cards. Omitting any of these causes VS Code extension errors (`MissingRequiredProperty`, `AdaptiveCardMissingActionSubmit`).
- For info cards with no meaningful inputs, add an `Action.Submit` (e.g. "OK") and bind a dummy acknowledgement variable (`Topic.CardAcknowledged`, type `String`).

## Node Comparison

| Node | Use When |
|------|----------|
| `AdaptiveCardPrompt` | Any Adaptive Card — with or without input fields |
| `SendActivity` | Plain text messages with optional `{}` variable interpolation |

Do NOT use `SendActivity` with an `attachments` array for Adaptive Cards.

## Field Validation

Do NOT use `style: "Email"` or `style: "Tel"` for validation — these only change the mobile keyboard and do not validate on submit. Always use `regex`:

```json
{
  "type": "Input.Text",
  "id": "email",
  "label": "Email address",
  "placeholder": "Enter your email address",
  "isRequired": true,
  "regex": "^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$",
  "errorMessage": "Enter a valid email address"
}
```

```json
{
  "type": "Input.Text",
  "id": "mobile",
  "label": "Mobile number",
  "placeholder": "Enter your mobile number",
  "isRequired": true,
  "regex": "^[+]?[0-9][\\s\\-\\(\\)0-9]{6,14}$",
  "errorMessage": "Enter a valid mobile number"
}
```

| Approach | Validates on submit? | Notes |
|----------|---------------------|-------|
| `regex` | Yes — blocks submit if pattern fails | Use for email, phone, any format |
| `isRequired: true` | Yes — blocks submit if empty | Mandatory fields |
| `style: "Email"` | No | Keyboard hint only — never use for validation |
| `style: "Tel"` | No | Keyboard hint only — never use for validation |

> **Rule**: Every `Input.ChoiceSet` (and any required input) must have a `label` property, or the VS Code extension raises `AdaptiveCardInputIsRequiredMissingLabel`.

## Output Binding

- Card input `id` values must exactly match the keys in `output.binding`.
- Topic variable references: `Topic.VariableName` (no `=` prefix).
- Declare every bound field in `outputType.properties` with its type.

```yaml
output:
  binding:
    userName: Topic.UserName
    userEmail: Topic.UserEmail
    category: Topic.Category
outputType:
  properties:
    userName:
      type: String
    userEmail:
      type: String
    category:
      type: String
```

## Dynamic Text Around Cards

Card JSON is static — Power Fx expressions and `{}` interpolation do not work inside the card body. Use `SendActivity` before or after `AdaptiveCardPrompt` for dynamic content:

```yaml
- kind: SendActivity
  id: sendMessage_Rz4Wq1
  activity: "Hello {Topic.UserName}, please complete the form below."

- kind: AdaptiveCardPrompt
  id: adaptiveCardPrompt_m9Kp2x
  card: |
    { ... }
```

## Card Types Quick Reference

| Type | Has inputs? | Has `output`? | Template |
|------|------------|--------------|---------|
| `form` | Yes | Yes | Form Card |
| `info` | No (dummy acknowledgement) | Yes (always required) | Info Card |
| `confirmation` | Yes (ChoiceSet) | Yes | Confirmation Card |

For full YAML examples of each type, see [card-templates.md](card-templates.md).
