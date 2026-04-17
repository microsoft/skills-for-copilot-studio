# Date Context Best Practice

Provides the current date to the orchestrator through agent instructions using Power FX, enabling accurate responses to date-related questions like "What are my next public holidays?" or "What meetings do I have this week?"

## The Challenge

When users ask date-relative questions, the orchestrator needs to know the current date to:
- Calculate relative time periods ("next week", "upcoming", "recent")
- Filter time-sensitive content from knowledge sources
- Provide contextually accurate responses about schedules, deadlines, and events

Without explicit date context, the orchestrator may:
- Misinterpret relative date references
- Return outdated or irrelevant information
- Struggle with localization and date format ambiguity

## The Solution

Inject the current date directly into the agent instructions using Power FX's `Today()` function with explicit formatting:

```yaml
instructions: |
  ## Current Context
  Date: {Text(Today(),DateTimeFormat.LongDate)}
  
  Use this date as your reference point when users ask about:
  - Upcoming events, deadlines, or schedules
  - "Next" or "recent" timeframes
  - Time-sensitive information from knowledge sources
  
  Always interpret relative dates based on this current date context.
  
  ## Your Role
  [Rest of your agent instructions...]
```

## Why LongDate Format?

Using `DateTimeFormat.LongDate` provides several advantages:

**Before (ambiguous short format):** `3/13/2026`
- Could be March 13th or 13th of March depending on locale
- Creates potential for hallucinations when the model guesses incorrectly

**After (clear long format):** `Thursday, March 13, 2026`
- Unambiguous date representation
- Includes day of week for additional context
- Locale-independent interpretation
- Reduces model confusion and hallucinations

## Implementation

### Step 1 — Add Date Context to Instructions

In your agent's `agent.mcs.yml` or `settings.mcs.yml`, add the date context at the top of the instructions:

```yaml
instructions: |
  ## Current Context
  Date: {Text(Today(),DateTimeFormat.LongDate)}
  
  When users ask about dates, schedules, or time-sensitive information, use this date as your reference point.
  Interpret "next", "upcoming", "recent", and other relative terms based on this current date.
  
  ## Your Role
  You are a helpful assistant that can access company information and schedules.
  [Continue with your existing instructions...]
```

### Step 2 — Update Knowledge Sources (If Needed)

Ensure your knowledge sources contain date-tagged content that the orchestrator can filter:
- Meeting schedules with dates
- Event calendars
- Policy effective dates
- Deadline information

### Step 3 — Test Date-Relative Queries

Test with various date-relative questions:
- "What's coming up next week?"
- "Show me recent announcements"
- "What holidays are approaching?"
- "When is my next deadline?"

## Alternative Date Formats

Depending on your use case, you may want different date formats:

```yaml
# Long date with day name (recommended)
Date: {Text(Today(),DateTimeFormat.LongDate)}
# Result: "Thursday, March 13, 2026"

# Short date (less clear, not recommended for multilingual)
Date: {Text(Today(),DateTimeFormat.ShortDate)}
# Result: "3/13/2026"

# Custom format with explicit month name
Date: {Text(Today(),"mmmm dd, yyyy")}
# Result: "March 13, 2026"

# Include time if needed for scheduling
DateTime: {Text(Now(),DateTimeFormat.LongDateTime)}
# Result: "Thursday, March 13, 2026 2:30:00 PM"
```

## When to Use This Pattern

- Users frequently ask about schedules, events, or time-sensitive information
- Your knowledge sources contain dated content (calendars, policies, announcements)
- You need to filter or prioritize information by recency or upcoming dates
- Users ask relative date questions ("next week", "recently", "upcoming")
- Your agent operates across multiple time zones or locales

## Token Considerations

Each Power FX expression in instructions consumes tokens in every orchestrator call. For date context:
- The date expression is evaluated once per conversation
- Minimal token impact (typically 5-10 tokens)
- The benefit of accurate date interpretation usually outweighs the small token cost

## Combining with Other Patterns

Date context works well with other best practices:

**With JIT User Context:**
```yaml
instructions: |
  ## Current Context
  Date: {Text(Today(),DateTimeFormat.LongDate)}
  User: {Global.UserDisplayName} from {Global.UserCountry}
  
  Provide localized, date-aware responses based on the user's location and current date.
```

**With Knowledge Filtering:**
```yaml
instructions: |
  ## Current Context
  Date: {Text(Today(),DateTimeFormat.LongDate)}
  
  When searching for events or schedules, prioritize information dated on or after today's date.
  Filter out past events unless specifically requested.
```