import type { InvisivelResponse } from '@/lib/api';

interface Props {
  data: InvisivelResponse;
}

const LABELS: Record<1 | 2 | 3, { titulo: string; descricao: string; tom: 'red' | 'orange' | 'yellow' }> = {
  1: {
    titulo: 'Crise sem vínculo',
    descricao: '3+ urgências e zero visita do ACS no ano',
    tom: 'red',
  },
  2: {
    titulo: 'Alto risco sem contato',
    descricao: 'Gestante, criança 0-6, hipertenso, diabético, idoso ou vulnerável sem visita',
    tom: 'orange',
  },
  3: {
    titulo: 'Sem contato',
    descricao: 'Sem condição especial, mas zero visita',
    tom: 'yellow',
  },
};

function tomToStyles(tom: 'red' | 'orange' | 'yellow') {
  if (tom === 'red')    return { bg: 'var(--p1-bg)', text: 'var(--p1-text)', border: 'var(--p1-border)' };
  if (tom === 'orange') return { bg: 'var(--p2-bg)', text: 'var(--p2-text)', border: 'var(--p2-border)' };
  return                       { bg: 'var(--p3-bg)', text: 'var(--p3-text)', border: 'var(--p3-border)' };
}

export function InvisivelCounters({ data }: Props) {
  if (data.total === 0) {
    return (
      <div className="rounded-lg p-6 text-sm" style={{ background: 'var(--grey-card)', color: 'var(--grey-text)' }}>
        Sem invisíveis detectados ainda. Recalcular scores primeiro para popular as categorias.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {([1, 2, 3] as const).map(cat => {
        const meta = LABELS[cat];
        const s = tomToStyles(meta.tom);
        const n = data.por_categoria[cat];
        return (
          <div
            key={cat}
            className="rounded-lg p-5"
            style={{ background: s.bg, borderLeft: `4px solid ${s.border}` }}
          >
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: s.text }}>
              Categoria {cat}
            </p>
            <p className="text-4xl font-black mt-2" style={{ color: s.text }}>
              {n.toLocaleString('pt-BR')}
            </p>
            <p className="text-sm font-bold mt-2" style={{ color: 'var(--grey-dark)' }}>
              {meta.titulo}
            </p>
            <p className="text-xs mt-1 leading-snug" style={{ color: 'var(--grey-text)' }}>
              {meta.descricao}
            </p>
          </div>
        );
      })}
    </div>
  );
}
