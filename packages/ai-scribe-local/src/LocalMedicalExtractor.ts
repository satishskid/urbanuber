/**
 * LocalMedicalExtractor — Browser-native medical data extraction
 *
 * Ports MedScribe's extraction pipeline to produce UrbanUber's chip format.
 * Uses LFM2.5-1.2B-Instruct via ONNX Runtime Web when WebGPU is available,
 * falls back to keyword extraction otherwise.
 */

import type {
  MedScribeExtraction,
  ScribeResult,
  Observation,
  AiSource,
} from "./types";

// ── Clinical system prompt (MedScribe-derived, outputs chip-format JSON) ──────
const EXTRACTION_PROMPT = `You are an expert medical consultation assistant. Extract structured medical information from the consultation transcript.

RULES:
1. Respond with valid JSON only — no markdown, no code fences, no explanations
2. Extract only information explicitly mentioned in the transcript
3. Use professional medical terminology
4. If a field is not mentioned, use empty string "" or empty array []
5. medication_names should use generic names unless brand name is specifically mentioned
6. For each observation, assign probability: "high", "medium", or "low"
7. observation types must be one of: "symptom", "rx", "ddx"

JSON STRUCTURE:
{
  "incident_record": "Detailed paragraph: chief complaint, history of present illness, symptoms, duration, onset",
  "prescription": [
    {"drug": "name", "dose": "e.g. 500mg", "frequency": "e.g. twice daily", "duration": "e.g. 5 days"}
  ],
  "lab_recommendations": ["Complete Blood Count", ...],
  "radiology_recommendations": ["Chest X-ray", ...],
  "treatment_plan": "Detailed paragraph explaining treatment approach and management strategy",
  "diet_advice": ["Specific dietary recommendation", ...],
  "summary": "Comprehensive summary: patient presentation, key findings, assessment, plan",
  "observations": [
    {"id": "obs-1", "label": "Fever", "state": "suggested", "type": "symptom", "probability": "high"}
  ],
  "red_flags": ["Any danger signs detected"],
  "vitals": [{"label": "Temp", "value": "39.2", "unit": "°C", "abnormal": true}],
  "icd10_codes": [{"code": "J06.9", "description": "Acute upper respiratory infection", "primary": true}],
  "dosing_notes": [{"drug": "name", "dose_mg_kg": 0, "route": "oral", "frequency": "BD", "max_dose": "1g", "safety_note": ""}]
}`;

export class LocalMedicalExtractor {
  private isInitialized = false;
  private llm: any = null;
  private useLLM = true;
  private onnxPipeline: any = null;

  async initialize(
    onProgress?: (percent: number, message: string) => void,
  ): Promise<void> {
    if (this.isInitialized) return;

    const hasWebGPU =
      typeof navigator !== "undefined" && !!(navigator as any).gpu;

    if (!hasWebGPU) {
      console.warn(
        "[LocalExtractor] WebGPU unavailable, using keyword extraction",
      );
      this.useLLM = false;
      this.isInitialized = true;
      if (onProgress)
        onProgress(100, "WebGPU unavailable — keyword extraction ready");
      return;
    }

    try {
      if (onProgress) onProgress(10, "Loading transformers.js...");

      const transformers = await import(
        /* webpackIgnore: true */ "@huggingface/transformers"
      );
      const { pipeline, env } = transformers;

      // Ensure ONNX runtime uses WebGPU
      if (env.backends.onnx.wasm) {
        env.backends.onnx.wasm.proxy = false;
      }

      if (onProgress)
        onProgress(30, "Downloading LFM2.5-1.2B-Instruct model...");

      this.onnxPipeline = await pipeline(
        "text-generation",
        "onnx-community/LFM2.5-1.2B-Instruct-ONNX",
        {
          device: "webgpu",
          dtype: "q4",
          progress_callback: (progress: any) => {
            if (
              progress.status === "progress" &&
              progress.progress &&
              onProgress
            ) {
              const pct = 30 + Math.floor((progress.progress / 100) * 60);
              onProgress(
                pct,
                `Loading model... ${Math.floor(progress.progress)}%`,
              );
            } else if (progress.status === "ready" && onProgress) {
              onProgress(95, "Model loaded, warming up...");
            }
          },
        },
      );

      if (onProgress) onProgress(100, "Local AI ready");
      this.isInitialized = true;
      console.log("[LocalExtractor] LFM2.5-1.2B-Instruct loaded on WebGPU");
    } catch (err: any) {
      console.warn(
        "[LocalExtractor] LLM init failed, falling back to keywords:",
        err.message,
      );
      this.useLLM = false;
      if (onProgress)
        onProgress(100, "Model unavailable — keyword extraction ready");
      this.isInitialized = true;
    }
  }

  async dispose(): Promise<void> {
    this.onnxPipeline = null;
    this.isInitialized = false;
  }

