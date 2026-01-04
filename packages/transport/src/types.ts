/**
 * Transport interface for game communication
 */

import type { JsonRpcMessage } from '@game-bench/protocol';

/**
 * Abstract transport interface
 * All transports (stdio, WebSocket, HTTP, in-process) implement this
 */
export interface Transport {
  /** Send a message */
  send(message: JsonRpcMessage): Promise<void>;

  /** Register message handler */
  onMessage(handler: (message: JsonRpcMessage) => void): void;

  /** Connect (optional - some transports are always connected) */
  connect?(): Promise<void>;

  /** Disconnect */
  disconnect?(): Promise<void>;

  /** Check connection status */
  isConnected(): boolean;

  /** Register error handler */
  onError?(handler: (error: Error) => void): void;

  /** Register close handler */
  onClose?(handler: () => void): void;
}

/**
 * Transport factory options
 */
export interface TransportOptions {
  /** Connection timeout in ms */
  timeout?: number;

  /** Enable debug logging */
  debug?: boolean;
}
