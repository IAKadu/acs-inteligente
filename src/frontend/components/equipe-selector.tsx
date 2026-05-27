'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { EquipeSede } from '@/lib/api';

interface Props {
  equipes: EquipeSede[];
  initialEquipe?: string;
  initialCapacidade?: number;
}

export function EquipeSelector({ equipes, initialEquipe, initialCapacidade }: Props) {
  const router = useRouter();
  const [equipe, setEquipe] = useState(initialEquipe ?? '');
  const [capacidade, setCapacidade] = useState(initialCapacidade ?? 6);

  function gerar() {
    if (!equipe) return;
    const q = new URLSearchParams({ equipe_id: equipe, capacidade: String(capacidade) });
    router.push(`/agenda?${q.toString()}`);
  }

  return (
    <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-end p-4 rounded-lg" style={{ background: 'var(--grey-card)' }}>
      <div className="flex-1 min-w-0">
        <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--blue-dark)' }}>
          Equipe
        </label>
        <select
          value={equipe}
          onChange={e => setEquipe(e.target.value)}
          className="w-full px-3 py-2 rounded-md font-mono text-sm"
          style={{ background: 'var(--white)', border: '1px solid var(--grey-mid)', color: 'var(--grey-dark)' }}
        >
          <option value="">— Selecionar equipe —</option>
          {equipes.map(e => (
            <option key={e.equipe_id} value={e.equipe_id}>
              {e.equipe_id.slice(0, 12)}… · {e.n_pacientes} pacientes
            </option>
          ))}
        </select>
      </div>
      <div className="w-full md:w-28">
        <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--blue-dark)' }}>
          Capacidade
        </label>
        <input
          type="number"
          min={1}
          max={50}
          value={capacidade}
          onChange={e => setCapacidade(Number(e.target.value))}
          className="w-full px-3 py-2 rounded-md text-sm"
          style={{ background: 'var(--white)', border: '1px solid var(--grey-mid)', color: 'var(--grey-dark)' }}
        />
      </div>
      <button
        onClick={gerar}
        disabled={!equipe}
        className="px-5 py-2 rounded-md font-bold uppercase tracking-wider text-sm whitespace-nowrap transition-opacity"
        style={{
          background: equipe ? 'var(--blue-light)' : 'var(--grey-mid)',
          color: 'var(--white)',
          opacity: equipe ? 1 : 0.6,
          cursor: equipe ? 'pointer' : 'not-allowed',
        }}
      >
        Gerar agenda
      </button>
    </div>
  );
}
