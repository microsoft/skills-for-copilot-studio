---
user-invocable: false
agent-types: modern
description: Edit an existing inline skill in a modern Copilot Studio agent. Modify the skill's markdown content, description, or name. Use when the user asks to change, update, or improve a skill.
argument-hint: <skill name or change description>
allowed-tools: Read, Edit, Glob, Grep
context: fork
agent: copilot-studio-author
---

# Edit an Existing Skill

## Pre-checks

1. Run `Glob: **/settings.mcs.yml` to find the agent workspace.
2. Confirm it's a modern agent (`template: cliagent-1.0.0` or `$kind: CLICopilotRecognizer`).

## Find the skill

Skills live in two locations:
- `topics/*.mcs.yml` — skills with `DialogComponent` registration (invocable by orchestrator)
- `translations/*.mcs.yml` — skills with `TranslationsComponent` only (content layer)

Search both:

```
Glob: **/topics/*.mcs.yml
Glob: **/translations/*.mcs.yml
```

Filter to `InlineAgentSkill` files (not `ConnectorTool` or other types):

```
Grep: kind: InlineAgentSkill
```

If the user specifies a skill name, match against `componentName` in `mcs.metadata`. If ambiguous, list all skills and ask which one.

## What can be edited

### Skill description (mcs.metadata)

The `description` in `mcs.metadata` is what the orchestrator uses to decide when to invoke the skill. This is the most impactful edit — improving it changes routing behavior.

```yaml
mcs.metadata:
  componentName: OrderLookup
  description: Looks up order status by order number. Use when the customer asks about shipping, delivery, tracking, or order status.
```

**Guidelines for good descriptions:**
- Be specific about WHEN to invoke (not just what it does)
- Include synonyms the user might use
- Mention what NOT to route here if there's confusion with other skills

### Skill name (componentName)

Can be changed, but the file name should also match: `Default_{componentName}.mcs.yml`

### Markdown content

The `content` field contains the skill's instructions as markdown with YAML frontmatter:

```yaml
content: |-
  ---
  name: OrderLookup
  description: Looks up order status
  ---
  # Order Lookup

  When the user asks about their order:
  1. Ask for the order number
  2. Use the Order API tool to look up status
  3. Tell the user the result
```

**When editing content:**
- Keep the YAML frontmatter (`---` block with `name` and `description`) in sync with `mcs.metadata`
- The frontmatter `description` should match `mcs.metadata.description`
- The frontmatter `name` should match `mcs.metadata.componentName`
- Use markdown formatting (headers, lists, bold) for clarity
- Reference tools by name if the skill should use them

## What NOT to edit

- **`kind:`** — must stay `InlineAgentSkill`
- **File location** — moving from `topics/` to `translations/` or vice versa changes the Dataverse registration type. Don't move files between directories.

## After editing

Tell the user to push with `/copilot-studio:manage-agent` to sync changes to the environment.
