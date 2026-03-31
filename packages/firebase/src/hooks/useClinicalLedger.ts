import { useState, useEffect, useRef } from "react";
import {
  getClinicalLedgerByPatient,
  addClinicalLedgerEntry,
  pollData,
  PollSubscription,
} from "@skids/api-client";

export interface ClinicalEvent {
  id?: string;
  patientId: string;
  providerId: string;
  type: string;
  payload: any;
  createdAt: any;
}

export const useClinicalLedger = (patientId: string) => {
  const [events, setEvents] = useState<ClinicalEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const subRef = useRef<PollSubscription<any> | null>(null);

  useEffect(() => {
    if (!patientId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    subRef.current = pollData(
      () => getClinicalLedgerByPatient(patientId, 200),
      (entries) => {
        const ledgerEvents: ClinicalEvent[] = entries.map((e: any) => ({
          id: e.id,
          patientId: e.patient_id,
          providerId: e.provider_id,
          type: e.type,
          payload:
            typeof e.payload === "string" ? JSON.parse(e.payload) : e.payload,
          createdAt: e.created_at,
        }));
        setEvents(ledgerEvents);
        setLoading(false);
      },
      3000, // Poll every 3 seconds (replaces Firestore real-time)
    );

    return () => {
      if (subRef.current) subRef.current.stop();
    };
  }, [patientId]);

  const addEvent = async (providerId: string, type: string, payload: any) => {
    try {
      const result = await addClinicalLedgerEntry({
        patient_id: patientId,
        provider_id: providerId,
        type,
        payload,
      });
      return result.id;
    } catch (err) {
      console.error("Error adding clinical event:", err);
      throw err;
    }
  };

  return { events, loading, error, addEvent };
};
