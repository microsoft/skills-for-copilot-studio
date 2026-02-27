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
   - Whether it needs its own knowledge sources

4. **Create the child agent directory structure**:
   ```
   src/<parent-agent>/agents/<ChildAgentName>/
   ├── agent.mcs.yml
   ├── knowledge/          (if needed)
   └── actions/            (if needed)
   ```

5. **Generate `agent.mcs.yml`** following this pattern:

```yaml
# Name: <Child Agent Name>
kind: AgentDialog
inputs:
  - kind: AutomaticTaskInput
    propertyName: AdditionalInput
    description: <Description of what additional context this agent needs>

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
      description: <Same description as in inputs>
      type: String

outputType: {}
```

6. **Key fields explained**:
   - `beginDialog.description` — This is what the parent orchestrator reads to decide when to route. Be specific and action-oriented (e.g., "This agent handles billing inquiries, refund requests, and payment issues").
   - `settings.instructions` — The child agent's system prompt. Define its personality, scope, and behavior guidelines.
   - `inputs` — Use `AutomaticTaskInput` for context the orchestrator should pass. The parent fills these automatically.

7. **Optionally add knowledge sources** in the child's `knowledge/` directory using the same `KnowledgeSourceConfiguration` format.

## Example: Customer Support Child Agent

```yaml
# Name: Billing Support Agent
kind: AgentDialog
inputs:
  - kind: AutomaticTaskInput
    propertyName: CustomerQuery
    description: The customer's billing-related question or issue

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
