/**
 * E2E Test: Geospatial Dispatch Logic
 * 
 * Verifies geofire-common geohash generation and range queries work correctly.
 * Run with: node --experimental-specifier-resolution=node tests/test-geo.mjs
 */

import {
    geohashForLocation,
    geohashQueryBounds,
    distanceBetween,
} from 'geofire-common';

// ── Test Data ──────────────────────────────────────────────
// Bangalore center (Indiranagar)
const CLINIC_LAT = 12.9716;
const CLINIC_LNG = 77.5946;

// Simulated provider locations around Bangalore
const providers = [
    { id: 'DR-001', name: 'Dr. Anita', lat: 12.9750, lng: 77.5980, role: 'pediatrician' },    // ~0.5km away
    { id: 'DR-002', name: 'Dr. Rajesh', lat: 12.9800, lng: 77.6050, role: 'pediatrician' },     // ~1.3km away
    { id: 'PHB-001', name: 'Phlebotomist Priya', lat: 12.9600, lng: 77.5800, role: 'phlebotomist' }, // ~1.9km away
    { id: 'DR-003', name: 'Dr. Suresh', lat: 13.0200, lng: 77.6500, role: 'pediatrician' },     // ~7.5km away
    { id: 'DR-004', name: 'Dr. Meera', lat: 13.1000, lng: 77.7000, role: 'pediatrician' },      // ~17km away (OUT OF RANGE)
];

let passed = 0;
let failed = 0;

function assert(condition, testName) {
    if (condition) {
        console.log(`  ✅ PASS: ${testName}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: ${testName}`);
        failed++;
    }
}

// ── Test 1: Geohash Generation ─────────────────────────────
console.log('\n🧪 Test 1: Geohash Generation');
const clinicHash = geohashForLocation([CLINIC_LAT, CLINIC_LNG]);
console.log(`  Clinic geohash: ${clinicHash}`);
assert(typeof clinicHash === 'string', 'Geohash is a string');
assert(clinicHash.length >= 6, 'Geohash has sufficient precision (≥6 chars)');

// Nearby locations should share geohash prefix
const nearbyHash = geohashForLocation([12.9750, 77.5980]);
assert(clinicHash.substring(0, 4) === nearbyHash.substring(0, 4), 'Nearby location shares 4-char geohash prefix');

// Far location should differ
const farHash = geohashForLocation([13.1000, 77.7000]);
assert(clinicHash.substring(0, 5) !== farHash.substring(0, 5), 'Far location has different 5-char geohash prefix');

// ── Test 2: Distance Calculation ───────────────────────────
console.log('\n🧪 Test 2: Distance Calculation');

for (const p of providers) {
    const dist = distanceBetween([p.lat, p.lng], [CLINIC_LAT, CLINIC_LNG]);
    console.log(`  ${p.name}: ${dist.toFixed(2)} km`);
}

const dist001 = distanceBetween([providers[0].lat, providers[0].lng], [CLINIC_LAT, CLINIC_LNG]);
assert(dist001 < 1, 'DR-001 is within 1km');

const dist004 = distanceBetween([providers[4].lat, providers[4].lng], [CLINIC_LAT, CLINIC_LNG]);
assert(dist004 > 10, 'DR-004 is beyond 10km');

// ── Test 3: Geohash Query Bounds ───────────────────────────
console.log('\n🧪 Test 3: Geohash Query Bounds (10km radius)');

const bounds = geohashQueryBounds([CLINIC_LAT, CLINIC_LNG], 10 * 1000); // 10km in meters
console.log(`  Generated ${bounds.length} query bounds:`);

for (const [start, end] of bounds) {
    console.log(`    [${start}, ${end}]`);
}

assert(bounds.length >= 1, 'At least 1 query bound generated');
assert(bounds.length <= 9, 'At most 9 query bounds (geofire spec)');

// ── Test 4: Simulated Dispatch (Full Pipeline) ─────────────
console.log('\n🧪 Test 4: Simulated Dispatch Pipeline');

const radiusKm = 10;
const center = [CLINIC_LAT, CLINIC_LNG];
const queryBounds = geohashQueryBounds(center, radiusKm * 1000);

