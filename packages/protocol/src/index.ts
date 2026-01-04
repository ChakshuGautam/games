/**
 * @game-bench/protocol
 *
 * Core protocol types for the game-bench framework.
 * Defines JSON-RPC messages, observation/action spaces, and game specifications.
 */

// JSON-RPC message types
export {
  JSONRPC_VERSION,
  ErrorCodes,
  // Base types
  type RequestId,
  type JsonRpcRequest,
  type JsonRpcNotification,
  type JsonRpcSuccessResponse,
  type JsonRpcErrorResponse,
  type JsonRpcError,
  type JsonRpcResponse,
  type JsonRpcMessage,
  // Lifecycle
  type InitializeParams,
  type InitializeResult,
  type ClientCapabilities,
  type ServerCapabilities,
  // Discovery
  type ListGamesResult,
  type GameSummary,
  type GetGameSpecParams,
  // Sessions
  type CreateSessionParams,
  type CreateSessionResult,
  type JoinSessionParams,
  type JoinSessionResult,
  // Gameplay
  type GetObservationParams,
  type GetObservationResult,
  type SubmitActionParams,
  type SubmitActionResult,
  type GetValidActionsParams,
  type GetValidActionsResult,
  // Core game types
  type Observation,
  type GameAction,
  type GameResult,
  // Notifications
  type StateChangedNotification,
  type GameEndedNotification,
  type TurnNotification,
  // Method map
  type ProtocolMethods,
  // Helper functions
  createRequest,
  createSuccessResponse,
  createErrorResponse,
  createNotification,
  isRequest,
  isNotification,
  isResponse,
  isErrorResponse,
} from './messages.js';

// Space types (Gym-like)
export {
  type Space,
  type DiscreteSpace,
  type BoxSpace,
  type MultiBinarySpace,
  type MultiDiscreteSpace,
  type TextSpace,
  type DictSpace,
  type TupleSpace,
  type SequenceSpace,
  // Utilities
  validateValue,
  sampleSpace,
  getSpaceSize,
} from './spaces.js';

// Game specification types
export {
  type GameSpecification,
  type GameRules,
  type TimingConfig,
  type PlayerConfig,
  type EvaluationConfig,
  type GameInstance,
  type GameFactory,
} from './game-spec.js';
