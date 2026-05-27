-- Fase 2: adiciona flags de invisível e prioridade calculada em pacientes_scores.
-- Remove cap implícito do score (era enforced via Math.min em TS) — score agora
-- pode ir até ~250. Adiciona índices para o endpoint de painel de gestão.

ALTER TABLE pacientes_scores
  ADD COLUMN IF NOT EXISTS flag_invisivel          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flag_crise_sem_vinculo  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS categoria_invisivel     INTEGER,
  ADD COLUMN IF NOT EXISTS prioridade              TEXT;

-- categoria_invisivel: 1=crise_sem_vinculo, 2=alto_risco_sem_contato, 3=sem_cond_especial
-- prioridade: 'CRITICO' | 'URGENTE' | 'ATENCAO' | 'ROTINA' (cut por faixas de score)

CREATE INDEX IF NOT EXISTS idx_scores_prioridade   ON pacientes_scores(prioridade);
CREATE INDEX IF NOT EXISTS idx_scores_invisivel    ON pacientes_scores(flag_invisivel) WHERE flag_invisivel = TRUE;
CREATE INDEX IF NOT EXISTS idx_scores_crise        ON pacientes_scores(flag_crise_sem_vinculo) WHERE flag_crise_sem_vinculo = TRUE;
