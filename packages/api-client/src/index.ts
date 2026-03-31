/**
 * @skids/api-client — Client for UrbanUber Edge API (Turso-backed)
 *
 * All database operations go through the Cloudflare Worker API.
 * Replaces direct Firestore calls with HTTP requests.
 *
 * Real-time listeners are replaced with polling (configurable interval).
 */

// ── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_API_URL = "https://skids-edge-api.satish-9f4.workers.dev";

let _apiUrl = DEFAULT_API_URL;

export function setApiUrl(url: string): void {
  _apiUrl = url;
}

export function getApiUrl(): string {
  return _apiUrl;
}

// ── HTTP Helper ──────────────────────────────────────────────────────────────

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${_apiUrl}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json();
}

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
  service_tags: string;
  ai_settings: string;
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
  payload: string;
  created_at: string;
  payment_status: string | null;
  processed_at: string | null;
  event_type: string | null;
  request_id: string | null;
  timestamp: string | null;
}

// ── Patients ─────────────────────────────────────────────────────────────────

export async function getPatients(): Promise<Patient[]> {
  const data = await api<{ patients: any[] }>("/api/patients");
  return data.patients;
}

export async function getPatientCount(): Promise<number> {
  const data = await api<{ count: number }>("/api/patients/count");
  return data.count;
}

export async function getPatient(id: string): Promise<Patient | null> {
  try {
    const data = await api<{ patient: any }>(`/api/patients/${id}`);
    return data.patient;
  } catch {
    return null;
  }
}

export async function createPatient(
  phone: string,
  subscriptionTier = "free",
): Promise<{ id: string }> {
  return api("/api/patients", {
    method: "POST",
    body: JSON.stringify({ phone, subscription_tier: subscriptionTier }),
  });
}

// ── Providers ────────────────────────────────────────────────────────────────

export async function getProviders(): Promise<Provider[]> {
  const data = await api<{ providers: any[] }>("/api/providers");
  return data.providers;
}

export async function getOnlineProviders(): Promise<Provider[]> {
  const data = await api<{ providers: any[] }>("/api/providers/online");
  return data.providers;
}

export async function getProvider(id: string): Promise<Provider | null> {
  try {
    const data = await api<{ provider: any }>(`/api/providers/${id}`);
    return data.provider;
  } catch {
    return null;
  }
}

export async function createProvider(
  id: string,
  name: string,
  role = "doctor",
): Promise<{ id: string }> {
  return api("/api/providers", {
    method: "POST",
    body: JSON.stringify({ id, name, role }),
  });
}

export async function updateProviderLocation(
  providerId: string,
  lat: number,
  lng: number,
  geohash: string,
): Promise<void> {
  await api(`/api/providers/${providerId}/location`, {
    method: "PATCH",
    body: JSON.stringify({ lat, lng, geohash }),
  });
}

export async function updateProviderOnlineStatus(
  providerId: string,
  isOnline: boolean,
): Promise<void> {
  await api(`/api/providers/${providerId}/online`, {
    method: "PATCH",
    body: JSON.stringify({ is_online: isOnline }),
  });
}

export async function updateProviderSettings(
  providerId: string,
  settings: Record<string, any>,
): Promise<void> {
  await api(`/api/providers/${providerId}/settings`, {
    method: "PATCH",
    body: JSON.stringify(settings),
  });
}

export async function getProvidersInGeohashRange(
  prefix: string,
): Promise<Provider[]> {
  const data = await api<{ providers: any[] }>(
    `/api/providers/geo?prefix=${encodeURIComponent(prefix)}`,
  );
  return data.providers;
}

// ── Service Requests ─────────────────────────────────────────────────────────

export async function getServiceRequests(): Promise<ServiceRequest[]> {
  const data = await api<{ service_requests: any[] }>("/api/service-requests");
  return data.service_requests;
}

export async function getServiceRequestsByPatient(
  patientId: string,
): Promise<ServiceRequest[]> {
  const data = await api<{ service_requests: any[] }>(
    `/api/service-requests/patient/${patientId}`,
  );
  return data.service_requests;
}

