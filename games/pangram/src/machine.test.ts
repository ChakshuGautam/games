/**
 * Tests for Pangram XState machine
 *
 * Tests state transitions and permissive behavior.
 * Machine is designed to accept any input and provide feedback.
 */

import { describe, it, expect, vi } from 'vitest';
import { createActor } from 'xstate';
import { pangramMachine } from './machine.js';

// Mock the dictionary API
vi.mock('./mechanics.js', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    validateWordDictionary: vi.fn().mockImplementation(async (word: string) => {
      const validWords = ['rack', 'king', 'racking', 'cranking', 'crack', 'cracking'];
      return validWords.includes(word.toLowerCase());
    }),
  };
});

describe('Pangram Machine', () => {
  describe('Initial State', () => {
    it('starts in playing state', () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      expect(actor.getSnapshot().value).toBe('playing');
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

  describe('ADD_LETTER (permissive)', () => {
    it('adds valid letter to input', () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      const { context } = actor.getSnapshot();
      const validLetter = context.letters[0];

      actor.send({ type: 'ADD_LETTER', letter: validLetter });
      expect(actor.getSnapshot().context.currentInput).toBe(validLetter);

      actor.stop();
    });

    it('silently ignores invalid letters', () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

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

  describe('DELETE_LETTER (permissive)', () => {
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

    it('is no-op when input is empty', () => {
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
      actor.send({ type: 'CLEAR' });

      expect(actor.getSnapshot().context.currentInput).toBe('');
      actor.stop();
    });
  });

  describe('SUBMIT (permissive)', () => {
    it('provides error feedback for short words', () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      actor.send({ type: 'ADD_LETTER', letter: 'R' });
      actor.send({ type: 'ADD_LETTER', letter: 'A' });
      actor.send({ type: 'SUBMIT' });

      const ctx = actor.getSnapshot().context;
      expect(ctx.lastMessage).toContain('4 letters');
      expect(ctx.lastMessageType).toBe('error');
      expect(actor.getSnapshot().value).toBe('playing');

      actor.stop();
    });

    it('transitions to validating with 4+ letters', async () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      actor.send({ type: 'ADD_LETTER', letter: 'R' });
      actor.send({ type: 'ADD_LETTER', letter: 'A' });
      actor.send({ type: 'ADD_LETTER', letter: 'C' });
      actor.send({ type: 'ADD_LETTER', letter: 'K' });
      actor.send({ type: 'SUBMIT' });

      expect(actor.getSnapshot().value).toBe('validating');

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(actor.getSnapshot().value).toBe('playing');

      actor.stop();
    });

    it('accepts valid word and updates score', async () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      actor.send({ type: 'ADD_LETTER', letter: 'R' });
      actor.send({ type: 'ADD_LETTER', letter: 'A' });
      actor.send({ type: 'ADD_LETTER', letter: 'C' });
      actor.send({ type: 'ADD_LETTER', letter: 'K' });
      actor.send({ type: 'SUBMIT' });

      await new Promise(resolve => setTimeout(resolve, 100));

      const { context } = actor.getSnapshot();
      expect(context.foundWords).toContain('rack');
      expect(context.score).toBe(1);

      actor.stop();
    });
  });

  describe('SUBMIT_WORD (consolidated)', () => {
    it('accepts valid word directly', async () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      actor.send({ type: 'SUBMIT_WORD', word: 'RACK' });

      await new Promise(resolve => setTimeout(resolve, 100));

      const { context } = actor.getSnapshot();
      expect(context.foundWords).toContain('rack');
      expect(context.score).toBe(1);

      actor.stop();
    });

    it('provides error feedback for invalid words', async () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      actor.send({ type: 'SUBMIT_WORD', word: 'XXXX' });

      await new Promise(resolve => setTimeout(resolve, 100));

      const { context } = actor.getSnapshot();
      expect(context.foundWords).not.toContain('xxxx');
      expect(context.lastMessageType).toBe('error');

      actor.stop();
    });

    it('provides error for short words without validating', () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      actor.send({ type: 'SUBMIT_WORD', word: 'RK' });

      const { context } = actor.getSnapshot();
      expect(context.lastMessage).toContain('4 valid letters');
      expect(actor.getSnapshot().value).toBe('playing'); // Never went to validating

      actor.stop();
    });

    it('scores pangrams correctly', async () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      actor.send({ type: 'SUBMIT_WORD', word: 'CRACKING' });

      await new Promise(resolve => setTimeout(resolve, 100));

      const { context } = actor.getSnapshot();
      expect(context.foundWords).toContain('cracking');
      expect(context.score).toBe(15); // 8 + 7 bonus

      actor.stop();
    });

    it('prevents duplicate words', async () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      actor.send({ type: 'SUBMIT_WORD', word: 'RACK' });
      await new Promise(resolve => setTimeout(resolve, 100));

      const scoreAfterFirst = actor.getSnapshot().context.score;

      actor.send({ type: 'SUBMIT_WORD', word: 'RACK' });
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(actor.getSnapshot().context.score).toBe(scoreAfterFirst);

      actor.stop();
    });
  });

  describe('NEW_PUZZLE', () => {
    it('resets to new puzzle', async () => {
      const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
      actor.start();

      const initialLetters = [...actor.getSnapshot().context.letters];

      actor.send({ type: 'SUBMIT_WORD', word: 'RACK' });
      await new Promise(resolve => setTimeout(resolve, 100));

      actor.send({ type: 'NEW_PUZZLE' });

      const { context } = actor.getSnapshot();
      expect(context.score).toBe(0);
      expect(context.foundWords).toEqual([]);
      expect(context.letters).not.toEqual(initialLetters);

      actor.stop();
    });
  });
});
