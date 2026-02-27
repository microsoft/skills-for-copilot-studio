---
description: Add a public website knowledge source to a Copilot Studio agent. Use when the user asks to add a knowledge source, documentation URL, or website for the agent to search.
argument-hint: <website-url>
allowed-tools: Bash(python *), Read, Write, Glob
---

# Add Knowledge Source

Add a public website knowledge source to the agent.

## Instructions

1. **Auto-discover the agent directory**:
   ```
   Glob: src/**/agent.mcs.yml
   ```
   NEVER hardcode an agent name.

2. **Parse the arguments** to extract:
   - Website URL
   - Description (optional)

3. **Look up the knowledge source schema**:
   ```bash
   python scripts/schema-lookup.py resolve KnowledgeSourceConfiguration
   python scripts/schema-lookup.py resolve PublicSiteSearchSource
   ```

4. **Generate the knowledge source YAML**:

   ```yaml
   # Name: <Description or domain name>
   kind: KnowledgeSourceConfiguration
   source:
     kind: PublicSiteSearchSource
     site: <URL>
   ```

5. **Save** to `src/<agent-name>/knowledge/<descriptive-name>.knowledge.mcs.yml`

## URL Guidelines

- URLs should be HTTPS
- Limit to 2 path segments (e.g., `https://contoso.com/docs/section`)
- Avoid query parameters
- Ensure the site is publicly accessible

## Limitations

**This skill can ONLY create Public Website knowledge sources.**

For other types, inform the user:

> "The following knowledge source types must be created through the Copilot Studio UI as they require Power Platform configuration:
> - Dataverse tables
> - Graph Connectors
> - File uploads
>
> Please create these in the portal, then export the solution to edit them here."
