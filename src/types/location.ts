export type LocationStatus = 'planned' | 'reserved' | 'visited';

export const LOCATION_STATUS_LABELS: Record<LocationStatus, string> = {
  planned: 'Gepland',
  reserved: 'Gereserveerd',
  visited: 'Bezocht',
};

/** Preset palette a manager can pick a zone colour from (label → hex). */
export const ZONE_COLORS: Record<string, string> = {
  Roze: '#ec4899',
  Paars: '#8b5cf6',
  Blauw: '#3b82f6',
  Turkoois: '#14b8a6',
  Groen: '#22c55e',
  Geel: '#eab308',
  Oranje: '#f97316',
  Rood: '#ef4444',
};

/**
 * A canvassing location (street/neighbourhood/building) tracked in Location
 * Manager. `timesVisited`/`lastVisitedAt` are denormalised counters kept in
 * sync by `locationsService.logVisit` — reading the `visits` subcollection
 * for a plain "how many times" number on every list render would mean N
 * extra reads per location.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

export interface Location {
  locationId: string;
  officeId: string;
  name: string;
  address: string | null;
  neighbourhood: string | null;
  /** Pin/centroid — always set, even for an area (used to zoom/fit the map). */
  lat: number;
  lng: number;
  /** Drawn area boundary (Ghent street/neighbourhood outline), or null for a plain point pin. */
  boundary: LatLng[] | null;
  /**
   * How `boundary` is drawn: 'area' = closed polygon (≥3 points), 'street' =
   * open line along a street (≥2 points), null = plain pin. Older docs lack
   * the key — read as `l.shape ?? (l.boundary ? 'area' : null)`.
   */
  shape: 'area' | 'street' | null;
  /**
   * Manager-picked hex colour for a zone's fill/outline (one of ZONE_COLORS),
   * or null to fall back to the status colour. Older docs lack the key —
   * always read it as `l.color ?? null`.
   */
  color: string | null;
  notes: string | null;
  status: LocationStatus;
  timesVisited: number;
  lastVisitedAt: number | null;
}

export type LocationCreatePayload = Omit<
  Location,
  'locationId' | 'officeId' | 'timesVisited' | 'lastVisitedAt'
>;
export type LocationPatch = Partial<
  Omit<Location, 'locationId' | 'officeId' | 'timesVisited' | 'lastVisitedAt'>
>;

/** One visit log entry — who canvassed this location, and when. */
export interface LocationVisit {
  visitId: string;
  locationId: string;
  employeeId: string;
  employeeName: string;
  visitedAt: number;
  notes: string | null;
}

export type LocationVisitCreatePayload = Omit<LocationVisit, 'visitId' | 'locationId'>;
