import { SectionHead } from '@/components/section-head';
import { ScoreSimulator } from '@/components/score-simulator';

export default function EntendaOScore() {
  const BANDS = [
    { label: 'CRÍTICO', range: '≥ 80 pontos', color: 'var(--priority-1)', bg: 'rgba(220,53,69,.07)', text: '#9b1c28', desc: 'Risco imediato. Urgências recentes, invisível de alto risco ou múltiplos fatores acumulados. Visita prioritária na semana corrente.' },
    { label: 'URGENTE', range: '50 – 79', color: 'var(--priority-2)', bg: 'rgba(253,126,20,.07)', text: '#8d4a0c', desc: 'Risco elevado. Déficit de visitas em paciente de alto risco clínico ou urgência recente. Visita nos próximos 7 dias.' },
    { label: 'ATENÇÃO', range: '20 – 49', color: 'var(--priority-3)', bg: 'rgba(255,193,7,.10)', text: '#856404', desc: 'Risco moderado. Paciente crônico com déficit leve ou situação de vulnerabilidade. Visita no ciclo atual.' },
    { label: 'ROTINA',  range: '< 20',    color: 'var(--priority-4)', bg: 'rgba(40,167,69,.07)',  text: '#1a6630', desc: 'Dentro do prazo recomendado. Sem fatores de risco agudos. Visita conforme calendário regular.' },
  ];

  const CLINICAL = [
    { perfil: 'Gestante', peso: 40 },
    { perfil: 'Criança 0–6 anos', peso: 35 },
    { perfil: 'Hipertenso + Diabético', peso: 30 },
    { perfil: 'Hipertenso', peso: 20 },
    { perfil: 'Diabético', peso: 20 },
    { perfil: 'Idoso 66+', peso: 15 },
  ];

  const REGUA = [
    { perfil: 'Criança 0–6 anos', min: 7 },
    { perfil: 'Gestante', min: 6 },
    { perfil: 'Hipertenso / Diabético / Hipertenso+Diabético', min: 4 },
    { perfil: 'Idoso 66+', min: 4 },
    { perfil: 'Demais pacientes', min: 2 },
  ];

  const URGENCIA = [
    { janela: 'Últimos 30 dias', peso: 25, exemplo: '1 urgência = +25 pts' },
    { janela: 'Últimos 90 dias', peso: 15, exemplo: '2 urgências = +30 pts' },
    { janela: 'Últimos 180 dias', peso: 8, exemplo: '3 urgências = +24 pts' },
    { janela: 'No ano', peso: 3, exemplo: '10 urgências = +30 pts' },
  ];

  const INVISIVEL = [
    { cat: '1', label: 'Crise sem vínculo', color: 'var(--priority-1)', bg: 'rgba(220,53,69,.07)', text: '#9b1c28', bonus: '+50 pts', crit: '0 visitas no ano + 3 ou mais urgências' },
    { cat: '2', label: 'Alto risco sem contato', color: 'var(--priority-2)', bg: 'rgba(253,126,20,.07)', text: '#8d4a0c', bonus: '+30 pts', crit: '0 visitas no ano + perfil de alto risco clínico' },
    { cat: '3', label: 'Sem condição especial', color: 'var(--grey-bar)', bg: 'var(--grey-card)', text: 'var(--grey-dark)', bonus: '0', crit: '0 visitas no ano + sem condição especial identificada' },
  ];

  return (
    <div className="space-y-12">

      {/* Page header */}
      <header>
        <p className="t-section-label">Metodologia</p>
        <h1 className="t-section-title">Entenda o Score</h1>
        <p className="text-base mt-3 max-w-2xl leading-loose" style={{ color: 'var(--grey-text)' }}>
          O Score de Risco ACS é um número composto calculado para cada paciente, combinando perfil clínico,
          situação social, régua de visitas e histórico de urgências. Ele orienta a priorização das visitas
          domiciliares na reunião semanal da equipe.
        </p>
      </header>

      {/* 1 — Faixas */}
      <section>
        <SectionHead
          eyebrow="01 — Classificação"
          title="Faixas de Prioridade"
          sub="O score vai de 0 a 250+, sem teto. As quatro faixas abaixo determinam a cor do card do paciente e a urgência da visita."
        />
        <div className="space-y-2">
          {BANDS.map(b => (
            <div
              key={b.label}
              className="flex items-center gap-5 rounded-sm px-5 py-4"
              style={{ border: `1px solid ${b.color}`, background: b.bg }}
            >
              <div className="shrink-0 w-28">
                <span
                  className="inline-block text-xs font-black uppercase tracking-wide px-3 py-1 rounded-sm"
                  style={{ background: b.color, color: '#fff' }}
                >
                  {b.label}
                </span>
                <p className="text-xs font-bold mt-1.5 font-mono" style={{ color: b.text }}>{b.range}</p>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: b.text }}>{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 2 — Score clínico */}
      <section>
        <SectionHead
          eyebrow="02 — Componentes"
          title="Score Clínico"
          sub="Pontuação fixa por perfil de saúde. Os perfis são cumulativos — um paciente hipertenso e idoso soma os dois pesos."
        />
        <div className="rounded-sm overflow-hidden" style={{ border: '1px solid var(--grey-mid)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--grey-card)' }}>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--grey-text)' }}>Perfil</th>
                <th className="text-right px-5 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--grey-text)' }}>Pontos</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide hidden md:table-cell" style={{ color: 'var(--grey-text)' }}>Régua de Visitas / Ano</th>
              </tr>
            </thead>
            <tbody>
              {CLINICAL.map((c, i) => {
                const regua = REGUA.find(r => r.perfil.startsWith(c.perfil.split(' ')[0]) || (c.perfil.includes('Hipertenso + Diabético') && r.perfil.includes('Hipertenso')));
                return (
                  <tr key={c.perfil} style={{ borderTop: i > 0 ? '1px solid var(--grey-mid)' : undefined }}>
                    <td className="px-5 py-3 font-bold" style={{ color: 'var(--grey-dark)' }}>{c.perfil}</td>
                    <td className="px-5 py-3 text-right font-mono font-black text-base" style={{ color: 'var(--blue-primary)' }}>+{c.peso}</td>
                    <td className="px-5 py-3 hidden md:table-cell text-sm" style={{ color: 'var(--grey-text)' }}>
                      {regua ? `Mínimo ${regua.min} visitas/ano` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          className="mt-3 px-5 py-4 rounded-sm text-sm leading-relaxed"
          style={{ background: 'rgba(0,74,128,.06)', borderLeft: '3px solid var(--blue-primary)', color: 'var(--grey-text)' }}
        >
          <strong style={{ color: 'var(--grey-dark)' }}>Déficit de visitas:</strong> para cada visita abaixo do mínimo anual recomendado, somam-se <strong>+8 pontos</strong>. Um paciente gestante sem nenhuma visita ganha +48 pts (6 visitas × 8) além dos +40 pts clínicos.
        </div>
      </section>

      {/* 3 — Régua de visitas */}
      <section>
        <SectionHead
          eyebrow="03 — Temporal"
          title="Régua de Visitas"
          sub="Mínimo de visitas domiciliares por ano, por perfil. Baseado na norma técnica da SMS Rio."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {REGUA.map(r => (
            <div
              key={r.perfil}
              className="rounded-sm px-5 py-4"
              style={{ background: 'var(--grey-card)', border: '1px solid var(--grey-mid)' }}
            >
              <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--grey-text)' }}>{r.perfil}</p>
              <p className="text-3xl font-black" style={{ color: 'var(--blue-primary)' }}>{r.min}<span className="text-sm font-bold ml-1" style={{ color: 'var(--grey-text)' }}>vis/ano</span></p>
            </div>
          ))}
        </div>
      </section>

      {/* 4 — Urgência */}
      <section>
        <SectionHead
          eyebrow="04 — Urgência"
          title="Score por Urgências"
          sub="Calculado em 4 janelas temporais cumulativas. O mesmo evento conta em todas as janelas em que se enquadra — é um acúmulo de risco, não uma contagem única."
        />
        <div className="rounded-sm overflow-hidden" style={{ border: '1px solid var(--grey-mid)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--grey-card)' }}>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--grey-text)' }}>Janela</th>
                <th className="text-right px-5 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--grey-text)' }}>Pts por evento</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide hidden md:table-cell" style={{ color: 'var(--grey-text)' }}>Exemplo</th>
              </tr>
            </thead>
            <tbody>
              {URGENCIA.map((u, i) => (
                <tr key={u.janela} style={{ borderTop: i > 0 ? '1px solid var(--grey-mid)' : undefined }}>
                  <td className="px-5 py-3 font-bold" style={{ color: 'var(--grey-dark)' }}>{u.janela}</td>
                  <td className="px-5 py-3 text-right font-mono font-black text-base" style={{ color: 'var(--priority-1)' }}>×{u.peso}</td>
                  <td className="px-5 py-3 hidden md:table-cell text-sm" style={{ color: 'var(--grey-text)' }}>{u.exemplo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5 — Gatilhos */}
      <section>
        <SectionHead
          eyebrow="05 — Gatilhos"
          title="Pontos Adicionais"
          sub="Somados ao score base quando as condições são detectadas."
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Situação de vulnerabilidade social', pts: '+10', hint: 'Baseado no campo situacao_vulnerabilidade do cadastro' },
            { label: 'Agendamento futuro registrado', pts: '+10', hint: 'Evento do tipo "agendamento" com data após 2025-12-31' },
            { label: 'Alerta crítico aberto (P1)', pts: '+20', hint: 'Alerta de prioridade 1 sem resolução registrada' },
          ].map(g => (
            <div
              key={g.label}
              className="rounded-sm px-5 py-4"
              style={{ background: 'var(--grey-card)', border: '1px solid var(--grey-mid)' }}
            >
              <p className="text-3xl font-black mb-1" style={{ color: 'var(--blue-primary)' }}>{g.pts}</p>
              <p className="text-sm font-bold mb-1" style={{ color: 'var(--grey-dark)' }}>{g.label}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--grey-text)' }}>{g.hint}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6 — Invisíveis */}
      <section>
        <SectionHead
          eyebrow="06 — Pacientes Invisíveis"
          title="Categorias de Invisibilidade"
          sub="Pacientes sem nenhuma visita registrada no ano são classificados em 3 categorias. Além do bônus de pontuação, entram na seção 'Invisíveis' do painel."
        />
        <div className="space-y-3">
          {INVISIVEL.map(inv => (
            <div
              key={inv.cat}
              className="rounded-sm px-5 py-4 flex items-start gap-5"
              style={{ border: `1px solid ${inv.color}`, background: inv.bg }}
            >
              <div className="shrink-0 text-center">
                <p
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-black"
                  style={{ background: inv.color, color: '#fff' }}
                >
                  {inv.cat}
                </p>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <p className="font-black text-base" style={{ color: inv.text }}>{inv.label}</p>
                  {inv.bonus !== '0' && (
                    <span
                      className="text-xs font-black px-2 py-0.5 rounded-sm"
                      style={{ background: inv.color, color: '#fff' }}
                    >
                      {inv.bonus}
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: inv.text }}>{inv.crit}</p>
              </div>
            </div>
          ))}
        </div>
        <div
          className="mt-4 px-5 py-4 rounded-sm text-sm leading-relaxed"
          style={{ background: 'rgba(0,74,128,.06)', borderLeft: '3px solid var(--blue-primary)', color: 'var(--grey-text)' }}
        >
          <strong style={{ color: 'var(--grey-dark)' }}>Atenção:</strong> as categorias não são excludentes da priorização principal. Um paciente cat. 1 pode ser CRÍTICO por outros fatores além do bônus de invisibilidade.
        </div>
      </section>

      {/* 7 — Exemplo */}
      <section>
        <SectionHead
          eyebrow="07 — Exemplo Prático"
          title="Como o Score é Calculado"
          sub="Cálculo hipotético para uma paciente gestante, hipertensa, em situação de vulnerabilidade, com 2 urgências no mês e sem nenhuma visita no ano."
        />
        <div className="rounded-sm overflow-hidden" style={{ border: '1px solid var(--grey-mid)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--grey-card)' }}>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--grey-text)' }}>Componente</th>
                <th className="text-right px-5 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--grey-text)' }}>Pontos</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Score clínico — Gestante', '+40'],
                ['Score clínico — Hipertensa', '+20'],
                ['Score social — Vulnerabilidade', '+10'],
                ['Déficit temporal — 6 visitas abaixo do mínimo (6 × 8)', '+48'],
                ['Urgência 30d — 2 × 25', '+50'],
                ['Urgência 90d — 2 × 15', '+30'],
                ['Bônus invisível — Alto risco sem visita', '+30'],
              ].map(([comp, pts], i) => (
                <tr key={comp} style={{ borderTop: i > 0 ? '1px solid var(--grey-mid)' : undefined }}>
                  <td className="px-5 py-3" style={{ color: 'var(--grey-dark)' }}>{comp}</td>
                  <td className="px-5 py-3 text-right font-mono font-bold" style={{ color: 'var(--blue-primary)' }}>{pts}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid var(--blue-primary)', background: 'rgba(0,74,128,.04)' }}>
                <td className="px-5 py-3 font-black text-base" style={{ color: 'var(--blue-secondary)' }}>Total</td>
                <td className="px-5 py-3 text-right font-mono font-black text-xl" style={{ color: 'var(--priority-1)' }}>228</td>
              </tr>
              <tr style={{ borderTop: '1px solid var(--grey-mid)', background: 'rgba(220,53,69,.05)' }}>
                <td className="px-5 py-3 text-sm" style={{ color: '#9b1c28' }}>Classificação resultante</td>
                <td className="px-5 py-3 text-right">
                  <span
                    className="inline-block text-xs font-black uppercase tracking-wide px-3 py-1 rounded-sm"
                    style={{ background: 'var(--priority-1)', color: '#fff' }}
                  >
                    CRÍTICO
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 8 — Simulador */}
      <section>
        <SectionHead
          eyebrow="08 — Simulador"
          title="Simule a Composição do Score"
          sub="Marque as condições do paciente e ajuste as quantidades para ver o score calculado em tempo real, com o detalhamento de cada componente."
        />
        <ScoreSimulator />
      </section>

    </div>
  );
}
