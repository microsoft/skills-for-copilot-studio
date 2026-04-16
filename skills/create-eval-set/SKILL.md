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

## Phase 3: Write the Expected Responses

The CSV import only supports two columns: `question` and `expectedResponse`. **Test methods cannot be set via CSV import** — they are configured in the UI after import. The default test method (General quality) is applied to all imported test cases.

Write expected responses with this in mind:
- For questions where you want **General quality** grading: write behavioral descriptions ("The response should recommend hotels in Paris with relevant details")
- For questions where you'll later switch to **Compare meaning** or **Exact match** in the UI: write realistic agent replies that the grader can compare against
- Leave `expectedResponse` empty for questions that only need General quality (it works without expected responses)

### Available test methods (configured in UI after import)

| Test method | What it measures | Requires expected response? |
|-------------|-----------------|---------------------------|
| **General quality** (default) | AI-graded quality: relevance, completeness, groundedness, abstention | No (but recommended as a rubric) |
| **Compare meaning** | Semantic similarity — compares meaning/intent | Yes |
| **Text similarity** | Cosine similarity of text | Yes, configurable pass threshold |
| **Exact match** | Character-for-character match | Yes |
| **Keyword match** | Response contains expected keywords/phrases | Yes (keywords added in UI) |
| **Capability use** | Agent called expected tools/topics | Configured in UI |
| **Custom** | Custom grader with your own instructions and labels | Configured in UI |

## Phase 4: Write the CSV

Write the CSV file using the Write tool. The format must be:

```csv
"question","expectedResponse"
"User question here","Expected agent response or behavioral rubric"
"Question without expected response",
```

### Column specification

| Column | Required | Description |
|--------|----------|-------------|
| `question` | Yes | The user message to send to the agent. Max **1,000 characters**. |
| `expectedResponse` | No | The expected response or behavioral rubric. Leave empty if not needed. |

**Important:** The `Testing method` column is **not supported on import** — it is ignored. All imported test cases get the default test method (General quality). Configure other test methods in the UI after import.

### Rules
- Max **100 questions** per test set
- Max **1,000 characters** per question (including spaces)
- File must be `.csv` format
- Use double quotes around all values
- For questions that will use General quality: write expected responses as behavioral descriptions
- For questions that will use Compare meaning or Exact match: write expected responses as realistic agent replies

### Expected response examples

**Behavioral rubric** (for General quality):
```csv
"Find me a hotel in Paris","The response should include hotel recommendations in Paris with relevant details like names, locations, or prices."
```

**Realistic reply** (for Compare meaning — set method in UI after import):
```csv
"Hi there","Hello! How can I help you today?"
```

**Exact expected text** (for Exact match — set method in UI after import):
```csv
"What is 2+2?","4"
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
