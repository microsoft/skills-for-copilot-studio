---
user-invocable: false
description: "Scan all routable surfaces in a Copilot Studio agent for routing collisions by evaluating each surface's full AI definition — name, description, and inputs/outputs — as the orchestrator compares them. Also checks for instruction interference where top-level instructions compete with tool and topic definitions. Use before pushing changes for testing, or when the orchestrator routes to the wrong surface or response latency is inconsistent."
allowed-tools: Read, Glob
context: fork
agent: copilot-studio-author
---

# Disambiguation Check

Scan all routable surfaces in a Copilot Studio agent and report collisions that may cause wrong routing, increased latency, or unnecessary reasoning overhead.

The orchestrator decides where to route by comparing **descriptions** (`modelDescription` on topics and tools, `beginDialog.description` on child agents) — along with surface names and input/output schemas. Top-level agent **instructions** are always present in the orchestrator's context — they inform routing, planning, and output generation. Detailed behavioral descriptions in instructions can compete with tool and topic definitions during routing, leading to interference. This skill checks for both routing collisions between surfaces and instruction interference.

## When to Run This Skill

This is a heavyweight analysis — do NOT run it on every edit. There are two triggers:

**1. Before pushing changes for testing** — when the user has made multiple routing-relevant edits (new topics, new child agents, new tools, changed descriptions) and is about to push. This is the natural checkpoint: catch collisions before they reach the test environment.

> "You've made several changes to topics and tools. Want to run a disambiguation check before pushing?"

**2. When there's a problem** — the user reports symptoms of routing collisions:
- "The agent keeps triggering the wrong topic"
- "It works sometimes but picks the wrong tool other times"
- "Some queries are fast but others take much longer" (the orchestrator is deliberating)
- "The agent answers from instructions instead of calling the tool"

Do NOT run:
- After every individual edit (too expensive)
- After non-routing changes (instructions tone, conversation starters, auth, knowledge, variables)
- After validation-only runs

When other skills finish a routing-relevant change, they should **suggest** this skill only if the user is about to push:
> "The new topic has been created. When you're ready to push, consider running a disambiguation check first."

## Instructions

### 1. Auto-discover the agent directory

```
Glob: **/agent.mcs.yml
```
Use the top-level agent (not one inside `agents/`). NEVER hardcode an agent name.

### 2. Run disambiguation per scope

Disambiguation runs **separately** for each scope — the parent agent and each child agent are independent orchestration scopes with their own routing decisions. A child agent's internal topics and tools don't compete with the parent's topics and tools — they only compete with each other within that child's scope.

**Scope layout:**
```
Parent scope:
  - Parent topics (topics/*.mcs.yml)
  - Parent actions (actions/*.mcs.yml)
  - Child agents as surfaces (agents/*/agent.mcs.yml — only their name + beginDialog.description)

Child agent scope (repeat for each child agent):
  - Child's own topics (agents/<child>/topics/*.mcs.yml)
  - Child's own actions (agents/<child>/actions/*.mcs.yml)
  - Child's own sub-agents if any (agents/<child>/agents/*)
```

Cross-scope checks (parent description vs. child description) happen at the **parent scope level** — the child agent's `beginDialog.description` is one of the parent's routable surfaces.

Run steps 3–6 once for the parent scope, then once for each child agent scope that has its own topics or actions.

### 3. Collect all routable surfaces (per scope)

