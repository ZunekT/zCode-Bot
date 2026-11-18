import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, '..', 'assets');
if (!existsSync(assets)) {
  console.log('Brak ../assets – pomijam (obraz Dockera kopiuje je sam).');
  process.exit(0);
}
mkdirSync(join(root, 'public'), { recursive: true });
cpSync(join(assets, 'emojis'), join(root, 'public', 'emojis'), { recursive: true });
cpSync(join(assets, 'branding'), join(root, 'public', 'branding'), { recursive: true });
console.log('Skopiowano emotki i grafiki do public/');
