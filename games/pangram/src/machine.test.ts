/**
 * Tests for Pangram XState machine
 *
 * Tests state transitions, guards, and actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createActor } from 'xstate';
import { pangramMachine } from './machine.js';

// Mock the dictionary API
vi.mock('./mechanics.js', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    validateWordDictionary: vi.fn().mockImplementation(async (word: string) => {
      // Mock valid words for testing
      const validWords = ['rack', 'king', 'racking', 'cranking', 'crack'];
      return validWords.includes(word.toLowerCase());
    }),
  };
});

describe('Pangram Machine', () => {
  describe('Initial State', () => {
    it('starts in playing state', () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('playing');

      actor.stop();
    });

    it('initializes with correct puzzle', () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      const { context } = actor.getSnapshot();
      expect(context.letters).toHaveLength(7);
      expect(context.letters).toContain(context.centerLetter);
      expect(context.currentInput).toBe('');
      expect(context.foundWords).toEqual([]);
      expect(context.score).toBe(0);

      actor.stop();
    });
  });

  describe('ADD_LETTER', () => {
    it('adds valid letter to input', () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      const { context } = actor.getSnapshot();
      const validLetter = context.letters[0];

      actor.send({ type: 'ADD_LETTER', letter: validLetter });

      expect(actor.getSnapshot().context.currentInput).toBe(validLetter);

      actor.stop();
    });

    it('ignores invalid letters', () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      // 'Z' is not in puzzle 0 (RACKING)
      actor.send({ type: 'ADD_LETTER', letter: 'Z' });

      expect(actor.getSnapshot().context.currentInput).toBe('');

      actor.stop();
    });

    it('allows repeated letters', () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      const { context } = actor.getSnapshot();
      const letter = context.letters[0];

      actor.send({ type: 'ADD_LETTER', letter });
      actor.send({ type: 'ADD_LETTER', letter });
      actor.send({ type: 'ADD_LETTER', letter });

      expect(actor.getSnapshot().context.currentInput).toBe(letter + letter + letter);

      actor.stop();
    });
  });

  describe('DELETE_LETTER', () => {
    it('removes last letter from input', () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      const { context } = actor.getSnapshot();
      actor.send({ type: 'ADD_LETTER', letter: context.letters[0] });
      actor.send({ type: 'ADD_LETTER', letter: context.letters[1] });
      actor.send({ type: 'DELETE_LETTER' });

      expect(actor.getSnapshot().context.currentInput).toBe(context.letters[0]);

      actor.stop();
    });

    it('does nothing when input is empty', () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      actor.send({ type: 'DELETE_LETTER' });

      expect(actor.getSnapshot().context.currentInput).toBe('');

      actor.stop();
    });
  });

  describe('CLEAR', () => {
    it('clears all input', () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      const { context } = actor.getSnapshot();
      actor.send({ type: 'ADD_LETTER', letter: context.letters[0] });
      actor.send({ type: 'ADD_LETTER', letter: context.letters[1] });
      actor.send({ type: 'ADD_LETTER', letter: context.letters[2] });
      actor.send({ type: 'CLEAR' });

      expect(actor.getSnapshot().context.currentInput).toBe('');

      actor.stop();
    });
  });

  describe('SUBMIT', () => {
    it('requires at least 4 letters', () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      const { context } = actor.getSnapshot();
      actor.send({ type: 'ADD_LETTER', letter: context.letters[0] });
      actor.send({ type: 'ADD_LETTER', letter: context.letters[1] });
      actor.send({ type: 'ADD_LETTER', letter: context.letters[2] });
      actor.send({ type: 'SUBMIT' });

      // Should still be in playing state (guard blocked transition)
      expect(actor.getSnapshot().value).toBe('playing');
      expect(actor.getSnapshot().context.currentInput).toBe(
        context.letters[0] + context.letters[1] + context.letters[2]
      );

      actor.stop();
    });

    it('transitions to validating with 4+ letters', async () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      // Type "RACK" (puzzle 0 has center letter K)
      actor.send({ type: 'ADD_LETTER', letter: 'R' });
      actor.send({ type: 'ADD_LETTER', letter: 'A' });
      actor.send({ type: 'ADD_LETTER', letter: 'C' });
      actor.send({ type: 'ADD_LETTER', letter: 'K' });
      actor.send({ type: 'SUBMIT' });

      // Should transition to validating
      expect(actor.getSnapshot().value).toBe('validating');

      // Wait for async validation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should be back to playing
      expect(actor.getSnapshot().value).toBe('playing');

      actor.stop();
    });

    it('accepts valid word and updates score', async () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      // Type "RACK"
      actor.send({ type: 'ADD_LETTER', letter: 'R' });
      actor.send({ type: 'ADD_LETTER', letter: 'A' });
      actor.send({ type: 'ADD_LETTER', letter: 'C' });
      actor.send({ type: 'ADD_LETTER', letter: 'K' });
      actor.send({ type: 'SUBMIT' });

      // Wait for validation
      await new Promise(resolve => setTimeout(resolve, 100));

      const { context } = actor.getSnapshot();
      expect(context.foundWords).toContain('rack');
      expect(context.score).toBe(1); // 4-letter word = 1 point
      expect(context.currentInput).toBe('');

      actor.stop();
    });

    it('rejects invalid word', async () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      // Type "RICK" (not in our mock valid words)
      actor.send({ type: 'ADD_LETTER', letter: 'R' });
      actor.send({ type: 'ADD_LETTER', letter: 'I' });
      actor.send({ type: 'ADD_LETTER', letter: 'C' });
      actor.send({ type: 'ADD_LETTER', letter: 'K' });
      actor.send({ type: 'SUBMIT' });

      // Wait for validation
      await new Promise(resolve => setTimeout(resolve, 100));

      const { context } = actor.getSnapshot();
      expect(context.foundWords).not.toContain('rick');
      expect(context.score).toBe(0);
      expect(context.lastMessageType).toBe('error');

      actor.stop();
    });

    it('prevents duplicate words', async () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      // Submit "RACK" first time
      actor.send({ type: 'ADD_LETTER', letter: 'R' });
      actor.send({ type: 'ADD_LETTER', letter: 'A' });
      actor.send({ type: 'ADD_LETTER', letter: 'C' });
      actor.send({ type: 'ADD_LETTER', letter: 'K' });
      actor.send({ type: 'SUBMIT' });

      await new Promise(resolve => setTimeout(resolve, 100));

      const scoreAfterFirst = actor.getSnapshot().context.score;

      // Try to submit "RACK" again
      actor.send({ type: 'ADD_LETTER', letter: 'R' });
      actor.send({ type: 'ADD_LETTER', letter: 'A' });
      actor.send({ type: 'ADD_LETTER', letter: 'C' });
      actor.send({ type: 'ADD_LETTER', letter: 'K' });
      actor.send({ type: 'SUBMIT' });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Score should not increase
      expect(actor.getSnapshot().context.score).toBe(scoreAfterFirst);
      expect(actor.getSnapshot().context.foundWords.filter(w => w === 'rack')).toHaveLength(1);

      actor.stop();
    });
  });

  describe('NEW_PUZZLE', () => {
    it('resets to new puzzle', async () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      const initialLetters = [...actor.getSnapshot().context.letters];

      // Find a word first
      actor.send({ type: 'ADD_LETTER', letter: 'R' });
      actor.send({ type: 'ADD_LETTER', letter: 'A' });
      actor.send({ type: 'ADD_LETTER', letter: 'C' });
      actor.send({ type: 'ADD_LETTER', letter: 'K' });
      actor.send({ type: 'SUBMIT' });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Start new puzzle
      actor.send({ type: 'NEW_PUZZLE' });

      const { context } = actor.getSnapshot();
      expect(context.score).toBe(0);
      expect(context.foundWords).toEqual([]);
      expect(context.currentInput).toBe('');
      // Letters should be different (puzzle 1)
      expect(context.letters).not.toEqual(initialLetters);

      actor.stop();
    });
  });

  describe('Guards', () => {
    it('canAddLetter blocks invalid letters', () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      const before = actor.getSnapshot().context.currentInput;
      actor.send({ type: 'ADD_LETTER', letter: 'Z' }); // Not in puzzle
      const after = actor.getSnapshot().context.currentInput;

      expect(before).toBe(after);

      actor.stop();
    });

    it('canDelete blocks when input empty', () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      // This should not throw, just be ignored
      actor.send({ type: 'DELETE_LETTER' });
      expect(actor.getSnapshot().context.currentInput).toBe('');

      actor.stop();
    });

    it('canSubmit blocks with less than 4 letters', () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      actor.send({ type: 'ADD_LETTER', letter: 'R' });
      actor.send({ type: 'ADD_LETTER', letter: 'A' });
      actor.send({ type: 'ADD_LETTER', letter: 'K' });
      actor.send({ type: 'SUBMIT' });

      // Should still be in playing (not validating)
      expect(actor.getSnapshot().value).toBe('playing');

      actor.stop();
    });
  });
});
