import 'dotenv/config';
import { z } from 'zod';

const snowflake = z.string().regex(/^\d{17,20}$/, 'Nieprawidłowe ID Discorda');

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'Brak DISCORD_TOKEN'),
  DISCORD_CLIENT_ID: snowflake,
  GUILD_ID: snowflake,
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  GITHUB_WEBHOOK_SECRET: z.string().optional().default(''),
  GITHUB_TOKEN: z.string().optional().default(''),
  HTTP_PORT: z.coerce.number().int().positive().default(3000),
  /** Publiczny adres serwera HTTP bota (do linków heartbeat), np. https://bot.zxcode.pl */
  PUBLIC_URL: z.string().url().optional(),
  /** Monitoring trybu „presence” – wymaga włączenia Presence Intent w Developer Portal. */
  ENABLE_PRESENCE_INTENT: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /** Wewnętrzne API dla strony zxcode.pl (tylko sieć Dockera). Bez sekretu API się nie uruchamia. */
  INTERNAL_API_SECRET: z.string().min(32, 'INTERNAL_API_SECRET musi mieć min. 32 znaki').optional(),
  INTERNAL_PORT: z.coerce.number().int().positive().default(3100),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Nieprawidłowa konfiguracja środowiska (.env):');
  for (const issue of parsed.error.issues) {
    console.error(`  • ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
