---
sidebar_position: 1
title: Project Structure
---

# Project Structure

Overview of the repository layout and how the components fit together.

```
skills-for-copilot-studio/
  .claude-plugin/          Plugin manifest and marketplace config
  agents/                  Sub-agent definitions
    author.md              Author agent system prompt and skill bindings
    test.md                Test agent system prompt and skill bindings
    troubleshoot.md        Troubleshoot agent system prompt and skill bindings
  hooks/                   Session hooks
    hooks.json             Agent routing configuration
  skills/                  Skill definitions (entry points + internal skills)
    author                 Author orchestration skill
    new-topic              Create new topic
    add-node               Add/modify topic nodes
    add-action             Add connector actions
    edit-action            Edit existing actions
    add-knowledge          Add knowledge sources
    add-generative-answers Add SearchAndSummarize
    add-other-agents       Add child/connected agents
    add-global-variable    Add global variables
    edit-agent             Edit agent settings
    edit-triggers          Modify triggers
    add-adaptive-card      Add adaptive cards
    chat-with-agent        Point-test published agents
    run-tests              Batch test suites and eval analysis
    test                   Test orchestration skill
    troubleshoot           Troubleshoot orchestration skill
    validate               YAML schema validation
    lookup-schema          Schema definition lookup
    list-kinds             List valid kind values
    list-topics            List agent topics
    known-issues           Known issues database search
    best-practices         Best practices and glossary
    _project-context       Internal: project auto-discovery
    _reference             Internal: schema reference tables
  scripts/                 Bundled Node.js tools
    src/                   Source code for bundled scripts
    schema-lookup.bundle.js    Schema lookup tool
    chat-with-agent.bundle.js  Agent chat tool
    connector-lookup.bundle.js Connector lookup tool
    package.json
  reference/               Copilot Studio YAML schema files
    bot.schema.yaml-authoring.json   Main authoring schema
    adaptive-card.schema.json        Adaptive card schema
    connectors/                      Connector definitions
  templates/               YAML templates for common patterns
    topics/                Topic templates
    actions/               Action templates
    agents/                Agent templates
    knowledge/             Knowledge source templates
    variables/             Variable templates
  tests/                   Test runner for Copilot Studio Kit integration
    run-tests.js           Test execution script
    package.json
    settings-example.json  Example test settings
    agents-example.json    Example agent configuration
  docs/                    Documentation site (Docusaurus)
    src/                   Markdown documentation content
    site/                  Docusaurus site project
```

## Key Components

### Plugin Manifest (`.claude-plugin/`)

The `plugin.json` file defines the plugin metadata:

```json
{
  "name": "copilot-studio",
  "version": "1.0.0",
  "description": "Microsoft Copilot Studio YAML authoring toolkit."
}
```

### Agents (`agents/`)

Each agent is defined as a Markdown file with YAML frontmatter specifying the agent name, description, and skill bindings. The agent body contains the system prompt.

### Skills (`skills/`)

Each skill is a directory containing the skill definition. Skills are the atomic units of functionality -- they handle one specific task (create a topic, validate YAML, etc.).

### Scripts (`scripts/`)

Bundled Node.js scripts built with [esbuild](https://esbuild.github.io/). These provide runtime functionality like schema lookups and agent chat.

To rebuild:

```bash
cd scripts
npm install
npm run build
```

### Reference (`reference/`)

The Copilot Studio YAML authoring schema files. These are the source of truth for validation and schema lookups.

## Contributing

See [CONTRIBUTING.md](https://github.com/microsoft/skills-for-copilot-studio/blob/main/CONTRIBUTING.md) for development setup and contribution guidelines.
