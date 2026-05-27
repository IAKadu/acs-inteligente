const ORS_API_KEY = process.env.ORS_API_KEY;
const ORS_BASE = 'https://api.openrouteservice.org/v2';

if (!ORS_API_KEY) {
  console.warn('⚠️  ORS_API_KEY ausente — endpoints de isochrone vão falhar');
}

export async function getIsochrones(
  lat: number,
  lng: number,
  rangeSeconds: number[] = [600, 900],
  profile: 'foot-walking' | 'driving-car' = 'foot-walking',
): Promise<unknown> {
  if (!ORS_API_KEY) throw new Error('ORS_API_KEY não configurada');
  const res = await fetch(`${ORS_BASE}/isochrones/${profile}`, {
    method: 'POST',
    headers: {
      'Authorization': ORS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/geo+json',
    },
    body: JSON.stringify({
      locations: [[lng, lat]],
      range: rangeSeconds,
      range_type: 'time',
      attributes: ['area', 'reachfactor'],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`ORS ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}
