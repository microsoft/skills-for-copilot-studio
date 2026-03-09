---
user-invocable: false
description: Add a knowledge source (public website or SharePoint) to a Copilot Studio agent. Use when the user asks to add a knowledge source, documentation URL, website, or SharePoint site for the agent to search.
argument-hint: <url>
allowed-tools: Bash(node *schema-lookup.bundle.js *), Read, Write, Glob
context: fork
agent: author
---

# Add Knowledge Source

Add a knowledge source to the agent. Supports **Public Website**, **SharePoint**, and **Custom API** sources.

## Instructions

1. **Auto-discover the agent directory**:
   ```
   Glob: **/agent.mcs.yml
   ```
   NEVER hardcode an agent name.

2. **Parse the arguments** to extract:
   - URL
   - Name / description (optional)

3. **Determine the source type** from the user's request:
   - If the URL contains `sharepoint.com` → use `SharePointSearchSource` (but first normalize the URL — see below)
   - If the user wants to connect a **custom search API or database** → use `OnKnowledgeRequested` (see Custom API section below)
   - Otherwise → use `PublicSiteSearchSource`

4. **If SharePoint: normalize the URL** before using it. Copilot Studio requires a direct folder path like:
   `https://contoso.sharepoint.com/sites/MySite/Shared%20Documents/MyFolder`

   Users often paste URLs in other formats. Handle them as follows:

   | URL pattern | Example | Action |
   |---|---|---|
   | **Direct path** (`/sites/.../Shared%20Documents/...`) | `https://x.sharepoint.com/sites/Site/Shared%20Documents/Folder` | **Use as-is** — this is the correct format |
   | **AllItems.aspx with `?id=` param** (`...AllItems.aspx?id=...`) | `https://x.sharepoint.com/.../AllItems.aspx?id=%2Fsites%2FSite%2FShared%20Documents%2FFolder&viewid=...` | **Extract and decode** the `id` query parameter. URL-decode it to get the path (e.g. `/sites/Site/Shared%20Documents/Folder`), then prepend the origin (`https://x.sharepoint.com`) to build the direct path. Drop all query parameters (`?id=`, `&viewid=`, etc.) |
   | **Sharing link** (`/:f:/s/...` or `/:x:/s/...`) | `https://x.sharepoint.com/:f:/s/Site/EncodedToken?e=abc` | **Cannot convert** — these are opaque sharing tokens with no extractable folder path. Ask the user: *"That's a SharePoint sharing link — I can't extract the folder path from it. Could you navigate to the folder in SharePoint, copy the URL from the browser address bar, and paste it here?"* |

   **Encoding rule:** Spaces in the final URL must be encoded as `%20` (e.g. `Shared%20Documents`, not `Shared Documents`).

5. **Look up the knowledge source schema**:
   ```bash
   node ${CLAUDE_SKILL_DIR}/../../scripts/schema-lookup.bundle.js resolve KnowledgeSourceConfiguration
   ```

6. **Generate the knowledge source YAML**.

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

7. **Always include `# Name:` and a description comment** at the top. These are important for identifying the knowledge source.

8. **Save** to the agent's `knowledge/<descriptive-name>.knowledge.mcs.yml` directory

## Custom API via OnKnowledgeRequested (YAML-only)

When the user wants to connect a **proprietary search API or database** not natively supported by Copilot Studio, use the `OnKnowledgeRequested` trigger. This is a **YAML-only capability with no UI designer** — it intercepts knowledge search requests and lets you call a custom API to populate results.

**How it works:**
1. Create a topic with `OnKnowledgeRequested` trigger
2. Use `System.SearchQuery` (the AI-rewritten query) as input to your API call
3. Transform API results into the required schema: `Content`, `ContentLocation`, `Title`
4. Set `System.SearchResults` with the transformed results

**Use the template:** `${CLAUDE_SKILL_DIR}/../../templates/topics/custom-knowledge-source.topic.mcs.yml`

**Prerequisites:** The user needs a connector action (in `actions/`) that calls their search API. If they don't have one yet, they should create it through the Copilot Studio UI or VS Code extension first.

## Dynamic Knowledge URLs with Global Variables

Knowledge source URLs support `{VariableName}` placeholders — typically global variables — for dynamic routing based on user context. This is powerful for scenarios where different users need different knowledge sources (e.g., geolocation-specific SharePoint folders, region-specific documentation).

**Pattern**: Define a global variable (via `/copilot-studio:add-global-variable`), populate it early in the conversation (e.g., in an OnActivity/conversation-init topic based on user profile or geolocation), then reference it in the knowledge source URL with Power Fx string interpolation.

**SharePoint example** — a workforce agent that routes to different SharePoint folders per region:
```yaml
# Name: Regional HR KB
# This knowledge source provides HR information from the {Global.UserKBURL} SharePoint.
kind: KnowledgeSourceConfiguration
source:
  kind: SharePointSearchSource
  site: =$"{Global.UserKBURL}"
```

**Public website example** — documentation site with region-specific subpaths:
```yaml
# Name: Regional Docs
# Documentation for the user's region at {Global.Region}.
kind: KnowledgeSourceConfiguration
source:
  kind: PublicSiteSearchSource
  site: =$"https://docs.example.com/{Global.Region}/api"
```

**CRITICAL: URL format for the global variable value**. The variable must contain a **direct, clean URL** — not a SharePoint UI URL with query parameters. Copilot Studio cannot resolve AllItems.aspx links.

| Correct (set this in the global variable) | Wrong (will not work) |
|---|---|
| `https://contoso.sharepoint.com/sites/MySite/Shared Documents/MyFolder` | `https://contoso.sharepoint.com/.../AllItems.aspx?id=%2Fsites%2F...&viewid=...` |

Note: spaces are OK in the variable value (unlike static `site:` values which need `%20`), because the Power Fx `$"{Global.UserKBURL}"` expression handles encoding at runtime.

**Implementation checklist** when the user asks for dynamic knowledge:
1. Create the global variable with `/copilot-studio:add-global-variable` (e.g., `UserKBURL`, `Region`)
2. Ensure a topic populates it early in the conversation (e.g., via user profile lookup, geolocation, or asking the user)
3. Create the knowledge source with `=$"{Global.VariableName}"` syntax in the `site:` field
4. Remind the user: the variable must be set **before** any topic that triggers knowledge search, otherwise the URL will be blank

## Knowledge Architecture & Best Practices

For detailed guidance on how knowledge retrieval works, source selection, content quality, security, maintenance, and advanced patterns like `triggerCondition`, see [knowledge-guide.md](knowledge-guide.md).

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
