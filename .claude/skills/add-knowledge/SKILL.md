---
description: Add a knowledge source (public website or SharePoint) to a Copilot Studio agent. Use when the user asks to add a knowledge source, documentation URL, website, or SharePoint site for the agent to search.
argument-hint: <url>
allowed-tools: Bash(python scripts/schema-lookup.py *), Read, Write, Glob
---

# Add Knowledge Source

Add a knowledge source to the agent. Supports **Public Website** and **SharePoint** sources.

## Instructions

1. **Auto-discover the agent directory**:
   ```
   Glob: src/**/agent.mcs.yml
   ```
   NEVER hardcode an agent name.

2. **Parse the arguments** to extract:
   - URL
   - Name / description (optional)

3. **Determine the source type** from the URL:
   - If the URL contains `sharepoint.com` → use `SharePointSearchSource`
   - Otherwise → use `PublicSiteSearchSource`

4. **Look up the knowledge source schema**:
   ```bash
   python scripts/schema-lookup.py resolve KnowledgeSourceConfiguration
   ```

5. **Generate the knowledge source YAML**.

   **Public Website:**
   ```yaml
   # Name: <Name>
   # <Description of what this knowledge source provides>
   kind: KnowledgeSourceConfiguration
   source:
     kind: PublicSiteSearchSource
     site: https://www.example.com
   ```

   **SharePoint:**
   ```yaml
   # Name: <Name>
   # <Description of what this knowledge source provides>
   kind: KnowledgeSourceConfiguration
   source:
     kind: SharePointSearchSource
     site: https://contoso.sharepoint.com/sites/MySite/Shared%20Documents/MyFolder
   ```

6. **Always include `# Name:` and a description comment** at the top. These are important for identifying the knowledge source.

7. **Save** to `src/<agent-name>/knowledge/<descriptive-name>.knowledge.mcs.yml`

## Limitations

**This skill can create Public Website and SharePoint knowledge sources.**

For other types, inform the user:

> "The following knowledge source types must be created through the Copilot Studio UI as they require Power Platform configuration:
> - Dataverse tables
> - Uploaded files
> - AI Search
> - SQL Server
>
> Please create these in the portal, then clone the solution to edit them here."
