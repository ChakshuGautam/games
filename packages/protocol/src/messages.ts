/**
 * JSON-RPC 2.0 protocol types for game communication
 * Follows MCP (Model Context Protocol) patterns
 */

export const JSONRPC_VERSION = '2.0' as const;

export type RequestId = string | number;

// ============================================================================
// Base JSON-RPC Types
// ============================================================================

export interface JsonRpcRequest<TMethod extends string = string, TParams = unknown> {
  jsonrpc: typeof JSONRPC_VERSION;
  id: RequestId;
  method: TMethod;
  params?: TParams;
}

export interface JsonRpcNotification<TMethod extends string = string, TParams = unknown> {
  jsonrpc: typeof JSONRPC_VERSION;
  method: TMethod;
  params?: TParams;
}

export interface JsonRpcSuccessResponse<TResult = unknown> {
  jsonrpc: typeof JSONRPC_VERSION;
  id: RequestId;
  result: TResult;
}

export interface JsonRpcErrorResponse {
  jsonrpc: typeof JSONRPC_VERSION;
  id: RequestId | null;
  error: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export type JsonRpcResponse<TResult = unknown> =
  | JsonRpcSuccessResponse<TResult>
  | JsonRpcErrorResponse;

export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcResponse;

// ============================================================================
// Standard Error Codes
// ============================================================================

export const ErrorCodes = {
  // JSON-RPC standard errors
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,

  // Game-specific errors (-32000 to -32099)
  GameNotFound: -32000,
  InvalidAction: -32001,
  ActionNotAllowed: -32002,
  GameNotStarted: -32003,
  GameAlreadyEnded: -32004,
  SessionNotFound: -32005,
  InvalidPlayer: -32006,
  TurnTimeout: -32007,
  ValidationFailed: -32008,
} as const;

// ============================================================================
// Lifecycle Methods
// ============================================================================

export interface InitializeParams {
  clientInfo?: {
    name: string;
    version: string;
  };
  capabilities?: ClientCapabilities;
}

export interface ClientCapabilities {
  supportsAsync?: boolean;
  supportsStreaming?: boolean;
}

export interface InitializeResult {
  serverInfo: {
    name: string;
    version: string;
  };
  capabilities: ServerCapabilities;
}

export interface ServerCapabilities {
  games: string[];
  supportsReplay?: boolean;
  supportsSpectate?: boolean;
}

// ============================================================================
// Game Discovery Methods
// ============================================================================

export interface ListGamesResult {
  games: GameSummary[];
}

export interface GameSummary {
  id: string;
  name: string;
  description: string;
  category: 'word' | 'puzzle' | 'logic' | 'strategy';
  timing: 'turn-based' | 'real-time' | 'timed-turns';
}

export interface GetGameSpecParams {
  gameId: string;
}

// ============================================================================
// Session Methods
// ============================================================================

export interface CreateSessionParams {
  gameId: string;
  config?: Record<string, unknown>;
  seed?: number;
}

export interface CreateSessionResult {
  sessionId: string;
  observation: Observation;
}

export interface JoinSessionParams {
  sessionId: string;
  playerInfo?: { name: string };
}

export interface JoinSessionResult {
  playerId: string;
  observation: Observation;
}

// ============================================================================
// Gameplay Methods
// ============================================================================

export interface GetObservationParams {
  sessionId: string;
}

export interface GetObservationResult {
  observation: Observation;
}

export interface SubmitActionParams {
  sessionId: string;
  action: GameAction;
}

export interface SubmitActionResult {
  observation: Observation;
  reward: number;
  terminated: boolean;
  truncated: boolean;
  info: Record<string, unknown>;
}

export interface GetValidActionsParams {
  sessionId: string;
}

export interface GetValidActionsResult {
  actions: GameAction[];
  actionMask?: boolean[];
}

// ============================================================================
// Observations and Actions
// ============================================================================

export interface Observation {
  /** Current game state visible to the player */
  state: Record<string, unknown>;

  /** Step number in the game */
  step: number;

