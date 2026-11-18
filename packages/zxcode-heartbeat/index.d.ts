import type { Client } from 'discord.js';

export interface HeartbeatOptions {
  url?: string;
  version?: string;
  interval?: number;
  debug?: boolean;
  onError?: (error: Error) => void;
}

export interface HeartbeatController {
  beat(): Promise<boolean>;
  stop(): void;
  readonly running: boolean;
}

export declare function heartbeat(client: Client, options?: HeartbeatOptions): HeartbeatController;
export default heartbeat;
