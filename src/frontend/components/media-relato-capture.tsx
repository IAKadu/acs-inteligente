'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { RelatoExtraido } from '@/lib/api';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Tab = 'audio' | 'image';

interface Props {
  onApply: (data: RelatoExtraido) => void;
}

export function MediaRelatoCapture({ onApply }: Props) {
  const [tab, setTab] = useState<Tab>('audio');
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--grey-mid)', background: '#fff', boxShadow: 'var(--shadow-sm)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ background: open ? 'rgba(0,74,128,.05)' : '#fff', borderBottom: open ? '1px solid var(--grey-mid)' : 'none' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 18 }}>🎙️</span>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--blue-primary)' }}>Relatar por áudio ou imagem</p>
            <p className="text-xs" style={{ color: 'var(--grey-text)' }}>Fale ou tire uma foto — a IA preenche o formulário</p>
          </div>
        </div>
        <span style={{ color: 'var(--grey-text)', fontSize: 18, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          ›
        </span>
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Tab switcher */}
          <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid var(--grey-mid)' }}>
            {(['audio', 'image'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2 text-sm font-bold transition-colors"
                style={{
                  background: tab === t ? 'var(--blue-primary)' : '#fff',
                  color: tab === t ? '#fff' : 'var(--grey-text)',
                  border: 'none',
                }}
              >
                {t === 'audio' ? '🎤 Áudio' : '📷 Imagem'}
              </button>
            ))}
          </div>

          {!online && (
            <div className="rounded-md px-3 py-2 text-xs font-bold flex items-center gap-2" style={{ background: 'rgba(255,193,7,.12)', color: '#856404', border: '1px solid var(--priority-3)' }}>
              <span>📶</span> Sem conexão — análise de IA indisponível. Grave o áudio e envie quando tiver sinal, ou preencha o formulário manualmente.
            </div>
          )}
          {tab === 'audio' && <AudioCapture onApply={onApply} online={online} />}
          {tab === 'image' && <ImageCapture onApply={onApply} online={online} />}
        </div>
      )}
    </div>
  );
}

// ── Audio tab ─────────────────────────────────────────────────────────────────

function AudioCapture({ onApply, online }: { onApply: (d: RelatoExtraido) => void; online: boolean }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<RelatoExtraido | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef = useRef<any>(null);

  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      setError('Reconhecimento de voz não disponível neste navegador. Use Chrome.');
      return;
    }
    const recog = new SR();
    recog.lang = 'pt-BR';
    recog.continuous = true;
    recog.interimResults = true;

    let final = '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recog.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + ' ';
        else interim = t;
      }
      setTranscript(final + interim);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recog.onerror = (e: any) => { setError(`Erro: ${e.error}`); setListening(false); };
    recog.onend = () => setListening(false);

    recogRef.current = recog;
    recog.start();
    setListening(true);
    setError('');
  }, []);

  const stopListening = useCallback(() => {
    recogRef.current?.stop();
    setListening(false);
  }, []);

  async function analyze() {
    if (!transcript.trim()) return;
    setProcessing(true);
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/api/visitas/analisar-media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'transcript', texto: transcript }),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data: RelatoExtraido = await res.json();
      setPreview(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  if (preview) {
    return (
      <PreviewResult
        data={preview}
        onEdit={() => setPreview(null)}
        onApply={(edited) => { onApply(edited); setPreview(null); setTranscript(''); }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Record button */}
      <div className="flex flex-col items-center gap-3 py-4">
        <button
          onClick={listening ? stopListening : startListening}
          className="rounded-full flex items-center justify-center transition-all"
          style={{
            width: 72, height: 72,
            background: listening ? 'var(--priority-1)' : 'var(--blue-primary)',
            color: '#fff',
            fontSize: 32,
            boxShadow: listening ? '0 0 0 8px rgba(220,53,69,.2)' : 'var(--shadow-lg)',
            border: 'none',
            animation: listening ? 'pulse 1.5s infinite' : 'none',
          }}
        >
          {listening ? '⏹' : '🎤'}
        </button>
        <p className="text-sm font-bold" style={{ color: listening ? 'var(--priority-1)' : 'var(--grey-text)' }}>
          {listening ? 'Gravando… toque para parar' : 'Toque para falar'}
        </p>
      </div>

      {/* Live transcript */}
      {(transcript || listening) && (
        <div>
          <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color: 'var(--grey-text)' }}>
            Transcrição {listening && <span style={{ color: 'var(--priority-1)' }}>● ao vivo</span>}
          </label>
          <textarea
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            rows={4}
            className="w-full rounded-md px-3 py-2 text-sm resize-none"
            style={{ border: '1px solid var(--grey-mid)', background: 'var(--grey-card)', outline: 'none' }}
            placeholder="A transcrição aparece aqui. Você pode editar antes de estruturar."
          />
        </div>
      )}

      {error && <p className="text-xs font-bold" style={{ color: '#9b1c28' }}>{error}</p>}

      {transcript.trim() && !listening && (
        <button
          onClick={analyze}
          disabled={processing || !online}
          className="w-full rounded-md py-3 text-sm font-bold transition-opacity"
          style={{ background: online ? 'var(--blue-primary)' : 'var(--grey-bar)', color: '#fff', opacity: (processing || !online) ? 0.6 : 1 }}
          title={!online ? 'Sem conexão — aguarde o sinal para enviar' : undefined}
        >
          {processing ? 'Analisando…' : !online ? '📶 Aguardando conexão…' : 'Estruturar dados com IA →'}
        </button>
      )}

      <p className="text-xs text-center" style={{ color: 'var(--grey-text)' }}>
        Funciona melhor no Chrome. Fale sobre a condição do paciente, medicamentos e moradia.
      </p>
    </div>
  );
}

