/**
 * Pangram Game XState Machine
 * Proper XState v5 implementation
 */

import { setup, assign, fromPromise } from 'xstate';
import {
  getPuzzle,
  isPangram,
  validateWordRules,
  validateWordDictionary,
  calculateWordScore,
  type Puzzle,
} from './mechanics.js';

// ============================================================================
// Types
// ============================================================================

export interface PangramContext {
  letters: string[];
  centerLetter: string;
  currentInput: string;
  foundWords: string[];
  score: number;
  lastMessage: string;
  lastMessageType: 'info' | 'success' | 'error' | 'pangram';
  puzzleIndex: number;
}

export type PangramEvent =
  | { type: 'ADD_LETTER'; letter: string }
  | { type: 'DELETE_LETTER' }
  | { type: 'CLEAR' }
  | { type: 'SUBMIT' }
  | { type: 'SUBMIT_WORD'; word: string }  // Consolidated event for agents
  | { type: 'NEW_PUZZLE' };

type ValidationResult =
  | { valid: false; reason: string }
  | { valid: true; word: string; points: number; isPangram: boolean; message: string };

// ============================================================================
// Machine Setup
// ============================================================================

export const pangramMachine = setup({
  types: {
    context: {} as PangramContext,
    events: {} as PangramEvent,
    input: {} as { puzzleIndex?: number },
  },
  actions: {
    addLetter: assign(({ context, event }) => {
      if (event.type !== 'ADD_LETTER') return {};
      const letter = event.letter.toUpperCase();
      if (context.letters.includes(letter)) {
        return {
          currentInput: context.currentInput + letter,
          lastMessage: '',
        };
      }
      return {};
    }),
    deleteLetter: assign(({ context }) => {
      if (context.currentInput.length === 0) return {};  // No-op if empty
      return {
        currentInput: context.currentInput.slice(0, -1),
        lastMessage: '',
      };
    }),
    clearInput: assign({
      currentInput: '',
      lastMessage: '',
    }),
    setWord: assign(({ context, event }) => {
      if (event.type !== 'SUBMIT_WORD') return {};
      // Filter to only valid letters and uppercase
      const validWord = event.word
        .toUpperCase()
        .split('')
        .filter(letter => context.letters.includes(letter))
        .join('');
      return { currentInput: validWord };
    }),
    setValidationError: assign((_, params: { message: string }) => ({
      currentInput: '',
      lastMessage: params.message,
      lastMessageType: 'error' as const,
    })),
    recordValidWord: assign(({ context }, params: { word: string; points: number; message: string; isPangram: boolean }) => ({
      foundWords: [...context.foundWords, params.word].sort(),
      score: context.score + params.points,
      currentInput: '',
      lastMessage: params.message,
      lastMessageType: (params.isPangram ? 'pangram' : 'success') as 'pangram' | 'success',
    })),
    resetForNewPuzzle: assign(({ context }) => {
      const puzzle = getPuzzle(context.puzzleIndex + 1);
      return {
        letters: puzzle.letters,
        centerLetter: puzzle.centerLetter,
        currentInput: '',
        foundWords: [] as string[],
        score: 0,
        lastMessage: '',
        lastMessageType: 'info' as const,
        puzzleIndex: (context.puzzleIndex + 1) % 10,
      };
    }),
  },
  guards: {
    isValidWord: ({ event }) => {
      const result = (event as unknown as { output: ValidationResult }).output;
      return result.valid === true;
    },
  },
  actors: {
    validateWord: fromPromise(async ({ input }: { input: {
      word: string;
      letters: string[];
      centerLetter: string;
      foundWords: string[];
    }}): Promise<ValidationResult> => {
      const { word, letters, centerLetter, foundWords } = input;

      // Check basic rules first
      const rulesResult = validateWordRules(word, letters, centerLetter, foundWords);
      if (!rulesResult.valid) {
        return { valid: false, reason: rulesResult.reason };
      }

      // Check dictionary
      const isValidWord = await validateWordDictionary(word);
      if (!isValidWord) {
        return { valid: false, reason: 'Not a valid English word' };
      }

      // Word is valid - calculate score
      const normalizedWord = word.toLowerCase();
      const points = calculateWordScore(normalizedWord, letters);
      const isWordPangram = isPangram(normalizedWord, letters);

      return {
        valid: true,
        word: normalizedWord,
        points,
        isPangram: isWordPangram,
        message: isWordPangram
          ? `PANGRAM! +${points} points!`
          : `+${points} point${points > 1 ? 's' : ''}`,
      };
    }),
  },
}).createMachine({
  id: 'pangram',
  initial: 'playing',
  context: ({ input }) => {
    const puzzleIndex = input?.puzzleIndex ?? 0;
    const puzzle = getPuzzle(puzzleIndex);
    return {
      letters: puzzle.letters,
      centerLetter: puzzle.centerLetter,
      currentInput: '',
      foundWords: [],
      score: 0,
      lastMessage: '',
      lastMessageType: 'info' as const,
      puzzleIndex,
    };
  },
  states: {
    playing: {
      on: {
        ADD_LETTER: {
          actions: 'addLetter',  // Silently ignores invalid letters
        },
        DELETE_LETTER: {
          actions: 'deleteLetter',  // No-op if empty
        },
        CLEAR: {
          actions: 'clearInput',
        },
        SUBMIT: [
          {
            guard: ({ context }) => context.currentInput.length >= 4,
            target: 'validating',
          },
          {
            actions: assign({
              lastMessage: 'Word must be at least 4 letters',
              lastMessageType: 'error' as const,
            }),
          },
        ],
        SUBMIT_WORD: [
          {
            guard: ({ context, event }) => {
              if (event.type !== 'SUBMIT_WORD') return false;
              const validLetters = event.word
                .toUpperCase()
                .split('')
                .filter(l => context.letters.includes(l));
              return validLetters.length >= 4;
            },
            actions: 'setWord',
            target: 'validating',
          },
          {
            actions: assign({
              lastMessage: 'Word must be at least 4 valid letters',
              lastMessageType: 'error' as const,
            }),
          },
        ],
        NEW_PUZZLE: {
          actions: 'resetForNewPuzzle',
        },
      },
    },
    validating: {
      invoke: {
        src: 'validateWord',
        input: ({ context }) => ({
          word: context.currentInput,
          letters: context.letters,
          centerLetter: context.centerLetter,
          foundWords: context.foundWords,
        }),
        onDone: [
          {
            guard: 'isValidWord',
            target: 'playing',
            actions: assign(({ context, event }) => {
              const result = event.output as ValidationResult;
              if (result.valid) {
                return {
                  foundWords: [...context.foundWords, result.word].sort(),
                  score: context.score + result.points,
                  currentInput: '',
                  lastMessage: result.message,
                  lastMessageType: (result.isPangram ? 'pangram' : 'success') as 'pangram' | 'success',
                };
              }
              return {};
            }),
          },
          {
            target: 'playing',
            actions: assign(({ event }) => {
              const result = event.output as ValidationResult;
              return {
                currentInput: '',
                lastMessage: result.valid ? '' : result.reason,
                lastMessageType: 'error' as const,
              };
            }),
          },
        ],
        onError: {
          target: 'playing',
          actions: assign({
            currentInput: '',
            lastMessage: 'Failed to validate word',
            lastMessageType: 'error' as const,
          }),
        },
      },
    },
  },
});

// Export types for consumers
export type PangramMachine = typeof pangramMachine;
