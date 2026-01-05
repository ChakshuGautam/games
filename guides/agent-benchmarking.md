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
# With Google Gemini (recommended)
GOOGLE_GENERATIVE_AI_API_KEY=... npx tsx games/pangram/src/benchmark.ts \
  --provider google \
  --model gemini-2.5-flash \
  --steps 30

# With Anthropic
ANTHROPIC_API_KEY=sk-... npx tsx games/pangram/src/benchmark.ts \
  --provider anthropic \
  --model claude-sonnet-4-20250514 \
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

See [`games/pangram/src/benchmark.ts`](../games/pangram/src/benchmark.ts) for the full implementation using [Vercel AI SDK 6](https://sdk.vercel.ai/).

Key components:
- `ToolLoopAgent` for multi-step tool execution loop
- `tool()` with `inputSchema` for game interactions
- `stepCountIs()` to control max iterations
- `result.usage` for token tracking
- `result.steps` for iteration counting

## Leaderboard

| Model | Score | Tokens | Efficiency | Steps |
|-------|-------|--------|------------|-------|
| gemini-2.5-flash | 73 | 1,291 | 56.5 | 20 |

*Run your own benchmark and submit results!*

## References

- [ARC Prize](https://arcprize.org/leaderboard) - Cost-per-task efficiency
- [MCPAgentBench](https://arxiv.org/html/2512.24565) - Token efficiency scoring
- [Vercel AI SDK](https://sdk.vercel.ai/) - Agent framework
