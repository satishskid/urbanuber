-- UrbanUber Healthcare Aggregator — Turso Schema
-- Replaces Firestore collections with SQL tables
-- Target: libSQL (Turso)

-- ── Patients ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    subscription_tier TEXT DEFAULT 'free',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ── Providers ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'doctor',
    is_online INTEGER DEFAULT 0,
    geohash TEXT,
    lat REAL,
    lng REAL,
    last_location_update TEXT,
    fcm_token TEXT,
    service_tags TEXT DEFAULT '[]',
    ai_settings TEXT DEFAULT '{"localNodeUrl":"http://localhost:11434/api/generate","cloudProvider":"together_ai","cloudApiKey":"","mode":"hybrid","useLocalScribe":true}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_providers_online ON providers(is_online);
CREATE INDEX IF NOT EXISTS idx_providers_geohash ON providers(geohash);
CREATE INDEX IF NOT EXISTS idx_providers_online_geohash ON providers(is_online, geohash);

-- ── Service Requests ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_requests (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    provider_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    service_type TEXT NOT NULL,
    context_payload TEXT,
    assigned_provider_id TEXT,
    assigned_provider_name TEXT,
    distance_km REAL,
    estimated_eta_minutes INTEGER,
    dispatched_at TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    error_message TEXT,
    source_event_id TEXT,
    lab_test_name TEXT,
    item_name TEXT,
    patient_lat REAL,
    patient_lng REAL,
    radius_km REAL DEFAULT 10,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (provider_id) REFERENCES providers(id)
);

CREATE INDEX IF NOT EXISTS idx_service_requests_patient ON service_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_provider ON service_requests(provider_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_created ON service_requests(created_at DESC);

-- ── Clinical Ledger (append-only event log) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS clinical_ledger (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    payment_status TEXT,
    processed_at TEXT,
    event_type TEXT,
    request_id TEXT,
    "timestamp" TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (provider_id) REFERENCES providers(id)
);

CREATE INDEX IF NOT EXISTS idx_clinical_ledger_patient ON clinical_ledger(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_ledger_provider ON clinical_ledger(provider_id);
CREATE INDEX IF NOT EXISTS idx_clinical_ledger_type ON clinical_ledger(type);
CREATE INDEX IF NOT EXISTS idx_clinical_ledger_created ON clinical_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_ledger_patient_created ON clinical_ledger(patient_id, created_at DESC);

-- ── Provider Locations (optional, for real-time tracking) ───────────────────
CREATE TABLE IF NOT EXISTS provider_locations (
    provider_id TEXT PRIMARY KEY,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    geohash TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (provider_id) REFERENCES providers(id)
);
