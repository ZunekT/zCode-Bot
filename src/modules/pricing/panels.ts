import { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import type { DiscountCode, PricingItem, PricingPackage } from '../../generated/prisma/client.js';
import { BANNER_URL } from '../../ui/assets.js';
import { Panel } from '../../ui/builders/container.js';
import { button } from '../../ui/builders/buttons.js';
import { card, tableBlock } from '../../ui/components/card.js';
import { e } from '../../ui/emojis.js';
import { cents, formatMoney, truncate } from '../../utils/format.js';
import { discountLabel, discountValue } from './discounts.js';

const PACKAGE_EMOJIS = ['cube', 'rocket', 'crown', 'star', 'lightning'] as const;

/** Publiczny cennik (panel na kanale albo ephemeral z /cennik). */
export function pricingPanel(
  packages: PricingPackage[],
  stats: { avg: number | null; count: number },
  withBanner: boolean,
): Panel {
  const panel = new Panel({ tone: 'brand' });
  if (withBanner) panel.banner(BANNER_URL);
  panel
    .title('coins', 'Cennik zxCode')
    .text(
      'Gotowe pakiety na start albo projekt szyty na miarę. Kliknij **Zamów** – otworzymy ticket z wypełnionym formularzem.',
    );

  if (!packages.length) {
    panel.separator().text('-# Cennik jest w przygotowaniu – zapytaj o wycenę w tickecie.');
  }
  packages.slice(0, 6).forEach((p, i) => {
    panel
      .separator()
      .sectionWithButton(
        `### ${e(PACKAGE_EMOJIS[i % PACKAGE_EMOJIS.length]!)} ${p.name}\n` +
          `**od ${formatMoney(Number(p.price))}** · ${p.description}` +
          (p.features.length ? `\n-# ${p.features.slice(0, 8).join(' · ')}` : ''),
        button(`pricing:order:${p.id}`, 'Zamów', { style: i === 1 ? 'primary' : 'secondary', emoji: 'cart' }),
      );
  });

  panel.separator();
  if (stats.count)
    panel.text(
      `${e('star')} **${(stats.avg ?? 0).toFixed(1)}/5** • ${stats.count} opinii zweryfikowanych klientów`,
    );
  return panel
    .buttons(
      button('pricing:calc', 'Kalkulator wyceny', { style: 'primary', emoji: 'coins' }),
      button('pricing:custom', 'Projekt na miarę', { emoji: 'idea' }),
    )
    .footer('Ceny orientacyjne • dokładną wycenę dostaniesz w tickecie');
}

export interface CalcState {
  items: string[];
  code?: string;
}

export function calcSummary(items: PricingItem[], state: CalcState, dc: DiscountCode | null) {
  const chosen = items.filter((i) => state.items.includes(i.key));
  const sum = cents(chosen.reduce((s, i) => s + Number(i.price), 0));
  const discount = dc ? discountValue(dc, sum) : 0;
  return { chosen, sum, discount, total: cents(sum - discount) };
}

/** Kalkulator wyceny (ephemeral). */
export function calculatorPanel(
  items: PricingItem[],
  state: CalcState,
  dc: DiscountCode | null,
  notice?: string,
): Panel {
  const { chosen, sum, discount, total } = calcSummary(items, state, dc);
  const panel = card({
    tone: 'brand',
    emoji: 'coins',
    title: 'Kalkulator wyceny',
    description: notice ?? 'Zaznacz funkcje, których potrzebujesz – policzymy szacunkową cenę.',
    timestamp: false,
  });

  if (!items.length)
    return panel.text(
      '-# Kalkulator nie ma jeszcze pozycji. Administracja może je dodać: `/cennik pozycja dodaj`.',
    );

  panel
    .separator()
    .text(
      chosen.length
        ? tableBlock(
            [
              ...chosen.map((i) => [truncate(i.label, 28), formatMoney(Number(i.price))] as [string, string]),
              ...(discount ? [[`Rabat ${state.code}`, `-${formatMoney(discount)}`] as [string, string]] : []),
              ['Razem', formatMoney(total)],
            ],
            { separatorBefore: [chosen.length] },
          ) + (discount ? `\n-# Bez rabatu: ${formatMoney(sum)} · kod ${discountLabel(dc!)}` : '')
        : '-# Nic jeszcze nie wybrano.',
    )
    .select(
      new StringSelectMenuBuilder()
        .setCustomId('pricing:calcSelect')
        .setPlaceholder('Wybierz funkcje bota…')
        .setMinValues(0)
        .setMaxValues(Math.min(items.length, 25))
        .addOptions(
          items.slice(0, 25).map((i) => {
            const opt = new StringSelectMenuOptionBuilder()
              .setValue(i.key)
              .setLabel(truncate(`${i.label} — ${formatMoney(Number(i.price))}`, 100))
              .setDefault(state.items.includes(i.key));
            if (i.description) opt.setDescription(truncate(i.description, 100));
            return opt;
          }),
        ),
    )
    .buttons(
      button('pricing:orderCalc', 'Zamów ten zestaw', {
        style: 'success',
        emoji: 'cart',
        disabled: !chosen.length,
      }),
      button('pricing:code', state.code ? 'Zmień kod rabatowy' : 'Mam kod rabatowy', { emoji: 'gift' }),
    )
    .footer('Wycena szacunkowa • ostateczną cenę ustalimy w tickecie');
  return panel;
}

/** Opis do formularza ticketu na podstawie kalkulatora. */
export function calcOrderDescription(
  items: PricingItem[],
  state: CalcState,
  dc: DiscountCode | null,
): string {
  const { chosen, total } = calcSummary(items, state, dc);
  return (
    `Wybrane funkcje z kalkulatora:\n${chosen.map((i) => `- ${i.label}`).join('\n')}\n` +
    `Szacunkowa cena: ${formatMoney(total)}${state.code ? ` (kod rabatowy: ${state.code})` : ''}\n\nDodatkowe informacje: `
  );
}
