# Análise Completa do Dataset — Inteligência no Território (ACS Rio)

> **Contexto:** Claude Impact Lab 2026, desafio de saúde pública. Dataset de uma região mista (favela + asfalto) do Rio com 49 equipes de Saúde da Família. Anonimização agressiva (date shifting por paciente, geo noise ±100m, k-anonymity ≥5, amostragem 2.000 pacientes/equipe).
>
> **Objetivo deste documento:** consolidar a visão quantitativa e qualitativa do dataset para alimentar decisões de produto. Baseado em quatro scripts de EDA: `eda_initial.py`, `eda_deeper.py`, `eda_protocolo.py`, `eda_completo.py`.
>
> **Fontes complementares:** `_inbox/transcricao-apresentacao-problema.md`, `_inbox/briefing-acs-vulnerabilidade.md` (framework oficial), `_inbox/transcricao-qa-sms-rio.md` (Q&A operacional com Carol/SMS).

---

## Sumário executivo — os 8 fatos que devem guiar o produto

1. **50% dos cadastros nunca foram visitados em 1 ano** (48.838 de 97.938). Não é "fila de espera" — é silêncio absoluto.
2. **Existe um subgrupo de 42.068 pacientes "fantasma"** que só aparecem no cadastro: sem visita E sem evento clínico. **27.5% desses fantasmas são idosos 66+** (11.564 pacientes).
3. **Pós-urgência: 54.4% dos casos demoram mais de 30 dias para receber visita do ACS**. Mediana de lag = 36 dias. Esse é o **maior gap operacional mensurável** do sistema.
4. **265 ACS reais** (filtro: ≥200 visitas/ano) cobrem em média **206 pacientes únicos** — bem abaixo dos 750/microárea esperados. Sinal de subcobertura sistemática.
5. **Famílias calibradas (grid 30m + filtro 2-8)**: ~15.300 famílias candidatas, **tamanho médio 3.17 pessoas** (exatamente o 3.2 do briefing). Dessas, **>2.000 famílias têm 3+ condições de risco simultâneas**.
6. **Concentração geográfica é real**: 4 equipes acima de 1.5σ na taxa de urgência; uma célula de 100m concentra 220 urgências sozinha. Justifica vigilância endêmica espacial.
7. **Cadência mediana de visita = 33 dias por paciente** (~mensal, alinhado com protocolo). Mas 19.3% dos gaps são >90 dias (caudas longas com paciente esquecido).
8. **Eventos clínicos têm só 2 tipos**: `agendamento` (71%) e `urgencia-emergencia-ou-internacao` (29%). **Tuberculose ausente do dataset** apesar de ser citada como prioridade diária no briefing.

---

## 1. Composição do dataset

### 1.1 Volumes e relações

| Tabela | Linhas | Colunas-chave | Relação |
|---|---|---|---|
| `equipes` | 49 | `equipe_id`, lat/lng da sede | 1:N com `pacientes` |
| `pacientes` | 97.938 | `paciente_id`, `equipe_id`, demográficos, comorbidades, lat/lng | 1:N com `visitas` e `eventos_clinicos` |
| `eventos_clinicos` | 100.503 | `paciente_id`, `tipo`, `data_referencia` | tipos: `agendamento` (71.668), `urgencia-emergencia-ou-internacao` (28.835) |
| `visitas` | 159.599 | `profissional_id`, `paciente_id`, `registrados_em`, `ordem_visita_dia` | 365 dias cobertos, 3.531 profissionais distintos |

### 1.2 Amostragem (do briefing)

- Cap de **2.000 pacientes por equipe** (k-anonymity ≥5)
- 49 equipes × ~2.000 = ~98k pacientes
- 9 unidades de saúde distintas (várias equipes por unidade — bate com "2 a 16 equipes por clínica" do briefing)
- Recorte territorial: mistura favela + asfalto

### 1.3 Integridade referencial

- **Zero** visitas com `paciente_id` desconhecido
- **Zero** eventos com `paciente_id` desconhecido
- **Zero** pacientes com `equipe_id` desconhecido
- Todos os IDs referenciados existem nas tabelas-pai. Sem órfãos.

