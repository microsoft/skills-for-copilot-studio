# Teams Production Hardening for Copilot Studio Agents

A coordinated set of eight production patterns for Copilot Studio agents deployed to Microsoft Teams (and, where applicable, Microsoft 365 Copilot). Addresses app reinstalls, stale conversation context, cross-channel variable initialization, user-friendly reset/troubleshooting flows, and self-serve error diagnostics. The patterns are designed to work together — variables set by one pattern are read by others — so treat this as a framework to adopt end-to-end, not a pick-and-mix list.

**Source:** <https://microsoft.github.io/mcscatblog/posts/copilot-studio-teams-agent-patterns/>

## Framework Overview

```
                  ┌──────────────────────────────────────────┐
                  │  User opens agent in Teams / M365 Copilot │
                  └──────────────────┬───────────────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
┌─────────▼─────────┐    ┌───────────▼────────────┐   ┌─────────▼──────────┐
│ 1. OnInstallation │    │ 4. SetContextVariables │   │ 8. Suggested       │
│    Update         │    │    (fires if blank)    │   │    prompts (config)│
│    → ConvStart    │    │    → Global.UserContext│   └────────────────────┘
└─────────┬─────────┘    └────────────────────────┘
          │                          ▲
          ▼                          │
   ConversationStart ─────────────> reads Global.UserContext

   ┌───────────────────────────────────────────────┐
   │ 2. OnInactivity (12h) ──► clear vars          │
   │                           set Global.Inactive │
   │                                               │
   │ 3. OnActivity (Inactive=true) ──► notify +    │
   │                                    "Start over"│
   └─────────────────────┬─────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────────┐
         │ 6. Start Over (Adaptive Card)     │
         │    Yes  ──► 5. Reset Conversation │
         │    No   ──► continue              │
         │    Diagnostics panel inline       │
         └───────────────┬───────────────────┘
                         ▼
         ┌───────────────────────────────────┐
         │ 5. Reset Conversation             │
         │    Clear scoped vars + history    │
         │    Redirect to ConversationStart  │
         └───────────────────────────────────┘

   ┌───────────────────────────────────────────────┐
   │ 7. OnError (Adaptive Card)                    │
   │    Error details + diagnostics + "Start over" │
   │    LogCustomTelemetryEvent                    │
   └───────────────────────────────────────────────┘
```

## Shared Variables

| Variable | Set by | Read by | Purpose |
|---|---|---|---|
| `Global.InactiveConversation` | Pattern 2 (set true), Pattern 3 (reset false) | Pattern 3 | Flag that signals the next user message should render the "session expired" card |
| `Global.UserContext` | Pattern 4 | Agent instructions, all topics | Structured user context (Country, Language, …) surviving resets and M365 Copilot channel |
| `Topic.Confirm` | Pattern 6 | Pattern 6 branches | Yes/No answer to the restart confirmation |

## When to Use This Framework

- Your agent is deployed (or will be) to Microsoft Teams — especially with long-running persistent conversations
- You want consistent behavior across Teams and Microsoft 365 Copilot (M365 Copilot does not fire `OnConversationStart`)
- Users report stale context, confusing resets, or generic error messages with no path to action
- You need self-serve diagnostics for help-desk escalations (agent ID, conversation ID, environment ID, etc.)

## Implementation

Apply in the order listed. Earlier patterns set variables that later ones depend on.

### Pattern 1 — Handle App Reinstalls

**Problem:** When a user uninstalls and reinstalls the Teams app, the Conversation Start system topic does **not** fire. The user lands on an empty chat with no greeting or onboarding guidance.

**Solution:** New topic with an `OnActivity` trigger of type `InstallationUpdate` that redirects to the Conversation Start topic. `startBehavior: UseLatestPublishedContentAndCancelOtherTopics` ensures the topic runs the latest published version and supersedes stale in-flight dialogs.

