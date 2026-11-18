import type { Client } from 'discord.js';

export interface HeartbeatOptions {
  /** Adres z /monitoring na serwerze zxCode. Domyślnie process.env.ZXCODE_HEARTBEAT_URL. */
  url?: string;
  /** Wersja bota pokazywana na tablicy statusu. Domyślnie z package.json. */
  version?: string;
  /** Co ile ms wysyłać heartbeat (min. 15000, domyślnie 60000). */
  interval?: number;
  /** Wypisuje każde zgłoszenie w konsoli. */
  debug?: boolean;
  /** Wywoływane przy pierwszym błędzie z serii (zamiast console.warn). */
  onError?: (error: Error) => void;
}

export interface HeartbeatController {
  /** Wysyła heartbeat od razu. Zwraca true, gdy serwer go przyjął. */
  beat(): Promise<boolean>;
  /** Zatrzymuje wysyłanie. */
  stop(): void;
  readonly running: boolean;
}

export declare function heartbeat(client: Client, options?: HeartbeatOptions): HeartbeatController;
export default heartbeat;