For the scope being checked, read every file that contributes to routing. **Only include active surfaces** — skip any topic or action that:
- Has no `modelDescription` (the orchestrator can't route to it generatively)
- Is a system topic: `ConversationStart`, `Escalate`, `OnError`, `EndofConversation`, `Fallback`, `MultipleTopicsMatched`, `ResetConversation`, `Goodbye`, `ThankYou`, `StartOver`, `Signin`, `Search`

**A. Agent instructions** — read `agent.mcs.yml` → `instructions` for the current scope. Extract any lines that describe specific tool capabilities or topic domains (e.g., "When the user wants to open a ticket, collect X and Y"). These don't participate in routing comparison, but they can interfere with routing by causing the orchestrator to follow the instruction instead of selecting a tool/topic. Collect these for the instruction interference check (Check 2).

**B. Topics** — read all topic files in the current scope:
```
Glob: <scope-dir>/topics/*.topic.mcs.yml
```
For each topic, extract:
- Filename (the orchestrator sees this as the topic name)
- `modelDescription` (if present — **skip topics without one**)
- `inputs` → each `propertyName` + `description`
- `outputType` → each property name + `description`

**C. Actions/Tools** — read all action files in the current scope:
```
Glob: <scope-dir>/actions/*.mcs.yml
```
For each action, extract:
- Filename and `operationId`
- `modelDescription` (**skip actions without one**)
- `inputs` → each `propertyName` + `description`

**D. Child agents (parent scope only)** — read:
```
Glob: <scope-dir>/agents/*/agent.mcs.yml
```
For each child agent, extract:
- Directory name and `displayName`
- `beginDialog.description`
- `inputType` → each property name + `description`
- `outputType` → each property name + `description`

### 4. Build the full AI definition for each surface

For each active surface in the current scope, build a summary:

```
Surface: <filename or directory name>
Type: Topic | Action/Tool | Child Agent
Name: <display name or filename stem>
Description: <modelDescription or beginDialog.description>
Inputs: <list of propertyName + description>
Outputs: <list of output property names>
```

Separately, list any lines from top-level instructions that describe specific tool/topic capabilities — these are checked for instruction interference (Check 2).

### 5. Check for collisions (within the current scope)

For each pair of surfaces, compare their **full AI definitions** — not just one dimension. A collision exists when the orchestrator could plausibly confuse two surfaces given a realistic user query. Think about what the user might say and which surface would match.

#### Check 1: Combined definition collisions (HIGH severity)
This is the primary check. Two surfaces collide when their **combined** name + description + outputs would match the same user query.

- For each pair, ask: "Is there a realistic user query that both surfaces could plausibly handle?"
- Consider the name, description, AND output fields together
- A pair with different names but overlapping descriptions and shared output fields is a collision
- A pair with similar names but clearly different descriptions and distinct outputs is NOT a collision

**Example — collision (shared output makes it ambiguous):**
```
Surface A: GetEmployeeInfo
  Description: Retrieves employee profile — name, department, role
  Outputs: employeeId, name, department

Surface B: GetEmployeeStatus
  Description: Checks employee work status — active/on-leave/terminated
  Outputs: employeeId, status, lastCheckIn
```
The names `GetEmployeeInfo` / `GetEmployeeStatus` are fine on their own — they describe different things. The collision is that **both output `employeeId`**. When the user asks "What's the employee ID?", the orchestrator sees two surfaces that can both produce it. It has to reason about which one the user intended, adding latency.

**Fix:** Decide which surface owns `employeeId`. The other should either not output it, or its description should say "for employee ID, use [other topic]."

**Example — NOT a collision (names similar but definitions distinct):**
```
Surface A: SearchProducts
  Description: Full-text search of the product catalog by keyword
  Outputs: productList

Surface B: FilterProducts
  Description: Filters products by category, price range, or rating
  Outputs: filteredProducts
```
Different descriptions, different outputs, different use cases. The names share "Products" but the full definitions are clearly distinct.

#### Check 2: Instruction interference (HIGH severity)
Top-level instructions are always in the orchestrator's context — they influence routing alongside descriptions. When instructions describe step-by-step behavior that a tool or topic already handles, the orchestrator has competing information: the instruction tells it how to do the work, and the tool/topic also claims that capability. This can lead to the orchestrator following the instruction instead of calling the tool, or calling the tool redundantly.

- For each tool and topic, check if the agent's `instructions` contain lines that describe the same capability with actionable detail (e.g., step-by-step handling, data collection, decision logic)
- Flag when instructions tell the agent *how* to handle a domain that a tool or topic is designed for — not just that the tool exists
- Instructions that merely point to a tool ("Use the CreateTicket tool for support tickets") are fine and helpful. Instructions that describe the full behavior ("When the user has an IT problem, collect the description and priority, then create a ticket") compete with the tool's own definition.
- Instructions that augment execution ("When the CreateTicket tool returns a high-priority ticket, suggest escalation contacts") add value without interference.

**Example — interference:**
```
Instructions: "When the user wants to open a support ticket, collect the issue description and priority, then create the ticket."
Tool: CreateTicket
  Description: Creates a support ticket with issue description and priority level.
```
The orchestrator sees competing information: the instructions describe the full behavior, and the tool also claims ticket creation. The orchestrator may follow the instruction without calling the tool, or call it redundantly.

**Example — good pointer (no interference):**
```
Instructions: "Use the CreateTicket tool when the user needs to open a support ticket."
```
The instruction points to the tool without re-describing what it does.

**Example — good augmentation (no interference):**
```
Instructions: "When the CreateTicket tool returns a high-priority ticket, suggest escalation contacts."
```
The instruction adds post-execution behavior that the tool's definition can't provide.

**Fix — choose one of these approaches based on agent complexity:**

| Agent complexity | Fix |
|-----------------|-----|
| **Simple agent** (few topics, straightforward flows) | Keep the instruction at top level if it's the only way this behavior is defined. Remove the tool if it just duplicates the instruction. Or keep the tool and simplify the instruction to just point to it: "Use [tool] for [domain]." |
| **Moderate agent** (multiple tools and topics) | Move the behavioral detail into the tool's `modelDescription` so it lives with the tool definition. Simplify the top-level instruction to a pointer: "Use [tool] for [domain]." |
| **Complex agent** (many topics, child agents, overlapping domains) | Move both the behavioral instruction AND the tool into a **child agent**. The child agent owns the entire domain — its `beginDialog.description` tells the parent when to delegate, and its `settings.instructions` contain the behavioral guidance. Remove the detailed instruction from the parent. |

#### Check 3: Cross-scope collisions — parent ↔ child agent (HIGH severity)
- For each child agent's `beginDialog.description`, check if any parent-level topic `modelDescription` covers the same domain
- For each child agent, check if the parent's `instructions` describe capabilities that the child agent is supposed to own
- Flag any domain that is partially handled by both parent and child

**Fix:** Delegate cleanly — either the parent owns the domain entirely or the child does. If the split is necessary, state the exact boundary in both descriptions.

#### Check 4: Output schema collisions (MEDIUM severity)
- Compare output property names across all topics and child agents
- Flag any property name that appears in more than one surface's outputs
- This check only matters when combined with description overlap — if two surfaces produce the same field name but have clearly different descriptions and use cases, it may be acceptable

**Fix:** Decide which surface owns the shared field. State ownership in descriptions.

#### Check 5: Tool ↔ Topic collisions (MEDIUM severity)
- For each action `modelDescription`, check if any topic `modelDescription` covers the same domain
- Flag if a topic describes doing something that a tool already does

**Fix:** Remove the topic and let generative actions call the tool directly, or have the topic explicitly reference the tool ("Uses the [tool] to..."). Do not have both a topic and a tool claiming the same capability independently.

### 6. Report findings

Present results grouped by scope:

```
## Disambiguation Report: <agent-name>

### Scope: Parent Agent

Active surfaces: X topics, Y actions, Z child agents

#### 🔴 HIGH — Combined Definition Collisions
| Surface A | Surface B | Why it collides | User query that triggers both |
|-----------|-----------|----------------|------------------------------|
| GetEmployeeInfo | GetEmployeeStatus | Both output `employeeId` | "What's the employee ID?" |

Suggested fix: Remove `employeeId` from GetEmployeeStatus outputs. Add to its description: "For employee ID, use Employee Profile."

#### 🔴 HIGH — Instruction Interference
| Instruction line | Tool/Topic | Problem |
|-----------------|------------|----------|
| "When the user wants to open a ticket, collect..." | Tool: CreateTicket | Instruction describes full behavior, may bypass tool |

Suggested fix: Simplify instruction to "Use CreateTicket tool when user needs to open a support ticket." (see fix table above for complex agents)

#### 🔴 HIGH — Cross-Scope Collisions
(none found)

#### 🟡 MEDIUM — Output Schema Collisions
(none found)

#### 🟡 MEDIUM — Tool ↔ Topic Collisions
(none found)

---

### Scope: Child Agent — <child-agent-name>

Active surfaces: X topics, Y actions

(repeat checks 1, 2, 4, 5 within this scope — check 3 is parent-only)

---

### Summary
- Scopes checked: 1 parent + N child agents
- Total active surfaces: X
- HIGH issues: N
- MEDIUM issues: N
- No issues: ✅ (if clean across all scopes)
```

### 7. Offer fixes

For each HIGH issue, propose a specific edit (renamed file, rewritten description, added scope boundary, moved instruction). Ask the user if they want to apply the fixes.

For instruction ↔ tool collisions, recommend one of the three approaches (keep at top level / move to tool description / move to child agent) based on agent complexity. Explain the trade-off.

For MEDIUM issues, explain the risk and let the user decide.

If no collisions found, confirm the agent is clean and proceed with push.

## Collision Types Reference

### 1. Combined definition collisions
The orchestrator evaluates name + description + inputs/outputs **together**. A collision happens when the combined picture of two surfaces matches the same user query.

**Bad — shared output field creates ambiguity:**
```yaml
# Topic A: GetEmployeeInfo
modelDescription: Retrieves employee profile — name, department, role.
# outputs: employeeId, name, department

# Topic B: GetEmployeeStatus
modelDescription: Checks employee work status — active/on-leave/terminated.
# outputs: employeeId, status, lastCheckIn
```

**Sample questions that trigger both:**
- "What's the employee ID for John Smith?" — both surfaces output `employeeId`
- "Look up employee 12345" — both accept an employee identifier as implicit input
- "Get me employee details" — vague enough to match either name

**Suggested fix (approve or modify):**
> Remove `employeeId` from GetEmployeeStatus outputs. Change its description to:
> `modelDescription: Checks an employee's current work status — active/on-leave/terminated, last check-in date, and attendance record. For employee ID lookup, use GetEmployeeInfo.`

**Not a collision — names share a word but definitions are distinct:**
```yaml
# Topic A: SearchProducts — full-text keyword search, outputs productList
# Topic B: FilterProducts — filter by category/price/rating, outputs filteredProducts
```
"Search for running shoes" clearly matches A. "Show me shoes under $50" clearly matches B. No shared outputs, distinct verbs.

### 2. Instruction interference
Top-level instructions describe a capability with enough detail that the orchestrator follows the instruction instead of routing to the tool. This is not a routing collision — instructions don't participate in the description-vs-description comparison. It's the orchestrator short-circuiting routing because the system prompt already tells it what to do.

**Bad — instruction describes the full behavior:**
```
Instructions: "When the user wants to open a support ticket, collect the issue description and priority, then create the ticket."
Tool: CreateTicket — modelDescription: "Creates a support ticket with issue description and priority level."
```

**Sample questions where interference occurs:**
- "I need to open a ticket" — orchestrator follows the instruction step-by-step instead of calling the tool
- "Create a support ticket for my broken laptop" — orchestrator may attempt to "collect the issue description" from instructions rather than passing it to the tool
- "File a bug report, high priority" — orchestrator has enough detail in the instruction to act without the tool

**Fine — instruction just points to the tool:**
```
Instructions: "Use the CreateTicket tool when the user needs to open a support ticket."
```

**Suggested fix (approve or modify):**

For a **simple agent:**
> Replace the instruction line with:
> `"Use the CreateTicket tool when the user needs to open a support ticket."`

For a **moderate agent:**
> Move the behavioral detail into the tool's `modelDescription`:
> `modelDescription: Creates a support ticket. Collect the issue description and priority level (Low, Medium, High) from the user. Required fields: issue description, priority.`
> Simplify the instruction to: `"Use CreateTicket for support ticket requests."`

For a **complex agent:**
> Create a child agent `agents/TicketSupport/agent.mcs.yml` with:
> `beginDialog.description: "Handles support ticket creation — collects issue details, sets priority, and creates the ticket."`
> Move the behavioral instruction into the child agent's `settings.instructions`.
> Remove the instruction and direct tool reference from the parent.

### 3. Cross-scope collisions (parent ↔ child agent)

**Bad:**
```yaml
# Parent topic
modelDescription: Answers questions about company benefits.

# Child agent
beginDialog:
  description: Handles employee benefits inquiries.
```

**Sample questions that trigger both:**
- "What are my health insurance options?" — both claim the benefits domain
- "Tell me about the dental plan" — parent topic and child agent both match
- "How do I enroll in benefits?" — could route to either

**Suggested fix (approve or modify):**

Option A — delegate entirely to child:
> Delete the parent topic. The child agent's `beginDialog.description` is sufficient:
> `"Handles all employee benefits inquiries — health insurance, dental, vision, 401k, enrollment, and claims."`

Option B — split with explicit boundaries:
> Parent topic: `modelDescription: Provides a high-level overview of available benefit plans. Does NOT handle enrollment, claims, or plan-specific details — route those to the Benefits Agent.`
> Child agent: `beginDialog.description: Handles benefits enrollment, claims processing, and plan-specific questions. For a general overview of available plans, the parent handles that.`

### 4. Description overlaps (without shared outputs)
Two surfaces with different names and no shared outputs, but descriptions that cover the same ground. Lower risk than combined collisions but still adds orchestrator deliberation time.

**Bad:**
```yaml
# Topic A
modelDescription: Retrieves employee information including department and role.

# Topic B
modelDescription: Gets employee details such as team and current status.
```

**Sample questions that trigger both:**
- "Tell me about this employee" — matches both "employee information" and "employee details"
- "What department is Sarah in?" — could match either "department and role" or "team and current status"
- "Employee info for ID 4567" — matches either name pattern

**Suggested fix (approve or modify):**
> Topic A: `modelDescription: Looks up an employee's HR profile — name, department, role, hire date, and office location. Does NOT return attendance or status.`
> Topic B: `modelDescription: Checks an employee's current work status — active/on-leave/terminated, last check-in date, and attendance record. Does NOT return HR profile data.`

### 5. Tool ↔ Topic collisions

**Bad:**
```yaml
# Tool action
modelDescription: Retrieves exchange rate data.

# Topic
modelDescription: Provides exchange rate information.
```

**Sample questions that trigger both:**
- "What's the EUR/USD rate?" — both claim exchange rate data
- "Show me today's exchange rates" — tool can fetch it, topic says it provides it
- "Convert euros to dollars" — either surface could handle this

**Suggested fix (approve or modify):**

Option A — remove the topic, let generative actions call the tool directly:
> Delete the topic. The tool's `modelDescription` is sufficient for the orchestrator to call it when the user asks about exchange rates.

Option B — keep the topic but make it reference the tool:
> Topic: `modelDescription: Uses the ECB Rates tool to retrieve exchange rate data and presents it with analysis and historical context. Does NOT fetch data itself — delegates to the ECB tool.`

## How This Interacts with Other Design Decisions

- **Disambiguation quality and model choice are trade-offs** — see the Model Selection tip. Clean disambiguation lets you use a faster/cheaper model. If you can't fully disambiguate, a stronger model compensates at the cost of latency.
- **NL→Query glossaries in `modelDescription`** increase the text the orchestrator reads per surface. If two tools have large glossaries with overlapping terms, disambiguation is harder. Keep glossaries scoped to each tool's unique domain.
- **Instructions are always in context.** They inform routing, planning, and output generation on every turn. Instructions that describe step-by-step behavior compete with tool and topic definitions. Instructions that point to tools ("Use [tool] for [domain]") or augment execution ("When the tool returns X, do Y") add value without interference.

## Quick Scan (for other skills to use inline)

When another skill needs a lightweight collision check after a single change (not a full scan), use this abbreviated approach:

1. Read the `modelDescription` or `beginDialog.description` of the **newly created/edited** surface
2. Read the `modelDescription` / `beginDialog.description` of all **other active surfaces** (topics + actions + child agents)
3. Check if the new description shares 3+ significant content words with any existing description
4. If overlap found → warn the user and suggest running the full disambiguation skill
5. If clean → proceed without interruption

This avoids the cost of a full scan while still catching obvious collisions at the point of change.