```yaml
kind: AdaptiveDialog
startBehavior: UseLatestPublishedContentAndCancelOtherTopics
beginDialog:
  kind: OnActivity
  id: main
  type: InstallationUpdate
  actions:
    - kind: BeginDialog
      id: Bqmh4L
      dialog: cat_B2EAgent.topic.ConversationStart
```

**Replace** `cat_B2EAgent.topic.ConversationStart` with your agent's fully-qualified Conversation Start topic name (see `settings.mcs.yml` for the `cat_*` prefix).

---

### Pattern 2 — Clear Stale Context After Inactivity

**Problem:** Teams persists conversations indefinitely. A user returning after days to continue an unrelated task sees the agent operate with stale `ConversationHistory`, producing confused answers.

**Solution:** `OnInactivity` trigger (12h example — tune `durationInSeconds` to your scenario). Clears `ConversationHistory`, clears session variables, sets `Global.InactiveConversation = true` so Pattern 3 can notify the user on their next message, and cancels all dialogs.

```yaml
kind: AdaptiveDialog
beginDialog:
  kind: OnInactivity
  id: main
  condition: =System.Activity.ChannelId = "msteams"
  durationInSeconds: 43200
  actions:
    - kind: ClearAllVariables
      id: mXHosp
      variables: ConversationHistory
    - kind: ClearAllVariables
      id: Vsemgr
    - kind: SetVariable
      id: setVariable_6CUITr
      variable: Global.InactiveConversation
      value: true
    - kind: CancelAllDialogs
      id: webE3j
inputType: {}
outputType: {}
```

**Secondary benefit:** clearing `ConversationHistory` on long-idle sessions also reduces token usage on the next turn.

---

### Pattern 3 — Notify User After Inactivity-Triggered Reset

**Problem:** After Pattern 2 clears context, the user doesn't know why the agent "forgot" them. Without a message they send a follow-up expecting continuity and get inconsistent behavior.

**Solution:** `OnActivity` (type: Message) guarded by the `Global.InactiveConversation` flag. Immediately resets the flag, then renders a Hero Card explaining the session expired with a persistent **Start over** button.

```yaml
kind: AdaptiveDialog
beginDialog:
  kind: OnActivity
  id: main
  condition: =Global.InactiveConversation = true
  type: Message
  actions:
    - kind: SetVariable
      id: setVariable_G6aAbW
      variable: Global.InactiveConversation
      value: false
    - kind: SendActivity
      id: sendActivity_pgGjvA
      activity:
        attachments:
          - kind: HeroCardTemplate
            title: Session expired
            subtitle: New conversation started
            text: ℹ️ Your previous session ended due to inactivity. Your query is now treated as new. Restart anytime.
            buttons:
              - kind: MessageBack
                title: Start over
                text: Start over
inputType: {}
outputType: {}
```

The **Start over** button posts the literal text `Start over`, which your agent should recognize and route to the Start Over system topic (Pattern 6).

---

### Pattern 4 — Set Global Context Variables Cross-Channel

**Problem:** Context variables (language, country, department, etc.) are typically populated in `OnConversationStart`. But `OnConversationStart` **does not fire in Microsoft 365 Copilot** and is lost after resets (Patterns 2 and 5 both clear variables). The result: same agent, different behavior across channels.

**Solution:** Dedicated `SetContextVariables` topic with `OnActivity (type: Message)` + `priority: -2` + `condition: =IsBlank(Global.UserContext)`. Fires exactly once on the first user message when context isn't set yet, regardless of channel or reset history.

```yaml
kind: AdaptiveDialog
beginDialog:
  kind: OnActivity
  id: main
  priority: -2
  condition: =IsBlank(Global.UserContext)
  type: Message
  actions:
    - kind: SetVariable
      id: setVariable_kRbCMi
      variable: Global.UserContext
      value: |-
        ={
            Country: "USA",
            Language: "English"
        }
inputType: {}
outputType: {}
```

