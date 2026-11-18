import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // Fallback pozwala uruchomić `prisma generate` bez skonfigurowanej bazy (np. w CI).
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/zxcode',
  },
});
