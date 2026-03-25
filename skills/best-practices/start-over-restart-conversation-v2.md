# Start Over & Reset Conversation v2 — Channel-Aware with Adaptive Cards

The default Start Over system topic uses a simple text-based confirmation prompt. This v2 pattern replaces it with an Adaptive Card confirmation that adapts based on whether the user is in Microsoft Teams or another channel. It also includes a hidden debug menu for administrators.

## The Challenge

Copilot Studio agents are often deployed to multiple channels — Teams, web chat, custom websites, etc. The `Action.Submit` payload format differs between Teams and other channels:

- **Teams** requires the `msteams.messageBack` format for submit actions to work correctly
- **Other channels** (web chat, custom) use a simple string `data` property

Using the wrong format causes submit buttons to silently fail — the user clicks "Yes" or "No" and nothing happens. A single Adaptive Card cannot reliably work across both channel types.

## The Solution

Add a `ConditionGroup` that checks `System.Activity.ChannelId` before presenting the confirmation card. If the channel is `msteams`, send the Teams-formatted card with `messageBack` payloads. Otherwise, send the standard card with simple string data. Both cards are visually identical to the user.

### Additional Features

- **Adaptive Card confirmation** — replaces the plain text Yes/No prompt with a polished card UI
- **Hidden debug menu** — a collapsible section at the bottom of the card with Clear State, Clear History, and Conversation ID actions for troubleshooting
- **Channel-safe submit actions** — each channel gets the correct `Action.Submit` format

## Pattern Overview

```
User says "start over" / "restart"
        |
        v
Check System.Activity.ChannelId
  |-- "msteams"  -> Teams-formatted Adaptive Card (messageBack)
  |-- else       -> Standard Adaptive Card (simple data)
        |
        v
User confirms Yes or No
  |-- Yes -> BeginDialog: ResetConversation
  |-- No  -> "Ok. Let's carry on."
```

## Prerequisites — Disable System Topics

Before implementing these v2 topics, you **must** disable the built-in system topics they replace:

1. Navigate to **Topics** in the left sidebar
2. Find the **Start Over** system topic — toggle it **Off**
3. Find the **Reset Conversation** system topic — toggle it **Off**

> **Critical:** If you leave the default Start Over or Reset Conversation system topics enabled, they will conflict with the v2 topics. Both share the same trigger phrases, which causes unpredictable intent routing — the orchestrator may fire the old system topic instead of the v2 version.

## Implementation

### Pre-Step — Create the YesNo Custom Entity

Before creating the topic, you **must** create a custom closed-list entity that the Question nodes will use to parse the user's Yes/No response.

1. In Copilot Studio, navigate to **Settings** > **Entities** (or **Entities** in the left sidebar)
2. Click **+ Add an entity** > **Closed list**
3. Name the entity **YesNo**
4. Add two list items:
   - **Yes**
   - **No**
5. Save the entity

The Question nodes in the topic YAML reference this entity via `entityId`. After creating the entity, update the `entityId` values in the YAML to match your agent's generated entity ID (e.g., `yourAgentName.entity.YesNo`).

> **Important:** Without this entity, the Question nodes will fail to parse the user's button selection. The entity must exist before the topic is created.

### Full Topic YAML

Replace your existing Start Over system topic with the following YAML in the Code editor view:

