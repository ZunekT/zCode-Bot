import { DiscordAPIError, type Interaction, type RepliableInteraction } from 'discord.js';
import { failure } from '../ui/components/notice.js';
import type { V2Payload } from '../ui/builders/payload.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('errors');

/** Błąd, którego treść można pokazać użytkownikowi. */
export class UserError extends Error {
  constructor(
    message: string,
    readonly title = 'Nie udało się',
  ) {
    super(message);
    this.name = 'UserError';
  }
}

/** Odpowiada niezależnie od tego, czy interakcja była już potwierdzona. */
export async function safeReply(interaction: RepliableInteraction, payload: V2Payload): Promise<void> {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (err) {
    log.warn('Nie udało się odpowiedzieć na interakcję', err);
  }
}

export async function handleInteractionError(
  interaction: Interaction,
  err: unknown,
  where: string,
): Promise<void> {
  if (err instanceof UserError) {
    if (interaction.isRepliable()) await safeReply(interaction, failure(err.title, err.message));
    return;
  }

  // 10062 Unknown interaction – za późno na odpowiedź, nic nie da się zrobić.
  if (err instanceof DiscordAPIError && err.code === 10062) {
    log.warn(`Interakcja wygasła (${where})`);
    return;
  }

  log.error(`Błąd w ${where}`, err);
  if (interaction.isRepliable()) {
    await safeReply(
      interaction,
      failure('Coś poszło nie tak', 'Wystąpił nieoczekiwany błąd. Obsługa została powiadomiona w logach.'),
    );
  }
}

export function registerProcessErrorHandlers(): void {
  process.on('unhandledRejection', (reason) => log.error('Nieobsłużone odrzucenie Promise', reason));
  process.on('uncaughtException', (err) => log.error('Nieobsłużony wyjątek', err));
}
