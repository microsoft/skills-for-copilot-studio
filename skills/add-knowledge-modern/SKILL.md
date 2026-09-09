---
user-invocable: false
agent-types: modern
description: Add a knowledge source to a modern Copilot Studio agent. Supports public websites (YAML-authorable) and SharePoint/files/Dataverse (require UI setup). Use when the user asks to add a knowledge source, documentation URL, or website.
argument-hint: <url or description>
allowed-tools: Read, Write, Glob
context: fork
agent: copilot-studio-author
---

# Add Knowledge Source to a Modern Agent

## Pre-checks

1. Run `Glob: **/settings.mcs.yml` to find the agent workspace.
2. Read `settings.mcs.yml` and confirm it's a modern agent (`template: cliagent-1.0.0` or `$kind: CLICopilotRecognizer`).

## Knowledge Source Types

Modern agents support these knowledge sources:

| Type | YAML-authorable? | Kind |
|------|-------------------|------|
| **Public websites** | YES — create YAML directly | `WebsiteKnowledgeSource` |
| **SharePoint** | Partial — URL in YAML, auth at runtime | `SharePointKnowledgeSource` |
| **Uploaded files** | NO — upload via UI, reference by schema name | `FileKnowledgeSource` |
| **Dataverse** | NO — configure via UI | `DataverseStructuredSearchSource` |
| **Azure AI Search** | NOT AVAILABLE for modern agents | — |
| **Dynamics 365** | NOT AVAILABLE for modern agents | — |

If the user asks for Azure AI Search or Dynamics 365, explain these are not available for modern agents.

## Adding a Public Website (YAML-authorable)

This is the only type that can be fully created from YAML.

1. Get the URL from the user
2. Generate a file name: sanitize the URL into a valid filename (e.g., `https://www.example.com` → `httpswwwexamplecom`)
3. Add a short random suffix to avoid conflicts (e.g., `httpswwwexamplecom_a3Bf`)
4. Create the file in `knowledge/` directory

### File structure

`knowledge/{sanitized_url}_{suffix}.mcs.yml`:

```yaml
mcs.metadata:
  componentName: {display URL, e.g. https://www.example.com}
kind: KnowledgeSourceConfiguration
source:
  kind: WebsiteKnowledgeSource
  siteUrl: {full URL}
```

### Example

For `https://www.tomsguide.com`:

```yaml
mcs.metadata:
  componentName: https://www.tomsguide.com
kind: KnowledgeSourceConfiguration
source:
  kind: WebsiteKnowledgeSource
  siteUrl: https://www.tomsguide.com
```

### Key rules

- The top-level kind is `KnowledgeSourceConfiguration` (NOT `KnowledgeSourceComponent` — that's the Dataverse registration, created automatically by the push)
- Use `kind:` discriminator (not `$kind:`) for knowledge files
- The `componentName` is typically the URL itself
- No `description` field in `mcs.metadata` for knowledge sources (unlike skills/tools)
- File goes in `knowledge/` directory

## Adding SharePoint

SharePoint knowledge can be partially created via YAML (the URL), but the user's permissions are evaluated at runtime by the platform.

```yaml
mcs.metadata:
  componentName: {SharePoint site name}
kind: KnowledgeSourceConfiguration
source:
  kind: SharePointKnowledgeSource
  siteUrl: {SharePoint site URL}
```

**URL normalization:** SharePoint URLs should be the root site URL (e.g., `https://contoso.sharepoint.com/sites/hr`), not a specific page or document URL.

## Adding Files or Dataverse (UI required)

For file uploads or Dataverse knowledge, guide the user to the UI:

> File and Dataverse knowledge sources must be added through the Copilot Studio UI:
>
> 1. Open your agent in Copilot Studio
> 2. In the right panel, click **+** next to **Knowledge**
> 3. For files: drag and drop or click to upload
> 4. For Dataverse: select **Dataverse** and configure the search
>
> Once added, run `/copilot-studio:manage-agent` to **pull** the updated files locally.

## After creation

Tell the user to push with `/copilot-studio:manage-agent` to register the knowledge source in the environment. The orchestrator will automatically search it when answering user questions — no explicit wiring needed (unlike classic agents which may need `SearchAndSummarizeContent` nodes).
