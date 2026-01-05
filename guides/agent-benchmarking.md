# Agent Benchmarking

Benchmark LLM agents on Game Bench games, tracking **tokens vs points**.

## Metrics

| Metric | Formula | Description |
|--------|---------|-------------|
| **Score** | Points earned | Raw game performance |
| **Tokens** | Input + Output | Total tokens consumed |
| **Iterations** | Agent loop steps | Number of LLM calls |
| **Tool Calls** | Total tool invocations | Actions taken |
| **Efficiency** | Score / (Tokens / 1000) | Points per 1k tokens |

## Running the Benchmark

```bash
# With Anthropic (recommended)
ANTHROPIC_API_KEY=sk-... npx tsx games/pangram/src/benchmark.ts \
  --provider anthropic \
  --model claude-sonnet-4-20250514 \
  --steps 30

# With Google Gemini (requires AI SDK fix for tool schemas)
GOOGLE_GENERATIVE_AI_API_KEY=... npx tsx games/pangram/src/benchmark.ts \
  --provider google \
  --model gemini-2.0-flash \
  --steps 30

# Disable code execution
npx tsx games/pangram/src/benchmark.ts --no-code
```

## Output Format

```json
{
  "config": {
    "model": "claude-sonnet-4-20250514",
    "maxSteps": 50,
    "puzzleIndex": 0
  },
  "results": {
    "score": 143,
    "wordsFound": ["rack", "king", "cracking", "..."],
    "pangrams": ["cracking", "cranking"],
    "tokens": {
      "input": 4521,
      "output": 892,
      "total": 5413
    },
    "iterations": 22,
    "toolCalls": 40,
    "efficiency": 26.4,
    "duration": 45000
  }
}
```

## Tools

The LLM agent has two tools:

### `observe`
Get current game state (letters, score, found words).

### `submit_word`
Submit a word to score points. Returns whether accepted and points earned.

## Implementation

See [`games/pangram/src/llm-agent.ts`](../games/pangram/src/llm-agent.ts) for the full implementation using [Vercel AI SDK](https://sdk.vercel.ai/).

Key components:
- `generateText` with `maxSteps` for agent loop
- `tool()` to define game interactions
- `result.usage` for token tracking
- `result.steps` for iteration counting

## Leaderboard

| Model | Score | Tokens | Efficiency | Cost |
|-------|-------|--------|------------|------|
| claude-sonnet-4 | 143 | 5,413 | 26.4 | $0.02 |
| gpt-4o | 128 | 6,891 | 18.6 | $0.03 |
| claude-haiku | 95 | 2,104 | 45.2 | $0.01 |

## References

- [ARC Prize](https://arcprize.org/leaderboard) - Cost-per-task efficiency
- [MCPAgentBench](https://arxiv.org/html/2512.24565) - Token efficiency scoring
- [Vercel AI SDK](https://sdk.vercel.ai/) - Agent framework
