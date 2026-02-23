import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// geofire-common for geohash calculations (server-side)
import {
    geohashQueryBounds,
    distanceBetween,
} from "geofire-common";

admin.initializeApp();

const db = admin.firestore();

// ── Event Processor (Existing) ──────────────────────────────
export const processClinicalEvent = onDocumentCreated(
    "clinical_ledger/{eventId}",
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) {
            return;
        }

        const data = snapshot.data();
        const eventType = data.type;

        logger.info(`Processing clinical event: ${eventType} for patient ${data.patientId}`);

        try {
            if (eventType === 'checkout_completed') {
                // Action 1: Payment splitting logic
                logger.info('Action 1: Initiating Payment Split via Payment Gateway (Stripe/Razorpay)');

                const amount = data.payload?.amount || 0;
                const providerId = data.providerId;

                // Calculate platform fee
                const platformFee = amount * 0.10; // 10% fee
                const providerPayout = amount - platformFee;

                logger.info(`Transferring ${providerPayout} to Provider ${providerId} and keeping ${platformFee} platform fee.`);

                // Update the event to mark payment processed
                await snapshot.ref.update({
                    paymentStatus: 'processed',
                    processedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }

            if (eventType === 'triage_context' || eventType === 'lab_order_requested') {
                // Action 2: Dispatch new service_requests for lab orders based on context
                const contextItems = data.payload?.context || [];

                const requestedLabs = contextItems.filter(
                    (item: any) => item.state === 'confirmed' && item.type === 'lab_order'
                );

                if (requestedLabs.length > 0) {
                    logger.info(`Action 2: Dispatching ${requestedLabs.length} service requests for lab orders`);

                    const batch = db.batch();
                    for (const lab of requestedLabs) {
                        const reqRef = db.collection('service_requests').doc();
                        batch.set(reqRef, {
                            patientId: data.patientId,
                            providerId: data.providerId,
                            sourceEventId: event.params.eventId,
                            serviceType: 'lab_order',
                            labTestName: lab.label,
                            status: 'pending',
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                    }
                    await batch.commit();

                    logger.info('Service requests successfully dispatched.');
                }
            }

        } catch (error) {
            logger.error('Error processing clinical event:', error);
            throw error;
        }
    }
);

// ── Geospatial Dispatch (New) ───────────────────────────────
/**
 * dispatchServiceRequest — Triggered when a new service_request is created.
 *
 * Finds the nearest online provider using geohash queries,
 * assigns them, and sends an FCM push notification.
 */
export const dispatchServiceRequest = onDocumentCreated(
    "service_requests/{requestId}",
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return;

        const data = snapshot.data();
        const requestId = event.params.requestId;

        // Skip if already dispatched
        if (data.status !== 'pending' || data.assignedProviderId) {
            logger.info(`Request ${requestId} already dispatched, skipping.`);
            return;
        }

        logger.info(`Dispatching service request ${requestId} (type: ${data.serviceType})`);

        try {
            // 1. Get patient location
            const patientLat = data.patientLat || data.location?.latitude;
            const patientLng = data.patientLng || data.location?.longitude;

            if (!patientLat || !patientLng) {
                logger.warn(`No location found for request ${requestId}. Marking as needs_assignment.`);
                await snapshot.ref.update({ status: 'needs_manual_assignment' });
                return;
            }

            // 2. Query nearby online providers using geohash bounds
            const radiusKm = data.radiusKm || 10;
            const center: [number, number] = [patientLat, patientLng];
            const bounds = geohashQueryBounds(center, radiusKm * 1000);

            const candidateProviders: Array<{
                id: string;
                name: string;
                distanceKm: number;
                fcmToken?: string;
            }> = [];

            for (const [start, end] of bounds) {
                const snap = await db.collection('providers')
                    .where('isOnline', '==', true)
                    .orderBy('geohash')
                    .startAt(start)
                    .endAt(end)
                    .get();

                for (const provDoc of snap.docs) {
                    const prov = provDoc.data();
                    const provLat = prov.location?.latitude || prov.lat;
                    const provLng = prov.location?.longitude || prov.lng;

                    if (!provLat || !provLng) continue;

                    const dist = distanceBetween([provLat, provLng], center);
                    if (dist <= radiusKm) {
                        candidateProviders.push({
                            id: provDoc.id,
                            name: prov.name || 'Provider',
                            distanceKm: Math.round(dist * 100) / 100,
                            fcmToken: prov.fcmToken,
                        });
                    }
                }
            }

            // 3. Sort by distance and pick closest
            candidateProviders.sort((a, b) => a.distanceKm - b.distanceKm);

            if (candidateProviders.length === 0) {
                logger.warn(`No providers found within ${radiusKm}km for request ${requestId}`);
                await snapshot.ref.update({
                    status: 'no_providers_available',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                return;
            }

            const nearest = candidateProviders[0];
            const etaMinutes = Math.ceil(nearest.distanceKm / 0.5); // ~30km/h avg

            logger.info(
                `Assigning ${nearest.name} (${nearest.distanceKm}km away, ETA ~${etaMinutes}min) to request ${requestId}`
            );

            // 4. Update request with assigned provider
            await snapshot.ref.update({
                assignedProviderId: nearest.id,
                assignedProviderName: nearest.name,
                distanceKm: nearest.distanceKm,
                estimatedEtaMinutes: etaMinutes,
                status: 'dispatched',
                dispatchedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // 5. Send FCM push notification to provider
            if (nearest.fcmToken) {
                try {
                    await admin.messaging().send({
                        token: nearest.fcmToken,
                        notification: {
                            title: '🚨 New Service Request',
                            body: `${data.serviceType} for patient — ${nearest.distanceKm}km away, ETA ~${etaMinutes}min`,
                        },
                        data: {
                            requestId,
                            serviceType: data.serviceType || '',
                            patientId: data.patientId || '',
                            distanceKm: String(nearest.distanceKm),
                            eta: String(etaMinutes),
                        },
                        android: {
                            priority: 'high',
                            notification: {
                                channelId: 'dispatch_alerts',
                                sound: 'default',
                            },
                        },
                        apns: {
                            payload: {
                                aps: {
                                    sound: 'default',
                                    badge: 1,
                                },
                            },
                        },
                    });
                    logger.info(`FCM notification sent to provider ${nearest.id}`);
                } catch (fcmErr) {
                    logger.error('FCM send error:', fcmErr);
                    // Non-fatal — dispatch succeeded even if notification fails
                }
            }

        } catch (error) {
            logger.error('Dispatch error:', error);
            await snapshot.ref.update({
                status: 'dispatch_error',
                errorMessage: String(error),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }
);

// ── Manual Dispatch (Callable Function) ─────────────────────
/**
 * manualDispatch — Admin-callable function to manually trigger
 * geospatial dispatch for a service request.
 */
export const manualDispatch = onCall(async (request) => {
    const { requestId, radiusKm } = request.data;

    if (!requestId) {
        throw new HttpsError('invalid-argument', 'requestId is required');
    }

    const reqDoc = await db.collection('service_requests').doc(requestId).get();
    if (!reqDoc.exists) {
        throw new HttpsError('not-found', 'Service request not found');
    }

    const data = reqDoc.data()!;
    const patientLat = data.patientLat || data.location?.latitude;
    const patientLng = data.patientLng || data.location?.longitude;

    if (!patientLat || !patientLng) {
        throw new HttpsError('failed-precondition', 'Patient location not available');
    }

    const center: [number, number] = [patientLat, patientLng];
    const radius = radiusKm || 15;
    const bounds = geohashQueryBounds(center, radius * 1000);

    const providers: any[] = [];
    for (const [start, end] of bounds) {
        const snap = await db.collection('providers')
            .where('isOnline', '==', true)
            .orderBy('geohash')
            .startAt(start)
            .endAt(end)
            .get();

        for (const doc of snap.docs) {
            const p = doc.data();
            const lat = p.location?.latitude;
            const lng = p.location?.longitude;
            if (lat && lng) {
                const dist = distanceBetween([lat, lng], center);
                if (dist <= radius) {
                    providers.push({ id: doc.id, name: p.name, distanceKm: Math.round(dist * 100) / 100 });
                }
            }
        }
    }

    providers.sort((a, b) => a.distanceKm - b.distanceKm);

    return {
        requestId,
        candidateCount: providers.length,
        candidates: providers.slice(0, 5),
        assigned: providers.length > 0 ? providers[0] : null,
    };
});
