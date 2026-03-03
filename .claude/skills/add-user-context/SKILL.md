---
name: add-user-context
description: "Provision user profile information (country, department, display name, etc.) from Microsoft 365 into a global variable at the start of each conversation using an OnActivity JIT topic. USE FOR: user country, user profile, user department, M365 profile, user context, GetMyProfile, JIT user info, personalized knowledge, country-aware answers. DO NOT USE FOR: general knowledge sources (use add-knowledge), glossary (use add-glossary)."
---

# Add JIT User Context from M365 Profile

This pattern loads the current user's Microsoft 365 profile (country, department, display name, etc.) into global variables the first time each conversation receives a user message. The orchestrator uses these variables to personalize answers — for example, returning the Work From Home policy for the user's specific country without asking them to specify it.

## Pattern Overview

```
OnActivity topic (type: Message)              ← fires on first user message
  condition: =IsBlank(Global.UserCountry)     ← JIT: only runs if not loaded yet
        ↓
InvokeConnectorAction                         ← calls M365 Users "Get my profile"
  connectionReference: shared_office365users
  operationId: UserGet_V2
        ↓
SetVariable → Global.UserCountry              ← extracted from profile response
        ↓
Agent instructions reference {Global.UserCountry} ← single injection, context-only
```

## Why `OnActivity (type: Message)` and not `OnConversationStart`

- **`OnConversationStart` is not channel-universal.** It is not fired by M365 Copilot or other channel-embedded surfaces — any initialization placed there silently does not run for those users.
- **`type: Message` confirms real usage intent.** Calling the M365 Users connector for a session that never sends a message wastes a connector call. Deferring until the first message ensures the profile is only fetched when there is actual need.
- The `condition: =IsBlank(Global.UserCountry)` guard ensures the topic runs exactly once per conversation regardless of how many messages follow.

## Prerequisites

Before authoring the YAML:
1. **The M365 Users connector must be configured in Copilot Studio**. Go to the agent's Settings → Connections and add a connection for "Microsoft 365 Users".
2. **Verify the connection reference name**. Read `src/<AGENT-NAME>/connectionreferences.mcs.yml` and note the exact `logicalName` for the M365 Users connector — you will use this as the `connectionReference` value. It is typically `shared_office365users` but may differ.
3. The user's M365 profile must have the `country` field populated in Azure AD. If it is blank, the pattern falls back to `Global.UserCountry = ""` — see the fallback handling in Step 3.

## Step 1 — Create the Global Variable

Create `src/<AGENT-NAME>/variables/UserCountry.mcs.yml`. Read `settings.mcs.yml` first to get the `schemaName` prefix.

```yaml
# Name: UserCountry
# The user's country from their M365 profile, loaded JIT at conversation start.
name: UserCountry
aIVisibility: UseInAIContext
scope: Conversation
description: The user's country from their M365 profile, loaded JIT at conversation start.
schemaName: <agent-schemaName>.globalvariable.UserCountry
kind: GlobalVariableComponent
defaultValue: DEFAULT
```

**Key points:**
- `aIVisibility: UseInAIContext` — the orchestrator needs to know the user's country to route knowledge searches correctly (unlike the glossary which is context-only)
- The variable is referenced as `Global.UserCountry` in topics and `{Global.UserCountry}` in agent instructions

## Step 2 — Create the Provisioning Topic

> **If you are also loading a glossary via the `add-glossary` pattern, do not create a separate topic. Merge both into a single `conversation-init` topic — see below.**

### Combined topic (user context + glossary)

When both patterns are active, use a single `OnActivity` topic. Use the template at `templates/topics/conversation-init.topic.mcs.yml` and replace all `REPLACE` IDs and `<AGENT-SCHEMA-NAME>` placeholders.

The single condition `=IsBlank(Global.UserCountry)` is sufficient — both variables are always provisioned together, so checking one is enough.

### Standalone topic (user context only)

If you are only loading user context without a glossary, create `src/<AGENT-NAME>/topics/conversation-init.topic.mcs.yml`:

