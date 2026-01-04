/**
 * @game-bench/engine
 *
 * Game engine for the game-bench framework.
 * Provides base types and game engine class.
 */

export {
  // Types
  type BaseGameContext,
  type BaseGameEvent,
  type GameMachineConfig,
  type GamePhase,
  // Engine
  GameEngine,
  // XState re-exports
  assign,
  fromPromise,
  createActor,
} from './base-machine.js';