- **Structured object** — use a record literal (`={...}`) so instructions can reference `{Global.UserContext.Country}`, `{Global.UserContext.Language}`, etc.
- **Replace hard-coded values** with calls to the M365 Users connector for real user profile data (see the JIT User Context pattern in this plugin)
- **Reference in instructions** — add a directive to your agent instructions like "Use `{Global.UserContext.Country}` when tailoring answers" and "If `Global.UserContext` is blank, trigger `/Set Context Variables` before answering"

**Why `priority: -2`** — negative priorities run before standard triggers, ensuring context is populated before any knowledge search or topic routing evaluates the first message.

---

### Pattern 5 — Rebuild the Reset Conversation System Topic

**Problem:** The default Reset Conversation topic clears some state but does not clear `ConversationHistory` and does not redirect users back to the onboarding/greeting flow — leaving them in a half-reset state.

**Solution:** Override the `OnSystemRedirect` Reset Conversation topic to clear `ConversationScopedVariables` and `ConversationHistory`, redirect to Conversation Start (which re-triggers Pattern 4 to repopulate context), then cancel all dialogs. `startBehavior: UseLatestPublishedContentAndCancelOtherTopics` forces the published version.

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
      dialog: cat_B2EAgent.topic.ConversationStart
    - kind: CancelAllDialogs
      id: cancelAllDialogs_12Gt21
```

**Replace** `cat_B2EAgent.topic.ConversationStart` with your agent's fully-qualified topic schema name.

---

### Pattern 6 — Rebuild Start Over with Adaptive Card + Diagnostics

**Problem:** The default Start Over dialog is a bare yes/no prompt. Users want confirmation language, and when things go wrong, help-desk engineers need diagnostic IDs (environment, tenant, agent, conversation) that users can copy-paste.

**Solution:** Replace the default Boolean question with an Adaptive Card question using a closed-list `YesNo` entity. The card shows:

- Confirmation header + explanation
- Yes / No action buttons
- Collapsed **Advanced options** panel with:
  - Troubleshooting actions: `Clear state` (`/debug clearstate`), `Clear history` (`/debug clearhistory`), `Conversation ID` (`/debug conversationid`)
  - Environment details: `System.Bot.EnvironmentId`, `System.Bot.TenantId`
  - Agent details: `System.Bot.Name`, `System.Bot.Id`, `System.Bot.SchemaName`
  - User details: `System.User.Language`, `System.User.Id`
  - Conversation details: `System.Activity.ChannelId`, `System.Conversation.Id`, `Text(Now(), DateTimeFormat.UTC)`

**Branches** (Power Fx on `Topic.Confirm`):
- `Yes` → `BeginDialog` to the Reset Conversation topic (Pattern 5)
- `No` → `SendActivity: "Ok. Let's carry on."` + `RecognizeIntent` on user input to get back to the normal flow

**Setup steps:**

1. Create a closed-list entity `YesNo` with items `Yes` and `No` (plus synonyms if needed)
2. Open the system **Start Over** topic
3. Replace the Boolean question node with a `Question` node using `ClosedListEntityReference` → `<agent>.entity.YesNo`, capturing into `Topic.Confirm`
4. Put the Adaptive Card structure described above as the `prompt` of that Question node
5. Add two `ConditionGroup` branches on `Topic.Confirm` — one for Yes (BeginDialog → Reset Conversation), one for No (SendActivity + RecognizeIntent)

See the blog post for the full Adaptive Card JSON; reproduce the structure as-is and swap text/branding to match your agent.

---

### Pattern 7 — Self-Serve OnError Topic with Adaptive Card + Telemetry

**Problem:** Generic "Something went wrong" messages leave users stuck and give engineers nothing actionable when they escalate.

**Solution:** Override the `OnError` system topic with a rich Adaptive Card that shows the error details, exposes the same diagnostic panel as Pattern 6, and logs telemetry. `startBehavior: UseLatestPublishedContentAndCancelOtherTopics` forces the published version.

**Adaptive Card structure** (inside the `SendActivity`):

- Header: `⚠️ Something went wrong` + short apology text
- Error details (attention-styled container, ColumnSets):
  - `System.Error.Message`
  - `System.Error.Code`
  - `System.Conversation.Id`
  - `Text(Now(), DateTimeFormat.UTC)`
- Collapsed **Advanced options** panel, identical to Pattern 6's:
  - Troubleshooting buttons: Start over, Clear state, Clear history, Conversation ID
  - Environment / Agent / User / Conversation diagnostic ColumnSets

**Telemetry logging node:**

```yaml
- kind: LogCustomTelemetryEvent
  id: 9KwEAn
  eventName: OnErrorLog
  properties: "={ErrorMessage: System.Error.Message, ErrorCode: System.Error.Code, TimeUTC: Text(Now(), DateTimeFormat.UTC), ConversationId: System.Conversation.Id}"
