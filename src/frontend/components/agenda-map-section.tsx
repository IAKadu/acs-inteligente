'use client';

import dynamic from 'next/dynamic';
import type { Agenda } from '@/lib/api';

const AgendaMapClient = dynamic(
  () => import('@/components/agenda-map').then(m => m.AgendaMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full rounded-lg flex items-center justify-center text-sm"
        style={{ height: '420px', background: 'var(--grey-card)', color: 'var(--grey-text)', border: '1px solid var(--grey-mid)' }}
      >
        Carregando mapa…
      </div>
    ),
  },
);

interface Props {
  agenda: Agenda;
}

export function AgendaMapSection({ agenda }: Props) {
  return <AgendaMapClient agenda={agenda} />;
}
