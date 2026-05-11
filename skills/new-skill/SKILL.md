---
user-invocable: false
agent-types: modern
description: Create a new inline skill for a modern Copilot Studio agent. Use when the user asks to add a skill, capability, or conversation behavior to their agent.
argument-hint: <skill-name>
allowed-tools: Read, Write, Glob
context: fork
agent: copilot-studio-author
---

# Create a new skill for a modern agent

## Pre-checks

1. Run `Glob: **/settings.mcs.yml` to find the agent workspace.
2. Read `settings.mcs.yml` and confirm it's a modern agent (look for `template: cliagent-1.0.0` or `$kind: CLICopilotRecognizer`).
3. If this is NOT a modern agent, STOP and tell the user this skill is for modern agents only.

## Gather requirements

Ask the user (if not already provided):
- **Skill name** — short, descriptive (e.g., "OrderLookup", "TravelBooking")
- **What should the skill do?** — the behavior, steps, and responses

## Generate the skill file

Create `topics/Default_{skillName}.mcs.yml` in the agent workspace directory (same level as `settings.mcs.yml`).

Use this exact structure:

```yaml
mcs.metadata:
  componentName: {SkillName}
  description: {one sentence — CRITICAL: the orchestrator uses this to decide when to invoke the skill}
kind: InlineAgentSkill
content: |-
  ---
  name: {SkillName}
  description: {same description as above}
  ---
  {markdown instructions for the skill}
```

### Template reference

Read the template at `${CLAUDE_SKILL_DIR}/../../templates/topics/cli-skill.mcs.yml` for the base structure.

## Key rules

### File location
- MUST be in the `topics/` directory — this creates a `DialogComponent` registration in Dataverse so the orchestrator can discover and invoke the skill.
- Files in `translations/` only create `TranslationsComponent` entries (content layer) — the skill will NOT be invocable.
- File naming convention: `Default_{camelCaseName}.mcs.yml`

### Description is critical
The `description` field (in both `mcs.metadata` and the markdown frontmatter) replaces trigger phrases from classic agents. The orchestrator reads it to decide which skill to route to. Be specific:
- BAD: "Handles orders" (too vague)
- GOOD: "Looks up order status by order number. Use when the customer asks about shipping, delivery, or order tracking."

### Markdown content
- Use headers, numbered steps, and clear instructions
- The content is what the LLM sees when the skill is invoked
- For multi-step flows, describe the conversation flow as numbered steps (ask X, then do Y, then respond with Z)
- Reference tools by name if the skill should use them: "Use the OrderAPI tool to look up the order"

### Frontmatter required
The markdown content MUST start with YAML frontmatter (`---` delimiters) containing `name` and `description`. Without this, the CPS UI rejects the skill upload.

### Discriminator
Use `kind:` (not `$kind:`) for skill files. Only `settings.mcs.yml` uses the `$kind:` discriminator.

## After creation

Tell the user:
1. The skill was created at `topics/Default_{name}.mcs.yml`
2. Push to the environment with `/copilot-studio:manage-agent` to register it
3. Test in the CPS Preview tab or via `/copilot-studio:chat-sdk`
