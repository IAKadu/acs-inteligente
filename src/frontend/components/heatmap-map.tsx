'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { HeatmapPoint, EquipeSede } from '@/lib/api';
import { apiClient } from '@/lib/api';

interface Props {
  hotspots: HeatmapPoint[];
  equipes: EquipeSede[];
}

export function HeatmapMap({ hotspots, equipes }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const isoLayerRef = useRef<L.GeoJSON | null>(null);
  const [loadingIso, setLoadingIso] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Leaflet marca o DIV com _leaflet_id quando inicializa. Em StrictMode dev
    // e HMR o effect re-roda e o container pode chegar aqui ainda marcado.
    // Limpa antes pra evitar "Map container is being reused".
    const container = containerRef.current as HTMLDivElement & { _leaflet_id?: number };
    if (container._leaflet_id != null) {
      delete container._leaflet_id;
    }

    const map = L.map(containerRef.current).setView([-22.93, -43.25], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    // Hotspots de urgência (vermelho)
    const maxN = Math.max(...hotspots.map(p => p.n_urgencias), 1);
    for (const p of hotspots) {
      const r = 4 + (p.n_urgencias / maxN) * 14;
      const opacity = 0.35 + (p.n_urgencias / maxN) * 0.45;
      L.circleMarker([p.lat, p.lng], {
        radius: r,
        color: '#dc2626',
        fillColor: '#ef4444',
        fillOpacity: opacity,
        weight: 1,
      })
        .addTo(map)
        .bindPopup(`<strong>${p.n_urgencias}</strong> urgências/internações nesta célula`);
    }

    // Sedes das equipes (azul) — clicar pede isócrona
    for (const eq of equipes) {
      const marker = L.circleMarker([eq.lat, eq.lng], {
        radius: 7,
        color: '#004a80',
        fillColor: '#1863dc',
        fillOpacity: 0.9,
        weight: 2,
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: 'Cera Pro', Segoe UI, Arial, sans-serif; min-width: 180px;">
          <strong style="font-size: 13px;">Equipe ${eq.equipe_id.slice(0, 8)}</strong><br/>
          <span style="font-size: 12px; color: #555;">${eq.n_pacientes} pacientes cadastrados</span><br/>
          <button id="iso-${eq.equipe_id.slice(0, 16)}" style="margin-top: 8px; padding: 4px 8px; background: #004a80; color: white; border: none; border-radius: 4px; font-size: 11px; font-weight: bold; cursor: pointer; text-transform: uppercase; letter-spacing: 0.05em;">Mostrar alcance (10/15 min a pé)</button>
        </div>
      `);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`iso-${eq.equipe_id.slice(0, 16)}`);
        if (!btn) return;
        btn.onclick = async () => {
          setLoadingIso(eq.equipe_id);
          try {
            const data = await apiClient.isochrones(eq.lat, eq.lng, [10, 15]);
            // Remove previous iso layer
            if (isoLayerRef.current) {
              isoLayerRef.current.remove();
              isoLayerRef.current = null;
            }
            isoLayerRef.current = L.geoJSON(data as never, {
              style: (feature) => {
                const value = (feature?.properties as { value: number } | undefined)?.value ?? 0;
                const isInner = value === 600; // 10 min
                return {
                  color: isInner ? '#003660' : '#1863dc',
                  fillColor: isInner ? '#1863dc' : '#00c0f4',
                  fillOpacity: isInner ? 0.25 : 0.15,
                  weight: 2,
                };
              },
            }).addTo(map);
            // Move iso layer below markers
            isoLayerRef.current.bringToBack();
          } catch (err) {
            alert(`Erro ORS: ${(err as Error).message}`);
          } finally {
            setLoadingIso(null);
          }
        };
      });
    }

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      if (isoLayerRef.current) {
        isoLayerRef.current = null;
      }
      // Limpa marca Leaflet do DIV pra próxima montagem não reutilizar instância
      const c = container as HTMLDivElement & { _leaflet_id?: number };
      if (c._leaflet_id != null) delete c._leaflet_id;
    };
  }, [hotspots, equipes]);

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full h-[500px] rounded-md border border-grey-mid" />
      {loadingIso && (
        <div className="absolute top-3 right-3 bg-white px-3 py-2 rounded-sm shadow-md text-xs font-bold text-brand-blue-primary">
          Calculando alcance…
        </div>
      )}
      <div className="absolute bottom-3 left-3 bg-white/95 px-3 py-2 rounded-sm shadow-sm text-xs flex gap-4 items-center">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500 opacity-70"></span>
          Hotspot urgência
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-brand-blue-light border-2 border-brand-blue-primary"></span>
          Sede equipe
        </span>
        <span className="text-grey-text">Clique numa sede pra ver alcance a pé</span>
      </div>
    </div>
  );
}
