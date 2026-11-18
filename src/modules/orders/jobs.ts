import type { ZxClient } from '../../client.js';
import { prisma } from '../../db/prisma.js';
import { getSendableChannel } from '../../core/channels.js';
import { getConfig } from '../../core/config-service.js';
import { defineJob } from '../../core/types.js';
import { v2Message } from '../../ui/builders/payload.js';
import { card } from '../../ui/components/card.js';
import { discordTime, formatMoney, formatOrderId } from '../../utils/format.js';
import { notifyClient, refreshOrderPanel } from './service.js';

const HOUR = 3_600_000;

async function checkInvoices(client: ZxClient) {
  const now = Date.now();
  const invoices = await prisma.invoice.findMany({ where: { status: 'ISSUED' }, include: { order: true } });
  const config = await getConfig();

  for (const inv of invoices) {
    const due = inv.dueDate.getTime();
    const amount = formatMoney(Number(inv.amount), inv.currency);

    if (due < now) {
      await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'OVERDUE' } });
      await notifyClient(
        client,
        inv.order.userId,
        card({
          tone: 'error',
          emoji: 'invoice',
          title: `Minął termin płatności • ${inv.number}`,
          description: `Zlecenie **${formatOrderId(inv.orderId)}** – ${inv.order.title}\nJeśli już zapłaciłeś(-aś), daj znać w tickecie – zaksięgujemy wpłatę.`,
          fields: [{ emoji: 'coins', label: 'Kwota', value: amount }],
        }),
      );
      const alerts = await getSendableChannel(client, config.staffAlertChannelId);
      await alerts
        ?.send(
          v2Message(
            card({
              tone: 'warning',
              emoji: 'invoice',
              title: `Zaległa proforma ${inv.number}`,
              fields: [
                {
                  emoji: 'package',
                  label: 'Zlecenie',
                  value: `${formatOrderId(inv.orderId)} – ${inv.order.title}`,
                },
                { emoji: 'user', label: 'Klient', value: `<@${inv.order.userId}>` },
                { emoji: 'coins', label: 'Kwota', value: amount },
              ],
            }),
          ),
        )
        .catch(() => undefined);
      await refreshOrderPanel(client, inv.orderId);
      continue;
    }

    if (!inv.remindedAt && due - now <= 24 * HOUR) {
      await prisma.invoice.update({ where: { id: inv.id }, data: { remindedAt: new Date() } });
      await notifyClient(
        client,
        inv.order.userId,
        card({
          tone: 'warning',
          emoji: 'payment_card',
          title: `Przypomnienie o płatności • ${inv.number}`,
          description: `Termin płatności za **${formatOrderId(inv.orderId)}** mija ${discordTime(inv.dueDate, 'R')}.`,
          fields: [
            { emoji: 'coins', label: 'Kwota', value: amount },
            {
              emoji: 'documentation',
              label: 'Tytuł przelewu',
              value: `\`${formatOrderId(inv.orderId)} ${inv.number}\``,
            },
          ],
          body: config.paymentDetails ? `\`\`\`\n${config.paymentDetails}\n\`\`\`` : undefined,
        }),
      );
    }
  }
}

export const orderJobs = [
  defineJob({ name: 'invoices', intervalMs: HOUR, runOnStart: true, run: checkInvoices }),
];