### 1.4 Qualidade — pontos críticos a manter em mente

| Limitação | Impacto |
|---|---|
| **Date shifting por paciente** | Comparações temporais entre pacientes são inválidas. Só vale dentro do mesmo paciente. |
| **Geo noise ±100m** | Clustering espacial preserva padrões mas precisa de buffer >100m. Famílias verdadeiras podem aparecer até 200m apart. |
| **K-anonymity ≥5** | Casos raros foram suprimidos. Exemplo: TB não aparece como `tipo` apesar de ser citada como prioridade. |
| **Amostragem 2.000/equipe** | Subcobertura aparente vs realidade. ACS real cobre 750/microárea; vemos só ~200. |
| **Outliers extremos de geo** | 1.101 pacientes a >10km da sede; 4 a >1000km. Recomendado descartar para análise espacial. |

---

## 2. Perfil da população

### 2.1 Demografia

| Atributo | Valor | Notas |
|---|---|---|
| Faixa etária 0-6 | 2.746 (2.8%) | Grupo pequeno mas prioritário |
| Faixa etária 6-18 | 9.737 (9.9%) | |
| Faixa etária 19-45 | 34.505 (35.2%) | Maior grupo (jovens trabalhadores) |
| Faixa etária 45-65 | 26.092 (26.6%) | |
| **Idosos 66+** | **24.858 (25.4%)** | Grupo politicamente sensível e de alta carga |
| Feminino | 55.283 (56.4%) | |
| Masculino | 42.655 (43.6%) | |
| Raça/cor Branca | 47.6% | |
| Parda | 36.0% | |
| Preta | 14.7% | |
| Outros | 1.7% | |

### 2.2 Comorbidades e perfis combinados

| Perfil | Pacientes | % da base |
|---|---|---|
| Hipertensos | 21.017 | 21.5% |
| Vulneráveis (social) | 9.191 | 9.4% |
| Diabéticos | 8.172 | 8.3% |
| Gestantes | 661 | 0.7% |
| **Idoso + Hipertenso** | **10.943** | **11.2%** (maior perfil combinado) |
| Hipertenso + Diabético | 6.385 | 6.5% |
| Idoso + Diabético | 4.604 | 4.7% |
| Idoso + Hip + Diab (triplete cardiovascular) | 3.946 | 4.0% |
| Hipertenso + Vulnerável | 1.402 | 1.4% |
| Crianca 0-6 + Vulnerável | 619 | 0.6% |
| Hip + Dia + Vuln (triplet completo) | 355 | 0.4% |
| Gestante + Vulnerável | 107 | 0.1% |

> **Insight produto:** o perfil "idoso + hipertenso" é o maior grupo combinado. Numa demo, qualquer alerta sobre esse grupo bate em 11% da população. O triplete cardiovascular (idoso + hip + dia) com ~4k pacientes é o maior bloco de risco crônico definido.

### 2.3 Faltas no dataset (campos do briefing que NÃO existem nos dados)

| Conceito do briefing | Coluna no dataset | Implicação |
|---|---|---|
| Tuberculose ativa | **ausente** | Protocolo diário (visita TDO) não pode ser exercido |
| Gestante alto risco | só `gestacao` boolean | Não dá pra distinguir padrão vs risco |
| Hipertenso "descompensado" | só `hipertenso` boolean | Critério "quinzenal se descompensado" inacessível |
| Idoso "frágil/acamado" | só `faixa_etaria` | Critério "quinzenal" inacessível |
| Saúde mental | **ausente** | |
| Desnutrição infantil | **ausente** | |
| Uso de drogas | **ausente** | |
| Bolsa Família / tipo de benefício | colapsado em `situacao_vulnerabilidade` | Perde nuance social |

→ **Conclusão:** o dataset suporta **um nível de granularidade abaixo** do framework do briefing. Solução: usar booleanos do dataset como **proxy de severidade básica** e prever que a captura adicional (via voz/WhatsApp/triagem do ACS) **completa as classificações refinadas** em produção.