```yaml
kind: AdaptiveDialog
modelDescription: null
beginDialog:
  kind: OnActivity
  id: main
  type: Message
  condition: =IsBlank(Global.UserCountry)
  actions:
    - kind: InvokeConnectorAction
      id: getProfile_REPLACE1
      connectionReference: shared_office365users
      connectionProperties:
        mode: Invoker
      operationId: UserGet_V2
      output:
        kind: SingleVariableOutputBinding
        variable: init:Topic.M365Profile
    - kind: SetVariable
      id: setCountry_REPLACE2
      variable: Global.UserCountry
      value: =If(IsBlank(Topic.M365Profile.country), "Unknown", Topic.M365Profile.country)
```

**Replace these placeholders:**
- `REPLACE1`, `REPLACE2` — generate unique IDs using the ID Generation rules in `SKILL.md`
- `shared_office365users` — replace with the exact `logicalName` from `connectionreferences.mcs.yml`

**How it works:**
- `type: Message` — triggers only on actual user messages, not system events; see "Why `OnActivity (type: Message)`" above
- `condition: =IsBlank(Global.UserCountry)` — JIT: loads once per conversation; subsequent messages skip this topic
- `InvokeConnectorAction` calls the M365 Users connector's "Get my profile (V2)" operation, which returns the Azure AD profile of the currently authenticated user
- `SingleVariableOutputBinding` captures the full profile response into `Topic.M365Profile`
- `SetVariable` extracts `.country` from the profile object; uses `"Unknown"` as a fallback if the field is not populated in Azure AD
- **Authentication required**: this connector uses the signed-in user's identity. The agent must have authentication configured (`OnSignIn` / OAuthInput) — if the user is not authenticated, the connector call will fail

> **If combining with a glossary:** use the combined template and a single `condition: =IsBlank(Global.UserCountry)`. Both variables are loaded in one topic pass. — Update Agent Instructions

In `src/<AGENT-NAME>/agents/agent.mcs.yml` or `settings.mcs.yml`:

```yaml
instructions: |
  ## User Context
  The current user's country is {Global.UserCountry}.
  When the user asks a question whose answer depends on location (e.g. "What is my WFH policy?",
  "What are my local holidays?", "What is my notice period?"), use {Global.UserCountry} to
  search knowledge sources or interpret answers in the correct country context.
  Do not ask the user for their country — it is already known.
  If the country is "Unknown", answer with the general policy and note that the answer may vary by country.
```

**Why two references to `{Global.UserCountry}`:** the country value is short (a country name string), so the token cost of two injections is negligible. The second reference in the fallback instruction is important for clear behavior when the field is missing.

## Loading Additional Profile Fields

To also provision `department` or `displayName`, add more `SetVariable` nodes after the connector call:

```yaml
    - kind: SetVariable
      id: setDepartment_REPLACE3
      variable: Global.UserDepartment
      value: =If(IsBlank(Topic.M365Profile.department), "Unknown", Topic.M365Profile.department)
```

Create a corresponding `UserDepartment.mcs.yml` global variable for each additional field, using `aIVisibility: UseInAIContext` if the orchestrator should reason about it.

## Available M365 Profile Fields

The `UserGet_V2` response object includes (fields may be empty if not populated in Azure AD):

| Field | Description |
|-------|-------------|
| `country` | User's country |
| `department` | User's department |
| `displayName` | Full display name |
| `givenName` | First name |
| `surname` | Last name |
| `mail` | Email address |
| `jobTitle` | Job title |
| `officeLocation` | Office location |
| `city` | City |
| `companyName` | Company name |

## Validation Checklist

Before testing:
- [ ] M365 Users connector is configured in the agent's Connections settings
- [ ] `connectionReference` value matches the exact `logicalName` in `connectionreferences.mcs.yml`
- [ ] Agent has authentication configured (the connector uses the signed-in user's identity)
- [ ] `Global.UserCountry` variable file exists in `variables/` with `aIVisibility: UseInAIContext`
- [ ] All `REPLACE` IDs are replaced with unique generated IDs
- [ ] Agent instructions reference `{Global.UserCountry}` with guidance on how to use it

## Testing

1. Sign in to the agent in test chat (authentication must complete)
2. Send a message — the `OnActivity` topic fires and `Global.UserCountry` is populated
3. Use the variable inspector in the test panel to confirm the value matches your Azure AD profile country
4. Ask a country-sensitive question (e.g. "What is my work from home policy?") — verify the answer reflects your country
5. Ask a second question — confirm the profile is not re-fetched (condition `=IsBlank` prevents it)
6. Test with a user whose `country` field is blank in Azure AD — confirm the `"Unknown"` fallback works
