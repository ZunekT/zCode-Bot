import { AttachmentBuilder } from 'discord.js';
import type { GuildConfig } from '../../generated/prisma/client.js';
import { BANNER_URL } from '../../ui/assets.js';
import { Panel } from '../../ui/builders/container.js';
import { button } from '../../ui/builders/buttons.js';
import { card } from '../../ui/components/card.js';
import { e } from '../../ui/emojis.js';
import { renderCaptcha } from './captcha.js';
import { CAPTCHA_TTL, MAX_ATTEMPTS } from './service.js';

export const MODE_LABELS: Record<string, string> = {
  captcha: 'Captcha (kod z obrazka)',
  button: 'Jedno kliknięcie',
};

/** Publiczny panel weryfikacji. */
export function verificationPanel(config: GuildConfig, rulesChannelId?: string | null): Panel {
  const steps =
    config.verificationMode === 'button'
      ? `**1.** Przeczytaj zasady poniżej\n**2.** Kliknij **Zweryfikuj się** – gotowe!`
      : `**1.** Przeczytaj zasady poniżej\n**2.** Kliknij **Zweryfikuj się**\n**3.** Przepisz kod z obrazka – i gotowe!`;

  return new Panel({ tone: 'brand' })
    .banner(BANNER_URL)
    .title('shield_check', 'Weryfikacja')
    .text('Witaj na serwerze **zxCode**! Zanim zobaczysz resztę kanałów, potwierdź, że jesteś człowiekiem.')
    .separator()
    .text(`### ${e('checklist')} Jak to działa?\n${steps}`)
    .separator()
    .text(
      `### ${e('documentation')} Najważniejsze zasady\n` +
        `• Szanuj innych – zero obrażania i spamu\n` +
        `• Bez reklam i linków do innych serwerów bez zgody\n` +
        `• **Nigdy** nie udostępniaj tokenów botów ani haseł\n` +
        `• Zamówienia i pomoc tylko przez tickety` +
        (rulesChannelId ? `\n\nPełny regulamin: <#${rulesChannelId}>` : ''),
    )
    .buttons(button('verify:start', 'Zweryfikuj się', { style: 'success', emoji: 'verified' }))
    .footer('Weryfikacja zajmuje kilka sekund • Masz problem? Napisz do administracji');
}

/** Wiadomość z captchą (ephemeral) + plik obrazka. */
export function captchaPayloadParts(code: string, opts: { warning?: string } = {}) {
  const panel = card({
    tone: opts.warning ? 'warning' : 'info',
    emoji: 'lock',
    title: 'Przepisz kod z obrazka',
    description:
      opts.warning ?? 'Wielkość liter nie ma znaczenia. Kliknij **Wpisz kod**, gdy będziesz gotowy.',
    timestamp: false,
  })
    .banner('attachment://captcha.png', 'Kod weryfikacyjny')
    .buttons(
      button('verify:enter', 'Wpisz kod', { style: 'primary', emoji: 'code' }),
      button('verify:refresh', 'Nowy kod', { emoji: 'cloud_upload' }),
    )
    .footer(`Kod ważny ${CAPTCHA_TTL / 60} min • ${MAX_ATTEMPTS} próby`);
  return { panel, files: [new AttachmentBuilder(renderCaptcha(code), { name: 'captcha.png' })] };
}

export function verifiedCard(guildName: string) {
  return card({
    tone: 'success',
    emoji: 'verified',
    title: `Witaj na ${guildName}!`,
    description: 'Weryfikacja zakończona – masz już pełny dostęp do serwera. Miłego pobytu!',
    timestamp: false,
  });
}