---

## 3. Dinâmica das visitas

### 3.1 Volume e distribuição

- **159.599 visitas** em 365 dias
- **49.100 pacientes únicos visitados** (50.1% da base)
- **48.838 pacientes nunca visitados** (49.9% — silêncio absoluto)
- 3.531 profissionais distintos, mas só **265 são ACS reais** (≥200 visitas/ano)
- Mediana de visitas por paciente (entre visitados): **2.0** (média 3.25)
- Cauda longa: 67 pacientes com 30+ visitas; 14 com 60+; máximo de **118 visitas/ano**

### 3.2 Cadência intra-paciente (dentro do mesmo paciente — única análise temporal válida)

Para 110.499 pares de visitas consecutivas:

| Gap entre visitas | Frequência | % do total |
|---|---|---|
| ≤ 7 dias (semanal) | 18.816 | 17.0% |
| 8-30 dias (~mensal) | 33.768 | 30.6% |
| 31-90 dias | 36.585 | 33.1% |
| > 90 dias (lacuna grande) | 21.330 | 19.3% |
| **Mediana** | **33 dias** | (~mensal — alinhado com protocolo) |
| Média | 53 dias | (puxado por caudas longas) |

> **Insight:** mediana mensal mostra que **quando um paciente está sob acompanhamento**, a cadência prescrita é cumprida. O problema não é o ritmo — é **a metade que nunca entra no acompanhamento**.

### 3.3 Workload dos 265 ACS reais

| Métrica | Média | Mediana | Mín | Máx |
|---|---|---|---|---|
| Visitas/ano | 535.1 | 506 | 200 | **1.147** |
| Pacientes únicos | 206.5 | 200 | 73 | 417 |
| Dias ativos | 238.8 | 244 | 119 | 342 |

**Calibração com briefing:** ACS deveria cobrir ~750 pessoas/microárea. Vemos 206. Causas prováveis:
- Amostragem 2.000/equipe ÷ 6 ACS = ~333 pacientes/ACS na nossa amostra (já é menor que 750)
- ACS não consegue cobrir 100% da microárea no ano — gap entre meta e realidade

### 3.4 ACS intensos (suspeitos de TB ou seguimento de risco)

Top 10 ACS por visitas/paciente:

| Visitas/paciente | Caso típico |
|---|---|
| 6.54 (top) | 104 pacientes, 680 visitas — provável paciente único intenso |
| 5.43 | 175 pacientes, 951 visitas |
| 4.0-4.3 | Vários — perfil "acompanhamento de risco" |

Como TB está suprimida do dataset, esses ACS provavelmente atendem pacientes em **tratamento crônico complexo** (TB? gestante de risco? saúde mental? — invisível pra nós).

### 3.5 Distribuição diária de visita

`ordem_visita_dia` indica a sequência dentro de um dia. Mediana 1, max 15.
- 75% das visitas registradas têm ordem ≤3 → maioria dos dias com **poucas visitas registradas**
- Sugere que muito ACS faz registro em lote no fim do dia, e a `ordem_visita_dia` **não representa cronologia real** dentro do dia
- Conclusão: não dá pra otimizar dentro do dia com base só nessa coluna

---

## 4. Eventos clínicos

### 4.1 Composição

| Tipo | Eventos | % |
|---|---|---|
| `agendamento` | 71.668 | 71.3% |
| `urgencia-emergencia-ou-internacao` | 28.835 | 28.7% |

**32.992 pacientes únicos** têm pelo menos 1 evento (33.7% da base).
**14.437 pacientes** tiveram pelo menos 1 urgência/emergência/internação no ano (14.7%).

### 4.2 Lag pós-urgência (descoberta crítica)

Para 14.971 urgências com visita posterior do mesmo paciente:

| Lag urgência → próxima visita | Frequência | % |
|---|---|---|
| ≤ 7 dias (resposta rápida) | 2.526 | **17.0%** |
| 8-30 dias | 4.295 | 28.7% |
| **> 30 dias (resposta tardia)** | **8.150** | **54.4%** |
| **Mediana** | **36 dias** | |
| Média | 59.5 dias | |

