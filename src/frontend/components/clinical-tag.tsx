const TAG_STYLE: Record<string, { bg: string; color: string; emoji: string; label: string }> = {
  hipertenso: { bg: 'rgba(0,192,244,.15)', color: '#0072a3', emoji: '🫀', label: 'Hipertenso' },
  diabetico: { bg: 'rgba(253,126,20,.15)', color: '#8d4a0c', emoji: '🩺', label: 'Diabético' },
  gestante: { bg: 'rgba(232,62,140,.15)', color: '#9d1f62', emoji: '🤱', label: 'Gestante' },
  vulneravel: { bg: 'rgba(255,193,7,.2)', color: '#856404', emoji: '⚠️', label: 'Vulnerável' },
  emergencia: { bg: 'rgba(220,53,69,.12)', color: '#9b1c28', emoji: '🚨', label: 'Emergência recente' },
  idoso: { bg: 'rgba(0,74,128,.12)', color: '#004a80', emoji: '👴', label: 'Idoso 66+' },
  crianca: { bg: 'rgba(11,185,117,.15)', color: '#087a52', emoji: '👶', label: 'Criança 0-6' },
  'sem-visita': { bg: 'rgba(220,53,69,.08)', color: '#9b1c28', emoji: '⏰', label: 'Sem visita 180d+' },
  agendamento: { bg: 'rgba(0,192,244,.15)', color: '#007fa5', emoji: '📅', label: 'Agendamento próximo' },
};

export function ClinicalTag({ kind }: { kind: string }) {
  const style = TAG_STYLE[kind];
  if (!style) {
    return (
      <span
        className="inline-flex items-center px-3 py-0.5 text-xs font-bold uppercase tracking-wide"
        style={{
          background: 'var(--grey-card)',
          color: 'var(--grey-text)',
          borderRadius: 'var(--radius-pill)',
        }}
      >
        {kind}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-3 py-0.5 text-xs font-bold uppercase tracking-wide"
      style={{
        background: style.bg,
        color: style.color,
        borderRadius: 'var(--radius-pill)',
      }}
    >
      {style.emoji} {style.label}
    </span>
  );
}

// Mapeia fatores do scoring engine para tipos de tag
export function factorToTagKind(factor: string): string {
  if (factor === 'gestante') return 'gestante';
  if (factor === 'crianca_0_6') return 'crianca';
  if (factor === 'idoso_66_mais') return 'idoso';
  if (factor.startsWith('hipertenso')) return 'hipertenso';
  if (factor.startsWith('diabetico') || factor === 'hipertenso_e_diabetico') return 'diabetico';
  if (factor === 'situacao_vulnerabilidade') return 'vulneravel';
  if (factor.startsWith('urgencia')) return 'emergencia';
  if (factor.startsWith('sem_visita')) return 'sem-visita';
  if (factor === 'agendamento_proximo_14d') return 'agendamento';
  if (factor === 'alerta_critico_aberto') return 'emergencia';
  return factor;
}
