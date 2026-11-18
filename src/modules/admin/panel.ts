import type { GuildConfig } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import { isModuleEnabled } from '../../core/config-service.js';
import { Panel } from '../../ui/builders/container.js';
import { button } from '../../ui/builders/buttons.js';
import { e } from '../../ui/emojis.js';
import { CATEGORY_SETTINGS, CHANNEL_SETTINGS, ROLE_SETTINGS, type SettingDef } from './settings.js';

function lines(config: GuildConfig, defs: Record<string, SettingDef>, mention: (id: string) => string) {
  return Object.values(defs)
    .map((def) => {
      const value = config[def.field];
      return `${e(def.emoji)} **${def.label}:** ${value ? mention(value) : '`nie ustawiono`'}`;
    })
    .join('\n');
}

/** Panel /config pokaz – pełny przegląd konfiguracji. */
export function configPanel(client: ZxClient, config: GuildConfig): Panel {
  const modules = [...client.modules.values()]
    .filter((m) => m.toggleable !== false)
    .map((m) => `${isModuleEnabled(config, m.name) ? '🟢' : '🔴'} \`${m.name}\` – ${m.description}`)
    .join('\n');

  return new Panel({ tone: config.maintenance ? 'warning' : 'brand' })
    .title('tools', 'Konfiguracja zxCode Bot')
    .text(
      config.maintenance
        ? `${e('lightning')} **Tryb serwisowy WŁĄCZONY** – ${config.maintenanceMessage ?? 'bez komunikatu'}`
        : `${e('verified')} Bot działa normalnie.`,
    )
    .separator()
    .title('ticket', 'Tickety', 3)
    .text(lines(config, CATEGORY_SETTINGS, (id) => `<#${id}>`))
    .fields({
      'Auto-zamknięcie po': `${config.ticketAutoCloseHours} h bez odpowiedzi`,
      'Alert SLA po': `${config.ticketSlaHours} h oczekiwania klienta`,
    })
    .separator()
    .title('discord', 'Kanały', 3)
    .text(lines(config, CHANNEL_SETTINGS, (id) => `<#${id}>`))
    .separator()
    .title('users', 'Role', 3)
    .text(lines(config, ROLE_SETTINGS, (id) => `<@&${id}>`))
    .separator()
    .title('payment_card', 'Dane do przelewu', 3)
    .text(
      config.paymentDetails
        ? `\`\`\`\n${config.paymentDetails}\n\`\`\``
        : '`nie ustawiono` – użyj `/config platnosci`',
    )
    .separator()
    .title('cube', 'Moduły', 3)
    .text(modules || 'Brak modułów do przełączania.')
    .buttons(
      button('config:refresh', 'Odśwież', { emoji: 'cloud_upload' }),
      button('config:payments', 'Dane do przelewu', { emoji: 'payment_card' }),
    )
    .footer('Zmiany: /config kanal • /config rola • /config kategoria • /config tickety • /config modul');
}
