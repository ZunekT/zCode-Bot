import { deployGuildCommands } from '../src/core/registry.js';
import { modules } from '../src/modules/index.js';

const count = await deployGuildCommands(modules);
console.log(`✅ Zarejestrowano ${count} komend.`);
process.exit(0);
