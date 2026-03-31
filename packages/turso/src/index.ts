/**
 * @skids/turso — Turso/libSQL client for UrbanUber
 *
 * Replaces Firestore with edge-native SQL.
 * - Server-side: direct HTTP connection from Cloudflare Workers
 * - Client-side: via Cloudflare Worker API (no direct DB access from browser)
 */

import { createClient, Client, InMemoryDatabase } from "@libsql/client";
import { v4 as uuidv4 } from "uuid";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Patient {
  id: string;
  phone: string;
  subscription_tier: string;
  created_at: string;
  updated_at: string;
}

export interface Provider {
  id: string;
  name: string;
  role: string;
  is_online: number;
  geohash: string | null;
  lat: number | null;
  lng: number | null;
  last_location_update: string | null;
  fcm_token: string | null;
  service_tags: string; // JSON array
  ai_settings: string; // JSON object
  created_at: string;
  updated_at: string;
}

export interface ServiceRequest {
  id: string;
  patient_id: string;
  provider_id: string | null;
  status: string;
  service_type: string;
  context_payload: string | null;
  assigned_provider_id: string | null;
  assigned_provider_name: string | null;
  distance_km: number | null;
  estimated_eta_minutes: number | null;
  dispatched_at: string | null;
  updated_at: string;
  error_message: string | null;
  source_event_id: string | null;
  lab_test_name: string | null;
  item_name: string | null;
  patient_lat: number | null;
  patient_lng: number | null;
  radius_km: number;
  created_at: string;
}

export interface ClinicalLedgerEntry {
  id: string;
  patient_id: string;
  provider_id: string;
  type: string;
  payload: string; // JSON
  created_at: string;
  payment_status: string | null;
  processed_at: string | null;
  event_type: string | null;
  request_id: string | null;
  timestamp: string | null;
}

export interface ProviderLocation {
  provider_id: string;
  lat: number;
  lng: number;
  geohash: string | null;
  updated_at: string;
}

// ── Client Factory ───────────────────────────────────────────────────────────

export interface TursoConfig {
  url: string;
  authToken: string;
}

let _client: Client | null = null;

export function getTursoClient(config: TursoConfig): Client {
  if (_client) return _client;

  _client = createClient({
    url: config.url,
    authToken: config.authToken,
  });

  return _client;
}

export function resetTursoClient(): void {
  _client = null;
}

// ── Patients ─────────────────────────────────────────────────────────────────

export async function createPatient(
  client: Client,
  data: { phone: string; subscription_tier?: string },
): Promise<Patient> {
  const id = uuidv4();
  await client.execute({
    sql: "INSERT INTO patients (id, phone, subscription_tier) VALUES (?, ?, ?)",
    args: [id, data.phone, data.subscription_tier || "free"],
  });
  return getPatient(client, id);
}

export async function getPatient(
  client: Client,
  id: string,
): Promise<Patient | null> {
  const result = await client.execute({
    sql: "SELECT * FROM patients WHERE id = ?",
    args: [id],
  });
  return result.rows[0] as Patient | null;
}

export async function getAllPatients(client: Client): Promise<Patient[]> {
  const result = await client.execute(
    "SELECT * FROM patients ORDER BY created_at DESC",
  );
  return result.rows as Patient[];
}

export async function countPatients(client: Client): Promise<number> {
  const result = await client.execute("SELECT COUNT(*) as cnt FROM patients");
  return Number((result.rows[0] as any)?.cnt || 0);
}

// ── Providers ────────────────────────────────────────────────────────────────

export async function createProvider(
  client: Client,
  data: {
    id: string;
    name: string;
    role?: string;
  },
): Promise<Provider> {
  await client.execute({
    sql: `INSERT INTO providers (id, name, role) VALUES (?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET name = excluded.name, role = excluded.role`,
    args: [data.id, data.name, data.role || "doctor"],
  });
  return getProvider(client, data.id);
}

export async function getProvider(
  client: Client,
  id: string,
): Promise<Provider> {
  const result = await client.execute({
    sql: "SELECT * FROM providers WHERE id = ?",
    args: [id],
  });
  return result.rows[0] as Provider;
}

export async function getAllProviders(client: Client): Promise<Provider[]> {
  const result = await client.execute(
    "SELECT * FROM providers ORDER BY created_at DESC",
  );
  return result.rows as Provider[];
}

