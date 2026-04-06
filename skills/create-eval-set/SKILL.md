---
user-invocable: false
description: >
  Create a test set CSV file for import into Copilot Studio's in-product Evaluate tab.
  Reads the agent's topics, instructions, and knowledge sources to generate meaningful
  test cases with appropriate graders (General quality, Compare meaning, Exact match, etc.).
  Use when the user asks to create, prepare, or generate evaluation test cases for their agent.
allowed-tools: Read, Glob, Grep, Write
context: fork
agent: copilot-studio-test
---

# Create Evaluation Test Set

Create a test set CSV file that can be imported into Copilot Studio's **Evaluate** tab for in-product agent evaluation.

## Phase 1: Understand the Agent

Read the agent's YAML files to understand what it does:

1. `Glob: **/agent.mcs.yml` — find the agent
2. Read `agent.mcs.yml` — get the agent's instructions, description, and capabilities
3. Read `settings.mcs.yml` — check orchestration mode (generative vs classic)
4. `Glob: **/topics/*.mcs.yml` — list all topics
5. Read key topics (especially non-system ones) — understand trigger phrases, conversation flows, expected behaviors
6. Check for knowledge sources, actions, and connected tools

## Phase 2: Design Test Cases

Create test cases that cover:

| Category | What to test | Example |
|----------|-------------|---------|
| **Core functionality** | Main topics and capabilities | Questions matching trigger phrases |
| **Knowledge/generative** | Knowledge source responses | Questions the agent should answer from its knowledge |
| **System topics** | Greeting, Escalation, Goodbye, Thank You, Fallback | "Hi", "I want to speak to a person", "Goodbye" |
| **Edge cases** | Out-of-scope, ambiguous, off-topic | "Tell me a joke", "Book a flight for me" |
| **Boundary testing** | Things the agent should NOT do | Actions beyond its capabilities |

Aim for 10–25 test cases with good coverage across categories.

## Phase 3: Choose Test Methods

Select the appropriate test method for each test case:

| Test method | CSV value | When to use | Requires expected response? |
|-------------|-----------|------------|---------------------------|
| **General quality** | `General quality` | Open-ended questions, generative/knowledge responses where wording varies | No (but recommended as a rubric) |
| **Compare meaning** | `Compare meaning` | System topics with predictable responses, where meaning should match but exact wording may differ | Yes |
| **Exact match** | `Exact match` | Short, precise answers: numbers, codes, fixed phrases | Yes |
| **Text similarity** | `Similarity` | Responses where both wording and meaning should be close | Yes |
| **Keyword match** | `Keyword match` | Responses that must contain specific terms or phrases (keywords configured in UI after import) | Yes (keywords in UI) |

**Guidelines:**
- Use **General quality** for generative/web-browsing responses — the expected response serves as a rubric, not an exact match target
- Use **Compare meaning** for system topics (greeting, escalation, goodbye, thank you, fallback) where the response meaning is predictable
- Use **Exact match** sparingly — only when the agent should return a specific fixed string
- **Capability use** and **Custom** graders cannot be set via CSV — configure them in the UI after import

## Phase 4: Write the CSV

Write the CSV file using the Write tool. The format must be:

```csv
"question","expectedResponse","Testing method"
"User question here","Expected agent response or behavioral rubric","General quality"
```

### Column specification

| Column | Required | Description |
|--------|----------|-------------|
| `question` | Yes | The user message to send to the agent. Max **1,000 characters**. |
| `expectedResponse` | No | The expected response. Required for Compare meaning, Similarity, Exact match. For General quality, use as a behavioral rubric (e.g., "The response should recommend hotels in Paris"). |
| `Testing method` | No | The grader. If omitted, defaults to `General quality`. |

### Rules
- Max **100 questions** per test set
- Max **1,000 characters** per question (including spaces)
- File must be `.csv` format
- You can mix different test methods in the same file
- Use double quotes around all values
- For General quality test cases, write expected responses as behavioral descriptions: "The response should [describe what a good answer looks like]"
- For Compare meaning test cases, write expected responses as realistic agent replies

### Expected response guidance

**For General quality** (behavioral rubric — evaluated by AI):
```csv
"Find me a hotel in Paris","The response should include hotel recommendations in Paris with relevant details like names, locations, or prices.","General quality"
```

**For Compare meaning** (semantic match — meaning must align):
```csv
"Hi there","Hello! How can I help you today?","Compare meaning"
```

**For Exact match** (character-for-character):
```csv
"What is 2+2?","4","Exact match"
```

## Phase 5: Instruct the User

After writing the CSV, tell the user:

> **To import into Copilot Studio:**
> 1. Open your agent in Copilot Studio
> 2. Go to the **Evaluate** tab
> 3. Click **New evaluation** > **Single response**
> 4. Drag or browse for the CSV file
> 5. Review the imported test cases and adjust if needed
> 6. Optionally add more test methods (Capability use, Custom) in the UI
> 7. Click **Evaluate** to run, or **Save** to run later

After import, some things can only be configured in the UI:
- Pass thresholds for Compare meaning and Text similarity
- Keywords for Keyword match test cases
- Expected capabilities for Capability use test cases
- Custom grader instructions and labels
