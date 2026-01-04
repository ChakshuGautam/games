/**
 * Base game engine types and utilities
 * Provides common patterns for game implementation
 */

import type {
  Observation,
  GameAction,
  GameResult,
  GameSpecification,
  GameInstance,
} from '@game-bench/protocol';

// ============================================================================
// Base Context and Events
// ============================================================================

/**
 * Base context that all games extend
 */
export interface BaseGameContext {
  /** Current step/turn number */
  step: number;

  /** Game start timestamp */
  startTime: number;

  /** List of player IDs */
  players: string[];

  /** Index of current player (for turn-based games) */
  currentPlayerIndex: number;

  /** History of all actions for replay */
  actionHistory: Array<{
    player: string;
    action: GameAction;
    timestamp: number;
    step: number;
  }>;

  /** Game configuration */
  config: Record<string, unknown>;

  /** Random seed for reproducibility */
  seed?: number;

  /** Last error message */
  lastError: string | null;
}

/**
 * Base events that all games handle
 */
export type BaseGameEvent =
  | { type: 'game.start' }
  | { type: 'game.action'; playerId: string; action: GameAction }
  | { type: 'game.timeout' }
  | { type: 'game.forfeit'; playerId: string }
  | { type: 'game.reset'; config?: Record<string, unknown>; seed?: number };

// ============================================================================
// Game Machine Configuration
// ============================================================================

/**
 * Configuration for creating a game
 */
export interface GameMachineConfig<TContext extends BaseGameContext> {
  /** Unique game ID */
  id: string;

  /** Create initial context from config and seed */
  createInitialContext: (config: Record<string, unknown>, seed?: number) => TContext;

  /** Validate if an action is legal in the current state */
  validateAction: (context: TContext, action: GameAction, playerId: string) => boolean;

  /** Apply an action and return context updates */
  applyAction: (context: TContext, action: GameAction, playerId: string) => Partial<TContext>;

  /** Check if the game has reached a terminal state */
  isTerminal: (context: TContext) => boolean;

  /** Calculate the final result */
  calculateResult: (context: TContext) => GameResult;

  /** Generate observation for a player */
  getObservation: (context: TContext, playerId?: string) => Observation;

  /** Calculate reward for the last action (for RL agents) */
  calculateReward: (
    context: TContext,
    action: GameAction,
    prevContext: TContext
  ) => number;

  /** Get the next player index (for turn-based games) */
  getNextPlayer: (context: TContext) => number;

  /** Get list of valid actions in current state */
  getValidActions?: (context: TContext, playerId?: string) => GameAction[];

  /** Optional async action processor (e.g., for API validation) */
  processActionAsync?: (
    context: TContext,
    action: GameAction,
    playerId: string
  ) => Promise<{ valid: boolean; updates?: Partial<TContext>; error?: string }>;
}

// ============================================================================
// Simple Game Engine (without XState dependency in types)
// ============================================================================

export type GamePhase = 'idle' | 'playing' | 'processing' | 'ended';

/**
 * Simple game engine class
 * Games can use this directly or wrap XState machines
 */
export class GameEngine<TContext extends BaseGameContext> implements GameInstance {
  private context: TContext;
  private config: GameMachineConfig<TContext>;
  private spec: GameSpecification;
  private phase: GamePhase = 'idle';
  private prevContext: TContext | null = null;
  private subscribers: Array<(observation: Observation) => void> = [];

  constructor(
    machineConfig: GameMachineConfig<TContext>,
    spec: GameSpecification,
    options: { config?: Record<string, unknown>; seed?: number } = {}
  ) {
    this.config = machineConfig;
    this.spec = spec;
    this.context = machineConfig.createInitialContext(options.config ?? {}, options.seed);
  }

  getSpec(): GameSpecification {
    return this.spec;
  }

  start(): void {
    if (this.phase === 'idle') {
      this.phase = 'playing';
      this.context = {
        ...this.context,
        startTime: Date.now(),
      };
      this.notifySubscribers();
    }
  }

