export interface Place {
  id: string;
  name: string;
  detail: string;
  coords: [number, number]; // [lat, lon]
}

/** Vessel's live position — "current location" option for routing. */
export const VESSEL_POS: [number, number] = [-65.2, 42.5];

export const VESSEL_PLACE: Place = {
  id: 'vessel',
  name: 'RV Bharati Explorer (vessel)',
  detail: 'Live position · 65.20°S, 42.50°E',
  coords: VESSEL_POS,
};

/** Named waypoints inside the 9 km ops grid (64–70°S, 40–80°E). */
export const PLACES: Place[] = [
  { id: 'bharati', name: 'Bharati Station', detail: 'Landing harbour · 69.40°S, 76.20°E', coords: [-69.4, 76.2] },
  { id: 'davis', name: 'Davis Station', detail: '66.58°S, 77.97°E', coords: [-68.58, 77.97] },
  { id: 'zhongshan', name: 'Zhongshan Station', detail: '69.37°S, 76.38°E', coords: [-69.37, 76.38] },
  { id: 'mawson', name: 'Mawson Station', detail: '67.60°S, 62.87°E', coords: [-67.6, 62.87] },
  { id: 'prydz', name: 'Prydz Bay Anchorage', detail: '67.50°S, 63.00°E', coords: [-67.5, 63.0] },
  { id: 'ice-edge', name: 'Northern Ice Edge', detail: 'Open water approach · 64.50°S, 60.00°E', coords: [-64.5, 60.0] },
  { id: 'east-approach', name: 'Eastern Approach', detail: '68.10°S, 74.00°E', coords: [-68.1, 74.0] },
  { id: 'west-approach', name: 'Western Approach', detail: '66.00°S, 50.00°E', coords: [-66.0, 50.0] },
];

export function findPlace(id: string): Place | undefined {
  if (id === VESSEL_PLACE.id) return VESSEL_PLACE;
  return PLACES.find((p) => p.id === id);
}
