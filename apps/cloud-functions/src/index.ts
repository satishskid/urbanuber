import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

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

                // Mock Stripe Connect / Razorpay Route logic
                // 1. Calculate platform fee
                const platformFee = amount * 0.10; // 10% fee
                const providerPayout = amount - platformFee;

                // 2. Call external payment API to process transfer to Connected Account
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

                // Check if any context chips imply a lab/service order
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
            // Depending on retry configuration, this might retry the function
            throw error;
        }
    }
);
