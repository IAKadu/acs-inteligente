'use client';

import { useState } from 'react';

function scoreToPriority(score: number) {
  if (score >= 80) return 1;
  if (score >= 50) return 2;
  if (score >= 20) return 3;
  return 4;
}

const PRIORITY_LABEL: Record<number, string> = { 1: 'CRÍTICO', 2: 'URGENTE', 3: 'ATENÇÃO', 4: 'ROTINA' };
const PRIORITY_COLOR: Record<number, string> = {
  1: 'var(--priority-1)',
  2: 'var(--priority-2)',
  3: 'var(--priority-3)',
  4: 'var(--priority-4)',
};
const PRIORITY_BG: Record<number, string> = {
  1: 'rgba(220,53,69,.07)',
  2: 'rgba(253,126,20,.07)',
  3: 'rgba(255,193,7,.10)',
  4: 'rgba(40,167,69,.07)',
};
const PRIORITY_TEXT: Record<number, string> = {
  1: '#9b1c28',
  2: '#8d4a0c',
  3: '#856404',
  4: '#1a6630',
};

interface State {
  gestacao: boolean;
  crianca: boolean;
  hipertenso: boolean;
  diabetico: boolean;
  idoso: boolean;
  vulneravel: boolean;
  agendamento: boolean;
  semVisita: boolean;
  criseSemVinculo: boolean;
  deficit: number;
  urg30: number;
  urg90: number;
  urg180: number;
  urgano: number;
}

function compute(s: State) {
  let scoreClinico = 0;
  if (s.gestacao) scoreClinico += 40;
  if (s.crianca) scoreClinico += 35;
  if (s.hipertenso && s.diabetico) scoreClinico += 30;
  else if (s.hipertenso) scoreClinico += 20;
  else if (s.diabetico) scoreClinico += 20;
  if (s.idoso) scoreClinico += 15;
  if (s.vulneravel) scoreClinico += 10;

  const minimoVisitas = s.crianca ? 7 : s.gestacao ? 6 : (s.hipertenso || s.diabetico || s.idoso) ? 4 : 2;
  const semVisitaEfetivo = s.semVisita || s.criseSemVinculo;
  const deficit = semVisitaEfetivo && s.deficit === 0 ? minimoVisitas : s.deficit;
  const scoreDeficit = deficit * 8;

  const scoreUrgencia = s.urg30 * 25 + s.urg90 * 15 + s.urg180 * 8 + s.urgano * 3;
  const scoreAgendamento = s.agendamento ? 10 : 0;

  const altoRisco = s.gestacao || s.crianca || s.hipertenso || s.diabetico || s.idoso || s.vulneravel;
  let scoreBonus = 0;
  if (semVisitaEfetivo && altoRisco) scoreBonus += 30;
  if (s.criseSemVinculo) scoreBonus += 50;

  const total = scoreClinico + scoreDeficit + scoreUrgencia + scoreAgendamento + scoreBonus;

  return {
    total,
    deficit,
    deficitAuto: semVisitaEfetivo && s.deficit === 0,
    rows: [
      { label: 'Perfil clínico / social', value: scoreClinico },
      { label: `Déficit de visitas (${deficit}${semVisitaEfetivo && s.deficit === 0 ? ' auto' : ''})`, value: scoreDeficit },
      { label: 'Urgências recentes', value: scoreUrgencia },
      { label: 'Agendamento futuro', value: scoreAgendamento },
      { label: 'Bônus invisível', value: scoreBonus },
    ],
  };
}

const INITIAL: State = {
  gestacao: false, crianca: false, hipertenso: false, diabetico: false,
  idoso: false, vulneravel: false, agendamento: false, semVisita: false,
  criseSemVinculo: false, deficit: 0, urg30: 0, urg90: 0, urg180: 0, urgano: 0,
};

