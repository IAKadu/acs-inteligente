"""
Bulk scorer: computa scores de todos os pacientes via SQL puro.
Muito mais rapido que o rescore_all.ts sequencial.

Uso:
    python scripts/bulk_score.py
"""

import os
import sys
from pathlib import Path

env_file = Path(__file__).parent.parent / "src" / "backend" / ".env"
if env_file.exists() and not os.environ.get("DATABASE_URL"):
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line.startswith("DATABASE_URL="):
            os.environ["DATABASE_URL"] = line.split("=", 1)[1].strip()
            break

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERRO: DATABASE_URL nao encontrada.")
    sys.exit(1)

import psycopg2

BULK_SQL = """
WITH
-- Contagem de visitas por paciente
visit_counts AS (
    SELECT paciente_id, COUNT(*) AS n_visitas
    FROM visitas
    GROUP BY paciente_id
),
-- Contagem de urgencias por janela temporal (TODAY = 2025-12-31)
urg_counts AS (
    SELECT
        paciente_id,
        COUNT(*) FILTER (WHERE data_referencia >= DATE '2025-12-31' - INTERVAL '30 days')  AS n_30,
        COUNT(*) FILTER (WHERE data_referencia >= DATE '2025-12-31' - INTERVAL '90 days')  AS n_90,
        COUNT(*) FILTER (WHERE data_referencia >= DATE '2025-12-31' - INTERVAL '180 days') AS n_180,
        COUNT(*) AS n_ano
    FROM eventos_clinicos
    WHERE tipo = 'urgencia-emergencia-ou-internacao'
    GROUP BY paciente_id
),
-- Agendamentos futuros (apos 2025-12-31)
agenda_futura AS (
    SELECT DISTINCT paciente_id
    FROM eventos_clinicos
    WHERE tipo = 'agendamento'
      AND data_referencia > DATE '2025-12-31'
),
-- Alertas P1 abertos
alertas_p1 AS (
    SELECT paciente_id, COUNT(*) AS n_alertas
    FROM alertas
    WHERE prioridade = 1 AND resolvido_em IS NULL
    GROUP BY paciente_id
),
-- Base com todos os dados por paciente
base AS (
    SELECT
        p.paciente_id,
        p.faixa_etaria,
        p.gestacao,
        p.hipertenso,
        p.diabetico,
        p.situacao_vulnerabilidade,
        COALESCE(v.n_visitas, 0) AS n_visitas,
        COALESCE(u.n_30,  0)    AS n_30,
        COALESCE(u.n_90,  0)    AS n_90,
        COALESCE(u.n_180, 0)    AS n_180,
        COALESCE(u.n_ano, 0)    AS n_ano,
        (af.paciente_id IS NOT NULL) AS tem_agenda,
        COALESCE(al.n_alertas, 0)   AS n_alertas
    FROM pacientes p
    LEFT JOIN visit_counts  v  ON v.paciente_id  = p.paciente_id
    LEFT JOIN urg_counts    u  ON u.paciente_id  = p.paciente_id
    LEFT JOIN agenda_futura af ON af.paciente_id = p.paciente_id
    LEFT JOIN alertas_p1    al ON al.paciente_id = p.paciente_id
),
-- Calculo de score
scored AS (
    SELECT
        paciente_id,
        -- Clinico
        CASE WHEN gestacao = 1 THEN 40 ELSE 0 END +
        CASE WHEN faixa_etaria = '0-6' THEN 35 ELSE 0 END +
        CASE WHEN hipertenso = 1 AND diabetico = 1 THEN 30
             WHEN hipertenso = 1 THEN 20
             WHEN diabetico  = 1 THEN 20
             ELSE 0 END +
        CASE WHEN faixa_etaria = '66+' THEN 15 ELSE 0 END +
        -- Social
        CASE WHEN situacao_vulnerabilidade = 1 THEN 10 ELSE 0 END +
        -- Deficit de visitas (min_visitas - n_visitas) * 8
        GREATEST(0,
            CASE
                WHEN faixa_etaria = '0-6'               THEN 7
                WHEN gestacao = 1                        THEN 6
                WHEN hipertenso = 1 AND diabetico = 1    THEN 4
                WHEN hipertenso = 1                      THEN 4
                WHEN diabetico = 1                       THEN 4
                WHEN faixa_etaria = '66+'                THEN 4
                ELSE 2
            END - n_visitas
        ) * 8 +
        -- Urgencia (4 janelas cumulativas)
        n_30 * 25 + n_90 * 15 + n_180 * 8 + n_ano * 3 +
        -- Agendamento futuro
        CASE WHEN tem_agenda THEN 10 ELSE 0 END +
        -- Alerta critico aberto
        CASE WHEN n_alertas > 0 THEN 20 ELSE 0 END +
        -- Bonus invisivel: alto risco sem visita
        CASE WHEN n_visitas = 0 AND (
            gestacao = 1 OR faixa_etaria IN ('0-6','66+') OR
            hipertenso = 1 OR diabetico = 1 OR situacao_vulnerabilidade = 1
        ) THEN 30 ELSE 0 END +
        -- Bonus invisivel: crise sem vinculo
        CASE WHEN n_visitas = 0 AND n_ano >= 3 THEN 50 ELSE 0 END
        AS score,

        -- Flags
        (n_visitas = 0 AND (
            gestacao = 1 OR faixa_etaria IN ('0-6','66+') OR
            hipertenso = 1 OR diabetico = 1 OR situacao_vulnerabilidade = 1
        )) AS flag_invisivel,

        (n_visitas = 0 AND n_ano >= 3) AS flag_crise_sem_vinculo,

        CASE
            WHEN n_visitas = 0 AND n_ano >= 3 THEN 1
            WHEN n_visitas = 0 AND (
                gestacao = 1 OR faixa_etaria IN ('0-6','66+') OR
                hipertenso = 1 OR diabetico = 1 OR situacao_vulnerabilidade = 1
            ) THEN 2
            WHEN n_visitas = 0 THEN 3
            ELSE NULL
        END AS categoria_invisivel
    FROM base
)
INSERT INTO pacientes_scores
    (paciente_id, score, prioridade, fatores,
     flag_invisivel, flag_crise_sem_vinculo, categoria_invisivel, calculado_em)
SELECT
    paciente_id,
    score,
    CASE
        WHEN score >= 80 THEN 'CRITICO'
        WHEN score >= 50 THEN 'URGENTE'
        WHEN score >= 20 THEN 'ATENCAO'
        ELSE 'ROTINA'
    END AS prioridade,
    '[]' AS fatores,
    flag_invisivel,
    flag_crise_sem_vinculo,
    categoria_invisivel,
    NOW()
FROM scored
ON CONFLICT (paciente_id) DO UPDATE SET
    score                  = EXCLUDED.score,
    prioridade             = EXCLUDED.prioridade,
    fatores                = EXCLUDED.fatores,
    flag_invisivel         = EXCLUDED.flag_invisivel,
    flag_crise_sem_vinculo = EXCLUDED.flag_crise_sem_vinculo,
    categoria_invisivel    = EXCLUDED.categoria_invisivel,
    calculado_em           = EXCLUDED.calculado_em;
"""

