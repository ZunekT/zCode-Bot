import type { DiscountCode } from '../../generated/prisma/client.js';
import { prisma } from '../../db/prisma.js';
import { UserError } from '../../core/errors.js';
import { cents, formatMoney } from '../../utils/format.js';

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '');

/** Sprawdza kod (istnieje, nie wygasł, ma wolne użycia). */
export async function findValidDiscount(input: string): Promise<DiscountCode> {
  const code = normalizeCode(input);
  const dc = await prisma.discountCode.findUnique({ where: { code } });
  if (!dc) throw new UserError(`Kod \`${code}\` nie istnieje.`, 'Nieprawidłowy kod');
  if (dc.expiresAt && dc.expiresAt.getTime() < Date.now())
    throw new UserError(`Kod \`${code}\` wygasł.`, 'Kod wygasł');
  if (dc.maxUses !== null && dc.uses >= dc.maxUses)
    throw new UserError(`Kod \`${code}\` został już wykorzystany.`, 'Kod wykorzystany');
  return dc;
}

/** Wartość rabatu dla danej kwoty (nigdy więcej niż kwota). */
export function discountValue(dc: Pick<DiscountCode, 'percent' | 'amount'>, total: number): number {
  const raw = dc.percent ? (total * dc.percent) / 100 : Number(dc.amount ?? 0);
  return cents(Math.min(total, Math.max(0, raw)));
}

export const discountLabel = (dc: Pick<DiscountCode, 'percent' | 'amount'>) =>
  dc.percent ? `−${dc.percent}%` : `−${formatMoney(Number(dc.amount ?? 0))}`;
