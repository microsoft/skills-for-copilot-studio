# Adaptive Card Templates

Use these as starting points. Replace all `<random>` placeholders with unique random IDs (format: `<nodeType>_<6-8 alphanumeric>`).

Card JSON is always embedded as a multiline literal string using `card: |`.

---

## 1. Form Card

Collects multiple structured inputs in a single card. Submitted values are bound directly to topic variables via `output.binding`.

**Use for**: registration, feedback, requests, search filters, any multi-field data collection.

```yaml
- kind: AdaptiveCardPrompt
  id: adaptiveCardPrompt_<random>
  card: |
    {
      "type": "AdaptiveCard",
      "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
      "version": "1.5",
      "body": [
        {
          "type": "TextBlock",
          "text": "Form Title",
          "weight": "Bolder",
          "size": "Large",
          "wrap": true
        },
        {
          "type": "TextBlock",
          "text": "Please complete all fields and submit.",
          "isSubtle": true,
          "wrap": true,
          "spacing": "None"
        },
        {
          "type": "Input.Text",
          "id": "userName",
          "label": "Your name",
          "placeholder": "Enter your name",
          "isRequired": true,
          "errorMessage": "Name is required"
        },
        {
          "type": "Input.Text",
          "id": "userEmail",
          "label": "Email address",
          "placeholder": "Enter your email address",
          "isRequired": true,
          "regex": "^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$",
          "errorMessage": "Enter a valid email address"
        },
        {
          "type": "Input.Text",
          "id": "userMobile",
          "label": "Mobile number",
          "placeholder": "Enter your mobile number",
          "isRequired": true,
          "regex": "^[+]?[0-9][\\s\\-\\(\\)0-9]{6,14}$",
          "errorMessage": "Enter a valid mobile number"
        },
        {
          "type": "Input.ChoiceSet",
          "id": "category",
          "label": "Category",
          "style": "compact",
          "isRequired": true,
          "errorMessage": "Please select a category",
          "choices": [
            { "title": "Option A", "value": "optionA" },
            { "title": "Option B", "value": "optionB" },
            { "title": "Option C", "value": "optionC" }
          ]
        },
        {
          "type": "Input.Text",
          "id": "comments",
          "label": "Additional comments",
          "placeholder": "Optional...",
          "isMultiline": true
        }
      ],
      "actions": [
        {
          "type": "Action.Submit",
          "title": "Submit"
        }
      ]
    }
  output:
    binding:
      userName: Topic.UserName
      userEmail: Topic.UserEmail
      userMobile: Topic.UserMobile
      category: Topic.Category
      comments: Topic.Comments
  outputType:
    properties:
      userName:
        type: String
      userEmail:
        type: String
      userMobile:
        type: String
      category:
        type: String
      comments:
        type: String
```

**Notes**:
- `regex` on `Input.Text` validates on submit and blocks submission if the pattern does not match.
- `isRequired: true` blocks submission if the field is empty.
- `Input.ChoiceSet style: "compact"` renders as a dropdown; use `"expanded"` for radio buttons.
- The `id` in the card JSON must exactly match the key in `output.binding`.

---

## 2. Info Card

Displays structured information with no user input fields. **`output`, `outputType`, and an `Action.Submit` are still required** — omitting them causes VS Code extension errors. Use a dummy acknowledgement binding.

**Use for**: summaries, profile displays, result cards, announcements, status messages.

```yaml
- kind: AdaptiveCardPrompt
  id: adaptiveCardPrompt_<random>
  card: |
    {
      "type": "AdaptiveCard",
      "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
      "version": "1.5",
      "body": [
        {
          "type": "TextBlock",
          "text": "Card Title",
          "weight": "Bolder",
          "size": "Large",
          "wrap": true
        },
        {
          "type": "TextBlock",
          "text": "Subtitle or short description",
          "isSubtle": true,
          "wrap": true,
          "spacing": "None"
        },
        {
          "type": "TextBlock",
          "text": "Main body text providing more detail.",
          "wrap": true,
          "spacing": "Medium"
        },
        {
          "type": "FactSet",
          "facts": [
            { "title": "Field 1", "value": "Value 1" },
            { "title": "Field 2", "value": "Value 2" },
            { "title": "Field 3", "value": "Value 3" }
          ]
        }
      ],
      "actions": [
        {
          "type": "Action.Submit",
          "title": "OK"
        }
      ]
    }
  output:
    binding:
      acknowledged: Topic.CardAcknowledged
  outputType:
    properties:
      acknowledged:
        type: String
```

