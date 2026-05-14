# Writing Effective Agent Instructions

The `instructions` field in `agent.mcs.yml` is the system prompt. It is the most powerful lever for improving knowledge-based responses.

## Role of `instructions` in Knowledge Usage

The instructions field directly controls:
- **Grounding**: whether the agent sticks to knowledge sources or adds general model knowledge
- **Tone & format**: how answers are structured (bullet points, concise, formal, etc.)
- **Citation behavior**: whether the agent explicitly references sources
- **Fallback behavior**: what the agent says when no relevant information is found
- **Scope enforcement**: whether the agent stays on-topic or answers anything

## Keep Instructions Semantically Dense

Good instructions are not necessarily long instructions. Add a directive only when it changes runtime behavior.

Avoid:
- Restating generic assistant qualities
- Repeating the same rule in different words
- Adding broad tone or personality sections unless requested
- Expanding a short user request into a full policy document

Prefer:
- One clear role sentence
- A short scope statement
- Specific grounding, tool, or use-case rules only when needed
- A compact fallback or escalation rule if relevant
- Output formatting rules only when the user or scenario requires them

## Writing Knowledge-Aware Instructions

Use these directives in `instructions` to shape knowledge behavior:

**Inject the current date:**
```
Today's date is {Today()}. Use it when answering questions about deadlines, validity, upcoming events, or anything time-sensitive.
```
`Today()` is a Power Fx function that resolves at runtime — no topic or global variable needed. Use it directly in the `instructions` field. For time-of-day precision use `Now()` instead.

**Ground answers in knowledge sources:**
```
Always base your answers on the provided knowledge sources.
Do not use general model knowledge to answer questions about [topic].
If the answer is not in the knowledge sources, say: "I don't have information about that. You can contact [support channel] for help."
```

**Control citation behavior:**
```
Always cite the source document when providing an answer.
Do not fabricate sources or links that are not in the search results.
```

**Enforce topic scope:**
```
You only answer questions about [subject]. If the user asks about something outside this scope,
politely redirect them: "I can only help with [subject]. For other questions, please contact [resource]."
```

**Control response format:**
```
Keep answers concise — 3 sentences or fewer unless the user asks for more detail.
Use bullet points when listing steps or multiple items.
Avoid jargon. Write for a general audience.
```

**Handle no-answer gracefully:**
```
If you cannot find a relevant answer in the knowledge sources, do not guess.
Instead, offer to connect the user with a human agent or provide a contact method.
```

## What Instructions Cannot Do
- They cannot override the model's safety guardrails
- They cannot force the agent to search a specific knowledge source — use `knowledgeSourceIds` in a `SearchAndSummarizeContent` node for that
- They cannot guarantee the agent will never hallucinate — grounding reduces it but does not eliminate it
- They cannot change chunking or embedding behavior — that is controlled by the knowledge source content quality
