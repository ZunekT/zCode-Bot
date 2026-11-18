import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../db/prisma.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('db-check');

/** Sprawdza, czy wszystkie migracje z prisma/migrations są wykonane. Zwraca listę brakujących. */
export async function findPendingMigrations(): Promise<string[]> {
  const dir = path.resolve(process.cwd(), 'prisma', 'migrations');
  const names = (await readdir(dir, { withFileTypes: true }).catch(() => []))
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let applied: Set<string>;
  try {
    const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    applied = new Set(rows.map((r) => r.migration_name));
  } catch {
    applied = new Set();
  }
  return names.filter((n) => !applied.has(n)).sort();
}

/** Zatrzymuje start, jeśli baza nie jest zaktualizowana – zamiast błędów przy pierwszej komendzie. */
export async function assertDatabaseUpToDate(): Promise<void> {
  const pending = await findPendingMigrations();
  if (pending.length === 0) return;
  log.error(
    `Baza nie jest aktualna – brakuje migracji: ${pending.join(', ')}\n` +
      '  • na komputerze / VPS:  npm run db:deploy\n' +
      '  • na Termuxie:          npm run db:apply',
  );
  process.exit(1);
}
