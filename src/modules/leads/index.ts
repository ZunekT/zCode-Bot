import { prisma } from '../../db/prisma.js';
import { defineJob, defineModule } from '../../core/types.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('leads');
const RETENTION_MS = 365 * 86_400_000;

export const leadsModule = defineModule({
  name: 'leads',
  description: 'Zapytania o strony z formularza na zxcode.pl',
  jobs: [
    defineJob({
      name: 'leads-retention',
      intervalMs: 24 * 3_600_000,
      runOnStart: true,
      async run() {
        const { count } = await prisma.lead.deleteMany({
          where: { updatedAt: { lt: new Date(Date.now() - RETENTION_MS) } },
        });
        if (count) log.info(`Usunięto ${count} zapytań starszych niż 12 miesięcy`);
      },
    }),
  ],
});