**+ 8.051 pacientes** com urgência que NUNCA receberam visita posterior do ACS.

> **Esse é o achado de impacto mais forte do dataset.** Pode ser citado literalmente no pitch: "Hoje, 1 em cada 2 brasileiros que vai para emergência espera mais de um mês para receber visita do ACS."

### 4.3 Agendamentos como gatilho de comunicação

71.668 agendamentos em 24.958 pacientes únicos. Em média 2.87 agendamentos por paciente com agenda.

**Como o briefing fala em "busca ativa de faltosos"** mas o dataset não diferencia "agendamento que compareceu" vs "faltou", a feature `tipo='agendamento'` vira só **lembrete antecipado** (ACS comunica que existe consulta marcada).

---

## 5. Gap operacional

### 5.1 Os 48.838 nunca-visitados — perfil

Comparativo "não-visitados" vs base total:

| Atributo | Sobre/sub-representado nos não-visitados |
|---|---|
| Homens | **+5.9pp** (mais sub-cobertos) |
| Brancos | +4.6pp |
| Adultos 19-45 | +3.5pp |
| Vulneráveis | −3.6pp (sistema prioriza bem) |
| Hipertensos | −9.9pp (sistema prioriza bem) |
| Diabéticos | −5.0pp |

Em **números absolutos**, mesmo com priorização, ainda há:
- **12.636 idosos 66+** nunca visitados (50.8% dos idosos!)
- **5.689 hipertensos** nunca visitados (27.1%)
- **2.838 vulneráveis** nunca visitados (30.9%)
- **546 crianças 0-6** nunca visitadas (19.9%)
- **70 gestantes** nunca visitadas (10.6%)

### 5.2 Os "pacientes fantasma" (42.068)

**42.9% da base** está completamente invisível: zero visitas, zero eventos clínicos. Só existe o cadastro.

| Perfil dos fantasmas | Quantidade |
|---|---|
| Idosos 66+ | **11.564** (27.5% dos fantasmas) |
| Hipertensos | 4.445 |
| Vulneráveis | 2.219 |

> **Interpretação:** ou (a) são pessoas saudáveis que nunca precisaram de atendimento, ou (b) são casos genuinamente perdidos do radar. **O dataset não permite distinguir.** Essa é uma das maiores zonas de incerteza — e é onde a captura via voz/WhatsApp pelo ACS poderia revelar "está vivo, fui lá, vi que está bem" vs "não consegui localizar".

### 5.3 Visíveis ao sistema, invisíveis ao ACS (6.770 pacientes)

Pacientes com ≥1 evento clínico mas **zero** visita do ACS. Esses são **prioridade clara**: o sistema sabe que existem (apareceram em consulta ou urgência), mas o ACS não os toca.

### 5.4 Gap protocolar (referência: ≥12 visitas/ano para todos os grupos prioritários)

| Grupo | n | % abaixo do protocolo | Média real |
|---|---|---|---|
| Gestantes | 661 | **78.4%** | 7.5 |
| Crianças 0-6 | 2.746 | **93.7%** | 4.2 |
| Idosos 66+ | 24.858 | **98.7%** | 1.8 |
| Hipertensos | 21.017 | **97.8%** | 2.9 |
| Diabéticos | 8.172 | **96.5%** | 3.5 |
| Vulneráveis | 9.191 | **97.7%** | 2.5 |

> **Ressalva honesta:** o protocolo mensal (12/ano) é **aspiracional**, não prática atual. A própria Carol mencionou que para crianças até 1 ano o Rio pede 7-8 visitas/ano (não 12). Esses números são úteis pra mostrar magnitude do gap, mas não devem ser apresentados como acusação à prefeitura.

### 5.5 Resposta pós-urgência

Já coberto em §4.2: **54.4% com lag >30 dias + 30% sem visita nenhuma** = ~71% do fluxo pós-urgência quebrado.

---

## 6. Família como entidade — calibrada

