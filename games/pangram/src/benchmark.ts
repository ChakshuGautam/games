/**
 * Generic Benchmark Runner
 *
 * Runs any LLM against the game with:
 * - Game tools (observe, submit_word)
 * - Code sandbox tool (Python execution via Vercel Sandbox)
 * - Full metrics tracking (tokens, iterations, tool calls)
 *
 * Usage:
 *   GOOGLE_GENERATIVE_AI_API_KEY=... npx tsx games/pangram/src/benchmark.ts
 *
 * The LLM decides its own strategy - it can:
 * - Call game tools directly
 * - Write Python code to generate word candidates
 * - Analyze patterns and iterate
 */

import { generateText, tool, LanguageModelV1, jsonSchema } from 'ai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { createActor } from 'xstate';
import { pangramMachine } from './machine.js';
import { getGameConfig, generateSystemPrompt } from './game-config.js';

// ============================================================================
// Types
// ============================================================================

export interface BenchmarkConfig {
  provider: 'google' | 'anthropic';
  model: string;
  maxSteps: number;
  puzzleIndex: number;
  enableCodeExecution: boolean;
}

export interface BenchmarkResult {
  config: BenchmarkConfig;
  game: {
    score: number;
    wordsFound: string[];
    pangrams: string[];
  };
  metrics: {
    tokens: { input: number; output: number; total: number };
    iterations: number;
    toolCalls: { total: number; observe: number; submit_word: number; execute_code: number };
    efficiency: number;
    duration: number;
  };
}

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: BenchmarkConfig = {
  provider: 'google',
  model: 'gemini-2.0-flash',
  maxSteps: 30,
  puzzleIndex: 0,
  enableCodeExecution: true,
};

// ============================================================================
// Model Factory
// ============================================================================

