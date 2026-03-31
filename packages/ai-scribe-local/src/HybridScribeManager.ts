/**
 * HybridScribeManager — Local-first AI scribe with cloud fallback
 *
 * DEFAULT: Uses browser-native MedScribe pipeline (Web Speech API + LFM2.5-1.2B-Instruct)
 * FALLBACK: Uses Groq API via Cloudflare Worker (existing urbanUber pipeline)
 *
 * Priority order:
 *   1. Local WebGPU inference (MedScribe) — zero cost, full privacy
 *   2. Cloud Groq API — fallback when WebGPU unavailable or local extraction fails
 */

import { LocalSpeechToText } from "./LocalSpeechToText";
import { LocalMedicalExtractor } from "./LocalMedicalExtractor";
import { isWebGPUAvailable } from "./config";
import type { ScribeResult, ScribeProgress, AiSource } from "./types";

export interface CloudConfig {
  provider: "groq" | "together_ai";
  apiKey: string;
  endpoint?: string;
}

export interface HybridManagerOptions {
  cloud?: CloudConfig;
  onProgress?: (progress: ScribeProgress) => void;
}

export class HybridScribeManager {
  private stt: LocalSpeechToText;
  private extractor: LocalMedicalExtractor;
  private cloudConfig?: CloudConfig;
  private onProgress?: (progress: ScribeProgress) => void;

  private localReady = false;
  private activeSource: AiSource | null = null;

  constructor(options: HybridManagerOptions = {}) {
    this.stt = new LocalSpeechToText();
    this.extractor = new LocalMedicalExtractor();
    this.cloudConfig = options.cloud;
    this.onProgress = options.onProgress;
  }

  // ── Initialization ────────────────────────────────────────────────────────
  async initialize(): Promise<AiSource> {
    this.report("init", "Initializing local AI scribe...", "local", 5);

    // Try local initialization
    if (isWebGPUAvailable()) {
      try {
        await this.extractor.initialize((percent, message) => {
          this.report("init", message, "local", percent);
        });

        this.localReady = true;
        this.activeSource = "local";
        this.report(
          "done",
          "Local AI ready — browser-native inference active",
          "local",
          100,
        );
        return "local";
      } catch (err: any) {
        console.warn("[HybridScribe] Local init failed:", err.message);
      }
    } else {
      console.log("[HybridScribe] WebGPU not available");
    }

    // Check if cloud fallback is configured
    if (this.cloudConfig?.apiKey) {
      this.activeSource = "cloud";
      this.report("init", "Using cloud AI (Groq)", "cloud", 100);
      return "cloud";
    }

    this.report(
      "error",
      "No AI source available. Configure cloud API key or use a WebGPU browser.",
      undefined,
    );
    throw new Error("No AI source available");
  }

  // ── Transcription ─────────────────────────────────────────────────────────

  /**
   * Start live transcription (real-time speech-to-text via Web Speech API)
   */
  async startLiveTranscription(
    onUpdate: (text: string) => void,
  ): Promise<void> {
    if (!this.stt.isSupported()) {
      throw new Error("Speech recognition not supported in this browser");
    }
    this.report("transcribing", "Listening...", this.activeSource || undefined);
    await this.stt.startLive(onUpdate);
  }

  async stopLiveTranscription(): Promise<string> {
    return await this.stt.stop();
  }

  // ── Extraction (the main event) ───────────────────────────────────────────

  /**
   * Extract structured clinical data from transcript.
   * Tries local first, falls back to cloud.
   */
  async extract(transcript: string): Promise<{
    result: ScribeResult;
    source: AiSource;
    reasoning: string;
  }> {
    // ── Attempt 1: Local (WebGPU) ─────────────────────────────────────────
    if (this.localReady && this.extractor.isLocalLLMReady()) {
      try {
        this.report(
          "extracting",
          "Extracting with local AI model...",
          "local",
          50,
        );
        const result = await this.extractor.extract(transcript);
        this.report("done", "Local extraction complete", "local", 100);
        return {
          result,
          source: "local",
          reasoning: `[Local LFM2.5-1.2B] Extracted ${result.observations.length} clinical observations, ${result.dosing_notes?.length || 0} dosing notes.`,
        };
      } catch (err: any) {
        console.warn(
          "[HybridScribe] Local extraction failed, trying cloud:",
          err.message,
        );
      }
    }

    // ── Attempt 2: Local keyword fallback (no LLM, still local) ───────────
    if (this.localReady && !this.extractor.isLocalLLMReady()) {
      try {
        this.report(
          "extracting",
          "Extracting with local keyword analysis...",
          "local",
          50,
        );
        const result = await this.extractor.extract(transcript);
        this.report("done", "Local keyword extraction complete", "local", 100);
        return {
          result,
          source: "local",
          reasoning: `[Local Keywords] Extracted ${result.observations.length} clinical observations via pattern matching.`,
        };
      } catch (err: any) {
        console.warn("[HybridScribe] Keyword extraction failed:", err.message);
      }
    }

    // ── Attempt 3: Cloud fallback (Groq) ──────────────────────────────────
    if (this.cloudConfig?.apiKey) {
      this.report("extracting", "Using cloud AI (Groq)...", "cloud", 50);
      const { result, reasoning } = await this.cloudExtract(transcript);
      this.report("done", "Cloud extraction complete", "cloud", 100);
      return { result, source: "cloud", reasoning };
    }

    throw new Error("All extraction methods failed");
  }

