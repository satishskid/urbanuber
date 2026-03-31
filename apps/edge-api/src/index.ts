import { Hono } from "hono";
import { cors } from "hono/cors";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { generateLiveKitToken } from "./livekit-token";
import { tursoExecute } from "./db/turso-http";
import { v4 as uuidv4 } from "uuid";

type Bindings = {
  MEDSCREEN_BUCKET: R2Bucket;
  AI_GATEWAY_URL: string;
  GROQ_API_KEY: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  CF_ACCOUNT_ID: string;
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
  LIVEKIT_URL: string;
  TURSO_DB_URL: string;
  TURSO_DB_AUTH_TOKEN: string;
};

function turso(env: Bindings) {
  return { url: env.TURSO_DB_URL, authToken: env.TURSO_DB_AUTH_TOKEN };
}

const app = new Hono<{ Bindings: Bindings }>();
app.use("/api/*", cors());
app.get("/health", (c) => c.json({ status: "ok" }));

// ── Turso Health Check ───────────────────────────────────────────────────────
app.get("/api/db/health", async (c) => {
  try {
    await tursoExecute(turso(c.env), "SELECT 1");
    return c.json({ status: "ok", database: "turso" });
  } catch (err: any) {
    return c.json({ status: "error", error: err.message }, 500);
  }
});

