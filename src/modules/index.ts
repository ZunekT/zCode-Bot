import type { BotModule } from '../core/types.js';
import { adminModule } from './admin/index.js';
import { faqModule } from './faq/index.js';
import { systemModule } from './system/index.js';
import { ticketsModule } from './tickets/index.js';

/**
 * Lista wszystkich modułów bota. Nowy moduł = nowy katalog w src/modules + wpis tutaj.
 * Kolejność ma znaczenie tylko dla logów przy starcie.
 */
export const modules: BotModule[] = [
  systemModule,
  adminModule,
  ticketsModule,
  faqModule,
  // logsModule,         – etap 1
  // verificationModule, – etap 1
];
