/**
 * Game Specification types
 * Defines the contract for game implementations
 */

import type { Space } from './spaces.js';

/**
 * Complete specification for a game
 * This is returned by games/getSpec and used for documentation and validation
 */
export interface GameSpecification {
  /** Unique identifier for the game */
  id: string;

  /** Human-readable name */
  name: string;

  /** Semantic version */
  version: string;

  /** Short description of the game */
  description: string;

  /** Detailed rules documentation */
  rules: GameRules;

  /** Structure of observations players receive */
  observationSpace: Space;

  /** Structure of actions players can take */
  actionSpace: Space;

  /** Optional JSON Schema for game configuration */
  configSchema?: object;

  /** Timing configuration */
  timing: TimingConfig;

  /** Player configuration */
  players: PlayerConfig;

  /** Evaluation and benchmarking metadata */
  evaluation: EvaluationConfig;
}

/**
 * Game rules documentation
 */
export interface GameRules {
  /** Primary objective of the game */
  objective: string;

  /** Step-by-step instructions */
  howToPlay: string[];

  /** Scoring explanation */
  scoring: string;

  /** Constraints and restrictions */
  constraints: string[];
}

/**
 * Timing configuration for games
 */
export interface TimingConfig {
  /** Type of timing model */
  type: 'turn-based' | 'real-time' | 'timed-turns';

  /** Time limit per turn in milliseconds (for timed-turns) */
  turnTimeout?: number;

  /** Maximum game duration in milliseconds */
  gameTimeout?: number;

  /** Minimum time between actions in milliseconds (for real-time) */
  actionCooldown?: number;
}

/**
 * Player configuration
 */
export interface PlayerConfig {
  /** Minimum number of players */
  min: number;

  /** Maximum number of players */
  max: number;

  /** Whether the game supports teams */
  teams?: boolean;

  /** Whether players take sequential turns or act simultaneously */
  turnOrder?: 'sequential' | 'simultaneous';
}

/**
 * Evaluation and benchmarking configuration
 */
export interface EvaluationConfig {
  /** Metrics tracked for this game */
  metrics: string[];

  /** Difficulty level or variability */
  difficulty?: 'easy' | 'medium' | 'hard' | 'variable';

  /** Estimated game duration in minutes */
  estimatedDuration?: number;

  /** Whether the game is deterministic */
  deterministic?: boolean;

  /** Categories/tags for the game */
  tags?: string[];
}

/**
 * Runtime game instance interface
 * Implemented by the game engine
 */
export interface GameInstance {
  /** Get the game specification */
  getSpec(): GameSpecification;

  /** Get current observation for a player */
  getObservation(playerId?: string): import('./messages.js').Observation;

  /** Get list of valid actions for current state */
  getValidActions(playerId?: string): import('./messages.js').GameAction[];

  /** Apply an action and return the result */
  step(
    playerId: string,
    action: import('./messages.js').GameAction
  ): Promise<{
    observation: import('./messages.js').Observation;
    reward: number;
    terminated: boolean;
    truncated: boolean;
    info: Record<string, unknown>;
  }>;

  /** Reset the game to initial state */
  reset(config?: Record<string, unknown>, seed?: number): import('./messages.js').Observation;

  /** Check if the game has ended */
  isTerminated(): boolean;

  /** Get the final result (only valid after termination) */
  getResult(): import('./messages.js').GameResult | null;
}

/**
 * Game factory interface
 * Each game package exports this
 */
export interface GameFactory {
  /** The game specification */
  spec: GameSpecification;

  /** Create a new game instance */
  create(config?: Record<string, unknown>, seed?: number): GameInstance;
}
