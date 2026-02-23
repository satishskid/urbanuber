import { useState, useEffect } from 'react';
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    serverTimestamp,
    FirestoreError
} from 'firebase/firestore';
import { db } from '../index';

export interface ClinicalEvent {
    id?: string;
    patientId: string;
    providerId: string;
    type: string; // e.g., 'observation', 'vitals', 'triage_context', 'service_request'
    payload: any;
    createdAt: any;
}

export const useClinicalLedger = (patientId: string) => {
    const [events, setEvents] = useState<ClinicalEvent[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<FirestoreError | null>(null);

    useEffect(() => {
        if (!patientId) {
            setEvents([]);
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'clinical_ledger'),
            where('patientId', '==', patientId),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(
            q,
            { includeMetadataChanges: true }, // Important for offline-first to trigger when local cache updates
            (querySnapshot) => {
                const ledgerEvents: ClinicalEvent[] = [];
                querySnapshot.forEach((doc) => {
                    ledgerEvents.push({ id: doc.id, ...doc.data() } as ClinicalEvent);
                });
                setEvents(ledgerEvents);
                setLoading(false);
            },
            (err) => {
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [patientId]);

    const addEvent = async (providerId: string, type: string, payload: any) => {
        try {
            const docRef = await addDoc(collection(db, 'clinical_ledger'), {
                patientId,
                providerId,
                type,
                payload,
                createdAt: serverTimestamp(),
            });
            return docRef.id;
        } catch (err) {
            console.error('Error adding clinical event:', err);
            throw err;
        }
    };

    return { events, loading, error, addEvent };
};