```yaml
kind: AdaptiveDialog
beginDialog:
  kind: OnRecognizedIntent
  id: main
  intent:
    displayName: Start Over
    includeInOnSelectIntent: false
    triggerQueries:
      - let's begin again
      - start over
      - start again
      - restart

  actions:
    - kind: ConditionGroup
      id: conditionGroup_6mCd7m
      conditions:
        - id: conditionItem_RBBxGa
          condition: =System.Activity.ChannelId = "msteams"
          actions:
            - kind: Question
              id: xhFrcs
              alwaysPrompt: false
              variable: init:Topic.Confirm
              prompt:
                attachments:
                  - kind: AdaptiveCardTemplate
                    cardContent: |-
                      {
                        "$schema": "https://adaptivecards.io/schemas/adaptive-card.json",
                        "type": "AdaptiveCard",
                        "version": "1.5",
                        "body": [
                          {
                            "type": "TextBlock",
                            "text": "Are you sure you want to restart the conversation?",
                            "wrap": true,
                            "weight": "Bolder",
                            "size": "Medium"
                          },
                          {
                            "type": "TextBlock",
                            "text": "This will reset the current conversation context.",
                            "wrap": true,
                            "isSubtle": true,
                            "spacing": "Small"
                          },
                          {
                            "type": "ActionSet",
                            "spacing": "Medium",
                            "actions": [
                              {
                                "type": "Action.Submit",
                                "title": "Yes",
                                "data": {
                                  "msteams": {
                                    "type": "messageBack",
                                    "text": "Yes",
                                    "displayText": "Yes"
                                  }
                                }
                              },
                              {
                                "type": "Action.Submit",
                                "title": "No",
                                "data": {
                                  "msteams": {
                                    "type": "messageBack",
                                    "text": "No",
                                    "displayText": "No"
                                  }
                                }
                              }
                            ]
                          },
                          {
                            "type": "Container",
                            "spacing": "Small",
                            "style": "emphasis",
                            "bleed": true,
                            "items": [
                              {
                                "type": "TextBlock",
                                "text": "Debug Menu",
                                "size": "Small",
                                "wrap": true
                              }
                            ],
                            "selectAction": {
                              "type": "Action.ToggleVisibility",
                              "targetElements": [
                                "debugMenu"
                              ]
                            }
                          },
                          {
                            "type": "Container",
                            "id": "debugMenu",
                            "isVisible": false,
                            "spacing": "Small",
                            "items": [
                              {
                                "type": "ActionSet",
                                "actions": [
                                  {
                                    "type": "Action.Submit",
                                    "title": "Clear State",
                                    "data": {
                                      "msteams": {
                                        "type": "messageBack",
                                        "text": "/debug clearstate"
                                      }
                                    }
                                  },
                                  {
                                    "type": "Action.Submit",
                                    "title": "Clear History",
                                    "data": {
                                      "msteams": {
                                        "type": "messageBack",
                                        "text": "/debug clearhistory"
                                      }
                                    }
                                  },
                                  {
                                    "type": "Action.Submit",
                                    "title": "Conversation ID",
                                    "data": {
                                      "msteams": {
                                        "type": "messageBack",
                                        "text": "/debug conversationid"
                                      }
                                    }
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      }

              entity:
                kind: ClosedListEntityReference
                entityId: yourAgentName.entity.YesNo

      elseActions:
        - kind: Question
          id: FggYGb
          alwaysPrompt: false
          variable: Topic.Confirm
          prompt:
            attachments:
              - kind: AdaptiveCardTemplate
                cardContent: |-
                  {
                    "$schema": "https://adaptivecards.io/schemas/adaptive-card.json",
                    "type": "AdaptiveCard",
                    "version": "1.5",
                    "body": [
                      {
                        "type": "TextBlock",
                        "text": "Are you sure you want to restart the conversation?",
                        "wrap": true,
                        "weight": "Bolder",
                        "size": "Medium"
                      },
                      {
                        "type": "TextBlock",
                        "text": "This will reset the current conversation context.",
                        "wrap": true,
                        "isSubtle": true,
                        "spacing": "Small"
                      },
                      {
                        "type": "ActionSet",
                        "spacing": "Medium",
                        "actions": [
                          {
                            "type": "Action.Submit",
                            "title": "Yes",
                            "data": "Yes"
                          },
                          {
                            "type": "Action.Submit",
                            "title": "No",
                            "data": "No"
                          }
                        ]
                      },
                      {
                        "type": "Container",
                        "spacing": "Small",
                        "style": "emphasis",
                        "bleed": true,
                        "items": [
                          {
                            "type": "TextBlock",
                            "text": "Debug Menu",
                            "size": "Small",
                            "wrap": true
                          }
                        ],
                        "selectAction": {
                          "type": "Action.ToggleVisibility",
                          "targetElements": [
                            "debugMenu"
                          ]
                        }
                      },
                      {
                        "type": "Container",
                        "id": "debugMenu",
                        "isVisible": false,
                        "spacing": "Small",
                        "items": [
                          {
                            "type": "ActionSet",
                            "actions": [
                              {
                                "type": "Action.Submit",
                                "title": "Clear State",
                                "data": "/debug clearstate"
                              },
                              {
                                "type": "Action.Submit",
                                "title": "Clear History",
                                "data": "/debug clearhistory"
                              },
                              {
                                "type": "Action.Submit",
                                "title": "Conversation ID",
                                "data": "/debug conversationid"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }

          entity:
            kind: ClosedListEntityReference
            entityId: yourAgentName.entity.YesNo

    - kind: ConditionGroup
      id: conditionGroup_lvx2zV
      conditions:
        - id: conditionItem_sVQtHa
          condition: =Topic.Confirm = 'yourAgentName.entity.YesNo'.L8LTlk
          actions:
            - kind: BeginDialog
              id: 0YKYsy
              dialog: yourAgentName.topic.ResetConversationV2

      elseActions:
        - kind: SendActivity
          id: sendMessage_lk2CyQ
          activity: Ok. Let's carry on.
```

**Replace:**
- `yourAgentName.entity.YesNo` with your agent's Yes/No entity ID
- `yourAgentName.entity.YesNo'.L8LTlk` with your agent's "Yes" enum value
- `yourAgentName.topic.ResetConversationV2` with your agent's Reset Conversation v2 topic ID (created in the next section)

### Key Differences: Teams vs Other Channels

| Component | Teams Card | Standard Card |
|---|---|---|
| Yes/No buttons | `msteams.messageBack` with `text` and `displayText` | Simple string `data: "Yes"` / `data: "No"` |
| Debug actions | `msteams.messageBack` with `text: "/debug ..."` | Simple string `data: "/debug ..."` |
| Visual appearance | Identical | Identical |

The `messageBack` format is required in Teams because the Teams client processes `Action.Submit` differently from other Bot Framework channels. Without it, button clicks may not send the expected value back to the agent.

## Reset Conversation v2 Topic

