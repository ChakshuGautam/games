/**
 * Tests for Pangram game mechanics (pure functions)
 */

import { describe, it, expect } from 'vitest';
import {
  isPangram,
  usesOnlyAvailableLetters,
  containsCenterLetter,
  validateWordRules,
  calculateWordScore,
  getWordStats,
  getPuzzle,
  createCustomPuzzle,
} from './mechanics.js';

describe('isPangram', () => {
  const letters = ['R', 'A', 'C', 'K', 'I', 'N', 'G'];

  it('returns true for word using all 7 letters', () => {
    expect(isPangram('racking', letters)).toBe(true);
    expect(isPangram('CRACKING', letters)).toBe(true);
  });

  it('returns false for word missing letters', () => {
    expect(isPangram('rack', letters)).toBe(false);
    expect(isPangram('king', letters)).toBe(false);
  });
});

describe('usesOnlyAvailableLetters', () => {
  const letters = ['R', 'A', 'C', 'K', 'I', 'N', 'G'];

  it('returns true for valid words', () => {
    expect(usesOnlyAvailableLetters('rack', letters)).toBe(true);
    expect(usesOnlyAvailableLetters('KING', letters)).toBe(true);
  });

  it('returns false for words with invalid letters', () => {
    expect(usesOnlyAvailableLetters('racket', letters)).toBe(false); // 'e' and 't' not available
    expect(usesOnlyAvailableLetters('kings', letters)).toBe(false); // 's' not available
  });
});

describe('containsCenterLetter', () => {
  it('returns true when word contains center letter', () => {
    expect(containsCenterLetter('rack', 'k')).toBe(true);
    expect(containsCenterLetter('KING', 'K')).toBe(true);
  });

  it('returns false when word missing center letter', () => {
    expect(containsCenterLetter('rain', 'k')).toBe(false);
    expect(containsCenterLetter('RACING', 'K')).toBe(false);
  });
});

describe('validateWordRules', () => {
  const letters = ['R', 'A', 'C', 'K', 'I', 'N', 'G'];
  const centerLetter = 'K';

  it('accepts valid 4+ letter word with center letter', () => {
    const result = validateWordRules('rack', letters, centerLetter, []);
    expect(result).toEqual({ valid: true });
  });

  it('rejects words shorter than 4 letters', () => {
    const result = validateWordRules('ark', letters, centerLetter, []);
    expect(result.valid).toBe(false);
    expect((result as { reason: string }).reason).toContain('Too short');
  });

  it('rejects words missing center letter', () => {
    const result = validateWordRules('rain', letters, centerLetter, []);
    expect(result.valid).toBe(false);
    expect((result as { reason: string }).reason).toContain('center letter');
  });

  it('rejects words with unavailable letters', () => {
    const result = validateWordRules('racket', letters, centerLetter, []);
    expect(result.valid).toBe(false);
    expect((result as { reason: string }).reason).toContain('not in the puzzle');
  });

  it('rejects already found words', () => {
    const result = validateWordRules('rack', letters, centerLetter, ['rack']);
    expect(result.valid).toBe(false);
    expect((result as { reason: string }).reason).toContain('Already found');
  });
});

describe('calculateWordScore', () => {
  const letters = ['R', 'A', 'C', 'K', 'I', 'N', 'G'];

  it('scores 4-letter words as 1 point', () => {
    expect(calculateWordScore('rack', letters)).toBe(1);
    expect(calculateWordScore('king', letters)).toBe(1);
  });

  it('scores 5+ letter words as length points', () => {
    expect(calculateWordScore('crack', letters)).toBe(5);
    expect(calculateWordScore('raking', letters)).toBe(6);
  });

  it('adds 7 bonus points for pangrams', () => {
    expect(calculateWordScore('racking', letters)).toBe(7 + 7); // 7 letters + 7 bonus
    expect(calculateWordScore('cracking', letters)).toBe(8 + 7); // 8 letters + 7 bonus
  });
});

describe('getWordStats', () => {
  const letters = ['R', 'A', 'C', 'K', 'I', 'N', 'G'];

  it('calculates correct stats for found words', () => {
    const foundWords = ['rack', 'king', 'racking'];
    const stats = getWordStats(foundWords, letters);

    expect(stats.totalWords).toBe(3);
    expect(stats.totalPangrams).toBe(1);
    expect(stats.averageLength).toBe(5); // (4 + 4 + 7) / 3
  });

  it('handles empty word list', () => {
    const stats = getWordStats([], letters);
    expect(stats.totalWords).toBe(0);
    expect(stats.totalPangrams).toBe(0);
    expect(stats.averageLength).toBe(0);
  });
});

describe('getPuzzle', () => {
  it('returns puzzle by index', () => {
    const puzzle = getPuzzle(0);
    expect(puzzle.letters).toHaveLength(7);
    expect(puzzle.letters).toContain(puzzle.centerLetter);
  });

  it('wraps around for out of bounds index', () => {
    const puzzle0 = getPuzzle(0);
    const puzzle10 = getPuzzle(10); // Should wrap to 0
    expect(puzzle0).toEqual(puzzle10);
  });
});

describe('createCustomPuzzle', () => {
  it('creates valid custom puzzle', () => {
    const result = createCustomPuzzle(['A', 'B', 'C', 'D', 'E', 'F', 'G'], 'A');
    expect(result).toEqual({
      letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      centerLetter: 'A',
    });
  });

  it('rejects puzzle without 7 letters', () => {
    const result = createCustomPuzzle(['A', 'B', 'C'], 'A');
    expect(result).toEqual({ error: 'Must have exactly 7 letters' });
  });

  it('rejects puzzle where center not in letters', () => {
    const result = createCustomPuzzle(['A', 'B', 'C', 'D', 'E', 'F', 'G'], 'Z');
    expect(result).toEqual({ error: 'Center letter must be one of the 7 letters' });
  });

  it('rejects puzzle with duplicate letters', () => {
    const result = createCustomPuzzle(['A', 'A', 'C', 'D', 'E', 'F', 'G'], 'A');
    expect(result).toEqual({ error: 'All 7 letters must be unique' });
  });
});