**Note**: `Topic.CardAcknowledged` is a dummy variable required to satisfy Copilot Studio's mandatory `output`/`outputType` constraint. Its value is not used downstream.

---

## 3. Confirmation Card

Presents a Yes/No decision via `Input.ChoiceSet`. The chosen value is bound to a topic variable and branched on with a `ConditionGroup`.

**Use for**: confirm actions, approve/reject flows, destructive-action warnings.

```yaml
- kind: AdaptiveCardPrompt
  id: adaptiveCardPrompt_<random>
  card: |
    {
      "type": "AdaptiveCard",
      "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
      "version": "1.5",
      "body": [
        {
          "type": "TextBlock",
          "text": "Confirm Action",
          "weight": "Bolder",
          "size": "Large",
          "wrap": true
        },
        {
          "type": "TextBlock",
          "text": "Are you sure you want to proceed? This action cannot be undone.",
          "wrap": true,
          "spacing": "Medium",
          "color": "Warning"
        },
        {
          "type": "Input.ChoiceSet",
          "id": "confirmed",
          "label": "Your choice",
          "style": "expanded",
          "isRequired": true,
          "errorMessage": "Please select an option",
          "choices": [
            { "title": "Yes, confirm", "value": "yes" },
            { "title": "No, cancel", "value": "no" }
          ]
        }
      ],
      "actions": [
        {
          "type": "Action.Submit",
          "title": "Submit"
        }
      ]
    }
  output:
    binding:
      confirmed: Topic.UserConfirmed
  outputType:
    properties:
      confirmed:
        type: String

- kind: ConditionGroup
  id: conditionGroup_<random>
  conditions:
    - id: conditionItem_<random>
      condition: =Topic.UserConfirmed = "yes"
      actions:
        - kind: SendActivity
          id: sendMessage_<random>
          activity: "Action confirmed. Proceeding..."
    - id: conditionItem_<random>
      condition: =Topic.UserConfirmed = "no"
      actions:
        - kind: SendActivity
          id: sendMessage_<random>
          activity: "Action cancelled. No changes were made."
```

**Note**: `Input.ChoiceSet style: "expanded"` renders as inline radio buttons — both options are visible without opening a dropdown.

---

## Common Patterns

### Minimal card (text only, no inputs)

```yaml
- kind: AdaptiveCardPrompt
  id: adaptiveCardPrompt_<random>
  card: |
    {
      "type": "AdaptiveCard",
      "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
      "version": "1.5",
      "body": [
        {
          "type": "TextBlock",
          "text": "Your message here.",
          "wrap": true
        }
      ],
      "actions": [
        {
          "type": "Action.Submit",
          "title": "OK",
          "data": {
            "acknowledged": true
          }
        }
      ]
    }
  output:
    binding:
      acknowledged: Topic.Acknowledged
  outputType:
    properties:
      acknowledged:
        type: Boolean
```

### Dynamic text alongside a card

Card JSON is static. Use `SendActivity` before or after `AdaptiveCardPrompt` for dynamic content:

```yaml
- kind: SendActivity
  id: sendMessage_<random>
  activity: "Hello {Topic.UserName}, please complete the form below."

- kind: AdaptiveCardPrompt
  id: adaptiveCardPrompt_<random>
  card: |
    { ... }
  output:
    binding:
      field: Topic.Field
  outputType:
    properties:
      field:
        type: String
```

### Input.ChoiceSet style options

| `style` | Renders as |
|---------|-----------|
| `"compact"` | Dropdown / select list |
| `"expanded"` | Inline radio buttons (all options visible) |
| `"filtered"` | Searchable dropdown (Teams only) |

### Version compatibility

Use `"version": "1.5"` for maximum Teams + Copilot Chat compatibility.

| Feature | Min version |
|---------|-------------|
| TextBlock, FactSet, Image | 1.0 |
| Input.Text, Input.ChoiceSet, Input.Toggle | 1.0 |
| Input.Date, Input.Time, Input.Number | 1.0 |
| RichTextBlock | 1.2 |
| Table | 1.5 |
