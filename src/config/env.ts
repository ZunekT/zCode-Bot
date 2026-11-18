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
  PUBLIC_URL: z.string().url().optional(),
  ENABLE_PRESENCE_INTENT: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  INTERNAL_API_SECRET: z.string().min(32, 'INTERNAL_API_SECRET musi mieć min. 32 znaki').optional(),
  INTERNAL_PORT: z.coerce.number().int().positive().default(3100),
  MATHOST_API_KEY: z.string().min(16, 'MATHOST_API_KEY wygląda na niepełny').optional(),
  MATHOST_VPS_ID: z.coerce.number().int().positive().optional(),
  OWNER_ID: z
    .string()
    .regex(/^\d{17,20}$/, 'OWNER_ID musi być ID użytkownika Discord')
    .optional(),
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