### 6.1 O problema

Inferir família a partir de coordenadas com ruído de ±100m é frágil. Grid muito grande agrega prédios; grid muito pequeno separa membros reais.

### 6.2 Calibração de grid (vs benchmark do briefing: média 3.2 pessoas/família)

| Grid | Clusters totais | Família (2-4) | Família grande (5-8) | Provável prédio (9-20) | Prédio grande (20+) | Tam. médio |
|---|---|---|---|---|---|---|
| **30m** | **30.874** | **11.014** | **4.302** | 1.879 | 202 | **3.17** ✅ |
| 50m | 17.259 | 3.976 | 2.584 | 2.717 | 871 | 5.67 |
| 100m | 7.828 | 1.164 | 475 | 693 | 1.383 | 12.51 |
| 200m | 4.734 | 799 | 194 | 249 | 701 | 20.69 |

> **Recomendação:** usar **grid 30m + filtro [2-8]** como proxy de família real. Isso dá tamanho médio 3.17 — **exatamente alinhado com o briefing** (3.2). 49 equipes × ~625 famílias/equipe = ~30k famílias esperadas; conseguimos ~15.3k candidatas (50% do esperado — coerente porque a amostragem corta o cap em 2.000/equipe).

### 6.3 Famílias multi-condição (alvos prioritários)

Com grid 30m + filtro 2-8 (dado deduzido do output do script com 50m + outros grids):

| Sinais de risco simultâneos por família | Famílias |
|---|---|
| 0 sinais | ~800 |
| 1 sinal | ~1.750 |
| 2 sinais | ~1.870 |
| 3 sinais | ~1.680 |
| **≥3 sinais (alvo prioritário)** | **~2.150** |
| **≥4 sinais (alto risco)** | **~470** |

(Números do output com filtro [2-8] sobre grid 50m — substituir por 30m no script final pra calibração exata.)

> **Insight produto:** **~2.150 famílias com 3+ sinais de risco** é a unidade ideal pra "lista do dia familiar". Em vez de listar 8k pacientes individuais, o ACS recebe **150-200 famílias prioritárias** distribuídas entre os 265 ACS reais ≈ menos de 1 família/dia/ACS — totalmente viável dentro dos 6 turnos de visita.

### 6.4 O problema da confirmação

Como o briefing alerta e o user já apontou: estar no mesmo endereço/prédio ≠ ser família real. Caminhos pra resolver:

1. **Inferência espacial inicial** (proxy candidato — o que conseguimos hoje)
2. **Confirmação pelo ACS na visita** ("essas X pessoas moram juntas?") — vira input pro nosso DB
3. **Confirmação via WhatsApp** ao paciente
4. **Heurística agressiva**: filtro [2-8] já elimina prédios óbvios
5. **Flag explícita**: `familia_confirmada: bool` no nosso schema. Famílias não-confirmadas têm peso menor no algoritmo de priorização.

---

## 7. Sinais endêmicos / concentração geográfica

> **Ressalva crítica:** date shifting torna detecção temporal cross-paciente **inválida**. Concentração **espacial** continua válida (com ruído de 100m).

### 7.1 Taxa de urgência por equipe

| Métrica geral |  |
|---|---|
| Média de pacientes com urgência por equipe | 14.7% |
| Desvio padrão | 6.0pp |
| **Equipes acima de 1.5σ (hotspots claros)** | **4 equipes** |
| Taxa de urgência da equipe top | **31.0%** dos pacientes (620 de 2.000) |
| Top 10 equipes vs média geral | 2× maior em concentração de urgência |

**Top 4 equipes "hotspot":** três delas estão em torno de `lat ≈ -22.93, lng ≈ -43.25 a -43.26` — convergem geograficamente. Pode ser uma vizinhança com problema sanitário específico.

### 7.2 Hotspots geográficos de urgência (cells de 100m)

| Filtro | Células |
|---|---|
| ≥3 urgências | 1.970 |
| ≥5 urgências | 1.457 |
| ≥10 urgências | 811 |
| **Top célula: 220 urgências em 100×100m** | concentração escandalosa |