STATS_SQL = """
SELECT prioridade, COUNT(*)::int AS n
FROM pacientes_scores
GROUP BY prioridade
ORDER BY CASE prioridade
    WHEN 'CRITICO' THEN 1
    WHEN 'URGENTE' THEN 2
    WHEN 'ATENCAO' THEN 3
    ELSE 4 END;
"""

INV_SQL = """
SELECT categoria_invisivel, COUNT(*)::int AS n
FROM pacientes_scores
WHERE categoria_invisivel IS NOT NULL
GROUP BY categoria_invisivel
ORDER BY categoria_invasivel;
"""

def main():
    print("Conectando ao banco...")
    conn = psycopg2.connect(DATABASE_URL)
    print("Conexao OK\n")

    print("Executando bulk score SQL...")
    import time
    t0 = time.time()
    cur = conn.cursor()
    cur.execute(BULK_SQL)
    conn.commit()
    elapsed = time.time() - t0
    print(f"Concluido em {elapsed:.1f}s — {cur.rowcount} linhas processadas\n")

    print("=== DISTRIBUICAO DE PRIORIDADE ===")
    cur.execute(STATS_SQL)
    rows = cur.fetchall()
    for r in rows:
        print(f"  {r[0]:10s}: {r[1]:6d}")

    print("\n=== INVISIVEIS POR CATEGORIA ===")
    cur.execute("SELECT categoria_invisivel, COUNT(*)::int AS n FROM pacientes_scores WHERE categoria_invisivel IS NOT NULL GROUP BY categoria_invisivel ORDER BY categoria_invisivel")
    rows = cur.fetchall()
    labels = {1: 'crise_sem_vinculo', 2: 'alto_risco_sem_contato', 3: 'sem_cond_especial'}
    for r in rows:
        print(f"  cat {r[0]} ({labels.get(r[0], '?'):25s}): {r[1]:6d}")

    print("\n=== STATS DE SCORE ===")
    cur.execute("""
        SELECT
            ROUND(MIN(score)::numeric, 1) AS min,
            ROUND(AVG(score)::numeric, 1) AS avg,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY score)::numeric, 1) AS p50,
            ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY score)::numeric, 1) AS p90,
            ROUND(MAX(score)::numeric, 1) AS max
        FROM pacientes_scores
    """)
    r = cur.fetchone()
    print(f"  min={r[0]}  avg={r[1]}  p50={r[2]}  p90={r[3]}  max={r[4]}")

    cur.close()
    conn.close()
    print("\nPronto!")

if __name__ == "__main__":
    main()