function getModel(config: BenchmarkConfig): LanguageModelV1 {
  switch (config.provider) {
    case 'google':
      return google(config.model);
    case 'anthropic':
      return anthropic(config.model);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

// ============================================================================
// Benchmark Runner
// ============================================================================

export async function runBenchmark(
  config: Partial<BenchmarkConfig> = {}
): Promise<BenchmarkResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  // Load game config
  const gameConfig = getGameConfig();
  const systemPrompt = generateSystemPrompt(gameConfig);

  // Create game actor
  const actor = createActor(pangramMachine, {
    input: { puzzleIndex: finalConfig.puzzleIndex },
  });
  actor.start();

  // Tool call counters
  const toolCallCounts = { get_game_state: 0, submit_word: 0, execute_code: 0 };

  // Helper to observe game state
  const observeGame = () => {
    toolCallCounts.get_game_state++;
    const snapshot = actor.getSnapshot();
    const ctx = snapshot.context;
    return {
      letters: ctx.letters,
      centerLetter: ctx.centerLetter,
      score: ctx.score,
      foundWords: ctx.foundWords,
      lastMessage: ctx.lastMessage,
    };
  };

  // Helper to submit word
  const submitWord = async (word: string) => {
    toolCallCounts.submit_word++;
    const prevScore = actor.getSnapshot().context.score;
    actor.send({ type: 'SUBMIT_WORD', word });

    // Wait for validation
    while (actor.getSnapshot().value === 'validating') {
      await new Promise((r) => setTimeout(r, 50));
    }

    const snapshot = actor.getSnapshot();
    return {
      accepted: snapshot.context.score > prevScore,
      pointsEarned: snapshot.context.score - prevScore,
      message: snapshot.context.lastMessage,
      newScore: snapshot.context.score,
    };
  };

  // Simple Python code execution (mock for now - replace with Vercel Sandbox)
  const executeCode = async (code: string) => {
    toolCallCounts.execute_code++;
    // For now, return a message that code execution is available
    // In production, this would call Vercel Sandbox
    return {
      success: false,
      output: 'Code execution requires VERCEL_OIDC_TOKEN. Set up Vercel Sandbox to enable.',
      error: null,
    };
  };

  // Define tools using jsonSchema for Google compatibility
  const tools = {
    get_game_state: tool({
      description: 'Get the current game state including available letters, center letter, score, and found words. Call this first to see what letters you have.',
      parameters: jsonSchema<{ format: string }>({
        type: 'object',
        properties: {
          format: { type: 'string', description: 'Output format: use "brief" or "detailed"' },
        },
        required: ['format'],
      }),
      execute: async () => observeGame(),
    }),
    submit_word: tool({
      description: 'Submit a word to score points. Must be 4+ letters, use only available letters, include center letter.',
      parameters: jsonSchema<{ word: string }>({
        type: 'object',
        properties: {
          word: { type: 'string', description: 'The word to submit' },
        },
        required: ['word'],
      }),
      execute: async ({ word }) => submitWord(word),
    }),
    ...(finalConfig.enableCodeExecution ? {
      execute_code: tool({
        description: 'Execute Python code to help solve the puzzle. Use this to generate word candidates, analyze patterns, etc. Use print() to see output.',
        parameters: jsonSchema<{ code: string }>({
          type: 'object',
          properties: {
            code: { type: 'string', description: 'Python code to execute' },
          },
          required: ['code'],
        }),
        execute: async ({ code }) => executeCode(code),
      }),
    } : {}),
  };

  // Print header
  console.log('='.repeat(60));
  console.log('BENCHMARK RUNNER');
  console.log('='.repeat(60));
  console.log(`Provider: ${finalConfig.provider}`);
  console.log(`Model: ${finalConfig.model}`);
  console.log(`Max Steps: ${finalConfig.maxSteps}`);
  console.log(`Puzzle: ${finalConfig.puzzleIndex}`);
  console.log(`Code Execution: ${finalConfig.enableCodeExecution ? 'enabled' : 'disabled'}`);

  const initial = observeGame();
  toolCallCounts.get_game_state--; // Don't count initial observation
  console.log(`\nLetters: ${initial.letters.join(' ')} (center: ${initial.centerLetter})`);
  console.log('');

  // Run the agent
  const result = await generateText({
    model: getModel(finalConfig),
    system: systemPrompt,
    prompt: `Play the game and maximize your score. Start by observing the game state, then submit words. You can write Python code to help generate word candidates if needed.`,
    tools,
    maxSteps: finalConfig.maxSteps,
    onStepFinish: ({ toolCalls, toolResults }) => {
      if (toolCalls) {
        for (const tc of toolCalls) {
          if (tc.toolName === 'submit_word') {
            const res = toolResults?.find((r) => r.toolCallId === tc.toolCallId);
            if (res && typeof res.result === 'object' && res.result !== null) {
              const r = res.result as { accepted: boolean; pointsEarned: number };
              const word = (tc.args as { word: string }).word;
              if (r.accepted) {
                console.log(`  ✓ [+${r.pointsEarned}] ${word.toUpperCase()}`);
              } else {
                console.log(`  ✗ ${word}`);
              }
            }
          } else if (tc.toolName === 'execute_code') {
            console.log(`  🐍 Code executed`);
          }
        }
      }
    },
  });

  // Get final state
  const finalState = actor.getSnapshot();
  actor.stop();

  // Calculate metrics
  const inputTokens = result.usage.promptTokens;
  const outputTokens = result.usage.completionTokens;
  const totalTokens = inputTokens + outputTokens;
  const score = finalState.context.score;
  const duration = Date.now() - startTime;

  const totalToolCalls = toolCallCounts.get_game_state + toolCallCounts.submit_word + toolCallCounts.execute_code;

  // Identify pangrams
  const pangrams = finalState.context.foundWords.filter((w: string) => w.length >= 7);

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  console.log(`Score: ${score}`);
  console.log(`Words: ${finalState.context.foundWords.length}`);
  console.log(`Pangrams: ${pangrams.length}`);
  console.log(`\nTokens: ${totalTokens} (in: ${inputTokens}, out: ${outputTokens})`);
  console.log(`Iterations: ${result.steps.length}`);
  console.log(`Tool Calls: ${totalToolCalls} (get_state: ${toolCallCounts.get_game_state}, submit: ${toolCallCounts.submit_word}, code: ${toolCallCounts.execute_code})`);
  console.log(`Efficiency: ${(score / (totalTokens / 1000)).toFixed(2)} points/1k tokens`);
  console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);

  const benchmarkResult: BenchmarkResult = {
    config: finalConfig,
    game: {
      score,
      wordsFound: finalState.context.foundWords,
      pangrams,
    },
    metrics: {
      tokens: { input: inputTokens, output: outputTokens, total: totalTokens },
      iterations: result.steps.length,
      toolCalls: { total: totalToolCalls, ...toolCallCounts },
      efficiency: score / (totalTokens / 1000),
      duration,
    },
  };

  return benchmarkResult;
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const config: Partial<BenchmarkConfig> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--provider' && args[i + 1]) {
      config.provider = args[++i] as 'google' | 'anthropic';
    } else if (args[i] === '--model' && args[i + 1]) {
      config.model = args[++i];
    } else if (args[i] === '--steps' && args[i + 1]) {
      config.maxSteps = parseInt(args[++i], 10);
    } else if (args[i] === '--puzzle' && args[i + 1]) {
      config.puzzleIndex = parseInt(args[++i], 10);
    } else if (args[i] === '--no-code') {
      config.enableCodeExecution = false;
    }
  }

  try {
    const result = await runBenchmark(config);
    console.log('\n' + '='.repeat(60));
    console.log('JSON OUTPUT');
    console.log('='.repeat(60));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Benchmark error:', error);
    process.exit(1);
  }
}

main();