export function ScoreSimulator() {
  const [s, setS] = useState<State>(INITIAL);

  const toggle = (key: keyof State) =>
    setS(prev => ({ ...prev, [key]: !prev[key] }));

  const setNum = (key: keyof State, val: number) =>
    setS(prev => ({ ...prev, [key]: Math.max(0, val) }));

  const { total, rows } = compute(s);
  const priority = scoreToPriority(total);

  const CHECKS: { key: keyof State; label: string }[] = [
    { key: 'gestacao',        label: 'Gestante' },
    { key: 'crianca',         label: 'Criança 0–6 anos' },
    { key: 'hipertenso',      label: 'Hipertenso' },
    { key: 'diabetico',       label: 'Diabético' },
    { key: 'idoso',           label: 'Idoso 66+' },
    { key: 'vulneravel',      label: 'Vulnerável' },
    { key: 'agendamento',     label: 'Consulta agendada' },
    { key: 'semVisita',       label: 'Sem visita no ano' },
    { key: 'criseSemVinculo', label: '0 visitas + 3+ urgências' },
  ];

  const NUMS: { key: keyof State; label: string; max: number }[] = [
    { key: 'deficit', label: 'Visitas faltantes', max: 12 },
    { key: 'urg30',   label: 'Urgências — 30 dias', max: 20 },
    { key: 'urg90',   label: 'Urgências — 90 dias', max: 20 },
    { key: 'urg180',  label: 'Urgências — 180 dias', max: 20 },
    { key: 'urgano',  label: 'Urgências — no ano', max: 50 },
  ];

  return (
    <div
      className="rounded-md overflow-hidden"
      style={{ border: '1px solid var(--grey-mid)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div
        className="px-5 py-3 text-sm font-bold uppercase tracking-wide"
        style={{ background: 'var(--blue-primary)', color: '#fff' }}
      >
        Simulador interativo
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Left — inputs */}
        <div className="px-5 py-5 space-y-5" style={{ borderRight: '1px solid var(--grey-mid)' }}>
          {/* Checkboxes */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--grey-text)' }}>
              Perfil do paciente
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
              {CHECKS.map(c => (
                <label
                  key={c.key}
                  className="flex items-center gap-2 cursor-pointer select-none text-sm"
                  style={{ color: 'var(--grey-dark)' }}
                >
                  <input
                    type="checkbox"
                    checked={s[c.key] as boolean}
                    onChange={() => toggle(c.key)}
                    className="w-4 h-4 accent-blue-700 shrink-0"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          {/* Number inputs */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--grey-text)' }}>
              Quantidades
            </p>
            <div className="space-y-2">
              {NUMS.map(n => (
                <div key={n.key} className="flex items-center justify-between gap-4">
                  <label className="text-sm flex-1" style={{ color: 'var(--grey-dark)' }}>{n.label}</label>
                  <input
                    type="number"
                    min={0}
                    max={n.max}
                    value={s[n.key] as number}
                    onChange={e => setNum(n.key, Number(e.target.value))}
                    className="w-20 text-right rounded px-2 py-1 text-sm font-mono font-bold"
                    style={{
                      border: '1px solid var(--grey-mid)',
                      background: 'var(--grey-card)',
                      color: 'var(--blue-primary)',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Reset */}
          <button
            onClick={() => setS(INITIAL)}
            className="text-xs font-bold uppercase tracking-wide mt-1"
            style={{ color: 'var(--grey-text)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Limpar tudo
          </button>
        </div>

        {/* Right — result */}
        <div className="px-5 py-5 flex flex-col gap-5">
          {/* Score + band */}
          <div
            className="rounded-md px-6 py-5 flex flex-col items-center justify-center gap-2 text-center"
            style={{ background: PRIORITY_BG[priority], border: `2px solid ${PRIORITY_COLOR[priority]}` }}
          >
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: PRIORITY_TEXT[priority] }}
            >
              Score de Risco
            </span>
            <span
              className="text-6xl font-black leading-none"
              style={{ color: PRIORITY_COLOR[priority] }}
            >
              {total}
            </span>
            <span
              className="inline-block text-sm font-black uppercase tracking-wide px-4 py-1.5 rounded"
              style={{ background: PRIORITY_COLOR[priority], color: '#fff' }}
            >
              {PRIORITY_LABEL[priority]}
            </span>
          </div>

          {/* Breakdown */}
          <div className="rounded-md overflow-hidden" style={{ border: '1px solid var(--grey-mid)' }}>
            {rows.map((r, i) => (
              <div
                key={r.label}
                className="flex items-center justify-between px-4 py-2 text-sm"
                style={{
                  borderTop: i > 0 ? '1px solid var(--grey-mid)' : undefined,
                  background: i % 2 === 0 ? '#fff' : 'var(--grey-card)',
                }}
              >
                <span style={{ color: 'var(--grey-text)' }}>{r.label}</span>
                <span className="font-mono font-bold" style={{ color: r.value > 0 ? 'var(--blue-primary)' : 'var(--grey-mid)' }}>
                  +{r.value}
                </span>
              </div>
            ))}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderTop: `2px solid var(--blue-primary)`, background: 'rgba(0,74,128,.04)' }}
            >
              <span className="font-black text-sm" style={{ color: 'var(--blue-secondary)' }}>Total</span>
              <span className="font-mono font-black text-lg" style={{ color: PRIORITY_COLOR[priority] }}>{total}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
