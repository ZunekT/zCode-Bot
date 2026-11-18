import { env } from '../config/env.js';

const levels = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof levels;

const colors: Record<Level, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};

function write(level: Level, scope: string, message: string, extra?: unknown) {
  if (levels[level] < levels[env.LOG_LEVEL]) return;
  const time = new Date().toISOString();
  const line = `${colors[level]}${time} ${level.toUpperCase().padEnd(5)}\x1b[0m [${scope}] ${message}`;
  const out = level === 'error' || level === 'warn' ? console.error : console.log;
  if (extra !== undefined) out(line, extra);
  else out(line);
}

export interface Logger {
  debug(message: string, extra?: unknown): void;
  info(message: string, extra?: unknown): void;
  warn(message: string, extra?: unknown): void;
  error(message: string, extra?: unknown): void;
  child(scope: string): Logger;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (m, e) => write('debug', scope, m, e),
    info: (m, e) => write('info', scope, m, e),
    warn: (m, e) => write('warn', scope, m, e),
    error: (m, e) => write('error', scope, m, e),
    child: (sub) => createLogger(`${scope}:${sub}`),
  };
}

export const logger = createLogger('zxcode');