  /**
   * Extract structured medical data from transcript.
   * Returns ScribeResult compatible with UrbanUber's triage flow.
   */
  async extract(transcript: string): Promise<ScribeResult> {
    if (!this.isInitialized) await this.initialize();

    let extraction: MedScribeExtraction;

    if (this.useLLM && this.onnxPipeline) {
      try {
        extraction = await this.extractViaLLM(transcript);
      } catch (err: any) {
        console.warn(
          "[LocalExtractor] LLM extraction failed, using keywords:",
          err.message,
        );
        extraction = this.keywordExtract(transcript);
      }
    } else {
      extraction = this.keywordExtract(transcript);
    }

    return this.toScribeResult(extraction, transcript);
  }

  private async extractViaLLM(
    transcript: string,
  ): Promise<MedScribeExtraction> {
    const messages = [
      { role: "system", content: EXTRACTION_PROMPT },
      {
        role: "user",
        content: `Analyze this consultation transcript and return structured JSON:\n\n${transcript}`,
      },
    ];

    const result = await this.onnxPipeline(messages, {
      max_new_tokens: 1800,
      temperature: 0.1,
      do_sample: false,
    });

    const rawText =
      result[0]?.generated_text?.[result[0].generated_text.length - 1]
        ?.content || "";
    return this.parseLLMResponse(rawText);
  }