  // ── Cloud extraction (Groq) ───────────────────────────────────────────────
  private async cloudExtract(transcript: string): Promise<{
    result: ScribeResult;
    reasoning: string;
  }> {
    const { provider, apiKey, endpoint } = this.cloudConfig!;

    let url: string;
    let model: string;

    if (provider === "together_ai") {
      url = endpoint || "https://api.together.xyz/v1/chat/completions";
      model = "Qwen/Qwen2.5-72B-Instruct";
    } else {
      url = endpoint || "https://api.groq.com/openai/v1/chat/completions";
      model = "llama-3.3-70b-versatile";
    }

    const systemPrompt = `You are an expert medical consultation assistant. Extract structured medical information from the transcript.

RULES:
1. Respond with valid JSON only — no markdown, no code fences
2. Extract only information explicitly mentioned
3. If a field is not mentioned, use empty string "" or empty array []

JSON STRUCTURE:
{
  "incident_record": "Detailed paragraph: chief complaint, HPI, symptoms, duration",
  "prescription": [{"drug": "name", "dose": "500mg", "frequency": "twice daily", "duration": "5 days"}],
  "lab_recommendations": ["Complete Blood Count", ...],
  "radiology_recommendations": ["Chest X-ray", ...],
  "treatment_plan": "Detailed paragraph on treatment approach",
  "diet_advice": ["Recommendation 1", ...],
  "summary": "Comprehensive summary",
  "observations": [{"id": "obs-1", "label": "Fever", "state": "suggested", "type": "symptom", "probability": "high"}],
  "red_flags": [],
  "vitals": [{"label": "Temp", "value": "39.2", "unit": "°C", "abnormal": true}],
  "icd10_codes": [{"code": "J06.9", "description": "Acute URI", "primary": true}],
  "dosing_notes": [{"drug": "name", "dose_mg_kg": 0, "route": "oral", "frequency": "BD", "max_dose": "1g", "safety_note": ""}]
}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Analyze this consultation transcript:\n\n${transcript}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`Cloud API error: HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";

    let parsed: any = {};
    try {
      let cleaned = rawContent
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      console.warn("[HybridScribe] Failed to parse cloud response");
    }

    const result: ScribeResult = {
      summary: parsed.summary || transcript.slice(0, 300),
      reasoning_summary: parsed.treatment_plan?.slice(0, 200) || "",
      red_flags: parsed.red_flags || [],
      vitals: parsed.vitals || [],
      icd10_codes: parsed.icd10_codes || [],
      observations: (parsed.observations || []).map((o: any, i: number) => ({
        id: o.id || `obs-${i}`,
        label: o.label || "",
        state: o.state || "suggested",
        type: o.type || "symptom",
        probability: o.probability || "medium",
      })),
      dosing_notes: parsed.dosing_notes || [],
    };

    return {
      result,
      reasoning: `[Cloud ${provider}] Extracted ${result.observations.length} observations`,
    };
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  getActiveSource(): AiSource | null {
    return this.activeSource;
  }

  isLocalReady(): boolean {
    return this.localReady;
  }

  async dispose(): Promise<void> {
    await this.extractor.dispose();
    this.localReady = false;
  }

  private report(
    phase: ScribeProgress["phase"],
    message: string,
    source?: AiSource,
    percent?: number,
  ) {
    if (this.onProgress) {
      this.onProgress({ phase, message, source, percent });
    }
  }
}
