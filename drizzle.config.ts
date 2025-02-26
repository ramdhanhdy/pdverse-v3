/**
 * NOTE: This configuration file is no longer used as we've switched to a direct SQLite implementation
 * without using Drizzle ORM. It's kept for reference purposes only.
 * 
 * The database schema and operations are now defined directly in lib/db/index.ts
 */

import type { Config } from 'drizzle-kit';
import path from 'path';

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: path.join(process.cwd(), 'data', 'pdverse.db'),
  },
} satisfies Config;
