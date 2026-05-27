-- Schema inicial portado do SQLite (db.sqlite) para Postgres.
-- Mudanças vs SQLite:
--   * INTEGER PRIMARY KEY AUTOINCREMENT → BIGSERIAL PRIMARY KEY
--   * REAL → DOUBLE PRECISION
--   * DATETIME → TIMESTAMPTZ (com timezone)
--   * Booleanos continuam como INTEGER (0/1) pra manter compat com código existente
--   * JSON em registros_whatsapp.dados_extraidos e pacientes_scores.fatores agora JSONB
--     (driver postgres retorna objeto JS direto — código de parse foi removido)

-- ============================================================================
-- TABELAS PORTADAS DO DATASET ORIGINAL (parquets → sqlite → aqui)
-- ============================================================================

CREATE TABLE equipes (
  equipe_id           TEXT PRIMARY KEY,
  endereco_latitude   DOUBLE PRECISION,
  endereco_longitude  DOUBLE PRECISION
);

CREATE TABLE pacientes (
  paciente_id               TEXT PRIMARY KEY,
  equipe_id                 TEXT REFERENCES equipes(equipe_id),
  unidade_id                TEXT,
  faixa_etaria              TEXT,
  sexo                      TEXT,
  raca_cor                  TEXT,
  situacao_vulnerabilidade  INTEGER,
  endereco_latitude         DOUBLE PRECISION,
  endereco_longitude        DOUBLE PRECISION,
  hipertenso                INTEGER,
  diabetico                 INTEGER,
  gestacao                  INTEGER
);
CREATE INDEX idx_pacientes_equipe ON pacientes(equipe_id);

CREATE TABLE visitas (
  id                BIGSERIAL PRIMARY KEY,
  profissional_id   TEXT,
  registrados_em    DATE,
  ordem_visita_dia  INTEGER,
  paciente_id       TEXT REFERENCES pacientes(paciente_id),
  origem            TEXT DEFAULT 'parquet'
);
CREATE INDEX idx_visitas_paciente ON visitas(paciente_id);
CREATE INDEX idx_visitas_data ON visitas(registrados_em);

CREATE TABLE eventos_clinicos (
  id              BIGSERIAL PRIMARY KEY,
  paciente_id     TEXT REFERENCES pacientes(paciente_id),
  tipo            TEXT,
  data_referencia DATE
);
CREATE INDEX idx_eventos_paciente ON eventos_clinicos(paciente_id);

-- ============================================================================
-- TABELAS DE APLICAÇÃO (preenchidas via webhook WhatsApp / scoring engine)
-- ============================================================================

CREATE TABLE registros_whatsapp (
  id                  BIGSERIAL PRIMARY KEY,
  whatsapp_msg_id     TEXT UNIQUE,
  from_number         TEXT,
  profissional_id     TEXT,
  mensagem_texto      TEXT,
  dados_extraidos     JSONB,
  paciente_id         TEXT REFERENCES pacientes(paciente_id),
  status              TEXT DEFAULT 'recebido',
  recebido_em         TIMESTAMPTZ DEFAULT NOW(),
  processado_em       TIMESTAMPTZ
);

CREATE TABLE alertas (
  id            BIGSERIAL PRIMARY KEY,
  paciente_id   TEXT REFERENCES pacientes(paciente_id),
  tipo          TEXT,
  mensagem      TEXT,
  prioridade    INTEGER DEFAULT 2,
  origem        TEXT,
  criado_em     TIMESTAMPTZ DEFAULT NOW(),
  resolvido_em  TIMESTAMPTZ
);
CREATE INDEX idx_alertas_paciente ON alertas(paciente_id);
CREATE INDEX idx_alertas_status ON alertas(resolvido_em);

CREATE TABLE pacientes_scores (
  paciente_id    TEXT PRIMARY KEY REFERENCES pacientes(paciente_id),
  score          DOUBLE PRECISION,
  fatores        JSONB,
  justificativa  TEXT,
  calculado_em   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_scores_value ON pacientes_scores(score DESC);
