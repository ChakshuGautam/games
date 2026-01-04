/**
 * stdio transport for MCP-style communication
 * Reads JSON-RPC messages from stdin, writes to stdout
 */

import * as readline from 'node:readline';
import type { JsonRpcMessage } from '@game-bench/protocol';
import type { Transport, TransportOptions } from './types.js';

export interface StdioTransportOptions extends TransportOptions {
  /** Input stream (default: process.stdin) */
  input?: NodeJS.ReadableStream;

  /** Output stream (default: process.stdout) */
  output?: NodeJS.WritableStream;

  /** Prefix for logging (written to stderr) */
  logPrefix?: string;
}

export class StdioTransport implements Transport {
  private rl: readline.Interface | null = null;
  private messageHandler: ((message: JsonRpcMessage) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private closeHandler: (() => void) | null = null;
  private connected = false;
  private options: StdioTransportOptions;
  private input: NodeJS.ReadableStream;
  private output: NodeJS.WritableStream;

  constructor(options: StdioTransportOptions = {}) {
    this.options = options;
    this.input = options.input ?? process.stdin;
    this.output = options.output ?? process.stdout;
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    this.rl = readline.createInterface({
      input: this.input,
      terminal: false,
    });

    this.rl.on('line', (line) => {
      if (!line.trim()) return;

      try {
        const message = JSON.parse(line) as JsonRpcMessage;

        if (this.options.debug) {
          this.log('recv', line);
        }

        this.messageHandler?.(message);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (this.options.debug) {
          this.log('error', `Failed to parse: ${line}`);
        }
        this.errorHandler?.(error);
      }
    });

    this.rl.on('close', () => {
      this.connected = false;
      this.closeHandler?.();
    });

    this.rl.on('error', (err) => {
      this.errorHandler?.(err);
    });

    this.connected = true;
  }

  async send(message: JsonRpcMessage): Promise<void> {
    const json = JSON.stringify(message);

    if (this.options.debug) {
      this.log('send', json);
    }

    return new Promise((resolve, reject) => {
      this.output.write(json + '\n', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  onMessage(handler: (message: JsonRpcMessage) => void): void {
    this.messageHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  async disconnect(): Promise<void> {
    this.rl?.close();
    this.rl = null;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  private log(type: string, message: string): void {
    const prefix = this.options.logPrefix ?? '[transport]';
    process.stderr.write(`${prefix} ${type}: ${message}\n`);
  }
}