export async function getServiceRequestsByStatus(
  status: string,
): Promise<ServiceRequest[]> {
  const data = await api<{ service_requests: any[] }>(
    `/api/service-requests/status/${status}`,
  );
  return data.service_requests;
}

export async function createServiceRequest(data: {
  patient_id: string;
  service_type: string;
  provider_id?: string;
  status?: string;
  context_payload?: Record<string, any>;
  source_event_id?: string;
  lab_test_name?: string;
  item_name?: string;
  patient_lat?: number;
  patient_lng?: number;
  radius_km?: number;
}): Promise<{ id: string; status: string }> {
  return api("/api/service-requests", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateServiceRequest(
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
  await api(`/api/service-requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function batchCreateServiceRequests(
  requests: Array<{
    patient_id: string;
    service_type: string;
    lab_test_name: string;
    item_name: string;
    source_event_id: string;
  }>,
): Promise<{ ids: string[]; count: number }> {
  return api("/api/service-requests/batch", {
    method: "POST",
    body: JSON.stringify({ requests }),
  });
}

// ── Clinical Ledger ──────────────────────────────────────────────────────────

export async function getClinicalLedger(
  limit = 100,
): Promise<ClinicalLedgerEntry[]> {
  const data = await api<{ entries: any[] }>(
    `/api/clinical-ledger?limit=${limit}`,
  );
  return data.entries;
}

export async function getClinicalLedgerByPatient(
  patientId: string,
  limit = 100,
): Promise<ClinicalLedgerEntry[]> {
  const data = await api<{ entries: any[] }>(
    `/api/clinical-ledger/patient/${patientId}?limit=${limit}`,
  );
  return data.entries;
}

export async function addClinicalLedgerEntry(data: {
  patient_id: string;
  provider_id: string;
  type: string;
  payload: Record<string, any>;
  event_type?: string;
  request_id?: string;
}): Promise<{ id: string; type: string; created_at: string }> {
  return api("/api/clinical-ledger", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateLedgerPaymentStatus(
  id: string,
  paymentStatus: string,
): Promise<void> {
  await api(`/api/clinical-ledger/${id}/payment`, {
    method: "PATCH",
    body: JSON.stringify({ payment_status: paymentStatus }),
  });
}

// ── Real-time Polling (replaces Firestore onSnapshot) ────────────────────────

export interface PollSubscription<T> {
  stop: () => void;
}

export function pollData<T>(
  fetchFn: () => Promise<T>,
  onData: (data: T) => void,
  intervalMs = 5000,
): PollSubscription<T> {
  let stopped = false;

  const fetch = async () => {
    if (stopped) return;
    try {
      const data = await fetchFn();
      onData(data);
    } catch (err) {
      console.warn("[pollData] Fetch error:", err);
    }
    if (!stopped) setTimeout(fetch, intervalMs);
  };

  fetch();

  return {
    stop: () => {
      stopped = true;
    },
  };
}

// ── AI Scribe (existing) ─────────────────────────────────────────────────────

export async function callScribe(
  audioTranscript: string,
  patientContext?: string,
): Promise<any> {
  return api("/api/scribe", {
    method: "POST",
    body: JSON.stringify({ audioTranscript, patientContext }),
  });
}

// ── Video Token ──────────────────────────────────────────────────────────────

export async function getVideoToken(
  roomName: string,
  identity: string,
  name?: string,
): Promise<{ token: string; url: string; room: string }> {
  return api("/api/video/token", {
    method: "POST",
    body: JSON.stringify({ roomName, identity, name }),
  });
}

// ── Upload URL ───────────────────────────────────────────────────────────────

export async function getUploadUrl(
  filename: string,
  contentType: string,
): Promise<{ url: string; fileKey: string }> {
  return api(
    `/api/upload-url?filename=${encodeURIComponent(filename)}&contentType=${encodeURIComponent(contentType)}`,
  );
}