export async function getOnlineProviders(client: Client): Promise<Provider[]> {
  const result = await client.execute({
    sql: "SELECT * FROM providers WHERE is_online = 1 ORDER BY geohash",
    args: [],
  });
  return result.rows as Provider[];
}

export async function updateProviderLocation(
  client: Client,
  providerId: string,
  data: {
    lat: number;
    lng: number;
    geohash: string;
  },
): Promise<void> {
  await client.execute({
    sql: `UPDATE providers SET lat = ?, lng = ?, geohash = ?,
              last_location_update = datetime('now'), updated_at = datetime('now')
              WHERE id = ?`,
    args: [data.lat, data.lng, data.geohash, providerId],
  });
}

export async function updateProviderOnlineStatus(
  client: Client,
  providerId: string,
  isOnline: boolean,
): Promise<void> {
  await client.execute({
    sql: "UPDATE providers SET is_online = ?, updated_at = datetime('now') WHERE id = ?",
    args: [isOnline ? 1 : 0, providerId],
  });
}

export async function updateProviderSettings(
  client: Client,
  providerId: string,
  settings: Record<string, any>,
): Promise<void> {
  const current = await getProvider(client, providerId);
  const existing = current?.ai_settings ? JSON.parse(current.ai_settings) : {};
  const merged = { ...existing, ...settings };
  await client.execute({
    sql: "UPDATE providers SET ai_settings = ?, updated_at = datetime('now') WHERE id = ?",
    args: [JSON.stringify(merged), providerId],
  });
}

// ── Geohash range query (for geo-dispatch) ───────────────────────────────────

export async function getProvidersInGeohashRange(
  client: Client,
  prefix: string,
  isOnline = true,
): Promise<Provider[]> {
  const result = await client.execute({
    sql: `SELECT * FROM providers
              WHERE is_online = ? AND geohash LIKE ?
              ORDER BY geohash`,
    args: [isOnline ? 1 : 0, `${prefix}%`],
  });
  return result.rows as Provider[];
}

// ── Service Requests ─────────────────────────────────────────────────────────

