import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ── Patients ─────────────────────────────────────────────────────────────────
export const patients = sqliteTable("patients", {
  id: text("id").primaryKey(),
  phone: text("phone").notNull(),
  subscriptionTier: text("subscription_tier").default("free"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ── Providers ────────────────────────────────────────────────────────────────
export const providers = sqliteTable("providers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull().default("doctor"),
  isOnline: integer("is_online").default(0),
  geohash: text("geohash"),
  lat: real("lat"),
  lng: real("lng"),
  lastLocationUpdate: text("last_location_update"),
  fcmToken: text("fcm_token"),
  serviceTags: text("service_tags").default("[]"),
  aiSettings: text("ai_settings").default(
    '{"localNodeUrl":"http://localhost:11434/api/generate","cloudProvider":"together_ai","cloudApiKey":"","mode":"hybrid","useLocalScribe":true}',
  ),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ── Service Requests ─────────────────────────────────────────────────────────
export const serviceRequests = sqliteTable("service_requests", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull(),
  providerId: text("provider_id"),
  status: text("status").notNull().default("pending"),
  serviceType: text("service_type").notNull(),
  contextPayload: text("context_payload"),
  assignedProviderId: text("assigned_provider_id"),
  assignedProviderName: text("assigned_provider_name"),
  distanceKm: real("distance_km"),
  estimatedEtaMinutes: integer("estimated_eta_minutes"),
  dispatchedAt: text("dispatched_at"),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  errorMessage: text("error_message"),
  sourceEventId: text("source_event_id"),
  labTestName: text("lab_test_name"),
  itemName: text("item_name"),
  patientLat: real("patient_lat"),
  patientLng: real("patient_lng"),
  radiusKm: real("radius_km").default(10),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ── Clinical Ledger (append-only) ────────────────────────────────────────────
export const clinicalLedger = sqliteTable("clinical_ledger", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull(),
  providerId: text("provider_id").notNull(),
  type: text("type").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  paymentStatus: text("payment_status"),
  processedAt: text("processed_at"),
  eventType: text("event_type"),
  requestId: text("request_id"),
  timestamp: text("timestamp"),
});

// ── Provider Locations ───────────────────────────────────────────────────────
export const providerLocations = sqliteTable("provider_locations", {
  providerId: text("provider_id").primaryKey(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  geohash: text("geohash"),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});
