/**
 * Wgrywa paczkę emotek (assets/emojis/*.png) jako Application Emojis.
 * Pomija emotki, które już istnieją. Dodaj --force, żeby podmienić istniejące.
 *
 * npm run emojis:sync [-- --force]
 */
import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { REST, Routes, type RESTGetAPIApplicationEmojisResult } from 'discord.js';

const token = process.env.DISCORD_TOKEN;
const appId = process.env.DISCORD_CLIENT_ID;
if (!token || !appId) {
  console.error('Ustaw DISCORD_TOKEN i DISCORD_CLIENT_ID w .env');
  process.exit(1);
}

const force = process.argv.includes('--force');
const dir = path.resolve(process.cwd(), 'assets', 'emojis');
const rest = new REST().setToken(token);

const existing = (await rest.get(Routes.applicationEmojis(appId))) as RESTGetAPIApplicationEmojisResult;
const byName = new Map(existing.items.map((e) => [e.name, e]));

const files = (await readdir(dir)).filter((f) => f.endsWith('.png')).sort();
let created = 0;
let skipped = 0;

for (const file of files) {
  const name = path.basename(file, '.png');
  if (!/^[a-z0-9_]{2,32}$/.test(name)) {
    console.warn(`⚠️  Pomijam ${file} – nazwa musi mieć 2–32 znaki [a-z0-9_]`);
    continue;
  }

  const current = byName.get(name);
  if (current && !force) {
    skipped++;
    continue;
  }
  if (current?.id && force) await rest.delete(Routes.applicationEmoji(appId, current.id));

  const image = `data:image/png;base64,${(await readFile(path.join(dir, file))).toString('base64')}`;
  await rest.post(Routes.applicationEmojis(appId), { body: { name, image } });
  created++;
  console.log(`✅ ${name}`);
}

console.log(`\nGotowe: wgrano ${created}, pominięto ${skipped} (już istniały).`);
console.log('Bot wczyta emotki automatycznie przy następnym starcie.');
