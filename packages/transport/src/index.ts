/**
 * @game-bench/transport
 *
 * Transport adapters for the game-bench framework.
 * Provides stdio, in-process, and other transport implementations.
 */

// Types
export type { Transport, TransportOptions } from './types.js';

// stdio transport (for MCP-style communication)
export { StdioTransport, type StdioTransportOptions } from './stdio.js';

// In-process transport (for React/direct integration)
export { createInProcessTransportPair, createDirectBridge } from './in-process.js';
