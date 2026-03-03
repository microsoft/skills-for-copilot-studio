---
description: Add a knowledge source (public website or SharePoint) to a Copilot Studio agent. Use when the user asks to add a knowledge source, documentation URL, website, or SharePoint site for the agent to search.
argument-hint: <url>
allowed-tools: Bash(python scripts/schema-lookup.py *), Read, Write, Glob
---

# Add Knowledge Source

Add a knowledge source to the agent. Supports **Public Website**, **SharePoint**, and **Custom API** sources.

## Instructions

1. **Auto-discover the agent directory**:
   ```
   Glob: src/**/agent.mcs.yml
   ```
   NEVER hardcode an agent name.

2. **Parse the arguments** to extract:
   - URL
   - Name / description (optional)

3. **Determine the source type** from the user's request:
   - If the URL contains `sharepoint.com` → use `SharePointSearchSource`
   - If the user wants to connect a **custom search API or database** → use `OnKnowledgeRequested` (see Custom API section below)
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

## Custom API via OnKnowledgeRequested (YAML-only)

When the user wants to connect a **proprietary search API or database** not natively supported by Copilot Studio, use the `OnKnowledgeRequested` trigger. This is a **YAML-only capability with no UI designer** — it intercepts knowledge search requests and lets you call a custom API to populate results.

**How it works:**
1. Create a topic with `OnKnowledgeRequested` trigger
2. Use `System.SearchQuery` (the AI-rewritten query) as input to your API call
3. Transform API results into the required schema: `Content`, `ContentLocation`, `Title`
4. Set `System.SearchResults` with the transformed results

**Use the template:** `templates/topics/custom-knowledge-source.topic.mcs.yml`

**Prerequisites:** The user needs a connector action (in `actions/`) that calls their search API. If they don't have one yet, they should create it through the Copilot Studio UI or VS Code extension first.

## Dynamic Knowledge URLs

Knowledge source URLs support `{VariableName}` placeholders for dynamic routing based on user context:

```yaml
source:
  kind: PublicSiteSearchSource
  site: "https://docs.example.com/{Global.Region}/api"
```

Use global variables (via `/add-global-variable`) combined with Power Fx `LookUp()` to set region or context-based values, then reference them in knowledge source URLs. This enables a single knowledge source configuration to route to different content per user.

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