  private parseLLMResponse(response: string): MedScribeExtraction {
    try {
      let cleaned = response
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.normalize(parsed);
      }
    } catch (err) {
      console.warn("[LocalExtractor] Failed to parse LLM JSON response");
    }
    return this.emptyExtraction();
  }

  private normalize(data: any): MedScribeExtraction {
    return {
      incident_record: this.str(data.incident_record),
      prescription: Array.isArray(data.prescription)
        ? data.prescription
            .map((m: any) => ({
              drug: this.str(m.drug),
              dose: this.str(m.dose),
              frequency: this.str(m.frequency),
              duration: this.str(m.duration),
            }))
            .filter((m: any) => m.drug)
        : [],
      lab_recommendations: Array.isArray(data.lab_recommendations)
        ? data.lab_recommendations.filter(Boolean)
        : [],
      radiology_recommendations: Array.isArray(data.radiology_recommendations)
        ? data.radiology_recommendations.filter(Boolean)
        : [],
      treatment_plan: this.str(data.treatment_plan),
      diet_advice: Array.isArray(data.diet_advice)
        ? data.diet_advice.filter(Boolean)
        : [],
      summary: this.str(data.summary),
    };
  }

  private str(val: any): string {
    if (typeof val === "string") return val.trim();
    return val ? String(val).trim() : "";
  }

  private emptyExtraction(): MedScribeExtraction {
    return {
      incident_record: "",
      prescription: [],
      lab_recommendations: [],
      radiology_recommendations: [],
      treatment_plan: "",
      diet_advice: [],
      summary: "",
    };
  }

  // ── Keyword extraction fallback ───────────────────────────────────────────
  private keywordExtract(transcript: string): MedScribeExtraction {
    const text = transcript.toLowerCase();

    return {
      incident_record: transcript.trim(),
      prescription: this.extractPrescriptions(transcript),
      lab_recommendations: this.extractLabs(text),
      radiology_recommendations: this.extractRadiology(text),
      treatment_plan: this.extractByKeywords(transcript, [
        "prescribed",
        "advised",
        "recommended",
        "started on",
        "treatment",
        "plan",
      ]),
      diet_advice: this.extractByKeywords(transcript, [
        "diet",
        "avoid",
        "fluid",
        "water",
        "rest",
        "sleep",
        "exercise",
        "eat",
      ])
        .split(". ")
        .filter(Boolean),
      summary: transcript.trim().slice(0, 500),
    };
  }

  private extractPrescriptions(
    text: string,
  ): MedScribeExtraction["prescription"] {
    const meds = [
      "paracetamol",
      "acetaminophen",
      "ibuprofen",
      "amoxicillin",
      "azithromycin",
      "metformin",
      "lisinopril",
      "atorvastatin",
      "omeprazole",
      "cetirizine",
      "amoxiclav",
      "augmentin",
      "crocin",
      "dolo",
      "calpol",
      "combiflam",
    ];
    const freqs = [
      "once daily",
      "twice daily",
      "three times daily",
      "daily",
      "bid",
      "tid",
      "qid",
      "prn",
      "every 8 hours",
      "every 12 hours",
      "bd",
      "tds",
    ];
    const doseRe = /\b\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|mg\/ml)\b/i;
    const durRe = /\b\d+\s*(?:day|days|week|weeks|month|months)\b/i;
    const lower = text.toLowerCase();
    const seen = new Set<string>();

    return meds
      .filter((m) => lower.includes(m))
      .map((m) => {
        const dose = text.match(doseRe)?.[0] || "";
        const freq = freqs.find((f) => lower.includes(f)) || "";
        const dur = text.match(durRe)?.[0] || "";
        const key = `${m}|${dose}|${freq}|${dur}`;
        if (seen.has(key)) return null;
        seen.add(key);
        return { drug: this.cap(m), dose, frequency: freq, duration: dur };
      })
      .filter(Boolean) as MedScribeExtraction["prescription"];
  }

  private extractLabs(text: string): string[] {
    const labs: Array<[string, string[]]> = [
      [
        "Complete Blood Count (CBC)",
        ["cbc", "complete blood count", "blood count", "hemoglobin"],
      ],
      [
        "Fasting Blood Sugar",
        ["fasting blood sugar", "fbs", "fasting glucose", "hba1c"],
      ],
      [
        "Lipid Profile",
        ["lipid profile", "cholesterol", "triglycerides", "ldl", "hdl"],
      ],
      ["Thyroid Function Test", ["thyroid", "tsh", "t3", "t4"]],
      ["Liver Function Test", ["liver function", "lft", "sgot", "sgpt"]],
      [
        "Kidney Function Test",
        ["kidney function", "kft", "creatinine", "urea"],
      ],
      ["Urinalysis", ["urine", "urinalysis", "routine urine"]],
      ["Blood Culture", ["blood culture"]],
      ["ESR", ["esr", "erythrocyte sedimentation"]],
      ["CRP", ["crp", "c-reactive protein"]],
    ];
    return labs
      .filter(([, kws]) => kws.some((k) => text.includes(k)))
      .map(([name]) => name);
  }

  private extractRadiology(text: string): string[] {
    const imaging: Array<[string, string[]]> = [
      ["Chest X-ray", ["chest xray", "chest x-ray", "cxr"]],
      ["CT Scan", ["ct scan", "computed tomography"]],
      ["MRI", ["mri", "magnetic resonance"]],
      ["Ultrasound", ["ultrasound", "sonography", "usg"]],
      ["ECG/EKG", ["ecg", "ekg", "electrocardiogram"]],
      ["Echocardiogram", ["echo", "echocardiogram", "2d echo"]],
      ["X-ray", ["x-ray", "xray"]],
    ];
    return imaging
      .filter(([, kws]) => kws.some((k) => text.includes(k)))
      .map(([name]) => name);
  }

  private extractByKeywords(text: string, keywords: string[]): string {
    const sentences = text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return sentences
      .filter((s) => keywords.some((k) => s.toLowerCase().includes(k)))
      .join(". ");
  }

  private cap(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ── Convert MedScribe extraction → UrbanUber ScribeResult ─────────────────
  private toScribeResult(
    ext: MedScribeExtraction,
    transcript: string,
  ): ScribeResult {
    const observations: Observation[] = [];
    let obsIdx = 0;

    // Prescription → rx observations
    ext.prescription.forEach((med) => {
      observations.push({
        id: `rx-${++obsIdx}`,
        label:
          `${med.drug} ${med.dose} ${med.frequency} × ${med.duration}`.trim(),
        state: "suggested",
        type: "rx",
        probability: "high",
      });
    });

    // Lab recommendations → lab_order observations
    ext.lab_recommendations.forEach((lab) => {
      observations.push({
        id: `lab-${++obsIdx}`,
        label: lab,
        state: "suggested",
        type: "lab_order",
        probability: "medium",
      });
    });

    // Radiology → radiology observations
    ext.radiology_recommendations.forEach((rad) => {
      observations.push({
        id: `rad-${++obsIdx}`,
        label: rad,
        state: "suggested",
        type: "radiology",
        probability: "medium",
      });
    });

    // Diet advice → treatment observations
    ext.diet_advice.forEach((d) => {
      observations.push({
        id: `diet-${++obsIdx}`,
        label: d,
        state: "suggested",
        type: "diet",
        probability: "low",
      });
    });

    // Extract symptoms from transcript
    const symptomKeywords = [
      "pain",
      "fever",
      "cough",
      "headache",
      "nausea",
      "vomiting",
      "fatigue",
      "weakness",
      "dizziness",
      "shortness of breath",
      "rash",
      "swelling",
      "constipation",
      "diarrhea",
      "sore throat",
    ];
    const lower = transcript.toLowerCase();
    symptomKeywords.forEach((sym) => {
      if (lower.includes(sym)) {
        observations.push({
          id: `symp-${++obsIdx}`,
          label: this.cap(sym),
          state: "suggested",
          type: "symptom",
          probability: "high",
        });
      }
    });

    return {
      summary:
        ext.summary ||
        ext.incident_record.slice(0, 300) ||
        "Consultation completed.",
      reasoning_summary: ext.treatment_plan
        ? ext.treatment_plan.slice(0, 200)
        : "",
      red_flags: [],
      vitals: [],
      icd10_codes: [],
      observations,
      dosing_notes: ext.prescription.map((m) => ({
        drug: m.drug,
        dose_mg_kg: 0,
        route: "oral",
        frequency: m.frequency,
        max_dose: m.dose,
        safety_note: "",
      })),
    };
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  isLocalLLMReady(): boolean {
    return this.useLLM && this.onnxPipeline !== null;
  }
}
