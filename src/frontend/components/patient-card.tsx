'use client';

import Link from 'next/link';
import type { Paciente } from '@/lib/api';
import { scoreToPriority } from '@/lib/api';
import { ScoreBadge } from './score-badge';
import { ClinicalTag, factorToTagKind } from './clinical-tag';

export function PatientCard({ patient }: { patient: Paciente }) {
  const priority = scoreToPriority(patient.score);
  const borderColor = {
    1: 'var(--priority-1)',
    2: 'var(--priority-2)',
    3: 'var(--priority-3)',
    4: 'var(--priority-4)',
  }[priority];

  const fatores = Array.isArray(patient.fatores) ? patient.fatores : [];
  const tagKinds = Array.from(new Set(fatores.map(factorToTagKind)));

  return (
    <Link
      href={`/pacientes/${patient.paciente_id}`}
      className="block bg-white rounded-md p-5 transition-shadow hover:shadow-md"
      style={{
        border: `1px solid var(--grey-mid)`,
        borderLeft: `4px solid ${borderColor}`,
        boxShadow: 'var(--shadow-sm)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-xs font-mono" style={{ color: 'var(--grey-text)' }}>
            Paciente #{patient.paciente_id.slice(0, 8)}… · Equipe #{patient.equipe_id.slice(0, 6)}
          </p>
          <p className="font-bold text-base mt-1">
            {patient.faixa_etaria} · {patient.sexo}
          </p>
        </div>
        <ScoreBadge score={patient.score} />
      </div>
      <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--grey-text)' }}>
        {patient.ultima_visita
          ? `Última visita: ${patient.ultima_visita}`
          : 'Nunca recebeu visita do ACS.'}
        {' '}
        {fatores.length} fator{fatores.length > 1 ? 'es' : ''} de risco.
      </p>
      <div className="flex flex-wrap gap-2">
        {tagKinds.slice(0, 5).map(k => <ClinicalTag key={k} kind={k} />)}
      </div>
    </Link>
  );
}
