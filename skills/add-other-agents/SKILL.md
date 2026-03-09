---
user-invocable: false
description: Add child agents, connected agents, or other multi-agent patterns to a Copilot Studio agent. Use when the user asks to create a sub-agent, child agent, connected agent, or call another agent.
argument-hint: <agent description>
allowed-tools: Bash(node *schema-lookup.bundle.js *), Read, Write, Glob
context: fork
agent: author
---

# Add Other Agents

Add multi-agent capabilities to a Copilot Studio agent. Two patterns are supported:

| Pattern | Use when | What it creates |
|---------|----------|----------------|
| **Child agent** | The agent needs a specialist sub-agent owned by the same parent | `AgentDialog` in `agents/` subdirectory |
| **Connected agent** | The agent needs to call an external, independently-managed agent | `InvokeConnectedAgentTaskAction` in a topic (TaskDialog) |

Ask the user which pattern they need if unclear.

---

## Pattern 1: Child Agent

Create a new child agent (AgentDialog) that the parent agent's orchestrator can delegate to.

### Instructions

1. **Auto-discover the parent agent directory**:
   ```
   Glob: **/agent.mcs.yml
   ```
   Use the top-level agent (not one inside an `agents/` subdirectory). NEVER hardcode an agent name.

2. **Look up the AgentDialog schema**:
   ```bash
   node ${CLAUDE_SKILL_DIR}/../../scripts/schema-lookup.bundle.js resolve AgentDialog
   node ${CLAUDE_SKILL_DIR}/../../scripts/schema-lookup.bundle.js resolve OnToolSelected
   ```

3. **Determine from the user**:
   - Child agent name and display name
   - What the child agent specializes in (for the description and instructions)
   - What inputs the child agent needs (if any)
   - Whether it will need its own knowledge sources (handled in Phase 2 — see below)

4. **Create the child agent directory** (Phase 1 — plain agent only, NO knowledge):
   ```
   <parent-agent>/agents/<ChildAgentName>/
   └── agent.mcs.yml
   ```

5. **Generate `agent.mcs.yml`** using `${CLAUDE_SKILL_DIR}/../../templates/agents/child-agent.mcs.yml` as the starting template. Read the template, then customize all placeholder values (`<...>`) based on the user's requirements.

   Key structure:
   - `kind: AgentDialog` — marks this as a child agent
   - `beginDialog.kind: OnToolSelected` with a `description` — tells the parent orchestrator when to route here
   - `settings.instructions` — the child agent's system prompt
   - `inputType` — context the orchestrator passes in
   - `outputType` — what the child agent returns (use `outputType: {}` if no structured output is needed)

   **CRITICAL: AgentDialog must NOT have `beginDialog.actions`.** Child agents use generative orchestration — all behavior is driven by `settings.instructions`. Do NOT add action nodes (Question, SendActivity, BeginDialog, ConditionGroup, etc.) to the actions array. If the user's scenario requires hardcoded action flows, it should be an AdaptiveDialog topic in the parent agent, not a child agent.

6. **Key fields explained**:
   - `beginDialog.description` — This is what the parent orchestrator reads to decide when to route. Be specific and action-oriented (e.g., "This agent handles billing inquiries, refund requests, and payment issues").
   - `settings.instructions` — The child agent's system prompt. Define its personality, scope, and behavior guidelines.
   - `inputType` — for context the orchestrator should pass. The parent fills these automatically.

### Two-Phase Workflow (Important)

Child agents MUST be created in two phases:

**Phase 1 — Create the plain agent** (steps 1-6 above):
- Create ONLY `agent.mcs.yml` with configuration, instructions, inputs, and outputs.
- Do NOT create a `knowledge/` directory or any knowledge sources yet.
- Tell the user: "The child agent has been created. Please push these changes to your environment using the Copilot Studio VS Code Extension before we can add knowledge sources to it."

