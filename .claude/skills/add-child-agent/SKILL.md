---
description: Add or configure a child agent (AgentDialog) for Copilot Studio. Use when the user asks to create a sub-agent, child agent, or specialist agent.
argument-hint: <child agent description>
allowed-tools: Bash(python *), Read, Write, Glob
---

# Add Child Agent

Create a new child agent (AgentDialog) that the parent agent's orchestrator can delegate to.

## Instructions

1. **Auto-discover the parent agent directory**:
   ```
   Glob: src/**/agent.mcs.yml
   ```
   Use the top-level agent (not one inside an `agents/` subdirectory). NEVER hardcode an agent name.

2. **Look up the AgentDialog schema**:
   ```bash
   python scripts/schema-lookup.py resolve AgentDialog
   python scripts/schema-lookup.py resolve OnToolSelected
   ```

3. **Determine from the user**:
   - Child agent name and display name
   - What the child agent specializes in (for the description and instructions)
   - What inputs the child agent needs (if any)
   - Whether it will need its own knowledge sources (handled in Phase 2 — see below)

4. **Create the child agent directory** (Phase 1 — plain agent only, NO knowledge):
   ```
   src/<parent-agent>/agents/<ChildAgentName>/
   └── agent.mcs.yml
   ```

5. **Generate `agent.mcs.yml`** following this pattern:

```yaml
# Name: <Child Agent Name>
kind: AgentDialog

beginDialog:
  kind: OnToolSelected
  id: main
  description: <When should the orchestrator route to this agent — be specific>

settings:
  instructions: <Detailed instructions for the child agent's behavior>

inputType:
  properties:
    AdditionalInput:
      displayName: Additional Input
      description: <Description of what additional context this agent needs>
      type: String

outputType: {}
```

6. **Key fields explained**:
   - `beginDialog.description` — This is what the parent orchestrator reads to decide when to route. Be specific and action-oriented (e.g., "This agent handles billing inquiries, refund requests, and payment issues").
   - `settings.instructions` — The child agent's system prompt. Define its personality, scope, and behavior guidelines.
   - `inputType` — for context the orchestrator should pass. The parent fills these automatically.

## Two-Phase Workflow (Important)

Child agents MUST be created in two phases:

**Phase 1 — Create the plain agent** (steps 1–6 above):
- Create ONLY `agent.mcs.yml` with configuration, instructions, inputs, and outputs.
- Do NOT create a `knowledge/` directory or any knowledge sources yet.
- Tell the user: "The child agent has been created. Please push these changes to your environment using the Copilot Studio VS Code Extension before we can add knowledge sources to it."

**Phase 2 — Add knowledge sources** (only after the user confirms they pushed):
- Once the user confirms the child agent has been pushed and exists in the environment, you can add knowledge sources to it using `/add-knowledge`.
- Create the `knowledge/` directory under the child agent and add knowledge source files there.

This constraint exists because knowledge sources reference the agent they belong to — the child agent must exist in the environment first.

## Example: Customer Support Child Agent

```yaml
# Name: Billing Support Agent
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

inputType:
  properties:
    CustomerQuery:
      displayName: Customer Query
      description: The customer's billing-related question or issue
      type: String

outputType: {}
```
