/**
 * Re-scora todos os pacientes em lote.
 * Imprime progresso a cada 1000 pacientes e estatísticas finais.
 *
 * Uso: npx tsx scripts/rescore_all.ts
 */
import { sql } from '../src/lib/db.js';
import { recomputeAndSave } from '../src/lib/scoring.js';

async function main() {
  console.log('Buscando todos os paciente_id...');
  const rows = await sql<Array<{ paciente_id: string }>>`SELECT paciente_id FROM pacientes`;
  console.log(`Total: ${rows.length} pacientes\n`);

  const t0 = Date.now();
  let n = 0;

  for (const { paciente_id } of rows) {
    await recomputeAndSave(paciente_id);
    n++;
    if (n % 1000 === 0) {
      const elapsed = (Date.now() - t0) / 1000;
      const rate = n / elapsed;
      const eta = (rows.length - n) / rate;
      console.log(`  ${n}/${rows.length}  (${rate.toFixed(0)} p/s, ETA ${(eta/60).toFixed(1)}min)`);
    }
  }

  const totalSec = (Date.now() - t0) / 1000;
  console.log(`\nConcluído: ${n} pacientes em ${(totalSec/60).toFixed(1)} min\n`);

  console.log('=== DISTRIBUIÇÃO DE PRIORIDADE ===');
  const distr = await sql`
    SELECT prioridade, COUNT(*)::int AS n
    FROM pacientes_scores
    GROUP BY prioridade
    ORDER BY CASE prioridade
      WHEN 'CRITICO' THEN 1
      WHEN 'URGENTE' THEN 2
      WHEN 'ATENCAO' THEN 3
      WHEN 'ROTINA'  THEN 4
      ELSE 5 END
  `;
  console.table(distr);

  console.log('\n=== INVISÍVEIS POR CATEGORIA ===');
  const inv = await sql`
    SELECT categoria_invisivel, COUNT(*)::int AS n
    FROM pacientes_scores
    WHERE categoria_invisivel IS NOT NULL
    GROUP BY categoria_invisivel
    ORDER BY categoria_invisivel
  `;
  console.table(inv);

  console.log('\n=== STATS DE SCORE ===');
  const stats = await sql`
    SELECT
      ROUND(MIN(score)::numeric, 1)               AS min,
      ROUND(AVG(score)::numeric, 1)               AS avg,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY score)::numeric, 1) AS p50,
      ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY score)::numeric, 1) AS p90,
      ROUND(MAX(score)::numeric, 1)               AS max
    FROM pacientes_scores
  `;
  console.table(stats);

  await sql.end();
}

main().catch(err => { console.error(err); process.exit(1); });