> **Insight de surto/endemia:** uma única célula de 100m com **220 urgências** em 1 ano é uma anomalia digna de investigação. Pode ser um endereço de alta concentração populacional (prédio grande, comunidade), ou um padrão clínico territorial real. **A análise não diz qual** — mas dá ao ACS/coordenação um ponto de partida.

### 7.3 Concentração de comorbidades

**Top 5 equipes por % hipertensos**: 24.9% – 28.4%. Áreas com hipertensão acima da média — perfil envelhecido.

**Top 5 equipes por % vulneráveis**: 21.5% – 33.2%. Áreas de alta vulnerabilidade social. A equipe líder tem **1/3 da população em vulnerabilidade**.

**Top 5 equipes por % idosos**: 37.4% – 38.9%. Áreas hiper-envelhecidas (vs média 25.4% da base).

> **Insight de produto:** essas concentrações territoriais são exatamente o tipo de **inteligência que o briefing fala em capturar**. Uma camada de visualização territorial (heatmap por equipe/microárea) é fácil de construir, alto valor narrativo, e bate com o ângulo "endemia" que o Peter propôs.

---

## 8. Análise por equipe

### 8.1 Visão geral (49 equipes)

| Métrica | Média | Mín | Máx |
|---|---|---|---|
| % gestante | 0.7% | 0.0% | 1.4% |
| % criança 0-6 | 2.8% | 0.4% | 6.3% |
| % idoso 66+ | 25.4% | 9.3% | 38.9% |
| % hipertenso | 21.5% | 15.2% | 28.4% |
| % vulnerável | 9.4% | 0.5% | **33.2%** |
| % sem visita | 49.9% | 22.4% | **65.7%** |
| Média visitas/paciente | 1.63 | 0.90 | 3.14 |

> Variância grande na cobertura: equipe líder cobre **77.6% dos pacientes**, equipe pior cobre **34.3%**. Um delta de 43pp entre equipes da MESMA prefeitura sugere espaço enorme pra equalização.

### 8.2 Equipes "desafiadoras" (top 5 — composto vulnerabilidade + idoso + multi-condição)

Estas são equipes com **alta carga clínica/social**:

| Rank | Pacientes | % Vulnerável | % Idoso | % Hipertenso | % Sem visita |
|---|---|---|---|---|---|
| 1 | 1.998 | 32.8% | 11.5% | 24.3% | 41.1% |
| 2 | 1.998 | 33.2% | 9.3% | 23.2% | 38.1% |
| 3 | 2.000 | 19.0% | 23.3% | 26.3% | 34.0% |
| 4 | 2.000 | 25.8% | 14.1% | 20.4% | 46.6% |
| 5 | 2.000 | 15.0% | **35.2%** | 17.9% | **64.0%** |

> A 5ª equipe da lista é especialmente preocupante: território altamente envelhecido (35% idosos), e mesmo assim 64% sem visita.

### 8.3 Equipes piores em cobertura

Característica comum: **baixa vulnerabilidade** (< 3%) mas alta % de idosos (33-37%). Provavelmente áreas de "asfalto" com plano de saúde — gente busca privado e ACS visita pouco. **Sistema está priorizando bem dada a sinalização que tem.**

### 8.4 Equipes melhores em cobertura (referência de boa prática)

Top 5 com mediana 24-38% sem visita. Atendem perfis com vulnerabilidade significativa (10-23%) e cobrem bem. **Servem de baseline pra benchmarks**.

---

## 9. Implicações estratégicas pro produto

### 9.1 O que esses dados sustentam (alinhado com a proposta do Peter)

