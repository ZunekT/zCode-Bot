import { EventEmitter } from 'node:events';

export interface GithubEventMap {
  release: [payload: Record<string, unknown>];
  push: [payload: Record<string, unknown>];
  issues: [payload: Record<string, unknown>];
  ping: [payload: Record<string, unknown>];
}

export const githubEvents = new EventEmitter<GithubEventMap>();
