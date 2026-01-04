/**
 * @game-bench/pangram
 *
 * Pangram word game implementation using XState.
 *
 * Architecture:
 * - machine.ts: XState state machine (single source of truth)
 * - mechanics.ts: Pure game logic (validation, scoring)
 * - ui/: React components
 *
 * Both human UI and agents use the same XState actor interface:
 *   actor.send({ type: 'ADD_LETTER', letter: 'A' })
 *   actor.send({ type: 'SUBMIT' })
 */

// Game mechanics (pure functions)
export {
  // Data
  PUZZLES,
  type Puzzle,
  // Validation
  isPangram,
  usesOnlyAvailableLetters,
  containsCenterLetter,
  validateWordRules,
  validateWordDictionary,
  // Scoring
  calculateWordScore,
  getWordStats,
  // Puzzle generation
  getPuzzle,
  getRandomPuzzle,
  createCustomPuzzle,
  // Text generation
  generateStateText,
} from './mechanics.js';

// XState machine (single source of truth for game state)
export {
  pangramMachine,
  type PangramContext,
  type PangramEvent,
  type PangramMachine,
} from './machine.js';
