import { escapeMarkdown } from 'discord.js';
import type { Lead, LeadStatus } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import { getSendableChannel } from '../../core/channels.js';
import { getConfig } from '../../core/config-service.js';
import { UserError } from '../../core/errors.js';
import { prisma } from '../../db/prisma.js';
import { v2Message } from '../../ui/builders/payload.js';
import { card } from '../../ui/components/card.js';
import { truncate } from '../../utils/format.js';
import { createLogger } from '../../utils/logger.js';
import { DEADLINES, SITE_BUDGETS, SITE_TYPES } from '../tickets/forms.js';

const log = createLogger('leads');

export const LEAD_STATUSES: Record<LeadStatus, string> = {
  NEW: 'Nowe',
  CONTACTED: 'W kontakcie',
  WON: 'Zamówione',
  CLOSED: 'Zamknięte',
};
export const LEAD_STATUS_KEYS = Object.keys(LEAD_STATUSES) as LeadStatus[];

const PER_IP_HOUR = 3;
const GLOBAL_HOUR = 40;
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

const labelOf = (list: { value: string; label: string }[], v: string) =>
  list.find((o) => o.value === v)?.label ?? v;

export const leadLabels = (l: Pick<Lead, 'siteType' | 'budget' | 'deadline'>) => ({
  siteType: labelOf(SITE_TYPES, l.siteType),
  budget: labelOf(SITE_BUDGETS, l.budget),
  deadline: labelOf(DEADLINES, l.deadline),
});

function str(v: unknown, field: string, min: number, max: number, required = true): string | null {
  const s = typeof v === 'string' ? v.replace(/\s+$/g, '').replace(/^\s+/, '') : '';
  if (!s) {
    if (required) throw new UserError(`Uzupełnij pole: ${field}.`);
    return null;
  }
  if (s.length < min) throw new UserError(`Pole „${field}” jest za krótkie (min. ${min} znaków).`);
  if (s.length > max) throw new UserError(`Pole „${field}” jest za długie (maks. ${max} znaków).`);
  return s;
}

function oneOf(v: unknown, list: { value: string }[], field: string): string {
  if (typeof v !== 'string' || !list.some((o) => o.value === v)) throw new UserError(`Wybierz: ${field}.`);
  return v;
}

export async function createLead(client: ZxClient, input: Record<string, unknown>, ipHash: string) {
  const email = str(input.email, 'e-mail', 5, 120)!.toLowerCase();
  if (!EMAIL.test(email)) throw new UserError('Podaj poprawny adres e-mail.');
  const website = str(input.website, 'obecna strona', 4, 200, false);
  if (website && !/^(https?:\/\/)?[^\s]+\.[^\s]+$/i.test(website))
    throw new UserError('Podaj poprawny adres obecnej strony.');
  const data = {
    name: str(input.name, 'imię', 2, 80)!,
    email,
    company: str(input.company, 'firma', 2, 80, false),
    siteType: oneOf(input.siteType, SITE_TYPES, 'rodzaj strony'),
    budget: oneOf(input.budget, SITE_BUDGETS, 'budżet'),
    deadline: oneOf(input.deadline, DEADLINES, 'termin'),
    description: str(input.description, 'opis', 20, 3000)!,
    website,
    discord: str(input.discord, 'Discord', 2, 40, false),
    ipHash,
  };

  const hourAgo = new Date(Date.now() - 3600_000);
  const [mine, all, dup] = await Promise.all([
    prisma.lead.count({ where: { ipHash, createdAt: { gte: hourAgo } } }),
    prisma.lead.count({ where: { createdAt: { gte: hourAgo } } }),
    prisma.lead.findFirst({
      where: { email, description: data.description, createdAt: { gte: new Date(Date.now() - 600_000) } },
    }),
  ]);
  if (dup) return { id: dup.id };
  if (mine >= PER_IP_HOUR || all >= GLOBAL_HOUR)
    throw new UserError(
      'Wysłano już kilka zapytań – spróbuj ponownie za godzinę albo napisz na kontakt@zxcode.pl.',
    );

  const lead = await prisma.lead.create({ data });
  void notifyStaff(client, lead);
  return { id: lead.id };
}

async function notifyStaff(client: ZxClient, lead: Lead) {
  try {
    const config = await getConfig();
    const channel = await getSendableChannel(client, config.staffAlertChannelId);
    if (!channel) return;
    const l = leadLabels(lead);
    const msg = await channel.send({
      ...v2Message(
        card({
          tone: 'brand',
          emoji: 'laptop',
          title: `Nowe zapytanie o stronę #${lead.id}`,
          description: `${config.staffRoleId ? `<@&${config.staffRoleId}> ` : ''}**${escapeMarkdown(lead.name)}**${lead.company ? ` · ${escapeMarkdown(lead.company)}` : ''}`,
          fields: [
            { emoji: 'notification', label: 'E-mail', value: escapeMarkdown(lead.email) },
            { emoji: 'laptop', label: 'Rodzaj', value: l.siteType },
            { emoji: 'coins', label: 'Budżet', value: l.budget },
            { emoji: 'calendar', label: 'Termin', value: l.deadline },
            {
              emoji: 'code',
              label: 'Obecna strona',
              value: lead.website ? escapeMarkdown(lead.website) : null,
            },
            { emoji: 'discord', label: 'Discord', value: lead.discord ? escapeMarkdown(lead.discord) : null },
          ],
          body: `>>> ${escapeMarkdown(truncate(lead.description, 1500))}\n-# Odpowiedz z panelu: Administracja → Zapytania`,
        }),
      ),
      allowedMentions: { roles: config.staffRoleId ? [config.staffRoleId] : [] },
    });
    await prisma.lead.update({ where: { id: lead.id }, data: { messageId: msg.id } });
  } catch (err) {
    log.warn('Nie udało się powiadomić obsługi o zapytaniu', err);
  }
}
