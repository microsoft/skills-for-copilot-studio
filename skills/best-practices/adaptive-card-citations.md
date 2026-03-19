# Citations in Adaptive Cards for Teams

When agents are deployed to the Microsoft Teams channel, the default citation rendering may not meet user expectations — citations can appear as plain footnote links that are easy to miss or feel disconnected from the answer. This best practice provides an alternative: rendering citations inside a collapsible Adaptive Card that gives users a clean, interactive references section.

## The Challenge

Copilot Studio's default citation behavior in Teams appends numbered source links after the response text. Common complaints include:

- Citations are visually disconnected from the answer
- The default rendering style feels cluttered when multiple sources are returned
- Users want a cleaner, more polished look that matches their organization's standards
- Footnote-style links are easy to overlook, reducing the perceived trustworthiness of the response

## The Solution

Replace the default citation rendering with an Adaptive Card that displays a collapsible "References" section. The card uses `Action.ToggleVisibility` to let users expand and collapse the citation list, and dynamically generates numbered citation entries from `Topic.Answer.Text.CitationSources` using `ForAll()`.

### Key Features

- **Collapsible references section** — starts collapsed so it doesn't overwhelm the response, users expand it when they want to verify sources
- **Numbered badges** — each citation gets a numbered emoji badge (1️⃣ through 9️⃣) matching the in-text citation numbers
- **Clickable links** — each citation row opens the source URL when clicked via `Action.OpenUrl`
- **Dynamic generation** — uses `ForAll()` over `Topic.Answer.Text.CitationSources` so the card adapts to however many citations are returned

## Implementation

### Step 1 — Add a Generative Answers Node

Ensure your topic has a generative answers node (SearchAndSummarizeContent) that populates `Topic.Answer`. The citation sources are available at `Topic.Answer.Text.CitationSources`, which contains the `Id`, `Name`, and `Url` for each source.

### Step 2 — Add the Adaptive Card After the Answer

After the generative answers node, add a `SendActivity` node with the Adaptive Card. The card should be sent as a separate message following the answer text so the citations appear below the response.

Use the following Adaptive Card JSON with Power Fx expressions:

```json
{
  type: "AdaptiveCard",
  '$schema': "https://adaptivecards.io/schemas/adaptive-card.json",
  version: "1.5",
  body: [

    // Expand header
    {
      type: "Container",
      id: "expandHeader",
      bleed: true,
      style: "emphasis",
      spacing: "None",
      items: [
        {
          type: "TextBlock",
          text: "🔽 References",
          weight: "Bolder",
          size: "Small",
          wrap: true
        }
      ],
      selectAction: {
        type: "Action.ToggleVisibility",
        targetElements: ["refs", "expandHeader", "collapseHeader"]
      }
    },

    // Collapse header
    {
      type: "Container",
      id: "collapseHeader",
      bleed: true,
      style: "emphasis",
      spacing: "None",
      isVisible: false,
      items: [
        {
          type: "TextBlock",
          text: "🔼 References",
          weight: "Bolder",
          size: "Small",
          wrap: true
        }
      ],
      selectAction: {
        type: "Action.ToggleVisibility",
        targetElements: ["refs", "expandHeader", "collapseHeader"]
      }
    },

    // References list
    {
      type: "Container",
      id: "refs",
      isVisible: false,
      bleed: true,
      spacing: "Small",
      items: ForAll(
        Topic.Answer.Text.CitationSources,
        With(
          {
            badge: Switch(
              Value(Id),
              1, "1️⃣",
              2, "2️⃣",
              3, "3️⃣",
              4, "4️⃣",
              5, "5️⃣",
              6, "6️⃣",
              7, "7️⃣",
              8, "8️⃣",
              9, "9️⃣",
              ""
            )
          },
          {
            type: "Container",
            separator: true,
            spacing: "None",
            selectAction: {
              type: "Action.OpenUrl",
              url: Url
            },
            items: [
              {
                type: "ColumnSet",
                columns: [
                  {
                    type: "Column",
                    width: "auto",
                    items: [
                      {
                        type: "TextBlock",
                        text: badge,
                        spacing: "Small"
                      }
                    ]
                  },
                  {
                    type: "Column",
                    width: "stretch",
                    items: [
                      {
                        type: "TextBlock",
                        text: Name & " ↗",
                        wrap: true,
                        color: "Accent",
                        spacing: "Small"
                      }
                    ]
                  }
                ]
              }
            ]
          }
        )
      )
    }
  ]
}
```

### Step 3 — Verify in Teams

Test the agent in the Teams channel to confirm:
- The answer text appears first, followed by the collapsible references card
- The "References" header toggles the citation list open and closed
- Each citation displays its numbered badge and source name
- Clicking a citation row opens the source URL in the browser

## How the Card Works

| Component | Purpose |
|---|---|
| `expandHeader` container | Shows "🔽 References" when citations are collapsed — clicking toggles visibility |
| `collapseHeader` container | Shows "🔼 References" when citations are expanded — starts hidden |
| `refs` container | The citation list — starts hidden, made visible by the toggle action |
| `ForAll()` over `CitationSources` | Dynamically generates one row per citation source |
| `Switch(Value(Id), ...)` | Maps citation ID to a numbered emoji badge (1️⃣–9️⃣) |
| `Action.OpenUrl` on each row | Makes the entire citation row clickable, opening the source URL |
| `Name & " ↗"` | Displays the source name with an arrow indicator for the link |

## When to Use This Pattern

- Your agent is deployed to the Microsoft Teams channel
- Users have expressed dissatisfaction with the default citation rendering
- You want a polished, collapsible references section that keeps the response clean
- Your organization requires citations to be visually prominent and easy to interact with
- The agent returns knowledge-grounded answers with multiple source documents