**Phase 2 — Add knowledge sources** (only after the user confirms they pushed):
- Once the user confirms the child agent has been pushed and exists in the environment, you can add knowledge sources to it using `/add-knowledge`.
- Create the `knowledge/` directory under the child agent and add knowledge source files there.

This constraint exists because knowledge sources reference the agent they belong to — the child agent must exist in the environment first.

### Example: Customer Support Child Agent

```yaml
kind: AgentDialog

beginDialog:
  kind: OnToolSelected
  id: main
  description: This agent handles billing inquiries, payment issues, refund requests, and subscription management. Route here when users ask about charges, invoices, or account billing.

settings:
  instructions: |
    You are a billing support specialist. Help customers with:
    - Understanding their charges and invoices
    - Processing refund requests
    - Managing subscription plans
    - Resolving payment issues

    Always verify the customer's account before making changes.
    Escalate to a human agent for refunds over $500.

inputs:
  - kind: AutomaticTaskInput
    propertyName: CustomerQuery
    description: The customer's billing-related question or issue

inputType:
  properties:
    CustomerQuery:
      displayName: Customer Query
      description: The customer's billing-related question or issue
      type: String

outputType: {}
```

---

## Pattern 2: Connected Agent

Call an external, independently-managed agent from your agent. This creates a `TaskDialog` with an `InvokeConnectedAgentTaskAction` that the orchestrator can invoke.

### What you can do (calling side)

The plugin creates the **calling side** YAML — a TaskDialog in your agent that invokes the connected agent with inputs/outputs.

### What the user must do (called side)

The connected agent must be configured separately (in Copilot Studio UI or in its own project). Tell the user they need to set up the following on the connected agent:

1. **Create an `OnRedirect` topic** — this is the entry point when the agent is called by another agent
2. **Create global variables** for each input the caller passes, with **"external source"** permissions enabled
3. **Declare `inputType: {}` and `outputType: {}`** on the OnRedirect topic to signal it participates in multi-agent scenarios

> **Important**: The connected agent must be published and accessible from the same environment or tenant. The `botSchemaName` (the connected agent's schema name) must be known — the user can find it in the connected agent's `settings.mcs.yml` or in Copilot Studio under Agent Details.

### Instructions

1. **Auto-discover the agent directory**:
   ```
   Glob: **/agent.mcs.yml
   ```

2. **Determine from the user**:
   - The connected agent's schema name (`botSchemaName`) — e.g., `cr123_expenseAgent`
   - What inputs to pass to the connected agent
   - A description of what the connected agent does (for the orchestrator)

3. **Create a TaskDialog** in the agent's `actions/` directory (or `topics/` if the user prefers):

### Example: Calling Side (your agent)

```yaml
kind: TaskDialog

modelDisplayName: Expense Report Processor
modelDescription: Use this agent to process expense reports by sending them to the expense processing agent

inputs:
  - kind: AutomaticTaskInput
    propertyName: expenseReportFileFullPath
    description: Full file path, including SharePoint site URL, of an expense report file.

action:
  kind: InvokeConnectedAgentTaskAction
  inputType:
    properties:
      expenseReportFileFullPath:
        displayName: expenseReportFileFullPath
        isRequired: true
        type: String
  botSchemaName: cr123_expenseAgent
  historyType:
    kind: ConversationHistory
```

### Example: Called Side (what the user must configure on the connected agent)

Share this with the user as guidance for what they need to set up on the connected agent:

```yaml
# OnRedirect topic on the connected agent
kind: AdaptiveDialog
modelDescription: Initializes the agent when called by another agent

beginDialog:
  kind: OnRedirect
  id: main
  actions:
    - kind: SetVariable
      id: setVariable_abc123
      variable: Global.expenseReportFileFullPath
      value: "=System.Activity.Value.expenseReportFileFullPath"

inputType: {}
outputType: {}
```

The connected agent also needs:
- A **global variable** `Global.expenseReportFileFullPath` (type: String)
- The variable must have **"Receive values from other agents"** enabled in Copilot Studio (this is the "external source" permission)
