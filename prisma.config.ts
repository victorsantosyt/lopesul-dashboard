// prisma.config.ts
import { defineConfig } from '@prisma/config';
import dotenv from 'dotenv';
import path from 'node:path';
import { existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  const p = path.resolve(process.cwd(), f);
  if (existsSync(p)) dotenv.config({ path: p });
}

export default defineConfig({});