```

**End the topic with `CancelAllDialogs`** so the user returns to a clean state.

> Combines naturally with the `rai-error-handling` authoring tip — use that tip's AI Builder classifier + subcode ConditionGroup inside this same OnError topic before the error card, so content-filter errors get category-specific messages while all other errors fall through to the generic diagnostic card.

---

### Pattern 8 — Configure Suggested Prompts at Agent Level

**Problem:** Users don't know what the agent can do. Discovery is inconsistent across Teams and M365 Copilot.

**Solution:** Define 3–4 suggested prompts at the **agent** level (not topic level). They surface on initial conversation start in both Teams and Microsoft 365 Copilot, guiding users toward effective queries without blocking free-form input.

**Setup steps:**

1. Open agent **Settings**
2. Navigate to **Generative AI → Suggested prompts**
3. Add 3–4 prompts aligned to your agent's core capabilities
4. Save at agent level

This is configuration-only — no topic YAML. In the YAML files it surfaces as the `conversationStarters` block in `agent.mcs.yml` / `settings.mcs.yml`.

## Validation Checklist

Test in this order — later tests depend on earlier patterns being in place:

- [ ] **Pattern 1** — Uninstall + reinstall the Teams app → Conversation Start greeting appears
- [ ] **Pattern 4** — Open the agent in Microsoft 365 Copilot (where `OnConversationStart` doesn't fire) → verify `Global.UserContext` populates before the first answer
- [ ] **Pattern 2 + 3** — Idle for longer than `durationInSeconds` (drop the value temporarily for testing) → send a message → "Session expired" Hero Card appears with **Start over** button
- [ ] **Pattern 6** — Trigger Start Over → Adaptive Card renders with confirmation + Advanced options containing correct IDs from `System.Bot.*` / `System.Conversation.Id`
- [ ] **Pattern 5** — Confirm Yes in Pattern 6's card → history clears, Conversation Start re-runs, `Global.UserContext` is repopulated by Pattern 4
- [ ] **Pattern 7** — Force a runtime error (e.g., hit a broken connector action) → error Adaptive Card renders with `System.Error.Message`, `System.Error.Code`, conversation ID, UTC timestamp; telemetry event `OnErrorLog` appears in Application Insights
- [ ] **Pattern 8** — New conversation → 3–4 suggested prompts appear below the chat input in both Teams and M365 Copilot

## Notes

- **Schema-name prefix** — every `BeginDialog` dialog reference (`cat_B2EAgent.topic.*`) uses your agent's schema name prefix. Read `settings.mcs.yml` to find yours before pasting.
- **`startBehavior: UseLatestPublishedContentAndCancelOtherTopics`** — applied on Patterns 1, 5, and 7 to force the latest published version and supersede any in-flight version of the same dialog.
- **Channel scoping** — Pattern 2's `condition: =System.Activity.ChannelId = "msteams"` limits inactivity handling to Teams. Remove the condition to apply to all channels, or adapt per target channel.
- **Diagnostics duplication** — Patterns 6 and 7 deliberately use the *same* Advanced options panel so users see a consistent diagnostic experience regardless of whether they hit Start Over or an error.
