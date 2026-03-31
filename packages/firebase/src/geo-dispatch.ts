/**
 * Geospatial Dispatch Utilities — Turso-backed
 *
 * Replaces Firestore geohash queries with Turso API calls.
 * Uses geofire-common for geohash calculations.
 * All DB operations go through the edge API (Cloudflare Worker).
 */

import {
  geohashForLocation,
  geohashQueryBounds,
  distanceBetween,
} from "geofire-common";
import {
  getProvidersInGeohashRange,
  getOnlineProviders,
  updateProviderLocation as apiUpdateLocation,
} from "@skids/api-client";

// ── Types ──────────────────────────────────────────────────

export interface ProviderLocation {
  id: string;
  name: string;
  role: string;
  lat: number;
  lng: number;
  geohash: string;
  isOnline: boolean;
  distanceKm?: number;
}

export interface DispatchResult {
  provider: ProviderLocation;
  distanceKm: number;
  estimatedEtaMinutes: number;
}

// ── Core Functions ─────────────────────────────────────────

export function generateGeohash(lat: number, lng: number): string {
  return geohashForLocation([lat, lng]);
}

export async function updateProviderLocation(
  providerId: string,
  lat: number,
  lng: number,
): Promise<void> {
  const geohash = geohashForLocation([lat, lng]);
  await apiUpdateLocation(providerId, lat, lng, geohash);
}

/**
 * Find all online providers within radiusKm of a center point.
 * Uses Turso geohash range queries via the edge API.
 */
export async function findNearbyProviders(
  centerLat: number,
  centerLng: number,
  radiusKm: number = 10,
): Promise<ProviderLocation[]> {
  const center: [number, number] = [centerLat, centerLng];
  const bounds = geohashQueryBounds(center, radiusKm * 1000);

  // Fetch providers for each geohash bound
  const allProviders: ProviderLocation[] = [];
  const seen = new Set<string>();

  for (const [start] of bounds) {
    // Use the first 4-5 chars of the geohash as prefix for range query
    const prefix = start.substring(0, 5);
    const providers = await getProvidersInGeohashRange(prefix);

    for (const p of providers) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);

      const providerLat = p.lat;
      const providerLng = p.lng;

      if (!providerLat || !providerLng) continue;

      const dist = distanceBetween([providerLat, providerLng], center);

      if (dist <= radiusKm) {
        allProviders.push({
          id: p.id,
          name: p.name || "Provider",
          role: p.role || "doctor",
          lat: providerLat,
          lng: providerLng,
          geohash: p.geohash || "",
          isOnline: p.is_online === 1,
          distanceKm: Math.round(dist * 100) / 100,
        });
      }
    }
  }

  // Sort by distance (closest first)
  allProviders.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
  return allProviders;
}

/**
 * Dispatch to the nearest available provider.
 */
export async function dispatchToNearest(
  patientLat: number,
  patientLng: number,
  radiusKm: number = 10,
): Promise<DispatchResult | null> {
  const nearby = await findNearbyProviders(patientLat, patientLng, radiusKm);
  if (nearby.length === 0) return null;

  const closest = nearby[0];
  const etaMinutes = Math.ceil((closest.distanceKm || 1) / 0.5);

  return {
    provider: closest,
    distanceKm: closest.distanceKm || 0,
    estimatedEtaMinutes: etaMinutes,
  };
}

/**
 * Get all online providers (for dashboard/watching).
 * Replaces watchNearbyProviders with polling via the API.
 */
export async function getOnlineProvidersList(): Promise<ProviderLocation[]> {
  const providers = await getOnlineProviders();
  return providers
    .filter((p) => p.lat && p.lng && p.is_online === 1)
    .map((p) => ({
      id: p.id,
      name: p.name || "Provider",
      role: p.role || "doctor",
      lat: p.lat!,
      lng: p.lng!,
      geohash: p.geohash || "",
      isOnline: true,
    }));
}