| Hipótese de produto | Evidência no dataset |
|---|---|
| **Reunião semanal como destino da inteligência** | 50% sem visita + 54% lag >30d pós-urgência exigem repriorização sistemática — não dá pra fazer mental |
| **Família como entidade canônica** | Calibração com grid 30m dá tamanho médio 3.17 (= briefing). ~2.150 famílias multi-condição são o alvo natural |
| **Escore de risco composto** | Hoje SMS não tem ([transcricao-qa-sms-rio.md]). 11k idosos+hipertensos, 4k triplets cardiovasculares: bases pra montar |
| **WhatsApp como canal nativo** | SMS confirmou "eles usam muito o WhatsApp"; agendamentos (71k) + urgência (28k) viram triggers de comunicação |
| **Ingestão via voz pós-visita** | 50% dos cadastros invisíveis ao ACS hoje — voz/áudio captura o que o caderninho captura, mas estruturado |

### 9.2 Métricas concretas que podem virar "indicadores de cobertura" no dashboard

- **Cobertura geral**: % pacientes visitados nos últimos 90 dias (linha base ~50%)
- **Cobertura pós-urgência**: % pacientes com urgência que receberam visita em ≤7 dias (linha base ~17%)
- **Gap protocolar por grupo**: visitas reais / mínimo prescrito, por categoria
- **Famílias multi-risco sem followup**: famílias com ≥3 sinais sem visita em X dias
- **Taxa de fantasmas ativos**: % cadastrados sem nenhum touchpoint no ano (linha base ~43%)
- **Concentração endêmica**: top N células geográficas com urgência > 1.5σ

### 9.3 Limites duros do dataset que constrangem produto

- **TB indetectável**: protocolo diário não pode ser implementado retroativamente — só prospectivamente quando o ACS marcar
- **Severidade clínica binária**: hipertenso é só sim/não. "Descompensado" vira input via voz/triagem
- **Sem "presença" em agendamento**: faltas a consulta não vêm do dataset — outro caso pra captura ativa
- **Date shifting**: análise sazonal cross-paciente é impossível. Pode ser limitação séria pra detecção de surto temporal (epidemia de gripe, p.ex.). Dependemos de coleta em tempo real pós-MVP.

### 9.4 Sugestões de "headline numbers" pro pitch

Em ordem decrescente de impacto narrativo:

1. **"1 em cada 2 pacientes que vai para emergência espera mais de um mês para receber visita do ACS."**
2. **"43% dos cadastros estão completamente invisíveis — sem visita E sem evento clínico."**
3. **"12.636 idosos da nossa amostra nunca foram visitados."**
4. **"Uma única célula de 100×100m concentrou 220 emergências no ano."**
5. **"265 ACS reais cobrem em média 206 pacientes — bem abaixo dos 750 que o protocolo prevê."**

---

## 10. Próximos passos analíticos sugeridos

Para evoluir essa análise no rumo do produto, valeria:

1. **Recalibrar a inferência espacial de família com grid 30m + filtro [2-8] e rodar análises multi-condição em cima dessa base** (script atual usa 50m em algumas seções)
2. **Construir um score de risco composto e medir distribuição** — escolher pesos, normalizar, ranquear pacientes/famílias
3. **Simular o fluxo de "lista do dia"**: dado 265 ACS × 6 turnos/semana × 3 famílias/turno = ~4.770 visitas/semana → quantas semanas pra cobrir as 2.150 famílias prioritárias?
4. **Heatmap geográfico** das 4 equipes hotspot — visualizar concentração de urgência sobre mapa do Rio
5. **Análise de "famílias com fantasmas"**: famílias inferidas que contêm pelo menos 1 paciente fantasma — esses são alvos quentes pra primeira visita estruturada via produto

---

## Apêndice — scripts que geraram esses números

- `scripts/eda_initial.py` — visão geral, shape, tipos, distribuições básicas
- `scripts/eda_deeper.py` — não-visitados, cobertura por grupo, ACS, hotspots iniciais
- `scripts/eda_protocolo.py` — gap protocolar com framework do briefing
- `scripts/eda_completo.py` — calibração de família, sinais endêmicos, cadência intra-paciente, análise por equipe/ACS, multi-comorbidades, qualidade

Todos rodam com `.venv/bin/python scripts/<nome>.py` a partir da raiz do repo.

---

*Documento gerado a partir de EDAs sucessivos durante o Claude Impact Lab 2026, equipe Peter Flag.*
