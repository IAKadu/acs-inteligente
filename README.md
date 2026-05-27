<img src="docs/assets/header.svg" alt="ACS Inteligente" width="100%"/>

# ACS Inteligente — Sistema de Apoio ao Agente Comunitário de Saúde

> Desenvolvido para o **Claude Impact Lab Rio 2026** — Hackathon Anthropic × Secretaria Municipal de Saúde do Rio de Janeiro

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![Hono](https://img.shields.io/badge/Hono-4-orange)](https://hono.dev)
[![Claude](https://img.shields.io/badge/Claude-Sonnet%204.6%20+%20Haiku%204.5-blue?logo=anthropic)](https://anthropic.com)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-green?logo=supabase)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)

---

## O Problema

O Brasil tem **~340 mil Agentes Comunitários de Saúde (ACS)** — profissionais de saúde que visitam famílias em seus domicílios, especialmente em comunidades vulneráveis. No Rio de Janeiro, cada ACS acompanha em média **750 famílias**.

O problema: **não existe priorização inteligente**. O ACS visita por ordem geográfica ou de memória, sem saber quais pacientes têm maior risco naquele dia. Pacientes com crises recentes, doenças crônicas mal controladas ou que nunca foram visitados ficam invisíveis no sistema.

Resultado: urgências evitáveis, internações desnecessárias, e vidas em risco.

## A Solução

**ACS Inteligente** é um sistema PWA mobile-first que usa IA para:

1. **Calcular um score de risco** para cada paciente, combinando comorbidades, histórico de urgências, tempo sem visita e condição social
2. **Otimizar a rota diária** do ACS priorizando os pacientes mais críticos, respeitando a capacidade da equipe
3. **Detectar pacientes invisíveis** — os que nunca foram visitados ou tiveram crise sem vínculo prévio com o serviço
4. **Registrar visitas rapidamente** via formulário, áudio ou foto — a IA estrutura os dados automaticamente
5. **Responder perguntas** sobre pacientes, protocolos e território via chat com Claude

---

## Funcionalidades

### 📊 Dashboard e KPIs

| Indicador | Descrição |
|-----------|-----------|
| Total de pacientes | Universo cadastrado na equipe |
| Cobertura de visitas | % visitados nos últimos 30 dias |
| Alertas abertos | Pacientes que precisam de atenção imediata |
| Urgências recentes | Passagens por UPA/internações nos últimos 30 dias |

### 🗺️ Agenda Diária com Mapa

- Rota otimizada com **algoritmo nearest-neighbor** + isócronas por caminhada (OpenRouteService)
- Cards de prioridade com badges: CRÍTICO / URGENTE / ATENÇÃO / ROTINA
- Justificativas geradas por Claude para cada decisão de prioridade
- Visualização em mapa Leaflet com marcadores coloridos por prioridade

### 📋 Registro de Visita (Mobile-First)

**3 formas de registrar:**

1. **Formulário manual** — checklist baseado no Guia Prático do MS (2009):
   - Paciente encontrado?
   - Condição: Estável / Com queixas / Urgente
   - Orientações dadas, medicamentos verificados, sinais vitais, encaminhamento, moradia

2. **Áudio** — Web Speech API em pt-BR, transcrição ao vivo no browser, Claude Haiku estrutura os dados

3. **Imagem / Foto** — câmera ou galeria, Claude Vision analisa a cena e extrai condição do paciente, medicamentos visíveis e estado da moradia

### 📶 Modo Offline

- Detecção automática de conectividade (`online`/`offline` events)
- Relatos salvos em `localStorage` quando sem sinal
- Sincronização automática ao recuperar conexão
- Banner de pendentes com botão "Enviar agora"
- Análise por IA desabilitada graciosamente quando offline

### 👻 Pacientes Invisíveis

3 categorias de invisibilidade detectadas automaticamente:

| Categoria | Definição |
|-----------|-----------|
| Crise sem vínculo | Teve urgência/internação mas nunca recebeu visita |
| Alto risco sem contato | Score ≥ 50, nunca visitado |
| Sem condição especial | Nunca visitado, sem fator de risco catalogado |

### 💬 Chat com IA

- Claude Sonnet 4.6 com **4 ferramentas read-only** de consulta ao banco:
  - `buscar_paciente_por_id` — detalhes clínicos do paciente
  - `listar_alertas_abertos` — alertas da equipe
  - `consultar_estatisticas_visitas` — cobertura por perfil
  - `consultar_eventos_clinicos` — urgências e internações
- Contexto de sistema com protocolos SMS Rio e guia do ACS
- Renderização Markdown nas respostas (negrito, listas, código)

### 🎯 Score de Risco

Pontuação composta de 0 a 250+, por faixas:

| Faixa | Score | Cor |
|-------|-------|-----|
| CRÍTICO | ≥ 80 | Vermelho |
| URGENTE | 50–79 | Laranja |
| ATENÇÃO | 20–49 | Amarelo |
| ROTINA | < 20 | Verde |

**Fatores do score:**
- Gestante: +40 pts
- Criança 0–6 anos: +35 pts
- Hipertenso + Diabético: +30 pts
- Hipertenso ou Diabético: +20 pts
- Idoso 66+: +15 pts
- Vulnerabilidade social: +10 pts
- Urgência nos últimos 30 dias: ×25 (multiplicador sobre déficit)
- Crise sem vínculo: +50 pts bônus

Página interativa `/score` com simulador em tempo real.

### 💬 Integração WhatsApp (Canal Alternativo)

- ACS envia mensagem de texto via WhatsApp (Twilio Sandbox)
- Claude Haiku extrai dados estruturados da mensagem livre
- Visita é registrada automaticamente no banco

---

## Arquitetura

### Visão Geral

<img src="docs/assets/flow.svg" alt="Fluxo arquitetural" width="100%"/>

### Diagrama Técnico

```mermaid
graph TB
    subgraph Campo ["📱 Campo — ACS"]
        PWA["Next.js 16 PWA<br/>Vercel CDN"]
        WA["WhatsApp<br/>Twilio Sandbox"]
    end

    subgraph Backend ["🖥️ Backend — Render (Node 20)"]
        API["Hono 4 API Server<br/>TypeScript ESM"]
    end

    subgraph Claude ["🤖 Anthropic Claude"]
        S46["claude-sonnet-4-6<br/>Chat + Tool Use"]
        H45["claude-haiku-4-5<br/>Structured Extraction<br/>+ Vision"]
    end

    subgraph DB ["🗄️ Supabase Postgres"]
        P[("pacientes<br/>~98K")]
        V[("visitas<br/>~1.2M")]
        PS[("pacientes_scores")]
        VR[("visita_relatos")]
        AL[("alertas")]
        EC[("eventos_clinicos")]
    end

    subgraph Geo ["🗺️ Geolocalização"]
        ORS["OpenRouteService<br/>Isócronas · Rotas"]
        LF["Leaflet.js<br/>Mapas interativos"]
    end

    PWA -->|"REST JSON"| API
    WA -->|"HTTP POST webhook"| API
    API -->|"Haiku: extração"| H45
    API -->|"Sonnet: chat + tools"| S46
    S46 -->|"4 read-only SQL tools"| DB
    H45 -->|"retorna JSON"| API
    API --> DB
    API -->|"foot-walking"| ORS
    PWA --> LF
    ORS --> LF
```

### Fluxo de Dados — Registro de Visita por Áudio

```mermaid
sequenceDiagram
    participant ACS as ACS (Campo)
    participant App as PWA (Browser)
    participant API as Backend API
    participant H45 as Claude Haiku 4.5
    participant DB as Supabase

    ACS->>App: Toca no microfone 🎤
    App->>App: Web Speech API pt-BR<br/>(transcrição local, offline)
    ACS->>App: "Paciente bem, tomando remédio<br/>mas queixou de tontura"
    App-->>ACS: Transcrição ao vivo
    ACS->>App: "Estruturar com IA →"
    App->>API: POST /api/visitas/analisar-media<br/>{ tipo: "transcript", texto: "..." }
    API->>H45: Messages API<br/>+ AUDIO_PROMPT estruturado
    H45-->>API: JSON { condicao: "com_queixas",<br/>medicamentos_verificados: true, ... }
    API-->>App: RelatoExtraido
    App-->>ACS: Pré-preenchimento do formulário
    ACS->>App: Revisa e confirma ✓
    App->>API: POST /api/visitas/relato
    API->>DB: INSERT visita_relatos
    API-->>App: 201 Created
    App-->>ACS: "Visita registrada!" 🟢
```

### Fluxo — Modo Offline

```mermaid
flowchart LR
    A[ACS preenche formulário] --> B{navigator.onLine?}
    B -- Sim --> C[POST /api/visitas/relato]
    C --> D[(Supabase)]
    C --> E[✓ Visita registrada]
    B -- Não --> F[enqueue em localStorage]
    F --> G[📥 Salvo no aparelho]
    H[window: online event] --> I[useOfflineSync.flush]
    I --> C
```

### Banco de Dados

```mermaid
erDiagram
    pacientes {
        uuid paciente_id PK
        uuid equipe_id FK
        text faixa_etaria
        text sexo
        text raca_cor
        int hipertenso
        int diabetico
        int gestacao
        int situacao_vulnerabilidade
        float endereco_latitude
        float endereco_longitude
    }

    pacientes_scores {
        uuid paciente_id PK
        float score
        text prioridade
        text[] fatores
        bool flag_invisivel
        bool flag_crise_sem_vinculo
        int categoria_invisivel
        timestamp calculado_em
    }

    visitas {
        bigint id PK
        uuid paciente_id FK
        uuid equipe_id
        text profissional_id
        timestamp registrados_em
        text origem
    }

    visita_relatos {
        bigint id PK
        uuid paciente_id FK
        uuid equipe_id
        text acs_nome
        bool paciente_encontrado
        text condicao
        bool orientacoes_dadas
        bool medicamentos_verificados
        bool encaminhamento_necessario
        bool sinais_vitais_verificados
        bool condicoes_moradia_ok
        text observacao
        timestamp criado_em
    }

    eventos_clinicos {
        bigint id PK
        uuid paciente_id FK
        text tipo
        date data_referencia
    }

    alertas {
        bigint id PK
        uuid paciente_id FK
        text tipo
        text mensagem
        int prioridade
        bool resolvido
        timestamp criado_em
    }

    equipes {
        uuid equipe_id PK
        float sede_latitude
        float sede_longitude
        text nome
    }

    pacientes ||--o{ visitas : "recebe"
    pacientes ||--o| pacientes_scores : "tem score"
    pacientes ||--o{ visita_relatos : "recebe relato"
    pacientes ||--o{ eventos_clinicos : "tem eventos"
    pacientes ||--o{ alertas : "tem alertas"
    equipes ||--o{ pacientes : "acompanha"
```

---

## Stack Técnica

| Camada | Tecnologia | Versão | Motivo |
|--------|-----------|--------|--------|
| Frontend | Next.js App Router | 16 | SSR, PWA, performance |
| UI | React + Tailwind v4 | 19 + 4 | Tokens CSS nativos |
| Mapas | Leaflet + React-Leaflet | 1.9 | OSM tiles, marcadores customizados |
| Backend | Hono | 4 | Ultra-leve, TypeScript ESM nativo |
| Runtime | Node.js | 20 | LTS estável |
| Database Driver | postgres (porsager) | 3.4 | Nativo Postgres, sem ORM |
| IA — Chat | Claude Sonnet 4.6 | latest | Raciocínio + tool use |
| IA — Extração | Claude Haiku 4.5 | latest | Rápido, barato, estruturado |
| IA — Visão | Claude Haiku 4.5 | latest | Análise de imagem médica |
| Database | Supabase Postgres | — | Managed, RLS, pooler |
| WhatsApp | Twilio | 5.3 | Sandbox para MVP |
| Rotas | OpenRouteService | — | Isócronas de caminhada |
| Deploy Frontend | Vercel | — | CDN global, zero-config |
| Deploy Backend | Render | — | Node.js gerenciado |
| Fonte | Cera Pro | — | Design system Prefeitura Rio |

---

## Screenshots

> Adicione os prints em `docs/screenshots/` — veja [`docs/screenshots/README.md`](docs/screenshots/README.md) para instruções.

### Dashboard — Visão Geral
![Dashboard](docs/screenshots/01-dashboard.png)

### Agenda Diária com Mapa
![Agenda](docs/screenshots/02-agenda.png)

### Agenda no Celular
![Agenda Mobile](docs/screenshots/03-agenda-mobile.png)

### Lista de Pacientes Priorizados
![Pacientes](docs/screenshots/04-pacientes.png)

### Detalhe do Paciente
![Detalhe](docs/screenshots/05-paciente-detalhe.png)

### Registrar Visita — Busca de Paciente
![Registrar Step 1](docs/screenshots/06-registrar.png)

### Registrar Visita — Formulário + Captura por Áudio
![Registrar Step 2](docs/screenshots/07-registrar-form.png)

### Modo Offline — Relato Salvo Localmente
![Offline](docs/screenshots/09-registrar-offline.png)

### Chat com IA
![Chat](docs/screenshots/10-chat.png)

### Simulador de Score
![Score](docs/screenshots/11-score.png)

---

## Pré-requisitos

- **Node.js** ≥ 20 (`node --version`)
- **npm** ≥ 10
- **Python** ≥ 3.10 (apenas para carga de dados)
- Conta **Supabase** (free tier funciona)
- Chave de API **Anthropic** (`sk-ant-...`)
- Chave **OpenRouteService** (free tier: 2.000 req/dia)
- Conta **Twilio** com Sandbox WhatsApp (opcional, para integração WhatsApp)

---

## Configuração

### 1. Clone o repositório

```bash
git clone https://github.com/SEU_USUARIO/acs-inteligente.git
cd acs-inteligente
```

### 2. Configure o banco de dados (Supabase)

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Vá em **Settings → Database → Connection string → Session pooler**
3. Anote a URL de conexão: `postgresql://postgres.XXXX:SENHA@aws-1-....pooler.supabase.com:5432/postgres`
4. Execute as migrations:

```bash
# No painel SQL do Supabase ou via psql:
psql $DATABASE_URL -f supabase/migrations/20260524180000_init_schema.sql
psql $DATABASE_URL -f supabase/migrations/20260524190000_fase2_score_flags.sql
psql $DATABASE_URL -f scripts/create_visita_relatos.sql
```

### 3. Carregue os dados (dataset do hackathon)

> Os dados de pacientes e visitas são anonimizados e provêm do dataset do Claude Impact Lab Rio 2026.

```bash
# Instale as dependências Python
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Configure a variável DATABASE_URL (veja seção de env vars)
export DATABASE_URL="postgresql://..."

# Carregue os dados dos arquivos Parquet
python scripts/load_data.py

# Calcule os scores iniciais para todos os pacientes
python scripts/bulk_score.py
```

### 4. Configure as variáveis de ambiente

**Backend** — copie e preencha:

```bash
cp src/backend/.env.example src/backend/.env
```

```env
# src/backend/.env
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://postgres.XXXX:SENHA@aws-1-...pooler.supabase.com:5432/postgres
PORT=3001

# Twilio WhatsApp (opcional)
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
PUBLIC_WEBHOOK_URL=https://SEU-NGROK.ngrok.io

# OpenRouteService
ORS_API_KEY=eyJ...
```

**Frontend** — copie e preencha:

```bash
cp src/frontend/.env.example src/frontend/.env.local
```

```env
# src/frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 5. Instale as dependências

```bash
# Backend
cd src/backend && npm install

# Frontend
cd ../frontend && npm install
```

### 6. Execute localmente

Abra **dois terminais**:

```bash
# Terminal 1 — Backend (porta 3001)
cd src/backend
npm run dev
# → Backend rodando em http://localhost:3001

# Terminal 2 — Frontend (porta 3000)
cd src/frontend
npm run dev
# → Abrindo http://localhost:3000
```

---

## Variáveis de Ambiente — Referência Completa

| Variável | Onde | Obrigatória | Descrição |
|----------|------|-------------|-----------|
| `ANTHROPIC_API_KEY` | Backend | ✅ | Chave da API Anthropic |
| `DATABASE_URL` | Backend + Python | ✅ | Supabase session pooler URL |
| `PORT` | Backend | — | Porta do servidor (default: 3001) |
| `TWILIO_ACCOUNT_SID` | Backend | ⚡ WhatsApp | SID da conta Twilio |
| `TWILIO_AUTH_TOKEN` | Backend | ⚡ WhatsApp | Token de autenticação Twilio |
| `TWILIO_WHATSAPP_FROM` | Backend | ⚡ WhatsApp | Número Sandbox Twilio |
| `PUBLIC_WEBHOOK_URL` | Backend | ⚡ WhatsApp | URL pública do ngrok para webhook |
| `ORS_API_KEY` | Backend | ⚡ Mapas | Chave OpenRouteService |
| `NEXT_PUBLIC_API_URL` | Frontend | ✅ | URL base do backend |

> ⚡ = Obrigatória apenas para a funcionalidade indicada

---

## Integração WhatsApp (opcional)

Para receber mensagens de ACS via WhatsApp durante desenvolvimento local:

1. Instale o [ngrok](https://ngrok.com): `ngrok http 3001`
2. Copie a URL HTTPS gerada (ex: `https://abc123.ngrok.io`)
3. Configure `PUBLIC_WEBHOOK_URL=https://abc123.ngrok.io` no `.env`
4. No Twilio Console → Messaging → Sandbox, configure o webhook:
   - **When a message comes in:** `https://abc123.ngrok.io/webhook/whatsapp` (POST)
5. Envie mensagem do WhatsApp para o número Sandbox do Twilio

O ACS pode enviar mensagens livres como:
> *"Visitei a senhora Maria, encontrei ela bem, verificou os remédios, pressão alta ontem precisou ir na UPA"*

Claude Haiku extrai automaticamente: `{ condicao: "urgente", medicamentos_verificados: true, encaminhamento_necessario: true, ... }`

---

## Deploy em Produção

### Frontend → Vercel

```bash
# Instale o CLI da Vercel
npm i -g vercel

cd src/frontend
vercel
# Siga o wizard, configure NEXT_PUBLIC_API_URL com a URL do backend no Render
```

Ou conecte o repositório diretamente no [vercel.com](https://vercel.com):
- **Root Directory:** `src/frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Env Vars:** `NEXT_PUBLIC_API_URL=https://SEU-BACKEND.onrender.com`

### Backend → Render

O arquivo `render.yaml` já está configurado. Conecte o repositório no [render.com](https://render.com):

- **Root Directory:** `src/backend`
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment Variables:** Adicione todas as vars do `.env` via dashboard

```yaml
# render.yaml (já incluído no repo)
services:
  - type: web
    name: impact-acs-backend
    runtime: node
    rootDir: src/backend
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /
```

---

## API — Endpoints Principais

### Pacientes e Scores

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/patients` | Lista paginada com filtros `equipe_id`, `score_min` |
| `GET` | `/api/patients/:id` | Detalhe do paciente + visitas + eventos + alertas |
| `GET` | `/api/patients/search?q=&equipe_id=` | Busca por ID prefix (para formulário) |
| `GET` | `/api/patients/:id/relatos` | Histórico de relatos de visita |
| `POST` | `/api/score/recompute/:id` | Recalcula score de um paciente |

### Agenda e Roteamento

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/equipes/:id/agenda` | Agenda diária otimizada para a equipe |
| `GET` | `/api/territory/heatmap` | Pontos geoespaciais de urgência |
| `GET` | `/api/territory/equipes` | Sedes das equipes (lat/lon) |
| `POST` | `/api/territory/isochrones` | Isócronas de caminhada via ORS |

### Gestão

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/kpis` | KPIs gerais (cobertura, alertas, urgências) |
| `GET` | `/api/gestao/painel` | Comparativo por equipe |
| `GET` | `/api/gestao/invisiveis` | Pacientes invisíveis com filtros |
| `GET` | `/api/visitas/stats` | Estatísticas de visita por perfil |
| `GET` | `/api/eventos/stats` | Análise espiral de urgências |

### Relatos de Visita

| Método | Endpoint | Payload | Descrição |
|--------|----------|---------|-----------|
| `POST` | `/api/visitas/relato` | `RelatoVisita` | Salva relato de visita |
| `POST` | `/api/visitas/analisar-media` | `{ tipo, texto? \| imagemBase64? }` | Extrai dados com IA (Haiku) |

**Payload `/api/visitas/relato`:**
```json
{
  "paciente_id": "uuid",
  "equipe_id": "uuid",
  "acs_nome": "Maria Silva",
  "paciente_encontrado": true,
  "condicao": "com_queixas",
  "orientacoes_dadas": true,
  "medicamentos_verificados": true,
  "sinais_vitais_verificados": false,
  "encaminhamento_necessario": true,
  "condicoes_moradia_ok": true,
  "observacao": "Paciente com queixa de tontura persistente..."
}
```

**Payload `/api/visitas/analisar-media` (áudio):**
```json
{
  "tipo": "transcript",
  "texto": "Visitei o senhor João, estava bem, tomou os remédios todos..."
}
```

**Payload `/api/visitas/analisar-media` (imagem):**
```json
{
  "tipo": "image",
  "imagemBase64": "base64string...",
  "mimeType": "image/jpeg"
}
```

### Chat e Webhook

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/chat` | Chat com Claude Sonnet 4.6 + tool use |
| `POST` | `/webhook/whatsapp` | Webhook Twilio (mensagens WhatsApp) |

---

## Estrutura do Projeto

```
acs-inteligente/
├── .env.example                    # Template de variáveis de ambiente
├── render.yaml                     # Configuração de deploy no Render
├── requirements.txt                # Dependências Python (ETL)
│
├── docs/
│   ├── assets/                     # SVGs do projeto (header, flow, divider)
│   └── screenshots/                # Prints de tela (adicionar manualmente)
│
├── scripts/                        # ETL e utilitários Python
│   ├── load_data.py                # Carrega Parquet → Supabase
│   ├── bulk_score.py               # Calcula scores para todos os pacientes
│   ├── create_visita_relatos.sql   # DDL da tabela de relatos
│   └── eda_*.py                    # Análises exploratórias do dataset
│
├── supabase/
│   └── migrations/
│       ├── *_init_schema.sql       # Schema inicial (tabelas principais)
│       └── *_fase2_score_flags.sql # Flags de invisibilidade e prioridade
│
└── src/
    ├── backend/                    # API Hono (Node 20 + TypeScript ESM)
    │   ├── package.json
    │   ├── .env.example
    │   └── src/
    │       ├── index.ts            # Entry point + todas as rotas inline
    │       ├── lib/
    │       │   ├── db.ts           # Queries SQL (postgres driver)
    │       │   ├── scoring.ts      # Motor de score de risco
    │       │   ├── routing.ts      # Otimização de rota (nearest-neighbor)
    │       │   ├── anthropic.ts    # Setup do SDK Anthropic
    │       │   ├── chat-tools.ts   # Definição das 4 ferramentas do chat
    │       │   ├── justificativas.ts # Geração de justificativas por Claude
    │       │   └── ors.ts          # Proxy OpenRouteService
    │       ├── prompts/            # System prompts em Markdown
    │       │   ├── chat-system.md
    │       │   ├── extract-message.md
    │       │   └── justificativa-visita.md
    │       └── routes/
    │           ├── chat.ts         # Chat streaming + tool use
    │           ├── media-relato.ts # Análise de áudio/imagem com Haiku
    │           └── webhook.ts      # Twilio WhatsApp webhook
    │
    └── frontend/                   # Next.js 16 App Router (React 19)
        ├── package.json
        ├── .env.example
        ├── app/
        │   ├── layout.tsx          # Layout global (topbar, FAB mobile, footer)
        │   ├── page.tsx            # / Dashboard
        │   ├── agenda/page.tsx     # /agenda Agenda diária + mapa
        │   ├── chat/page.tsx       # /chat Chat com IA
        │   ├── equipes/page.tsx    # /equipes Painel de equipes
        │   ├── eventos/page.tsx    # /eventos Análise de urgências
        │   ├── pacientes/page.tsx  # /pacientes Lista priorizada
        │   ├── pacientes/[id]/     # /pacientes/:id Detalhe do paciente
        │   ├── registrar/page.tsx  # /registrar Registrar visita (3 passos)
        │   ├── score/page.tsx      # /score Explicação + simulador
        │   ├── visitas/page.tsx    # /visitas Estatísticas de visita
        │   └── globals.css         # Design tokens (brandbook SMS Rio)
        ├── components/
        │   ├── agenda-card.tsx     # Card de prioridade na agenda
        │   ├── chat-message.tsx    # Renderização Markdown nas mensagens
        │   ├── media-relato-capture.tsx # Captura por áudio/imagem
        │   ├── score-simulator.tsx # Simulador interativo de score
        │   └── topbar.tsx          # Nav responsiva (hamburguer mobile)
        ├── hooks/
        │   └── use-offline-sync.ts # Sync automático ao recuperar conexão
        └── lib/
            ├── api.ts              # Cliente HTTP tipado (todos os endpoints)
            └── offline-queue.ts    # Fila persistida em localStorage
```

---

## Dataset

O dataset utilizado é o fornecido pelo hackathon Claude Impact Lab Rio 2026, disponibilizado pela Secretaria Municipal de Saúde do Rio de Janeiro. Os dados são **totalmente anonimizados**.

Contém aproximadamente:
- **98.000 pacientes** com dados demográficos e comorbidades
- **1,2 milhão de registros de visitas** domiciliares (histórico)
- **15.000 eventos clínicos** (urgências e internações)
- **Coordenadas geográficas** anonimizadas por microterritório

Os arquivos Parquet devem ser obtidos via [claude-impact-lab-saude](https://github.com/prefeitura-rio/claude-impact-lab-saude) e carregados com `python scripts/load_data.py`.

---

## Modelos Claude em Uso

| Modelo | Uso | Justificativa |
|--------|-----|---------------|
| `claude-sonnet-4-6` | Chat com tool use | Raciocínio complexo, contexto do paciente |
| `claude-haiku-4-5` | Extração de áudio | Rápido e barato para JSON estruturado |
| `claude-haiku-4-5` | Análise de imagem | Vision + extração em uma chamada |
| `claude-haiku-4-5` | Webhook WhatsApp | Alta frequência, baixo custo |

---

## Equipe

Desenvolvido durante o **Claude Impact Lab Rio 2026** (Hackathon Anthropic):

- **Kadu Bruns** — Desenvolvimento full-stack e integração Claude
- **Peter Flag** — Arquitetura de dados e análise territorial
- **Gabriel Tyll** — Backend e scoring engine
- **Ricardo Brigante** — UX e design system
- **Vitor Medeiros** — Análise de dados e modelos de risco

---

## Licença

MIT License — veja [LICENSE](LICENSE) para detalhes.

---

<div align="center">
  <img src="src/frontend/public/logo-prefeitura-saude.png" alt="Secretaria Municipal de Saúde — Prefeitura do Rio de Janeiro" height="60"/>
  <br/>
  <sub>Hackathon Claude Impact Lab 2026 · Secretaria Municipal de Saúde · Prefeitura do Rio de Janeiro</sub>
</div>