  /** Timestamp of this observation */
  timestamp: number;

  /** Current player ID (for multiplayer games) */
  currentPlayer?: string;

  /** Whether it's this player's turn to act */
  isMyTurn: boolean;

  /** Current game phase */
  phase: 'waiting' | 'active' | 'paused' | 'ended';

  /** Optional flat numeric representation for ML agents */
  vector?: number[];

  /** Optional natural language description for LLM agents */
  text?: string;
}

export interface GameAction {
  /** Action type identifier */
  type: string;

  /** Action-specific payload */
  payload?: unknown;
}

export interface GameResult {
  /** Winner player ID (null for draw or no-winner games) */
  winner?: string;

  /** Final scores per player */
  scores: Record<string, number>;

  /** How the game ended */
  reason: 'completed' | 'forfeit' | 'timeout' | 'error';

  /** Additional game-specific statistics */
  stats?: Record<string, unknown>;
}

// ============================================================================
// Notifications (Server -> Client)
// ============================================================================

export interface StateChangedNotification {
  sessionId: string;
  observation: Observation;
  source: 'action' | 'timer' | 'opponent' | 'system';
}

export interface GameEndedNotification {
  sessionId: string;
  result: GameResult;
}

export interface TurnNotification {
  sessionId: string;
  currentPlayer: string;
  timeRemaining?: number;
}

// ============================================================================
// Method Type Map
// ============================================================================

export interface ProtocolMethods {
  // Lifecycle
  'initialize': { params: InitializeParams; result: InitializeResult };
  'shutdown': { params: void; result: void };

  // Discovery
  'games/list': { params: void; result: ListGamesResult };
  'games/getSpec': { params: GetGameSpecParams; result: { spec: GameSpecification } };

  // Sessions
  'session/create': { params: CreateSessionParams; result: CreateSessionResult };
  'session/join': { params: JoinSessionParams; result: JoinSessionResult };
  'session/leave': { params: { sessionId: string }; result: void };

  // Gameplay
  'game/observe': { params: GetObservationParams; result: GetObservationResult };
  'game/act': { params: SubmitActionParams; result: SubmitActionResult };
  'game/validActions': { params: GetValidActionsParams; result: GetValidActionsResult };
  'game/reset': { params: { sessionId: string }; result: CreateSessionResult };
}

// Import GameSpecification type
import type { GameSpecification } from './game-spec.js';

// ============================================================================
// Helper Functions
// ============================================================================

export function createRequest<M extends keyof ProtocolMethods>(
  id: RequestId,
  method: M,
  params: ProtocolMethods[M]['params']
): JsonRpcRequest<M, ProtocolMethods[M]['params']> {
  return {
    jsonrpc: JSONRPC_VERSION,
    id,
    method,
    params,
  };
}

export function createSuccessResponse<T>(id: RequestId, result: T): JsonRpcSuccessResponse<T> {
  return {
    jsonrpc: JSONRPC_VERSION,
    id,
    result,
  };
}

export function createErrorResponse(
  id: RequestId | null,
  code: number,
  message: string,
  data?: unknown
): JsonRpcErrorResponse {
  return {
    jsonrpc: JSONRPC_VERSION,
    id,
    error: { code, message, data },
  };
}

export function createNotification<M extends string, P>(
  method: M,
  params: P
): JsonRpcNotification<M, P> {
  return {
    jsonrpc: JSONRPC_VERSION,
    method,
    params,
  };
}

export function isRequest(msg: JsonRpcMessage): msg is JsonRpcRequest {
  return 'id' in msg && 'method' in msg;
}

export function isNotification(msg: JsonRpcMessage): msg is JsonRpcNotification {
  return !('id' in msg) && 'method' in msg;
}

export function isResponse(msg: JsonRpcMessage): msg is JsonRpcResponse {
  return 'id' in msg && ('result' in msg || 'error' in msg);
}

export function isErrorResponse(msg: JsonRpcResponse): msg is JsonRpcErrorResponse {
  return 'error' in msg;
}
