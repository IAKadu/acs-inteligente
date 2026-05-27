'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { scoreToPriority } from '@/lib/api';
import type { Paciente, RelatoVisita, RelatoExtraido } from '@/lib/api';
import { MediaRelatoCapture } from '@/components/media-relato-capture';
import { enqueue } from '@/lib/offline-queue';
import { useOfflineSync } from '@/hooks/use-offline-sync';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Condicao = 'estavel' | 'com_queixas' | 'urgente';

const CONDICAO_CONFIG = {
  estavel:      { label: 'Estável',       icon: '✓', bg: 'rgba(40,167,69,.10)',   border: 'var(--priority-4)', text: '#1a6630' },
  com_queixas:  { label: 'Com queixas',   icon: '⚠', bg: 'rgba(255,193,7,.12)',  border: 'var(--priority-3)', text: '#856404' },
  urgente:      { label: 'Urgente',       icon: '!', bg: 'rgba(220,53,69,.10)',   border: 'var(--priority-1)', text: '#9b1c28' },
};

const PRIORITY_COLOR: Record<number, string> = {
  1: 'var(--priority-1)', 2: 'var(--priority-2)',
  3: 'var(--priority-3)', 4: 'var(--priority-4)',
};

interface CheckItem { key: keyof FormState; label: string; hint: string }

const CHECKLIST: CheckItem[] = [
  { key: 'orientacoes_dadas',         label: 'Orientações de saúde dadas',    hint: 'Medicamentos, alimentação, higiene, prevenção' },
  { key: 'medicamentos_verificados',  label: 'Medicamentos verificados',       hint: 'Uso correto, validade, estoque suficiente' },
  { key: 'sinais_vitais_verificados', label: 'Sinais vitais verificados',      hint: 'Pressão arterial, temperatura, glicemia (se disponível)' },
  { key: 'encaminhamento_necessario', label: 'Encaminhamento necessário',      hint: 'Precisar consultar UBS, especialista ou urgência' },
  { key: 'condicoes_moradia_ok',      label: 'Condições de moradia adequadas', hint: 'Higiene, ventilação, saneamento' },
];

interface FormState {
  orientacoes_dadas: boolean;
  medicamentos_verificados: boolean;
  sinais_vitais_verificados: boolean;
  encaminhamento_necessario: boolean;
  condicoes_moradia_ok: boolean;
}

const INITIAL_FORM: FormState = {
  orientacoes_dadas: false,
  medicamentos_verificados: false,
  sinais_vitais_verificados: false,
  encaminhamento_necessario: false,
  condicoes_moradia_ok: true,
};

