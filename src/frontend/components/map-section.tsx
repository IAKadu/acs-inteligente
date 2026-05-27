'use client';

import dynamic from 'next/dynamic';
import type { HeatmapPoint, EquipeSede } from '@/lib/api';

const HeatmapMap = dynamic(
  () => import('@/components/heatmap-map').then(m => m.HeatmapMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-[500px] rounded-md flex items-center justify-center text-sm"
        style={{ background: 'var(--grey-card)', color: 'var(--grey-text)' }}
      >
        Carregando mapa…
      </div>
    ),
  },
);

interface Props {
  hotspots: HeatmapPoint[];
  equipes: EquipeSede[];
}

export function MapSection({ hotspots, equipes }: Props) {
  return <HeatmapMap hotspots={hotspots} equipes={equipes} />;
}
