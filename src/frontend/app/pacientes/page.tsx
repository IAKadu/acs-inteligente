import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { PatientCard } from '@/components/patient-card';

export const dynamic = 'force-dynamic';

const FILTROS = [
  { score_min: 70, label: 'Urgente (70+)', count_label: 'Score ≥ 70', color: 'bg-[var(--priority-1)]/10 text-[#9b1c28] border-[var(--priority-1)]' },
  { score_min: 50, label: 'Alto (50+)',    count_label: 'Score ≥ 50', color: 'bg-[var(--priority-2)]/10 text-[#8d4a0c] border-[var(--priority-2)]' },
  { score_min: 30, label: 'Médio (30+)',   count_label: 'Score ≥ 30', color: 'bg-[var(--priority-3)]/15 text-[#856404] border-[var(--priority-3)]' },
  { score_min: 0,  label: 'Todos',         count_label: 'Todos pacientes', color: 'bg-grey-card text-grey-text border-grey-mid' },
];

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ score_min?: string; limit?: string }>;
}) {
  const params = await searchParams;
  const scoreMin = params.score_min !== undefined ? Number(params.score_min) : 50;
  const limit = params.limit ? Number(params.limit) : 120;

  const patients = await apiClient.patients({ score_min: scoreMin, limit });

  return (
    <div className="space-y-6">
      <header>
        <p className="t-section-label">Pacientes</p>
        <h1 className="t-section-title">Lista priorizada</h1>
        <p className="text-grey-text mt-3 max-w-2xl leading-relaxed">
          {patients.length} pacientes com score ≥ {scoreMin}. Ordenados pelo
          eixo composto (clínico + social + temporal + gatilho).
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map(f => (
          <Link
            key={f.score_min}
            href={`/pacientes?score_min=${f.score_min}`}
            className={`px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wide border ${f.color} ${scoreMin === f.score_min ? 'ring-2 ring-offset-2 ring-brand-blue-primary' : ''}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {patients.map(p => <PatientCard key={p.paciente_id} patient={p} />)}
      </div>

      {patients.length === 0 && (
        <div className="bg-grey-card rounded-sm p-8 text-center">
          <p className="text-grey-text">Nenhum paciente encontrado com esse filtro.</p>
        </div>
      )}
    </div>
  );
}