export async function createServiceRequest(
  client: Client,
  data: {
    patient_id: string;
    provider_id?: string;
    service_type: string;
    status?: string;
    context_payload?: Record<string, any>;
    source_event_id?: string;
    lab_test_name?: string;
    item_name?: string;
    patient_lat?: number;
    patient_lng?: number;
    radius_km?: number;
  },
): Promise<ServiceRequest> {
  const id = uuidv4();
  await client.execute({
    sql: `INSERT INTO service_requests (id, patient_id, provider_id, service_type, status,
              context_payload, source_event_id, lab_test_name, item_name, patient_lat, patient_lng, radius_km)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.patient_id,
      data.provider_id || null,
      data.service_type,
      data.status || "pending",
      data.context_payload ? JSON.stringify(data.context_payload) : null,
      data.source_event_id || null,
      data.lab_test_name || null,
      data.item_name || null,
      data.patient_lat || null,
      data.patient_lng || null,
      data.radius_km || 10,
    ],
  });
  return getServiceRequest(client, id);
}

export async function getServiceRequest(
  client: Client,
  id: string,
): Promise<ServiceRequest> {
  const result = await client.execute({
    sql: "SELECT * FROM service_requests WHERE id = ?",
    args: [id],
  });
  return result.rows[0] as ServiceRequest;
}

export async function getAllServiceRequests(
  client: Client,
): Promise<ServiceRequest[]> {
  const result = await client.execute(
    "SELECT * FROM service_requests ORDER BY created_at DESC",
  );
  return result.rows as ServiceRequest[];
}

export async function getServiceRequestsByPatient(
  client: Client,
  patientId: string,
): Promise<ServiceRequest[]> {
  const result = await client.execute({
    sql: "SELECT * FROM service_requests WHERE patient_id = ? ORDER BY created_at DESC",
    args: [patientId],
  });
  return result.rows as ServiceRequest[];
}

export async function getServiceRequestsByStatus(
  client: Client,
  status: string,
): Promise<ServiceRequest[]> {
  const result = await client.execute({
    sql: "SELECT * FROM service_requests WHERE status = ? ORDER BY created_at DESC",
    args: [status],
  });
  return result.rows as ServiceRequest[];
}

export async function updateServiceRequest(
  client: Client,
  id: string,
  data: Partial<{
    status: string;
    provider_id: string;
    assigned_provider_id: string;
    assigned_provider_name: string;
    distance_km: number;
    estimated_eta_minutes: number;
    dispatched_at: string;
    error_message: string;
  }>,
): Promise<void> {
  const sets: string[] = [];
  const args: any[] = [];

  if (data.status !== undefined) {
    sets.push("status = ?");
    args.push(data.status);
  }
  if (data.provider_id !== undefined) {
    sets.push("provider_id = ?");
    args.push(data.provider_id);
  }
  if (data.assigned_provider_id !== undefined) {
    sets.push("assigned_provider_id = ?");
    args.push(data.assigned_provider_id);
  }
  if (data.assigned_provider_name !== undefined) {
    sets.push("assigned_provider_name = ?");
    args.push(data.assigned_provider_name);
  }
  if (data.distance_km !== undefined) {
    sets.push("distance_km = ?");
    args.push(data.distance_km);
  }
  if (data.estimated_eta_minutes !== undefined) {
    sets.push("estimated_eta_minutes = ?");
    args.push(data.estimated_eta_minutes);
  }
  if (data.dispatched_at !== undefined) {
    sets.push("dispatched_at = ?");
    args.push(data.dispatched_at);
  }
  if (data.error_message !== undefined) {
    sets.push("error_message = ?");
    args.push(data.error_message);
  }

  if (sets.length === 0) return;

  sets.push("updated_at = datetime('now')");
  args.push(id);

  await client.execute({
    sql: `UPDATE service_requests SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
}

// ── Clinical Ledger ──────────────────────────────────────────────────────────

export async function addClinicalLedgerEntry(
  client: Client,
  data: {
    patient_id: string;
    provider_id: string;
    type: string;
    payload: Record<string, any>;
    event_type?: string;
    request_id?: string;
  },
): Promise<ClinicalLedgerEntry> {
  const id = uuidv4();
  const now = new Date().toISOString();
  await client.execute({
    sql: `INSERT INTO clinical_ledger (id, patient_id, provider_id, type, payload,
              created_at, event_type, request_id, timestamp)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.patient_id,
      data.provider_id,
      data.type,
      JSON.stringify(data.payload),
      now,
      data.event_type || null,
      data.request_id || null,
      now,
    ],
  });
  return getClinicalLedgerEntry(client, id);
}

export async function getClinicalLedgerEntry(
  client: Client,
  id: string,
): Promise<ClinicalLedgerEntry> {
  const result = await client.execute({
    sql: "SELECT * FROM clinical_ledger WHERE id = ?",
    args: [id],
  });
  return result.rows[0] as ClinicalLedgerEntry;
}

export async function getClinicalLedgerByPatient(
  client: Client,
  patientId: string,
  limit = 100,
): Promise<ClinicalLedgerEntry[]> {
  const result = await client.execute({
    sql: "SELECT * FROM clinical_ledger WHERE patient_id = ? ORDER BY created_at DESC LIMIT ?",
    args: [patientId, limit],
  });
  return result.rows as ClinicalLedgerEntry[];
}

export async function getRecentClinicalLedger(
  client: Client,
  limit = 10,
): Promise<ClinicalLedgerEntry[]> {
  const result = await client.execute({
    sql: "SELECT * FROM clinical_ledger ORDER BY created_at DESC LIMIT ?",
    args: [limit],
  });
  return result.rows as ClinicalLedgerEntry[];
}

export async function updateLedgerPaymentStatus(
  client: Client,
  id: string,
  paymentStatus: string,
): Promise<void> {
  await client.execute({
    sql: `UPDATE clinical_ledger SET payment_status = ?, processed_at = datetime('now') WHERE id = ?`,
    args: [paymentStatus, id],
  });
}

// ── Batch Operations ─────────────────────────────────────────────────────────

export async function batchCreateServiceRequests(
  client: Client,
  requests: Array<{
    patient_id: string;
    service_type: string;
    lab_test_name: string;
    item_name: string;
    source_event_id: string;
  }>,
): Promise<string[]> {
  const ids: string[] = [];
  const batch = requests.map((r) => {
    const id = uuidv4();
    ids.push(id);
    return {
      sql: `INSERT INTO service_requests (id, patient_id, service_type, status,
                  lab_test_name, item_name, source_event_id)
                  VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
      args: [
        id,
        r.patient_id,
        r.service_type,
        r.lab_test_name,
        r.item_name,
        r.source_event_id,
      ],
    };
  });

  if (batch.length > 0) {
    await client.batch(batch, "write");
  }
  return ids;
}