The Start Over v2 topic calls a **Reset Conversation v2** topic via `BeginDialog` when the user confirms "Yes". This companion topic handles the actual conversation reset — clearing variables, wiping conversation history, and redirecting to the Conversation Start topic for a fresh beginning.

### Reset Conversation v2 YAML

Create a new topic named **ResetConversationV2** and paste the following YAML in the Code editor view:

```yaml
kind: AdaptiveDialog
startBehavior: UseLatestPublishedContentAndCancelOtherTopics
beginDialog:
  kind: OnSystemRedirect
  id: main
  actions:
    - kind: ClearAllVariables
      id: clearAllVariables_73bTFR
      variables: ConversationScopedVariables

    - kind: ClearAllVariables
      id: SLgE7u
      variables: ConversationHistory

    - kind: BeginDialog
      id: U14iCH
      dialog: yourAgentName.topic.ConversationStart

    - kind: CancelAllDialogs
      id: cancelAllDialogs_12Gt21
```

**Replace:**
- `yourAgentName.topic.ConversationStart` with your agent's Conversation Start topic ID

### How Reset Conversation Works

The topic executes four actions in sequence:

| Action | What It Does |
|---|---|
| `ClearAllVariables: ConversationScopedVariables` | Resets all conversation-scoped variables (topic variables, global variables set during the session) |
| `ClearAllVariables: ConversationHistory` | Wipes the orchestrator's conversation history so the agent starts with no prior context |
| `BeginDialog: ConversationStart` | Redirects to the Conversation Start topic, giving the user a fresh greeting and re-initializing any setup logic (e.g., JIT glossary, user context) |
| `CancelAllDialogs` | Ends all remaining dialog stacks to ensure a clean state |

The `startBehavior: UseLatestPublishedContentAndCancelOtherTopics` ensures that any in-flight topics are cancelled before the reset runs, preventing stale state from lingering.

> **Note:** The `OnSystemRedirect` trigger means this topic is not triggered by user utterances — it is only called programmatically via `BeginDialog` from the Start Over v2 topic.

## The Debug Menu

Both card variants include a hidden debug menu that expands when the user clicks the "Debug Menu" header. It provides three actions:

| Action | What It Does |
|---|---|
| **Clear State** | Sends `/debug clearstate` — useful for resetting global variables during testing |
| **Clear History** | Sends `/debug clearhistory` — clears conversation history |
| **Conversation ID** | Sends `/debug conversationid` — returns the current conversation ID for troubleshooting |

The debug menu uses `Action.ToggleVisibility` to stay hidden by default — end users won't see it unless they know to click the header. Consider removing the debug menu section before deploying to production, or gate it behind an admin check.

## When to Use This Pattern

- Your agent is deployed to both Teams and at least one other channel (web chat, custom app)
- You want Adaptive Card-based confirmation instead of plain text prompts
- Submit buttons in your current Start Over topic are not working in Teams
- You need a built-in debug menu for administrators during development and testing
- You want a polished, channel-aware restart experience across all deployment targets

## Troubleshooting

Common issues and their fixes:

| Symptom | Cause | Fix |
|---|---|---|
| Yes/No buttons do nothing in Teams | Using simple string `data` instead of `messageBack` format | Ensure the Teams branch of the ConditionGroup uses the `msteams.messageBack` payload |
| Both v2 and default Start Over fire | Default Start Over system topic is still enabled | Disable the **Start Over** system topic in the Topics list |
| Reset doesn't clear variables | Default Reset Conversation system topic is firing instead of v2 | Disable the **Reset Conversation** system topic in the Topics list |
| "Incompatible type comparison" error on `Topic.Confirm` | Comparing the choice variable to a string (`"Yes"`) instead of the enum value | Use `Topic.Confirm = 'yourAgentName.entity.YesNo'.YesEnumValue` — not `Topic.Confirm.Value = "Yes"` |
| Question node fails to parse button selection | YesNo custom entity does not exist | Create the **YesNo** closed-list entity with items **Yes** and **No** before creating the topic |
| Agent shows old greeting after reset | `BeginDialog` points to wrong Conversation Start topic | Verify `yourAgentName.topic.ConversationStart` matches your actual topic ID |
| Debug menu buttons do nothing in Teams | Debug actions missing `msteams.messageBack` wrapper | Ensure debug `Action.Submit` buttons in the Teams card use `messageBack` format |

## Implementation Checklist

Use this checklist to verify all components are in place:

1. [ ] **YesNo entity** created with two items: Yes, No
2. [ ] **Start Over** system topic disabled
3. [ ] **Reset Conversation** system topic disabled
4. [ ] **Start Over v2** topic created with channel-aware ConditionGroup
5. [ ] **Reset Conversation v2** topic created with ClearAllVariables + BeginDialog
6. [ ] All `yourAgentName` placeholders replaced with actual agent schema name
7. [ ] Entity enum value in confirm condition matches the "Yes" option ID
8. [ ] Tested in Teams — Yes/No buttons work, debug menu toggles
9. [ ] Tested in web chat — Yes/No buttons work, debug menu toggles
10. [ ] Reset clears variables and redirects to Conversation Start
