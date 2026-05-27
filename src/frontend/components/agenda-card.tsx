import Link from 'next/link';
import type { AgendaItem } from '@/lib/api';

interface Props {
  item: AgendaItem;
}

const PRIOR_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  CRITICO: { bg: 'var(--p1-bg)', text: 'var(--p1-text)', border: 'var(--p1-border)' },
  URGENTE: { bg: 'var(--p2-bg)', text: 'var(--p2-text)', border: 'var(--p2-border)' },
  ATENCAO: { bg: 'var(--p3-bg)', text: 'var(--p3-text)', border: 'var(--p3-border)' },
  ROTINA:  { bg: 'var(--p4-bg)', text: 'var(--p4-text)', border: 'var(--p4-border)' },
};

function tags(item: AgendaItem): { text: string; tone: 'red' | 'orange' | 'blue' | 'grey' }[] {
  const out: { text: string; tone: 'red' | 'orange' | 'blue' | 'grey' }[] = [];
  if (item.flag_crise_sem_vinculo) out.push({ text: 'Crise sem vínculo', tone: 'red' });
  if (item.flag_invisivel)         out.push({ text: '★ 1º contato',     tone: 'orange' });
  if (item.gestacao === 1)         out.push({ text: 'Gestante',         tone: 'orange' });
  if (item.hipertenso === 1)       out.push({ text: 'Hipertenso',       tone: 'blue' });
  if (item.diabetico === 1)        out.push({ text: 'Diabético',        tone: 'blue' });
  if (item.situacao_vulnerabilidade === 1) out.push({ text: 'Vulnerável', tone: 'grey' });
  if (item.faixa_etaria === '66+') out.push({ text: 'Idoso 66+',        tone: 'grey' });
  if (item.faixa_etaria === '0-6') out.push({ text: 'Criança 0-6',      tone: 'grey' });
  if (item.n_urg_30d > 0)          out.push({ text: `${item.n_urg_30d} urg < 30d`, tone: 'red' });
  if (item.tem_agendamento_futuro) out.push({ text: 'Consulta agendada', tone: 'blue' });
  return out;
}

function tagStyle(tone: 'red' | 'orange' | 'blue' | 'grey') {
  if (tone === 'red')    return { bg: 'var(--p1-bg)', text: 'var(--p1-text)' };
  if (tone === 'orange') return { bg: 'var(--p2-bg)', text: 'var(--p2-text)' };
  if (tone === 'blue')   return { bg: 'rgba(0,192,244,.12)', text: 'var(--blue-dark)' };
  return                       { bg: 'var(--grey-card)', text: 'var(--grey-text)' };
}

export function AgendaCard({ item }: Props) {
  const prior = PRIOR_STYLE[item.prioridade ?? 'ROTINA'] ?? PRIOR_STYLE.ROTINA;

  return (
    <article className="rounded-lg overflow-hidden" style={{ background: 'var(--white)', border: '1px solid var(--grey-mid)' }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: prior.bg, borderBottom: `2px solid ${prior.border}` }}>
        <div className="flex items-center justify-center w-10 h-10 rounded-full font-black text-lg" style={{ background: 'var(--white)', color: prior.text, border: `2px solid ${prior.border}` }}>
          {item.ordem_visita}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: prior.text }}>
            {item.prioridade ?? 'ROTINA'} · Score {Math.round(item.score)}
          </p>
          <p className="text-xs font-mono mt-0.5 truncate" style={{ color: 'var(--grey-dark)' }}>
            {item.paciente_id.slice(0, 16)}…
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--grey-text)' }}>Trecho</p>
          <p className="text-sm font-black" style={{ color: 'var(--grey-dark)' }}>{item.distancia_anterior_km.toFixed(2)} km</p>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {tags(item).map((t, i) => {
            const s = tagStyle(t.tone);
            return (
              <span key={i} className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: s.bg, color: s.text }}>
                {t.text}
              </span>
            );
          })}
        </div>

        {item.justificativa && (
          <div className="rounded-md p-3 text-sm leading-snug" style={{ background: 'var(--grey-card)', color: 'var(--grey-dark)' }}>
            {item.justificativa}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs" style={{ color: 'var(--grey-text)' }}>
            Última visita: {item.dias_sem_visita < 999 ? `há ${item.dias_sem_visita}d` : 'nunca'} · {item.distancia_acumulada_km.toFixed(2)} km acumulado
          </span>
          <Link
            href={`/registrar?paciente_id=${item.paciente_id}`}
            className="shrink-0 text-xs font-black uppercase tracking-wide px-4 rounded-md flex items-center"
            style={{ background: 'var(--blue-primary)', color: '#fff', minHeight: 36 }}
          >
            Registrar →
          </Link>
        </div>
      </div>
    </article>
  );
}