// ── Schema Init ──────────────────────────────────────────────────────────────
app.post("/api/db/init", async (c) => {
  try {
    const cfg = turso(c.env);
    const statements = [
      `CREATE TABLE IF NOT EXISTS patients (id TEXT PRIMARY KEY, phone TEXT NOT NULL, subscription_tier TEXT DEFAULT 'free', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`,
      `CREATE TABLE IF NOT EXISTS providers (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'doctor', is_online INTEGER DEFAULT 0, geohash TEXT, lat REAL, lng REAL, last_location_update TEXT, fcm_token TEXT, service_tags TEXT DEFAULT '[]', ai_settings TEXT DEFAULT '{"mode":"hybrid","useLocalScribe":true}', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`,
      `CREATE INDEX IF NOT EXISTS idx_providers_online ON providers(is_online)`,
      `CREATE INDEX IF NOT EXISTS idx_providers_geohash ON providers(geohash)`,
      `CREATE INDEX IF NOT EXISTS idx_providers_online_geohash ON providers(is_online, geohash)`,
      `CREATE TABLE IF NOT EXISTS service_requests (id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, provider_id TEXT, status TEXT NOT NULL DEFAULT 'pending', service_type TEXT NOT NULL, context_payload TEXT, assigned_provider_id TEXT, assigned_provider_name TEXT, distance_km REAL, estimated_eta_minutes INTEGER, dispatched_at TEXT, updated_at TEXT DEFAULT (datetime('now')), error_message TEXT, source_event_id TEXT, lab_test_name TEXT, item_name TEXT, patient_lat REAL, patient_lng REAL, radius_km REAL DEFAULT 10, created_at TEXT DEFAULT (datetime('now')))`,
      `CREATE INDEX IF NOT EXISTS idx_sr_patient ON service_requests(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sr_status ON service_requests(status)`,
      `CREATE INDEX IF NOT EXISTS idx_sr_created ON service_requests(created_at DESC)`,
      `CREATE TABLE IF NOT EXISTS clinical_ledger (id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, provider_id TEXT NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), payment_status TEXT, processed_at TEXT, event_type TEXT, request_id TEXT, "timestamp" TEXT)`,
      `CREATE INDEX IF NOT EXISTS idx_cl_patient ON clinical_ledger(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_cl_created ON clinical_ledger(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_cl_patient_created ON clinical_ledger(patient_id, created_at DESC)`,
      `CREATE TABLE IF NOT EXISTS provider_locations (provider_id TEXT PRIMARY KEY, lat REAL NOT NULL, lng REAL NOT NULL, geohash TEXT, updated_at TEXT DEFAULT (datetime('now')))`,
    ];

    for (const sql of statements) {
      await tursoExecute(cfg, sql);
    }
    return c.json({ status: "ok", message: "Schema initialized", tables: 5 });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── Patients ─────────────────────────────────────────────────────────────────
app.get("/api/patients", async (c) => {
  try {
    const { rows } = await tursoExecute(
      turso(c.env),
      "SELECT * FROM patients ORDER BY created_at DESC",
    );
    return c.json({ patients: rows });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/api/patients/count", async (c) => {
  try {
    const { rows } = await tursoExecute(
      turso(c.env),
      "SELECT COUNT(*) as cnt FROM patients",
    );
    return c.json({ count: Number(rows[0]?.cnt || 0) });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/api/patients/:id", async (c) => {
  try {
    const { rows } = await tursoExecute(
      turso(c.env),
      "SELECT * FROM patients WHERE id = ?",
      [c.req.param("id")],
    );
    if (!rows[0]) return c.json({ error: "Not found" }, 404);
    return c.json({ patient: rows[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/api/patients", async (c) => {
  try {
    const { phone, subscription_tier } = await c.req.json();
    if (!phone) return c.json({ error: "phone required" }, 400);
    const id = uuidv4();
    await tursoExecute(
      turso(c.env),
      "INSERT INTO patients (id, phone, subscription_tier) VALUES (?, ?, ?)",
      [id, phone, subscription_tier || "free"],
    );
    return c.json(
      { id, phone, subscription_tier: subscription_tier || "free" },
      201,
    );
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── Providers ────────────────────────────────────────────────────────────────
app.get("/api/providers", async (c) => {
  try {
    const { rows } = await tursoExecute(
      turso(c.env),
      "SELECT * FROM providers ORDER BY created_at DESC",
    );
    return c.json({ providers: rows });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/api/providers/online", async (c) => {
  try {
    const { rows } = await tursoExecute(
      turso(c.env),
      "SELECT * FROM providers WHERE is_online = 1 ORDER BY geohash",
    );
    return c.json({ providers: rows });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/api/providers/:id", async (c) => {
  try {
    const { rows } = await tursoExecute(
      turso(c.env),
      "SELECT * FROM providers WHERE id = ?",
      [c.req.param("id")],
    );
    if (!rows[0]) return c.json({ error: "Not found" }, 404);
    return c.json({ provider: rows[0] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/api/providers", async (c) => {
  try {
    const { id, name, role } = await c.req.json();
    if (!id || !name) return c.json({ error: "id and name required" }, 400);
    await tursoExecute(
      turso(c.env),
      `INSERT INTO providers (id, name, role) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, role = excluded.role`,
      [id, name, role || "doctor"],
    );
    return c.json({ id, name, role: role || "doctor" }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.patch("/api/providers/:id/location", async (c) => {
  try {
    const { lat, lng, geohash } = await c.req.json();
    if (lat == null || lng == null || !geohash)
      return c.json({ error: "lat, lng, geohash required" }, 400);
    await tursoExecute(
      turso(c.env),
      `UPDATE providers SET lat = ?, lng = ?, geohash = ?, last_location_update = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      [lat, lng, geohash, c.req.param("id")],
    );
    return c.json({ status: "ok" });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.patch("/api/providers/:id/online", async (c) => {
  try {
    const { is_online } = await c.req.json();
    await tursoExecute(
      turso(c.env),
      `UPDATE providers SET is_online = ?, updated_at = datetime('now') WHERE id = ?`,
      [is_online ? 1 : 0, c.req.param("id")],
    );
    return c.json({ status: "ok" });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.patch("/api/providers/:id/settings", async (c) => {
  try {
    const settings = await c.req.json();
    const { rows } = await tursoExecute(
      turso(c.env),
      "SELECT ai_settings FROM providers WHERE id = ?",
      [c.req.param("id")],
    );
    const existing = rows[0]?.ai_settings
      ? JSON.parse(rows[0].ai_settings)
      : {};
    await tursoExecute(
      turso(c.env),
      `UPDATE providers SET ai_settings = ?, updated_at = datetime('now') WHERE id = ?`,
      [JSON.stringify({ ...existing, ...settings }), c.req.param("id")],
    );
    return c.json({ status: "ok" });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/api/providers/geo", async (c) => {
  try {
    const prefix = c.req.query("prefix") || "";
    const { rows } = await tursoExecute(
      turso(c.env),
      `SELECT * FROM providers WHERE is_online = 1 AND geohash LIKE ? ORDER BY geohash`,
      [`${prefix}%`],
    );
    return c.json({ providers: rows });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── Service Requests ─────────────────────────────────────────────────────────
app.get("/api/service-requests", async (c) => {
  try {
    const { rows } = await tursoExecute(
      turso(c.env),
      "SELECT * FROM service_requests ORDER BY created_at DESC",
    );
    return c.json({ service_requests: rows });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/api/service-requests/patient/:patientId", async (c) => {
  try {
    const { rows } = await tursoExecute(
      turso(c.env),
      "SELECT * FROM service_requests WHERE patient_id = ? ORDER BY created_at DESC",
      [c.req.param("patientId")],
    );
    return c.json({ service_requests: rows });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/api/service-requests/status/:status", async (c) => {
  try {
    const { rows } = await tursoExecute(
      turso(c.env),
      "SELECT * FROM service_requests WHERE status = ? ORDER BY created_at DESC",
      [c.req.param("status")],
    );
    return c.json({ service_requests: rows });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/api/service-requests", async (c) => {
  try {
    const b = await c.req.json();
    if (!b.patient_id || !b.service_type)
      return c.json({ error: "patient_id and service_type required" }, 400);
    const id = uuidv4();
    await tursoExecute(
      turso(c.env),
      `INSERT INTO service_requests (id, patient_id, provider_id, service_type, status, context_payload, source_event_id, lab_test_name, item_name, patient_lat, patient_lng, radius_km) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        b.patient_id,
        b.provider_id || null,
        b.service_type,
        b.status || "pending",
        b.context_payload ? JSON.stringify(b.context_payload) : null,
        b.source_event_id || null,
        b.lab_test_name || null,
        b.item_name || null,
        b.patient_lat || null,
        b.patient_lng || null,
        b.radius_km || 10,
      ],
    );
    return c.json({ id, status: "pending" }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.patch("/api/service-requests/:id", async (c) => {
  try {
    const b = await c.req.json();
    const sets: string[] = [];
    const args: any[] = [];
    const m: Record<string, string> = {
      status: "status",
      provider_id: "provider_id",
      assigned_provider_id: "assigned_provider_id",
      assigned_provider_name: "assigned_provider_name",
      distance_km: "distance_km",
      estimated_eta_minutes: "estimated_eta_minutes",
      dispatched_at: "dispatched_at",
      error_message: "error_message",
    };
    for (const [k, col] of Object.entries(m)) {
      if (b[k] !== undefined) {
        sets.push(`${col} = ?`);
        args.push(b[k]);
      }
    }
    if (!sets.length) return c.json({ error: "No fields to update" }, 400);
    sets.push("updated_at = datetime('now')");
    args.push(c.req.param("id"));
    await tursoExecute(
      turso(c.env),
      `UPDATE service_requests SET ${sets.join(", ")} WHERE id = ?`,
      args,
    );
    return c.json({ status: "ok" });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── Clinical Ledger ──────────────────────────────────────────────────────────
app.get("/api/clinical-ledger", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "100");
    const { rows } = await tursoExecute(
      turso(c.env),
      "SELECT * FROM clinical_ledger ORDER BY created_at DESC LIMIT ?",
      [String(limit)],
    );
    return c.json({ entries: rows });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/api/clinical-ledger/patient/:patientId", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "100");
    const { rows } = await tursoExecute(
      turso(c.env),
      "SELECT * FROM clinical_ledger WHERE patient_id = ? ORDER BY created_at DESC LIMIT ?",
      [c.req.param("patientId"), String(limit)],
    );
    return c.json({ entries: rows });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/api/clinical-ledger", async (c) => {
  try {
    const { patient_id, provider_id, type, payload, event_type, request_id } =
      await c.req.json();
    if (!patient_id || !provider_id || !type)
      return c.json({ error: "patient_id, provider_id, type required" }, 400);
    const id = uuidv4();
    const now = new Date().toISOString();
    await tursoExecute(
      turso(c.env),
      `INSERT INTO clinical_ledger (id, patient_id, provider_id, type, payload, created_at, event_type, request_id, "timestamp") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        patient_id,
        provider_id,
        type,
        JSON.stringify(payload),
        now,
        event_type || null,
        request_id || null,
        now,
      ],
    );
    return c.json({ id, type, created_at: now }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.patch("/api/clinical-ledger/:id/payment", async (c) => {
  try {
    const { payment_status } = await c.req.json();
    await tursoExecute(
      turso(c.env),
      `UPDATE clinical_ledger SET payment_status = ?, processed_at = datetime('now') WHERE id = ?`,
      [payment_status, c.req.param("id")],
    );
    return c.json({ status: "ok" });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── Batch ────────────────────────────────────────────────────────────────────
app.post("/api/service-requests/batch", async (c) => {
  try {
    const { requests } = await c.req.json();
    if (!Array.isArray(requests))
      return c.json({ error: "requests array required" }, 400);
    const ids: string[] = [];
    for (const r of requests) {
      const id = uuidv4();
      ids.push(id);
      await tursoExecute(
        turso(c.env),
        `INSERT INTO service_requests (id, patient_id, service_type, status, lab_test_name, item_name, source_event_id) VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
        [
          id,
          r.patient_id,
          r.service_type,
          r.lab_test_name,
          r.item_name,
          r.source_event_id,
        ],
      );
    }
    return c.json({ ids, count: ids.length }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── AI Scribe ────────────────────────────────────────────────────────────────
app.post("/api/scribe", async (c) => {
  try {
    const { audioTranscript, patientContext } = await c.req.json();
    if (!audioTranscript)
      return c.json({ error: "audioTranscript required" }, 400);
    const res = await fetch(
      `${c.env.AI_GATEWAY_URL}/groq/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${c.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: [
            {
              role: "system",
              content:
                'Extract clinical context into JSON: {"summary":"string","vitals":[],"observations":[]}',
            },
            {
              role: "user",
              content: `Context: ${patientContext || "None"}\n\nTranscript: ${audioTranscript}`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
      },
    );
    if (!res.ok) return c.json({ error: "Failed" }, 500);
    const data = (await res.json()) as any;
    return c.json(JSON.parse(data.choices[0]?.message?.content));
  } catch {
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// ── R2 Upload ────────────────────────────────────────────────────────────────
app.get("/api/upload-url", async (c) => {
  try {
    const fileName = c.req.query("filename");
    const contentType = c.req.query("contentType");
    if (!fileName || !contentType)
      return c.json({ error: "filename and contentType required" }, 400);
    const S3 = new S3Client({
      region: "auto",
      endpoint: `https://${c.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: c.env.R2_ACCESS_KEY_ID,
        secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
      },
    });
    const fileKey = `${crypto.randomUUID()}-${fileName}`;
    const url = await getSignedUrl(
      S3,
      new PutObjectCommand({
        Bucket: "medscreen",
        Key: fileKey,
        ContentType: contentType,
      }),
      { expiresIn: 900 },
    );
    return c.json({ url, fileKey });
  } catch {
    return c.json({ error: "Failed" }, 500);
  }
});

// ── LiveKit ──────────────────────────────────────────────────────────────────
app.post("/api/video/token", async (c) => {
  try {
    const { roomName, identity, name } = await c.req.json();
    if (!roomName || !identity)
      return c.json({ error: "roomName and identity required" }, 400);
    const token = await generateLiveKitToken(
      c.env.LIVEKIT_API_KEY,
      c.env.LIVEKIT_API_SECRET,
      roomName,
      identity,
      name || identity,
      3600,
    );
    return c.json({ token, url: c.env.LIVEKIT_URL, room: roomName });
  } catch {
    return c.json({ error: "Failed" }, 500);
  }
});

export default app;
