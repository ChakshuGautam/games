/**
 * In-process transport for direct integration
 * Creates a pair of connected transports for client/server communication
 * within the same process (e.g., React app embedding game engine)
 */

import type { JsonRpcMessage } from '@game-bench/protocol';
import type { Transport, TransportOptions } from './types.js';

interface MessageQueue {
  messages: JsonRpcMessage[];
  handler: ((message: JsonRpcMessage) => void) | null;
}

/**
 * In-process transport implementation
 */
class InProcessTransport implements Transport {
  private sendQueue: MessageQueue;
  private receiveQueue: MessageQueue;
  private connected = true;
  private errorHandler: ((error: Error) => void) | null = null;
  private closeHandler: (() => void) | null = null;
  private options: TransportOptions;

  constructor(
    sendQueue: MessageQueue,
    receiveQueue: MessageQueue,
    options: TransportOptions = {}
  ) {
    this.sendQueue = sendQueue;
    this.receiveQueue = receiveQueue;
    this.options = options;
  }

  async send(message: JsonRpcMessage): Promise<void> {
    if (!this.connected) {
      throw new Error('Transport is not connected');
    }

    if (this.options.debug) {
      console.log('[in-process] send:', JSON.stringify(message));
    }

    // Use microtask to simulate async behavior
    queueMicrotask(() => {
      if (this.sendQueue.handler) {
        this.sendQueue.handler(message);
      } else {
        this.sendQueue.messages.push(message);
      }
    });
  }

  onMessage(handler: (message: JsonRpcMessage) => void): void {
    this.receiveQueue.handler = handler;

    // Deliver any queued messages
    while (this.receiveQueue.messages.length > 0) {
      const message = this.receiveQueue.messages.shift()!;
      queueMicrotask(() => handler(message));
    }
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.closeHandler?.();
  }

  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Create a pair of connected in-process transports
 * Returns [clientTransport, serverTransport]
 *
 * Messages sent on client are received by server and vice versa
 */
export function createInProcessTransportPair(
  options: TransportOptions = {}
): [Transport, Transport] {
  // Queue A: client sends -> server receives
  const queueA: MessageQueue = { messages: [], handler: null };

  // Queue B: server sends -> client receives
  const queueB: MessageQueue = { messages: [], handler: null };

  const clientTransport = new InProcessTransport(queueA, queueB, options);
  const serverTransport = new InProcessTransport(queueB, queueA, options);

  return [clientTransport, serverTransport];
}

/**
 * Create a direct bridge between a transport and a message handler
 * Useful for testing or simple integrations
 */
export function createDirectBridge(
  handler: (message: JsonRpcMessage) => Promise<JsonRpcMessage | null>
): Transport {
  let messageHandler: ((message: JsonRpcMessage) => void) | null = null;
  let connected = true;

  return {
    async send(message: JsonRpcMessage): Promise<void> {
      if (!connected) {
        throw new Error('Transport is not connected');
      }

      // Process message and get response
      const response = await handler(message);

      // If there's a response, deliver it
      if (response && messageHandler) {
        queueMicrotask(() => messageHandler!(response));
      }
    },

    onMessage(handler: (message: JsonRpcMessage) => void): void {
      messageHandler = handler;
    },

    async disconnect(): Promise<void> {
      connected = false;
    },

    isConnected(): boolean {
      return connected;
    },
  };
}