// ── Image tab ─────────────────────────────────────────────────────────────────

function ImageCapture({ onApply, online }: { onApply: (d: RelatoExtraido) => void; online: boolean }) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState('');
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<RelatoExtraido | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) { setError('Selecione uma imagem válida.'); return; }
    setMimeType(file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif');
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(',')[1]);
      setError('');
    };
    reader.readAsDataURL(file);
  }

  async function analyze() {
    if (!imageBase64) return;
    setProcessing(true);
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/api/visitas/analisar-media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'image', imagemBase64: imageBase64, mimeType }),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data: RelatoExtraido = await res.json();
      setPreview(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  if (preview) {
    return (
      <PreviewResult
        data={preview}
        onEdit={() => setPreview(null)}
        onApply={(edited) => { onApply(edited); setPreview(null); setImagePreview(null); setImageBase64(''); }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      {!imagePreview ? (
        <div className="space-y-2">
          <button
            onClick={() => { if (inputRef.current) { inputRef.current.removeAttribute('capture'); inputRef.current.click(); } }}
            className="w-full rounded-md py-4 text-sm font-bold flex items-center justify-center gap-2"
            style={{ border: '2px dashed var(--grey-mid)', background: 'var(--grey-card)', color: 'var(--grey-dark)' }}
          >
            <span style={{ fontSize: 24 }}>🖼️</span> Escolher da galeria
          </button>
          <button
            onClick={() => { if (inputRef.current) { inputRef.current.setAttribute('capture', 'environment'); inputRef.current.click(); } }}
            className="w-full rounded-md py-4 text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: 'var(--blue-primary)', color: '#fff' }}
          >
            <span style={{ fontSize: 24 }}>📷</span> Tirar foto agora
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagePreview} alt="Preview" className="w-full rounded-md" style={{ maxHeight: 200, objectFit: 'cover' }} />
          <div className="flex gap-2">
            <button
              onClick={() => { setImagePreview(null); setImageBase64(''); }}
              className="flex-1 rounded-md py-2 text-sm font-bold"
              style={{ border: '1px solid var(--grey-mid)', color: 'var(--grey-text)' }}
            >
              Trocar
            </button>
            <button
              onClick={analyze}
              disabled={processing || !online}
              className="flex-1 rounded-md py-2 text-sm font-bold transition-opacity"
              style={{ background: online ? 'var(--blue-primary)' : 'var(--grey-bar)', color: '#fff', opacity: (processing || !online) ? 0.6 : 1 }}
              title={!online ? 'Sem conexão — aguarde o sinal' : undefined}
            >
              {processing ? 'Analisando…' : !online ? '📶 Sem conexão' : 'Analisar com IA →'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs font-bold" style={{ color: '#9b1c28' }}>{error}</p>}

      <p className="text-xs text-center" style={{ color: 'var(--grey-text)' }}>
        Fotos de documentos, medicamentos ou da situação da moradia.
      </p>
    </div>
  );
}

// ── Preview & apply ───────────────────────────────────────────────────────────

const CONDICAO_LABEL: Record<string, string> = {
  estavel: 'Estável', com_queixas: 'Com queixas', urgente: 'Urgente',
};

function PreviewResult({ data, onEdit, onApply }: { data: RelatoExtraido; onEdit: () => void; onApply: (edited: RelatoExtraido) => void }) {
  const [edited, setEdited] = useState<RelatoExtraido>({ ...data });

  const boolFields: { key: keyof RelatoExtraido; label: string }[] = [
    { key: 'paciente_encontrado',       label: 'Paciente encontrado' },
    { key: 'orientacoes_dadas',         label: 'Orientações dadas' },
    { key: 'medicamentos_verificados',  label: 'Medicamentos verificados' },
    { key: 'sinais_vitais_verificados', label: 'Sinais vitais verificados' },
    { key: 'encaminhamento_necessario', label: 'Encaminhamento necessário' },
    { key: 'condicoes_moradia_ok',      label: 'Condições de moradia OK' },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-md p-3" style={{ background: 'rgba(11,185,117,.06)', border: '1px solid rgba(11,185,117,.3)' }}>
        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#0a6b44' }}>
          IA interpretou — revise e aplique
        </p>

        {/* Condition selector */}
        <div className="flex gap-2 mb-3">
          {(['estavel', 'com_queixas', 'urgente'] as const).map(c => (
            <button
              key={c}
              onClick={() => setEdited(e => ({ ...e, condicao: c }))}
              className="flex-1 rounded text-xs py-1.5 font-bold transition-all"
              style={{
                background: edited.condicao === c ? 'var(--blue-primary)' : 'var(--grey-card)',
                color: edited.condicao === c ? '#fff' : 'var(--grey-text)',
              }}
            >
              {CONDICAO_LABEL[c]}
            </button>
          ))}
        </div>

        {/* Boolean toggles */}
        <div className="space-y-1.5">
          {boolFields.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!edited[key]}
                onChange={() => setEdited(e => ({ ...e, [key]: !e[key] }))}
                style={{ width: 16, height: 16, accentColor: 'var(--blue-primary)' }}
              />
              <span className="text-xs" style={{ color: 'var(--grey-dark)' }}>{label}</span>
            </label>
          ))}
        </div>

        {/* Observation */}
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--grey-text)' }}>Observação</p>
          <textarea
            value={edited.observacao}
            onChange={e => setEdited(prev => ({ ...prev, observacao: e.target.value }))}
            rows={3}
            className="w-full rounded px-2 py-1.5 text-xs resize-none"
            style={{ border: '1px solid var(--grey-mid)', background: '#fff', outline: 'none' }}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 rounded-md py-2 text-sm font-bold"
          style={{ border: '1px solid var(--grey-mid)', color: 'var(--grey-text)' }}
        >
          Descartar
        </button>
        <button
          onClick={() => onApply(edited)}
          className="flex-1 rounded-md py-2 text-sm font-bold"
          style={{ background: 'var(--green-accent)', color: '#fff' }}
        >
          Usar estes dados ✓
        </button>
      </div>
    </div>
  );
}