export default function RegistrarVisitaPage() {
  // Step management
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — patient search
  const [query, setQuery] = useState('');
  const [equipeFilter, setEquipeFilter] = useState('');
  const [results, setResults] = useState<Paciente[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Paciente | null>(null);

  // Step 2 — form
  const [pacienteEncontrado, setPacienteEncontrado] = useState(true);
  const [condicao, setCondicao] = useState<Condicao>('estavel');
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [acsNome, setAcsNome] = useState('');
  const [observacao, setObservacao] = useState('');

  // Step 3 — result
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<RelatoVisita | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);
  const [saveError, setSaveError] = useState('');

  const { pending, syncing, online, flush, refresh: syncRefresh } = useOfflineSync();

  // Pre-fill from URL query param ?paciente_id=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('paciente_id');
    if (pid) {
      fetch(`${BASE_URL}/api/patients/${pid}`)
        .then(r => r.json())
        .then(d => {
          if (d?.paciente) { setSelectedPatient(d.paciente); setStep(2); }
        })
        .catch(() => {});
    }
  }, []);

  const doSearch = useCallback(async (q: string, eq: string) => {
    if (!q && !eq) { setResults([]); return; }
    setSearching(true);
    try {
      const params = new URLSearchParams({ q, limit: '15' });
      if (eq) params.set('equipe_id', eq);
      const res = await fetch(`${BASE_URL}/api/patients/search?${params}`);
      const data: Paciente[] = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(query, equipeFilter), 300);
    return () => clearTimeout(t);
  }, [query, equipeFilter, doSearch]);

  async function save() {
    if (!selectedPatient) return;
    setSaving(true);
    setSaveError('');

    const payload = {
      paciente_id: selectedPatient.paciente_id,
      equipe_id: selectedPatient.equipe_id,
      acs_nome: acsNome || null,
      paciente_encontrado: pacienteEncontrado,
      condicao,
      ...form,
      observacao: observacao || null,
    };

    // Offline or network error → save to local queue
    const saveOffline = () => {
      const entry = enqueue(payload as Record<string, unknown>);
      setSaved({
        id: -1,
        criado_em: entry.criado_em,
        ...payload,
      } as RelatoVisita);
      setSavedOffline(true);
      setStep(3);
      syncRefresh();
    };

    if (!navigator.onLine) {
      saveOffline();
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/api/visitas/relato`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const relato: RelatoVisita = await res.json();
      setSaved(relato);
      setSavedOffline(false);
      setStep(3);
      flush(); // try to drain any previously queued items
    } catch (err) {
      // Network failure even though navigator.onLine was true — queue it
      if ((err as Error).message.includes('fetch') || !navigator.onLine) {
        saveOffline();
      } else {
        setSaveError((err as Error).message);
      }
    } finally {
      setSaving(false);
    }
  }

  function applyMediaData(data: RelatoExtraido) {
    setPacienteEncontrado(data.paciente_encontrado);
    setCondicao(data.condicao);
    setForm({
      orientacoes_dadas: data.orientacoes_dadas,
      medicamentos_verificados: data.medicamentos_verificados,
      sinais_vitais_verificados: data.sinais_vitais_verificados,
      encaminhamento_necessario: data.encaminhamento_necessario,
      condicoes_moradia_ok: data.condicoes_moradia_ok,
    });
    if (data.observacao) setObservacao(data.observacao);
  }

  function reset() {
    setStep(1); setQuery(''); setEquipeFilter(''); setResults([]);
    setSelectedPatient(null); setPacienteEncontrado(true);
    setCondicao('estavel'); setForm(INITIAL_FORM);
    setObservacao(''); setSaved(null); setSavedOffline(false); setSaveError('');
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">

      {/* Offline / pending banner */}
      {!online && (
        <div className="rounded-md px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(255,193,7,.15)', border: '1px solid var(--priority-3)' }}>
          <span style={{ fontSize: 20 }}>📶</span>
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: '#856404' }}>Sem conexão — modo offline</p>
            <p className="text-xs" style={{ color: '#856404' }}>Relatos serão salvos no aparelho e enviados quando a conexão voltar.</p>
          </div>
        </div>
      )}

      {online && pending > 0 && (
        <div className="rounded-md px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(0,74,128,.07)', border: '1px solid var(--blue-primary)' }}>
          <span style={{ fontSize: 20 }}>☁️</span>
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: 'var(--blue-primary)' }}>
              {pending} relato{pending > 1 ? 's' : ''} pendente{pending > 1 ? 's' : ''} de envio
            </p>
            <p className="text-xs" style={{ color: 'var(--grey-text)' }}>Salvos offline — aguardando sincronização.</p>
          </div>
          <button
            onClick={() => flush()}
            disabled={syncing}
            className="text-xs font-bold px-3 py-1.5 rounded-md transition-opacity"
            style={{ background: 'var(--blue-primary)', color: '#fff', opacity: syncing ? 0.6 : 1 }}
          >
            {syncing ? 'Enviando…' : 'Enviar agora'}
          </button>
        </div>
      )}

      {/* Header */}
      <header>
        <Link href="/" className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--blue-primary)' }}>
          ← Início
        </Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <p className="t-section-label">ACS</p>
            <h1 className="t-section-title" style={{ fontSize: 28 }}>Registrar Visita</h1>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-1.5">
            {([1, 2, 3] as const).map(s => (
              <div key={s} style={{
                width: s === step ? 24 : 10, height: 10,
                borderRadius: 5,
                background: s < step ? 'var(--green-accent)' : s === step ? 'var(--blue-primary)' : 'var(--grey-mid)',
                transition: 'all 0.2s',
              }} />
            ))}
          </div>
        </div>
      </header>

      {/* ── STEP 1: Select patient ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-lg p-5 space-y-4" style={{ background: '#fff', border: '1px solid var(--grey-mid)', boxShadow: 'var(--shadow-sm)' }}>
            <p className="text-sm font-bold" style={{ color: 'var(--grey-dark)' }}>Encontrar o paciente</p>

            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="ID do paciente (primeiros dígitos)…"
              className="w-full rounded-md px-4 text-sm"
              style={{ border: '1px solid var(--grey-mid)', background: 'var(--grey-card)', minHeight: 48, outline: 'none' }}
              autoFocus
            />

            <div>
              <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color: 'var(--grey-text)' }}>
                Filtrar por equipe (opcional)
              </label>
              <input
                value={equipeFilter}
                onChange={e => setEquipeFilter(e.target.value)}
                placeholder="ID da equipe…"
                className="w-full rounded-md px-4 text-sm"
                style={{ border: '1px solid var(--grey-mid)', background: 'var(--grey-card)', minHeight: 44, outline: 'none' }}
              />
            </div>
          </div>

          {/* Results */}
          {searching && (
            <p className="text-sm text-center" style={{ color: 'var(--grey-text)' }}>Buscando…</p>
          )}

          {!searching && results.length === 0 && (query || equipeFilter) && (
            <p className="text-sm text-center py-4" style={{ color: 'var(--grey-text)' }}>
              Nenhum paciente encontrado. Tente digitar os primeiros caracteres do ID.
            </p>
          )}

          {!searching && results.length === 0 && !query && !equipeFilter && (
            <p className="text-sm text-center py-4" style={{ color: 'var(--grey-text)' }}>
              Digite os primeiros dígitos do ID do paciente ou o ID da equipe para listar todos os pacientes.
            </p>
          )}

          <div className="space-y-2">
            {results.map(p => {
              const priority = scoreToPriority(p.score ?? 0);
              return (
                <button
                  key={p.paciente_id}
                  onClick={() => { setSelectedPatient(p); setStep(2); }}
                  className="w-full text-left rounded-md px-4 py-3 transition-shadow hover:shadow-md"
                  style={{
                    background: '#fff',
                    border: '1px solid var(--grey-mid)',
                    borderLeft: `4px solid ${PRIORITY_COLOR[priority]}`,
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-mono" style={{ color: 'var(--grey-text)' }}>
                        #{p.paciente_id.slice(0, 12)}…
                      </p>
                      <p className="font-bold text-sm mt-0.5" style={{ color: 'var(--grey-dark)' }}>
                        {p.faixa_etaria} · {p.sexo}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--grey-text)' }}>
                        {p.ultima_visita ? `Última visita: ${p.ultima_visita}` : 'Nunca visitado'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className="inline-block text-sm font-black px-2 py-1 rounded-sm"
                        style={{ background: PRIORITY_COLOR[priority], color: '#fff' }}
                      >
                        {Math.round(p.score ?? 0)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STEP 2: Fill form ─────────────────────────────────────────────── */}
      {step === 2 && selectedPatient && (
        <div className="space-y-5">
          {/* Patient summary chip */}
          <div
            className="rounded-md px-4 py-3 flex items-center justify-between gap-3"
            style={{ background: 'var(--grey-card)', border: '1px solid var(--grey-mid)' }}
          >
            <div>
              <p className="text-xs font-mono" style={{ color: 'var(--grey-text)' }}>
                #{selectedPatient.paciente_id.slice(0, 12)}…
              </p>
              <p className="font-bold text-sm" style={{ color: 'var(--grey-dark)' }}>
                {selectedPatient.faixa_etaria} · {selectedPatient.sexo}
              </p>
            </div>
            <button
              onClick={() => { setSelectedPatient(null); setStep(1); }}
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: 'var(--blue-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Trocar
            </button>
          </div>

          {/* Media capture */}
          <MediaRelatoCapture onApply={applyMediaData} />

          {/* Found? */}
          <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid var(--grey-mid)', boxShadow: 'var(--shadow-sm)' }}>
            <p className="text-sm font-bold mb-3" style={{ color: 'var(--grey-dark)' }}>Paciente estava em casa?</p>
            <div className="flex gap-3">
              {([true, false] as const).map(v => (
                <button
                  key={String(v)}
                  onClick={() => setPacienteEncontrado(v)}
                  className="flex-1 rounded-md py-3 text-sm font-bold transition-all"
                  style={{
                    border: `2px solid ${pacienteEncontrado === v ? 'var(--blue-primary)' : 'var(--grey-mid)'}`,
                    background: pacienteEncontrado === v ? 'rgba(0,74,128,.08)' : '#fff',
                    color: pacienteEncontrado === v ? 'var(--blue-primary)' : 'var(--grey-text)',
                  }}
                >
                  {v ? 'Sim' : 'Não encontrado'}
                </button>
              ))}
            </div>
          </div>

          {/* Condition */}
          {pacienteEncontrado && (
            <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid var(--grey-mid)', boxShadow: 'var(--shadow-sm)' }}>
              <p className="text-sm font-bold mb-3" style={{ color: 'var(--grey-dark)' }}>Condição observada</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(CONDICAO_CONFIG) as [Condicao, typeof CONDICAO_CONFIG.estavel][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setCondicao(key)}
                    className="rounded-md py-3 text-center transition-all"
                    style={{
                      border: `2px solid ${condicao === key ? cfg.border : 'var(--grey-mid)'}`,
                      background: condicao === key ? cfg.bg : '#fff',
                    }}
                  >
                    <div className="text-2xl mb-1">{cfg.icon}</div>
                    <div className="text-xs font-bold" style={{ color: condicao === key ? cfg.text : 'var(--grey-text)' }}>
                      {cfg.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Checklist */}
          {pacienteEncontrado && (
            <div className="rounded-lg p-4 space-y-1" style={{ background: '#fff', border: '1px solid var(--grey-mid)', boxShadow: 'var(--shadow-sm)' }}>
              <p className="text-sm font-bold mb-3" style={{ color: 'var(--grey-dark)' }}>O que foi feito nesta visita?</p>
              {CHECKLIST.map(item => (
                <label
                  key={item.key}
                  className="flex items-start gap-3 py-2.5 border-b cursor-pointer"
                  style={{ borderColor: 'var(--grey-mid)' }}
                >
                  <input
                    type="checkbox"
                    checked={form[item.key]}
                    onChange={() => setForm(f => ({ ...f, [item.key]: !f[item.key] }))}
                    className="mt-0.5 shrink-0"
                    style={{ width: 20, height: 20, accentColor: 'var(--blue-primary)' }}
                  />
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--grey-dark)' }}>{item.label}</p>
                    <p className="text-xs" style={{ color: 'var(--grey-text)' }}>{item.hint}</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* ACS name + observation */}
          <div className="rounded-lg p-4 space-y-4" style={{ background: '#fff', border: '1px solid var(--grey-mid)', boxShadow: 'var(--shadow-sm)' }}>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color: 'var(--grey-text)' }}>
                Seu nome (ACS)
              </label>
              <input
                value={acsNome}
                onChange={e => setAcsNome(e.target.value)}
                placeholder="Opcional"
                className="w-full rounded-md px-4 text-sm"
                style={{ border: '1px solid var(--grey-mid)', background: 'var(--grey-card)', minHeight: 44, outline: 'none' }}
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color: 'var(--grey-text)' }}>
                Observações adicionais
              </label>
              <textarea
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                placeholder="Anotações sobre a visita, situação da família, encaminhamentos realizados…"
                rows={3}
                className="w-full rounded-md px-4 py-3 text-sm resize-none"
                style={{ border: '1px solid var(--grey-mid)', background: 'var(--grey-card)', outline: 'none' }}
              />
            </div>
          </div>

          {saveError && (
            <p className="text-sm font-bold text-center py-2 rounded-md" style={{ background: 'rgba(220,53,69,.08)', color: '#9b1c28' }}>
              Erro ao salvar: {saveError}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pb-4">
            <button
              onClick={() => setStep(1)}
              className="flex-1 rounded-md font-bold text-sm py-3"
              style={{ border: '2px solid var(--grey-mid)', background: '#fff', color: 'var(--grey-text)' }}
            >
              Voltar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 rounded-md font-bold text-sm py-3 transition-opacity"
              style={{
                background: 'var(--blue-primary)', color: '#fff',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Salvando…' : 'Salvar visita'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Confirmation ───────────────────────────────────────────── */}
      {step === 3 && saved && (
        <div className="space-y-5">
          <div
            className="rounded-xl p-6 text-center"
            style={savedOffline
              ? { background: 'rgba(255,193,7,.10)', border: '2px solid var(--priority-3)' }
              : { background: 'rgba(11,185,117,.08)', border: '2px solid var(--green-accent)' }}
          >
            <div className="text-5xl mb-3">{savedOffline ? '📥' : '✓'}</div>
            <h2 className="text-xl font-black mb-1" style={{ color: savedOffline ? '#856404' : '#0a6b44' }}>
              {savedOffline ? 'Salvo no aparelho!' : 'Visita registrada!'}
            </h2>
            <p className="text-sm" style={{ color: 'var(--grey-text)' }}>
              {savedOffline
                ? 'Será enviado ao servidor quando a conexão voltar.'
                : new Date(saved.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          </div>

          {/* Summary */}
          <div className="rounded-lg p-4 space-y-2" style={{ background: '#fff', border: '1px solid var(--grey-mid)', boxShadow: 'var(--shadow-sm)' }}>
            <SummaryRow label="Paciente" value={`#${saved.paciente_id.slice(0, 12)}…`} />
            <SummaryRow label="Situação" value={CONDICAO_CONFIG[saved.condicao].label} />
            {saved.encaminhamento_necessario && (
              <SummaryRow label="Encaminhamento" value="Necessário — registre na UBS" highlight />
            )}
            {saved.observacao && (
              <div className="pt-2">
                <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--grey-text)' }}>Observações</p>
                <p className="text-sm" style={{ color: 'var(--grey-dark)' }}>{saved.observacao}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pb-4">
            <button
              onClick={reset}
              className="rounded-md font-bold text-sm py-3"
              style={{ background: 'var(--blue-primary)', color: '#fff' }}
            >
              Nova visita
            </button>
            {savedOffline ? (
              <button
                onClick={() => flush()}
                disabled={syncing || !online}
                className="rounded-md font-bold text-sm py-3 transition-opacity"
                style={{ background: 'var(--grey-card)', color: online ? 'var(--blue-primary)' : 'var(--grey-text)', border: '1px solid var(--grey-mid)', opacity: syncing ? 0.6 : 1 }}
              >
                {syncing ? 'Enviando…' : online ? 'Enviar agora' : 'Sem conexão'}
              </button>
            ) : (
              <Link
                href={`/pacientes/${saved.paciente_id}`}
                className="rounded-md font-bold text-sm py-3 text-center"
                style={{ background: 'var(--grey-card)', color: 'var(--blue-primary)', border: '1px solid var(--grey-mid)' }}
              >
                Ver paciente
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b" style={{ borderColor: 'var(--grey-mid)' }}>
      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--grey-text)' }}>{label}</span>
      <span className="text-sm font-bold" style={{ color: highlight ? '#9b1c28' : 'var(--grey-dark)' }}>{value}</span>
    </div>
  );
}
