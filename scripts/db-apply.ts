import 'dotenv/config';
import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Ustaw DATABASE_URL w .env');
  process.exit(1);
}

const dir = path.resolve(process.cwd(), 'prisma', 'migrations');
const names = (await readdir(dir, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const db = new pg.Client({ connectionString: url });
await db.connect();

const exists = async (table: string) =>
  (await db.query<{ t: string | null }>('SELECT to_regclass($1) AS t', [`public."${table}"`])).rows[0]?.t !=
  null;

const hadTable = await exists('_prisma_migrations');
await db.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) PRIMARY KEY NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMPTZ,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
)`);

const record = (name: string, checksum: string) =>
  db.query(
    `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count)
     VALUES ($1, $2, now(), $3, 1)`,
    [randomUUID(), checksum, name],
  );

const sqlOf = async (name: string) => {
  const sql = await readFile(path.join(dir, name, 'migration.sql'), 'utf8');
  return { sql, checksum: createHash('sha256').update(sql).digest('hex') };
};

if (!hadTable && names[0] && (await exists('GuildConfig'))) {
  const { checksum } = await sqlOf(names[0]);
  await record(names[0], checksum);
  console.log(`ℹ️  Tabele już istniały – oznaczam ${names[0]} jako wykonaną.`);
}

const applied = new Map(
  (
    await db.query<{ migration_name: string; checksum: string }>(
      'SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
    )
  ).rows.map((r) => [r.migration_name, r.checksum]),
);

let count = 0;
for (const name of names) {
  const { sql, checksum } = await sqlOf(name);
  const done = applied.get(name);
  if (done) {
    if (done !== checksum) console.warn(`⚠️  ${name}: plik zmienił się po wykonaniu migracji`);
    continue;
  }
  try {
    await db.query('BEGIN');
    await db.query(sql);
    await record(name, checksum);
    await db.query('COMMIT');
    console.log(`✅ ${name}`);
    count++;
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(`❌ ${name}: ${(err as Error).message}`);
    await db.end();
    process.exit(1);
  }
}

console.log(count ? `\nWgrano ${count} migracji.` : 'Baza jest aktualna.');
await db.end();
