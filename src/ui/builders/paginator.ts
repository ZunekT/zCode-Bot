import type { ButtonBuilder } from 'discord.js';
import { button } from './buttons.js';

/**
 * Przyciski ◀ x/y ▶. customId: `${prefix}:${page}`.
 * Moduł rejestruje handler na `${prefix}` i dostaje numer strony w args.
 */
export function pageButtons(prefix: string, page: number, totalPages: number): ButtonBuilder[] {
  const last = Math.max(totalPages - 1, 0);
  return [
    button(`${prefix}:${Math.max(page - 1, 0)}:prev`, '◀', { disabled: page <= 0 }),
    button(`${prefix}:${page}:noop`, `${page + 1} / ${last + 1}`, { disabled: true }),
    button(`${prefix}:${Math.min(page + 1, last)}:next`, '▶', { disabled: page >= last }),
  ];
}

export function paginate<T>(items: T[], page: number, perPage: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  return {
    items: items.slice(safePage * perPage, safePage * perPage + perPage),
    page: safePage,
    totalPages,
  };
}
