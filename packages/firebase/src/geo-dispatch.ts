/**
 * Geospatial Dispatch Utilities
 *
 * Uses Firestore + geofire-common to:
 *   1. Store provider locations with geohashes
 *   2. Find nearby online providers within a radius
 *   3. Dispatch service requests to the closest available provider
 *
 * This module works with Firebase v10 client SDK.
 */

import {
    collection,
    query,
    where,
    orderBy,
    startAt,
    endAt,
    getDocs,
    doc,
    updateDoc,
    serverTimestamp,
    onSnapshot,
    GeoPoint,
    type Firestore,
    type DocumentData,
    type Unsubscribe,
} from 'firebase/firestore';

// geofire-common provides geohash utilities (no native deps)
import {
    geohashForLocation,
    geohashQueryBounds,
    distanceBetween,
} from 'geofire-common';

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

/**
 * Generate a geohash for a lat/lng pair.
 * Store this in the provider's Firestore document.
 */
export function generateGeohash(lat: number, lng: number): string {
    return geohashForLocation([lat, lng]);
}

/**
 * Update a provider's location in Firestore with geohash.
 * Call this when the provider's GPS position changes.
 */
export async function updateProviderLocation(
    db: Firestore,
    providerId: string,
    lat: number,
    lng: number
): Promise<void> {
    const geohash = geohashForLocation([lat, lng]);
    const providerRef = doc(db, 'providers', providerId);

    await updateDoc(providerRef, {
        location: new GeoPoint(lat, lng),
        geohash,
        lastLocationUpdate: serverTimestamp(),
    });
}

/**
 * Find all online providers within `radiusKm` of a center point.
 *
 * How it works:
 *   1. geohashQueryBounds() returns geohash ranges covering the circle
 *   2. We run parallel Firestore range queries for each bound
 *   3. Client-side filter removes false positives (geohash overshoot)
 *   4. Results sorted by distance ascending
 */
export async function findNearbyProviders(
    db: Firestore,
    centerLat: number,
    centerLng: number,
    radiusKm: number = 10
): Promise<ProviderLocation[]> {
    const center: [number, number] = [centerLat, centerLng];
    const bounds = geohashQueryBounds(center, radiusKm * 1000); // meters

    const providersCol = collection(db, 'providers');
    const snapshots: DocumentData[][] = [];

    // Run parallel range queries for each geohash bound
    const queries = bounds.map(([start, end]: [string, string]) => {
        const q = query(
            providersCol,
            where('isOnline', '==', true),
            orderBy('geohash'),
            startAt(start),
            endAt(end)
        );
        return getDocs(q);
    });

    const results = await Promise.all(queries);

    // Merge and deduplicate
    const seen = new Set<string>();
    const providers: ProviderLocation[] = [];

    for (const snap of results) {
        for (const docSnap of snap.docs) {
            if (seen.has(docSnap.id)) continue;
            seen.add(docSnap.id);

            const data = docSnap.data();
            const providerLat = data.location?.latitude || data.lat;
            const providerLng = data.location?.longitude || data.lng;

            if (!providerLat || !providerLng) continue;

            // Client-side distance filter (removes geohash false positives)
            const dist = distanceBetween(
                [providerLat, providerLng],
                center
            );

            if (dist <= radiusKm) {
                providers.push({
                    id: docSnap.id,
                    name: data.name || 'Provider',
                    role: data.role || 'doctor',
                    lat: providerLat,
                    lng: providerLng,
                    geohash: data.geohash,
                    isOnline: true,
                    distanceKm: Math.round(dist * 100) / 100,
                });
            }
        }
    }

    // Sort by distance (closest first)
    providers.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));

    return providers;
}

/**
 * Dispatch to the nearest available provider.
 *
 * Returns the closest provider + estimated ETA.
 * ETA assumes average speed of 30 km/h for urban areas.
 */
export async function dispatchToNearest(
    db: Firestore,
    patientLat: number,
    patientLng: number,
    radiusKm: number = 10
): Promise<DispatchResult | null> {
    const nearby = await findNearbyProviders(db, patientLat, patientLng, radiusKm);

    if (nearby.length === 0) return null;

    const closest = nearby[0];
    const etaMinutes = Math.ceil((closest.distanceKm || 1) / 0.5); // ~30km/h avg

    return {
        provider: closest,
        distanceKm: closest.distanceKm || 0,
        estimatedEtaMinutes: etaMinutes,
    };
}

/**
 * Subscribe to real-time updates of nearby online providers.
 *
 * Note: Firestore doesn't support real-time geohash range queries natively.
 * This function watches the full 'providers' collection filtered by isOnline,
 * then applies client-side geohash + distance filtering.
 *
 * For production with many providers, consider Cloud Functions to
 * pre-filter and write to a 'nearby_providers/{patientId}' subcollection.
 */
export function watchNearbyProviders(
    db: Firestore,
    centerLat: number,
    centerLng: number,
    radiusKm: number,
    onUpdate: (providers: ProviderLocation[]) => void
): Unsubscribe {
    const center: [number, number] = [centerLat, centerLng];
    const providersCol = collection(db, 'providers');

    // Watch all online providers
    const q = query(providersCol, where('isOnline', '==', true));

    return onSnapshot(q, (snapshot) => {
        const providers: ProviderLocation[] = [];

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const providerLat = data.location?.latitude || data.lat;
            const providerLng = data.location?.longitude || data.lng;

            if (!providerLat || !providerLng) continue;

            const dist = distanceBetween([providerLat, providerLng], center);

            if (dist <= radiusKm) {
                providers.push({
                    id: docSnap.id,
                    name: data.name || 'Provider',
                    role: data.role || 'doctor',
                    lat: providerLat,
                    lng: providerLng,
                    geohash: data.geohash || '',
                    isOnline: true,
                    distanceKm: Math.round(dist * 100) / 100,
                });
            }
        }

        providers.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
        onUpdate(providers);
    });
}
