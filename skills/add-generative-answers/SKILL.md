---
user-invocable: false
description: Add generative answer nodes (SearchAndSummarizeContent or AnswerQuestionWithAI) to a Copilot Studio topic. Use this instead of /add-node when the user asks to add grounded answers, knowledge search, generative answers, or AI-powered responses — these nodes require specific patterns (ConditionGroup follow-up, knowledge source references, autoSend, responseCaptureType) that /add-node does not cover.
argument-hint: <topic-name or "new">
allowed-tools: Bash(node *schema-lookup.bundle.js *), Read, Write, Edit, Glob
context: fork
agent: author
---

# Add Generative Answers

Add `SearchAndSummarizeContent` nodes to generate responses grounded in the agent's knowledge sources.

## Important: Do You Even Need a Topic?

When knowledge sources are added to the agent (via `/add-knowledge`), the AI can **directly search them without any topic** if it recognizes a QnA-style query. A dedicated topic with `SearchAndSummarizeContent` is useful when:
- You want to **restrict the search to a subset of knowledge sources** (not all of them)
- You want to **control the flow** around the answer (e.g., follow-up questions, formatting, adaptive cards)
- You want to **process the response** before showing it (e.g., extract content, combine with other data)
- You want to **use a specific input** other than the user's last message

If the user just wants the agent to answer questions from its knowledge, adding the knowledge source may be enough.

## Instructions

1. **Auto-discover the agent directory**:
   ```
   Glob: **/agent.mcs.yml
   ```
   NEVER hardcode an agent name.

2. **Determine the approach** based on what the user needs:
   - **Add to existing topic**: Read the target topic and insert a SearchAndSummarizeContent node
   - **Create new search topic**: Generate a complete topic with the search pattern

3. **Look up the schema**:
   ```bash
   node ${CLAUDE_SKILL_DIR}/../../scripts/schema-lookup.bundle.js resolve SearchAndSummarizeContent
   ```

4. **Read `settings.mcs.yml`** to check if `GenerativeActionsEnabled: true`. This determines the best pattern:
   - **`GenerativeActionsEnabled: true`** → prefer **Pattern 2 (Orchestrator)**: use topic inputs/outputs and let the orchestrator handle the response. This is the best approach for generative-orchestrated agents.
   - **`GenerativeActionsEnabled: false`** (or not set) → use **Pattern 1 (Direct Response)**: `autoSend: false` + manual SendActivity, or **Pattern 3 (Fallback Search)** for a simple all-knowledge fallback.
   - **Verbatim/exact content needed** → use **Pattern 4 (Precision Search)**: `SearchKnowledgeSources` + `CreateSearchQuery` for raw results without AI summarization (insurance policies, HR docs, legal text).

5. **Ask the user** to clarify the behavior (if not already clear from their request):
   - Should it search **all knowledge sources** or only **specific ones**?
   - Should **general model knowledge** also be used, or only the configured knowledge sources?
   - Should the response be **sent automatically** to chat, or **processed first** (e.g., custom formatting, adaptive card, combined with other data)?

6. **Generate unique IDs** for all nodes (format: `<nodeType>_<6-8 random alphanumeric>`).

7. **Build the YAML** using the appropriate pattern. For full YAML examples, see [patterns.md](patterns.md). For the complete property reference table, see [property-reference.md](property-reference.md).

## SearchAndSummarizeContent vs AnswerQuestionWithAI

| Node | Use When | Data Source | Output |
|------|----------|-------------|--------|
| `SearchAndSummarizeContent` | You want answers grounded in the agent's knowledge sources (websites, SharePoint, Dataverse) | Agent's configured knowledge | AI-summarized response |
| `SearchKnowledgeSources` | You need verbatim/exact content — insurance policies, legal text, HR docs — where AI summarization could lose details | Agent's configured knowledge | Raw search results (no AI summary) |
| `AnswerQuestionWithAI` | You want a response based only on conversation history and general model knowledge | No external data | AI-generated response |

**Use `SearchAndSummarizeContent`** for the vast majority of cases (what people call "generative answers"). Use `SearchKnowledgeSources` when you need raw, unsummarized results for precision scenarios (pair with `CreateSearchQuery` for better search accuracy). Use `AnswerQuestionWithAI` only when you explicitly want the model to respond without consulting knowledge sources.

## Knowledge Source References

When using `knowledgeSources` to restrict the search to specific sources:

1. The knowledge source **must already exist** in the agent (add it first with `/add-knowledge`)
2. Find the knowledge source filename in the agent's `knowledge/` directory
3. Reference it **without the `.mcs.yml` extension**

Example: if the file is `cre3c_agent.topic.MyDocs_abc123.mcs.yml`, the reference is:
```yaml
knowledgeSources:
  kind: SearchSpecificKnowledgeSources
  knowledgeSources:
    - cre3c_agent.topic.MyDocs_abc123
```
