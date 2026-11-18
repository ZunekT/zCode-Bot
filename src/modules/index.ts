import type { BotModule } from '../core/types.js';
import { adminModule } from './admin/index.js';
import { announcementsModule } from './announcements/index.js';
import { changelogModule } from './changelog/index.js';
import { clientsModule } from './clients/index.js';
import { faqModule } from './faq/index.js';
import { logsModule } from './logs/index.js';
import { monitoringModule } from './monitoring/index.js';
import { ordersModule } from './orders/index.js';
import { portfolioModule } from './portfolio/index.js';
import { pricingModule } from './pricing/index.js';
import { remindersModule } from './reminders/index.js';
import { reviewsModule } from './reviews/index.js';
import { sdkModule } from './sdk/index.js';
import { statsModule } from './stats/index.js';
import { systemModule } from './system/index.js';
import { ticketsModule } from './tickets/index.js';
import { verificationModule } from './verification/index.js';

/**
 * Lista wszystkich modułów bota. Nowy moduł = nowy katalog w src/modules + wpis tutaj.
 * Kolejność ma znaczenie tylko dla logów przy starcie.
 */
export const modules: BotModule[] = [
  systemModule,
  adminModule,
  ticketsModule,
  faqModule,
  logsModule,
  verificationModule,
  ordersModule,
  pricingModule,
  portfolioModule,
  reviewsModule,
  clientsModule,
  announcementsModule,
  changelogModule,
  monitoringModule,
  remindersModule,
  statsModule,
  sdkModule,
];
