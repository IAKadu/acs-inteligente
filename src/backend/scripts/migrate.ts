/**
 * Roda as migrations de supabase/migrations/ em ordem.
 * Uso: npx tsx scripts/migrate.ts
 */
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import postgres from 'postgres';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL não configurada em .env');

const sql = postgres(DATABASE_URL, { prepare: false });

const migrationsDir = resolve(process.cwd(), '../../supabase/migrations');

const files = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log(`Encontradas ${files.length} migrations:\n`);

for (const file of files) {
  const content = readFileSync(resolve(migrationsDir, file), 'utf-8');
  console.log(`→ ${file} ...`);
  try {
    await sql.unsafe(content);
    console.log(`  ✓ OK`);
  } catch (err: unknown) {
    const msg = (err as Error).message ?? String(err);
    if (msg.includes('already exists')) {
      console.log(`  ⚠ já existe (ignorando)`);
    } else {
      console.error(`  ✗ ERRO: ${msg}`);
      process.exit(1);
    }
  }
}

await sql.end();
console.log('\nMigrations concluídas!');
