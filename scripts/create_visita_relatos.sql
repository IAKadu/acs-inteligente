-- Tabela de relatos de visita feitos pelo ACS via app mobile
CREATE TABLE IF NOT EXISTS visita_relatos (
  id              BIGSERIAL PRIMARY KEY,
  paciente_id     UUID        NOT NULL,
  equipe_id       UUID,
  acs_nome        TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Resultado da visita
  paciente_encontrado        BOOLEAN NOT NULL DEFAULT TRUE,
  condicao                   TEXT    NOT NULL DEFAULT 'estavel'
                               CHECK (condicao IN ('estavel','com_queixas','urgente')),

  -- Checklist padrao ACS (Guia Pratico MS 2009 / norma SMS Rio)
  orientacoes_dadas          BOOLEAN NOT NULL DEFAULT FALSE,
  medicamentos_verificados   BOOLEAN NOT NULL DEFAULT FALSE,
  encaminhamento_necessario  BOOLEAN NOT NULL DEFAULT FALSE,
  sinais_vitais_verificados  BOOLEAN NOT NULL DEFAULT FALSE,
  condicoes_moradia_ok       BOOLEAN NOT NULL DEFAULT TRUE,

  -- Relato livre
  observacao TEXT
);

CREATE INDEX IF NOT EXISTS idx_visita_relatos_paciente
  ON visita_relatos (paciente_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_visita_relatos_equipe
  ON visita_relatos (equipe_id, criado_em DESC);
