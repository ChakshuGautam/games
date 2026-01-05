/**
 * LLM Agent for Pangram
 *
 * Uses Vercel AI SDK to create an LLM-powered agent that plays Pangram.
 * Tracks tokens, iterations, and tool calls for benchmarking.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npx tsx games/pangram/src/llm-agent.ts
 *
 * Options:
 *   --model <model>    Model to use (default: claude-sonnet-4-20250514)
 *   --steps <n>        Max agent steps (default: 50)
 *   --puzzle <n>       Puzzle index (default: 0)
 *
 * Output: JSON with score, tokens, iterations, tool calls, efficiency
 */

import { generateText, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { createActor } from 'xstate';
import { pangramMachine } from './machine.js';

// ============================================================================
// Types
// ============================================================================

export interface AgentConfig {
  model: string;
  maxSteps: number;
  puzzleIndex: number;
}

export interface AgentResult {
  config: AgentConfig;
  results: {
    score: number;
    wordsFound: string[];
    pangrams: string[];
    tokens: {
      input: number;
      output: number;
      total: number;
    };
    iterations: number;
    toolCalls: number;
    efficiency: number; // score per 1k tokens
    duration: number;
  };
}

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: AgentConfig = {
  model: 'claude-sonnet-4-20250514',
  maxSteps: 50,
  puzzleIndex: 0,
};

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are playing Pangram, a word puzzle game. Your goal is to score as many points as possible.

RULES:
- You have 7 letters available, one is the CENTER letter (marked)
- Every word MUST include the center letter
- Words must be at least 4 letters long
- Letters can be reused within a word
- Pangrams (words using ALL 7 letters) score bonus points

SCORING:
- 4-letter words: 1 point
- 5+ letter words: 1 point per letter
- Pangrams: word length + 7 bonus points

STRATEGY:
1. First, call observe() to see the available letters
2. Try pangrams first (use all 7 letters) - they score the most
3. Then try longer words, then shorter ones
4. Track which words were accepted vs rejected
5. Don't repeat words you've already found

IMPORTANT: You have a limited token budget. Be efficient - don't ramble, just play.`;

// ============================================================================
// Agent Implementation
// ============================================================================

export async function runLLMAgent(
  config: Partial<AgentConfig> = {}
): Promise<AgentResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  // Create game actor
  const actor = createActor(pangramMachine, {
    input: { puzzleIndex: finalConfig.puzzleIndex },
  });
  actor.start();

  // Helper to observe game state
  const observeGame = () => {
    const snapshot = actor.getSnapshot();
    const ctx = snapshot.context;
    return {
      letters: ctx.letters,
      centerLetter: ctx.centerLetter,
      score: ctx.score,
      foundWords: ctx.foundWords,
      lastMessage: ctx.lastMessage,
      lastMessageType: ctx.lastMessageType,
    };
  };

  // Helper to submit word and wait for result
  const submitWord = async (word: string) => {
    const prevScore = actor.getSnapshot().context.score;
    actor.send({ type: 'SUBMIT_WORD', word });

    // Wait for validation to complete
    while (actor.getSnapshot().value === 'validating') {
      await new Promise((r) => setTimeout(r, 50));
    }

    const snapshot = actor.getSnapshot();
    const accepted = snapshot.context.score > prevScore;
    return {
      accepted,
      pointsEarned: snapshot.context.score - prevScore,
      message: snapshot.context.lastMessage,
      newScore: snapshot.context.score,
      foundWords: snapshot.context.foundWords,
    };
  };

  // Define tools for the LLM
  const tools = {
    observe: tool({
      description:
        'Get the current game state including available letters, center letter, score, and found words. Call this first to see what letters you have.',
      parameters: z.object({}),
      execute: async () => observeGame(),
    }),
    submit_word: tool({
      description:
        'Submit a word to score points. The word must be 4+ letters, use only the available letters, and include the center letter. Returns whether the word was accepted and points earned.',
      parameters: z.object({
        word: z.string().describe('The word to submit (case insensitive)'),
      }),
      execute: async ({ word }) => submitWord(word),
    }),
  };

  // Run the agent
  console.log('='.repeat(60));
  console.log('LLM AGENT - Pangram');
  console.log('='.repeat(60));
  console.log(`Model: ${finalConfig.model}`);
  console.log(`Max Steps: ${finalConfig.maxSteps}`);
  console.log(`Puzzle: ${finalConfig.puzzleIndex}`);

  const initial = observeGame();
  console.log(`\nLetters: ${initial.letters.join(' ')} (center: ${initial.centerLetter})`);
  console.log('');

  const result = await generateText({
    model: anthropic(finalConfig.model),
    system: SYSTEM_PROMPT,
    prompt: 'Play Pangram and maximize your score. Start by observing the game state.',
    tools,
    maxSteps: finalConfig.maxSteps,
    onStepFinish: ({ toolCalls, toolResults }) => {
      // Log each tool call
      if (toolCalls) {
        for (const tc of toolCalls) {
          if (tc.toolName === 'submit_word') {
            const res = toolResults?.find((r) => r.toolCallId === tc.toolCallId);
            if (res && typeof res.result === 'object' && res.result !== null) {
              const r = res.result as { accepted: boolean; pointsEarned: number };
              if (r.accepted) {
                console.log(`  ✓ [+${r.pointsEarned}] ${(tc.args as { word: string }).word.toUpperCase()}`);
              }
            }
          }
        }
      }
    },
  });

  // Stop the actor
  const finalState = actor.getSnapshot();
  actor.stop();

  // Calculate metrics
  const inputTokens = result.usage.promptTokens;
  const outputTokens = result.usage.completionTokens;
  const totalTokens = inputTokens + outputTokens;
  const score = finalState.context.score;

  // Count tool calls
  let toolCallCount = 0;
  for (const step of result.steps) {
    if (step.toolCalls) {
      toolCallCount += step.toolCalls.length;
    }
  }

  // Identify pangrams (7+ letter words)
  const pangrams = finalState.context.foundWords.filter(
    (w: string) => w.length >= 7
  );

  const duration = Date.now() - startTime;

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  console.log(`Score: ${score}`);
  console.log(`Words: ${finalState.context.foundWords.length}`);
  console.log(`Pangrams: ${pangrams.length}`);
  console.log(`Tokens: ${totalTokens} (in: ${inputTokens}, out: ${outputTokens})`);
  console.log(`Iterations: ${result.steps.length}`);
  console.log(`Tool Calls: ${toolCallCount}`);
  console.log(`Efficiency: ${(score / (totalTokens / 1000)).toFixed(2)} points/1k tokens`);
  console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);

  return {
    config: finalConfig,
    results: {
      score,
      wordsFound: finalState.context.foundWords,
      pangrams,
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens,
      },
      iterations: result.steps.length,
      toolCalls: toolCallCount,
      efficiency: score / (totalTokens / 1000),
      duration,
    },
  };
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const config: Partial<AgentConfig> = {};

  // Parse CLI args
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model' && args[i + 1]) {
      config.model = args[++i];
    } else if (args[i] === '--steps' && args[i + 1]) {
      config.maxSteps = parseInt(args[++i], 10);
    } else if (args[i] === '--puzzle' && args[i + 1]) {
      config.puzzleIndex = parseInt(args[++i], 10);
    }
  }

  try {
    const result = await runLLMAgent(config);
    console.log('\n' + '='.repeat(60));
    console.log('JSON OUTPUT');
    console.log('='.repeat(60));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Agent error:', error);
    process.exit(1);
  }
}

// Run if executed directly
main();