  getObservation(playerId?: string): Observation {
    const obs = this.config.getObservation(this.context, playerId);
    return {
      ...obs,
      phase: this.phase === 'ended' ? 'ended' : this.phase === 'idle' ? 'waiting' : 'active',
      isMyTurn: this.phase === 'playing',
    };
  }

  getValidActions(playerId?: string): GameAction[] {
    if (this.phase !== 'playing' || !this.config.getValidActions) {
      return [];
    }
    return this.config.getValidActions(this.context, playerId);
  }

  async step(
    playerId: string,
    action: GameAction
  ): Promise<{
    observation: Observation;
    reward: number;
    terminated: boolean;
    truncated: boolean;
    info: Record<string, unknown>;
  }> {
    if (this.phase !== 'playing') {
      return {
        observation: this.getObservation(playerId),
        reward: 0,
        terminated: this.phase === 'ended',
        truncated: false,
        info: { error: 'Game not in playing state' },
      };
    }

    this.prevContext = { ...this.context };

    // Check if action is valid
    if (!this.config.validateAction(this.context, action, playerId)) {
      return {
        observation: this.getObservation(playerId),
        reward: 0,
        terminated: false,
        truncated: false,
        info: { error: 'Invalid action' },
      };
    }

    // Process async if needed
    if (this.config.processActionAsync) {
      this.phase = 'processing';
      this.notifySubscribers();

      try {
        const result = await this.config.processActionAsync(this.context, action, playerId);
        this.phase = 'playing';

        if (!result.valid) {
          this.context = {
            ...this.context,
            lastError: result.error ?? 'Action rejected',
            ...(result.updates ?? {}),
          } as TContext;
          this.notifySubscribers();

          return {
            observation: this.getObservation(playerId),
            reward: 0,
            terminated: false,
            truncated: false,
            info: { error: result.error },
          };
        }

        // Apply updates from async processor
        if (result.updates) {
          this.context = {
            ...this.context,
            ...result.updates,
            step: this.context.step + 1,
            lastError: null,
          } as TContext;
        }
      } catch (err) {
        this.phase = 'playing';
        this.context = {
          ...this.context,
          lastError: 'Processing failed',
        };
        this.notifySubscribers();

        return {
          observation: this.getObservation(playerId),
          reward: 0,
          terminated: false,
          truncated: false,
          info: { error: 'Processing failed' },
        };
      }
    } else {
      // Sync action processing
      const updates = this.config.applyAction(this.context, action, playerId);
      this.context = {
        ...this.context,
        ...updates,
        step: this.context.step + 1,
        currentPlayerIndex: this.config.getNextPlayer(this.context),
        lastError: null,
        actionHistory: [
          ...this.context.actionHistory,
          {
            player: playerId,
            action,
            timestamp: Date.now(),
            step: this.context.step,
          },
        ],
      } as TContext;
    }

    // Check for terminal state
    if (this.config.isTerminal(this.context)) {
      this.phase = 'ended';
    }

    const reward = this.config.calculateReward(this.context, action, this.prevContext);
    this.notifySubscribers();

    return {
      observation: this.getObservation(playerId),
      reward,
      terminated: this.phase === 'ended',
      truncated: false,
      info: {
        step: this.context.step,
      },
    };
  }

  reset(config?: Record<string, unknown>, seed?: number): Observation {
    this.context = this.config.createInitialContext(config ?? this.context.config, seed);
    this.phase = 'idle';
    this.prevContext = null;
    this.notifySubscribers();
    return this.getObservation();
  }

  isTerminated(): boolean {
    return this.phase === 'ended';
  }

  getResult(): GameResult | null {
    if (this.phase === 'ended') {
      return this.config.calculateResult(this.context);
    }
    return null;
  }

  /** Get the current context (for debugging/testing) */
  getContext(): TContext {
    return this.context;
  }

  /** Get the current phase */
  getPhase(): GamePhase {
    return this.phase;
  }

  /** Subscribe to state changes */
  subscribe(callback: (observation: Observation) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== callback);
    };
  }

  private notifySubscribers(): void {
    const observation = this.getObservation();
    this.subscribers.forEach(cb => cb(observation));
  }
}

// Re-export for convenience
export { assign, fromPromise, createActor } from 'xstate';