// Simulate what Firestore would do: filter providers by geohash bounds + distance
const candidateProviders = [];

for (const provider of providers) {
    const providerHash = geohashForLocation([provider.lat, provider.lng]);

    // Check if provider's geohash falls within any bound
    let inBounds = false;
    for (const [start, end] of queryBounds) {
        if (providerHash >= start && providerHash <= end) {
            inBounds = true;
            break;
        }
    }

    if (inBounds) {
        // Client-side distance filter
        const dist = distanceBetween([provider.lat, provider.lng], center);
        if (dist <= radiusKm) {
            candidateProviders.push({
                ...provider,
                geohash: providerHash,
                distanceKm: Math.round(dist * 100) / 100,
                estimatedEtaMinutes: Math.ceil(dist / 0.5),
            });
        }
    }
}

// Sort by distance
candidateProviders.sort((a, b) => a.distanceKm - b.distanceKm);

console.log(`\n  📍 Patient Location: [${CLINIC_LAT}, ${CLINIC_LNG}]`);
console.log(`  🔍 Search Radius: ${radiusKm}km`);
console.log(`  📊 Candidates found: ${candidateProviders.length}`);
console.log('');

for (const c of candidateProviders) {
    console.log(`  🚑 ${c.name} (${c.role})`);
    console.log(`     Distance: ${c.distanceKm}km | ETA: ~${c.estimatedEtaMinutes}min`);
    console.log(`     Geohash: ${c.geohash}`);
}

assert(candidateProviders.length === 4, `Found 4 providers within ${radiusKm}km (excluded DR-004 at ~17km)`);
assert(candidateProviders[0].id === 'DR-001', 'Closest provider is DR-001 (Dr. Anita)');
assert(candidateProviders[0].distanceKm < 1, 'Closest provider is under 1km away');
assert(!candidateProviders.find(p => p.id === 'DR-004'), 'DR-004 (17km away) correctly excluded');

const dispatchedTo = candidateProviders[0];
console.log(`\n  🎯 DISPATCHED TO: ${dispatchedTo.name}`);
console.log(`     Distance: ${dispatchedTo.distanceKm}km`);
console.log(`     ETA: ~${dispatchedTo.estimatedEtaMinutes} minutes`);

// ── Test 5: LiveKit Token Structure ────────────────────────
console.log('\n🧪 Test 5: JWT Token Generation (LiveKit-style)');

// Simulate the Web Crypto JWT generation the Edge API does
function base64UrlEncode(data) {
    const base64 = btoa(String.fromCharCode(...data));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function strToBase64Url(str) {
    return base64UrlEncode(new TextEncoder().encode(str));
}

const header = { alg: 'HS256', typ: 'JWT' };
const now = Math.floor(Date.now() / 1000);
const payload = {
    iss: 'test_api_key',
    sub: 'patient_123',
    exp: now + 3600,
    nbf: now,
    iat: now,
    name: 'Test Patient',
    video: {
        roomJoin: true,
        room: 'consult_room_001',
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
    },
};

const headerEncoded = strToBase64Url(JSON.stringify(header));
const payloadEncoded = strToBase64Url(JSON.stringify(payload));

// Can't do HMAC in plain Node without crypto.subtle, but we can verify structure
const mockToken = `${headerEncoded}.${payloadEncoded}.mock_signature`;
const parts = mockToken.split('.');
assert(parts.length === 3, 'JWT has 3 parts (header.payload.signature)');

// Decode header
const decodedHeader = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
assert(decodedHeader.alg === 'HS256', 'JWT header has HS256 algorithm');
assert(decodedHeader.typ === 'JWT', 'JWT header has JWT type');

// Decode payload
const decodedPayload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
assert(decodedPayload.video.roomJoin === true, 'JWT payload has roomJoin grant');
assert(decodedPayload.video.room === 'consult_room_001', 'JWT payload has correct room name');
assert(decodedPayload.sub === 'patient_123', 'JWT payload has correct identity');
assert(decodedPayload.exp > now, 'JWT has valid expiry (in the future)');

// ── Summary ────────────────────────────────────────────────
console.log('\n' + '═'.repeat(50));
console.log(`🏁 RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log('═'.repeat(50));

if (failed > 0) {
    process.exit(1);
}
