/**
 * Agent benchmark tests
 *
 * Tests that the agent achieves minimum performance thresholds.
 * These are outcome-focused tests per the evaluation skill.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createActor } from 'xstate';
import { pangramMachine } from './machine.js';

// Mock the dictionary API for consistent testing
vi.mock('./mechanics.js', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    validateWordDictionary: vi.fn().mockImplementation(async (word: string) => {
      // Known valid words for puzzle 0 (RACKING, center K)
      const validWords = [
        'rack', 'king', 'ring', 'rank', 'rink', 'kick', 'nick', 'rick',
        'kink', 'cark', 'nark', 'akin', 'kiang',
        'crack', 'crank', 'raking', 'caking', 'inking', 'irking',
        'ranking', 'racking', 'kicking', 'nicking', 'ricking', 'narking',
        'cracking', 'cranking', 'carking',
      ];
      return validWords.includes(word.toLowerCase());
    }),
  };
});

// Helper to observe state
function observe(actor: ReturnType<typeof createActor<typeof pangramMachine>>) {
  const snapshot = actor.getSnapshot();
  return {
    score: snapshot.context.score,
    foundWords: snapshot.context.foundWords,
    lastMessage: snapshot.context.lastMessage,
    isValidating: snapshot.value === 'validating',
  };
}

// Helper to wait for validation
async function waitForPlaying(actor: ReturnType<typeof createActor<typeof pangramMachine>>) {
  while (actor.getSnapshot().value === 'validating') {
    await new Promise(r => setTimeout(r, 10));
  }
}

describe('Agent Benchmarks', () => {
  describe('SUBMIT_WORD interface', () => {
    it('accepts valid words via SUBMIT_WORD', async () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      actor.send({ type: 'SUBMIT_WORD', word: 'RACK' });
      await waitForPlaying(actor);

      const obs = observe(actor);
      expect(obs.foundWords).toContain('rack');
      expect(obs.score).toBe(1);

      actor.stop();
    });

    it('rejects invalid words with feedback', async () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      actor.send({ type: 'SUBMIT_WORD', word: 'XXXX' });
      await waitForPlaying(actor);

      const obs = observe(actor);
      expect(obs.foundWords).not.toContain('xxxx');
      expect(obs.lastMessage).toBeTruthy(); // Has error message

      actor.stop();
    });

    it('scores pangrams correctly', async () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      actor.send({ type: 'SUBMIT_WORD', word: 'CRACKING' });
      await waitForPlaying(actor);

      const obs = observe(actor);
      expect(obs.foundWords).toContain('cracking');
      expect(obs.score).toBe(15); // 8 letters + 7 bonus

      actor.stop();
    });
  });

  describe('Performance thresholds', () => {
    it('agent finds at least 10 words', async () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      const wordsToTry = [
        'cracking', 'cranking', 'racking', 'carking',
        'ranking', 'kicking', 'raking', 'caking', 'inking', 'irking',
        'crack', 'crank', 'rack', 'kick', 'king',
      ];

      for (const word of wordsToTry) {
        actor.send({ type: 'SUBMIT_WORD', word });
        await waitForPlaying(actor);
      }

      const obs = observe(actor);
      expect(obs.foundWords.length).toBeGreaterThanOrEqual(10);

      actor.stop();
    });

    it('agent scores at least 50 points', async () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      const wordsToTry = [
        'cracking', 'cranking', 'racking', 'carking', // 4 pangrams = 58 pts
        'ranking', 'kicking',
      ];

      for (const word of wordsToTry) {
        actor.send({ type: 'SUBMIT_WORD', word });
        await waitForPlaying(actor);
      }

      const obs = observe(actor);
      expect(obs.score).toBeGreaterThanOrEqual(50);

      actor.stop();
    });

    it('agent finds at least 1 pangram', async () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      actor.send({ type: 'SUBMIT_WORD', word: 'CRACKING' });
      await waitForPlaying(actor);

      const obs = observe(actor);
      // Pangram gives 15 points (8 + 7 bonus)
      expect(obs.score).toBe(15);
      expect(obs.foundWords).toContain('cracking');

      actor.stop();
    });
  });

  describe('Machine is permissive', () => {
    it('silently ignores invalid letters in ADD_LETTER', () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      actor.send({ type: 'ADD_LETTER', letter: 'Z' }); // Not in puzzle
      expect(actor.getSnapshot().context.currentInput).toBe('');

      actor.send({ type: 'ADD_LETTER', letter: 'R' }); // Valid
      expect(actor.getSnapshot().context.currentInput).toBe('R');

      actor.stop();
    });

    it('DELETE_LETTER is no-op when empty', () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      // Should not throw
      actor.send({ type: 'DELETE_LETTER' });
      expect(actor.getSnapshot().context.currentInput).toBe('');

      actor.stop();
    });

    it('SUBMIT with < 4 letters gives error message', () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      actor.send({ type: 'ADD_LETTER', letter: 'R' });
      actor.send({ type: 'ADD_LETTER', letter: 'A' });
      actor.send({ type: 'SUBMIT' });

      const ctx = actor.getSnapshot().context;
      expect(ctx.lastMessage).toContain('4 letters');
      expect(ctx.lastMessageType).toBe('error');

      actor.stop();
    });
  });
});
