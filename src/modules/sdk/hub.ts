import type { ServerResponse } from 'node:http';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('sdk:hub');

export type SdkEvent =
  | { type: 'config'; guildId: string; values: unknown; permissions: unknown; revision: number }
  | { type: 'profile'; profile: unknown; revision: number }
  | { type: 'revoked' };

type Listener = (event: SdkEvent) => void;

class SdkHub {
  private streams = new Map<number, Set<ServerResponse>>();
  private listeners = new Map<number, Set<Listener>>();

  addStream(botId: number, res: ServerResponse): void {
    if (!this.streams.has(botId)) this.streams.set(botId, new Set());
    this.streams.get(botId)!.add(res);
  }

  removeStream(botId: number, res: ServerResponse): boolean {
    const set = this.streams.get(botId);
    set?.delete(res);
    if (set && !set.size) this.streams.delete(botId);
    return this.isConnected(botId);
  }

  subscribe(botId: number, fn: Listener): () => void {
    if (!this.listeners.has(botId)) this.listeners.set(botId, new Set());
    this.listeners.get(botId)!.add(fn);
    return () => this.listeners.get(botId)?.delete(fn);
  }

  isConnected(botId: number): boolean {
    return (this.streams.get(botId)?.size ?? 0) > 0 || (this.listeners.get(botId)?.size ?? 0) > 0;
  }

  send(botId: number, event: SdkEvent): void {
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const res of this.streams.get(botId) ?? []) {
      try {
        res.write(payload);
      } catch (err) {
        log.debug(`Nie udało się wysłać zdarzenia do bota #${botId}`, err);
      }
    }
    for (const fn of this.listeners.get(botId) ?? []) {
      try {
        fn(event);
      } catch (err) {
        log.error(`Błąd słuchacza SDK bota #${botId}`, err);
      }
    }
  }

  closeStreams(botId: number): void {
    for (const res of this.streams.get(botId) ?? []) {
      try {
        res.write(`event: revoked\ndata: {"type":"revoked"}\n\n`);
        res.end();
      } catch {
        /* już zamknięte */
      }
    }
    this.streams.delete(botId);
  }

  keepAlive(): void {
    for (const set of this.streams.values()) {
      for (const res of set) {
        try {
          res.write(': ping\n\n');
        } catch {
          /* rozłączony – usunie go zdarzenie close */
        }
      }
    }
  }
}

export const sdkHub = new SdkHub();
