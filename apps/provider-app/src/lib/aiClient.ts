import { AiSettings } from "../hooks/useAiSettings";
import {
  HybridScribeManager,
  isWebGPUAvailable,
  type ScribeResult as LocalScribeResult,
  type AiSource,
  type ScribeProgress,
} from "@skids/ai-scribe-local";

// ── Hybrid Scribe Singleton ────────────────────────────────────────
let hybridManager: HybridScribeManager | null = null;
let hybridSource: AiSource | null = null;

/**
 * Get or initialize the hybrid scribe manager.
 * Returns the manager + which source is active ('local' or 'cloud').
 */
export async function getHybridScribe(
  settings: AiSettings,
  onProgress?: (progress: ScribeProgress) => void,
): Promise<{ manager: HybridScribeManager; source: AiSource }> {
  if (hybridManager && hybridSource) {
    return { manager: hybridManager, source: hybridSource };
  }

  const cloudConfig = settings.cloudApiKey
    ? {
        provider:
          settings.cloudProvider === "together_ai"
            ? ("together_ai" as const)
            : ("groq" as const),
        apiKey: settings.cloudApiKey,
      }
    : undefined;

  hybridManager = new HybridScribeManager({ cloud: cloudConfig, onProgress });
  hybridSource = await hybridManager.initialize();

  return { manager: hybridManager, source: hybridSource };
}

/**
 * Reset the hybrid scribe singleton (e.g., when settings change).
 */
export function resetHybridScribe(): void {
  if (hybridManager) {
    hybridManager.dispose();
  }
  hybridManager = null;
  hybridSource = null;
}

/**
 * Generate a clinical note using local-first, cloud-fallback extraction.
 * This is the primary entry point — tries MedScribe local first.
 */
export async function generateClinicalNoteLocal(
  params: {
    audioTranscript: string;
    patientContext: string;
    patientWeight: number;
  },
  settings: AiSettings,
  onProgress?: (progress: ScribeProgress) => void,
): Promise<{ result: LocalScribeResult; source: AiSource; reasoning: string }> {
  const { manager, source } = await getHybridScribe(settings, onProgress);

  const {
    result,
    source: usedSource,
    reasoning,
  } = await manager.extract(params.audioTranscript);

  return { result, source: usedSource, reasoning };
}

/**
 * Check if WebGPU is available for local inference.
 */
export function canRunLocal(): boolean {
  return isWebGPUAvailable();
}

const CLINICAL_SYSTEM_PROMPT = `You are an expert AI clinical scribe specializing in pediatric medicine. Your goal is to provide deep, transparent clinical reasoning before generating a final summary.

First, you MUST write your detailed clinical reasoning inside <think> tags. To mimic exhaustive medical expert reasoning, structure your <think> block with these explicit steps:

<think>
Step 1: Patient Context Analysis
- Evaluate age, weight, demographics, and baseline risk factors.

Step 2: Symptom & Sign Breakdown
- Work through the presented symptoms systematically. What fits? What doesn't?

Step 3: Differential Diagnosis (DDx)
- List the most likely conditions. Explain WHY each is probable or should be excluded based on epidemiology and the patient's specific presentation.
- Rank them by probability (high/medium/low).

Step 4: IMNCI / WHO Danger Signs Check
- Explicitly check for: unable to drink/feed, lethargy, convulsions, stridor, severe malnutrition, fever <2mo. If present, flag them.

Step 5: Pediatric Dosing & Safety
- If a medication is indicated, you MUST calculate the exact dose based on the patient's weight (mg/kg).
- Verify standard guidelines, maximum doses, and frequency for the specific age/weight.

Step 6: ICD-10 Coding
- Identify the most accurate ICD-10 code(s) for the primary and secondary diagnoses.
</think>

Then, after </think>, output ONLY valid JSON matching this schema:
{
  "summary": "string — 1-2 sentence clinical summary. DO NOT use markdown code blocks.",
  "reasoning_summary": "string — 1 sentence: main clinical conclusion",
  "red_flags": ["string"],
  "vitals": [{"label": "string", "value": "string", "unit": "string", "abnormal": boolean}],
  "icd10_codes": [{"code": "string", "description": "string", "primary": boolean}],
  "observations": [
    {"id": "string", "label": "string", "state": "suggested", "type": "symptom" | "rx" | "ddx", "probability": "high" | "medium" | "low"}
  ],
  "dosing_notes": [
    {"drug": "string", "dose_mg_kg": number, "route": "string", "frequency": "string", "max_dose": "string", "safety_note": "string"}
  ]
}

Rules:
- Never hallucinate medications not mentioned or clearly indicated by standard protocols.
- ALWAYS calculate doses per kg when weight is available.
- Assign probability to every observation (high/medium/low).
- The JSON output MUST NOT be wrapped in markdown code blocks like \`\`\`json. Just output the raw JSON string starting with {.`;

export type StreamEvent =
  | { type: "thinking"; delta: string }
  | { type: "output"; delta: string }
  | { type: "done"; result: any }
  | { type: "error"; message: string };

export async function generateClinicalNoteStream(
  params: {
    audioTranscript: string;
    patientContext: string;
    patientWeight: number;
  },
  settings: AiSettings,
  onEvent: (event: StreamEvent) => void,
) {
  const { audioTranscript, patientContext, patientWeight } = params;

  const messages = [
    { role: "system", content: CLINICAL_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Patient Context: ${patientContext || "None"}
Patient Weight: ${patientWeight ? patientWeight + " kg" : "Unknown"}

Consultation Transcript:
${audioTranscript}`,
    },
  ];

  let selectedUrl = "";
  let selectedAuth = "";
  let selectedModel = "";
  let providerType: "local" | "cloud" = "local";

  // 1. Determine priority target
  if (settings.mode === "cloud_only") {
    providerType = "cloud";
  } else {
    // hybrid or local_only starts with Local AI
    providerType = "local";
    selectedUrl =
      settings.localNodeUrl || "http://localhost:11434/api/v1/chat/completions";
    // WasmEdge / Ollama usually require open-source model string or empty default
    selectedModel = "medgemma-4b"; // placeholder, most local engines ignore if sole model loaded
  }

  const runCloudFallback = () => {
    providerType = "cloud";
    if (!settings.cloudApiKey) {
      throw new Error(
        "Local node failed, and no Cloud BYOK Key is configured.",
      );
    }

    if (settings.cloudProvider === "together_ai") {
      selectedUrl = "https://api.together.xyz/v1/chat/completions";
      selectedModel = "Qwen/Qwen2.5-72B-Instruct"; // Best open weight for Med
    } else {
      // Groq
      selectedUrl = "https://api.groq.com/openai/v1/chat/completions";
      selectedModel = "llama-3.3-70b-versatile";
    }
    selectedAuth = `Bearer ${settings.cloudApiKey}`;
  };

  if (providerType === "cloud") {
    runCloudFallback();
  }

  // 2. Execute Fetch with Failover
  let response: Response;
  try {
    const fetchArgs: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(selectedAuth ? { Authorization: selectedAuth } : {}),
      },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        stream: true,
        temperature: 0.15,
        // stop: ["<|end_of_text|>"], // standard Llama/Qwen stops
      }),
    };

    // If local, timeout quickly so we don't hang the UX
    if (providerType === "local") {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s max wait for local to answer
      response = await fetch(selectedUrl, {
        ...fetchArgs,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } else {
      response = await fetch(selectedUrl, fetchArgs);
    }

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (err: any) {
    // If local failed and we are hybrid, failover to cloud
    if (providerType === "local" && settings.mode === "hybrid") {
      console.warn("Local node failed, failing over to Cloud BYOK...", err);
      runCloudFallback();
      response = await fetch(selectedUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: selectedAuth,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages,
          stream: true,
          temperature: 0.15,
        }),
      });
      if (!response.ok)
        throw new Error(`Cloud Fallback Failed: HTTP ${response.status}`);
    } else {
      throw new Error(`AI Request failed: ${err.message}`);
    }
  }

  // 3. Parse Stream (OpenAI Format)
  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  let inThink = false;
  let thinkDone = false;
  let fullBuffer = "";

  const processChunk = (chunk: string) => {
    for (const line of chunk.split("\\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed === "data: [DONE]") {
        // Extract JSON
        let cleaned = fullBuffer.replace(/<think>[\s\S]*?<\/think>/gi, "");
        cleaned = cleaned
          .replace(/```(?:json)?\s*/gi, "")
          .replace(/```/gi, "")
          .trim();
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");

        let result = null;
        if (start !== -1 && end !== -1 && end >= start) {
          try {
            result = JSON.parse(cleaned.slice(start, end + 1));
          } catch (e) {}
        }

        onEvent({
          type: "done",
          result: result || {
            error: "Failed to parse AI output",
            raw: fullBuffer,
          },
        });
        continue;
      }
      if (!trimmed.startsWith("data: ")) continue;

      try {
        const payload = JSON.parse(trimmed.slice(6));
        const delta =
          payload.choices?.[0]?.delta?.content ||
          payload.message?.content ||
          "";
        if (!delta) continue;

        fullBuffer += delta;

        if (!thinkDone) {
          if (!inThink && fullBuffer.includes("<think>")) inThink = true;
          if (inThink) {
            if (fullBuffer.includes("</think>")) {
              thinkDone = true;
              inThink = false;
              const afterThink = fullBuffer.split("</think>").pop() || "";
              if (afterThink.trim())
                onEvent({ type: "output", delta: afterThink });
            } else {
              const clean = delta.replace(/<think>/gi, "");
              if (clean) onEvent({ type: "thinking", delta: clean });
            }
            continue;
          }
        }

        if (thinkDone || !inThink) {
          onEvent({ type: "output", delta });
        }
      } catch {
        /* skip incomplete chunks */
      }
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\\n\\n");
      buffer = chunks.pop() || "";
      for (const ch of chunks) processChunk(ch);
    }
    if (buffer) processChunk(buffer);
  } catch (err: any) {
    onEvent({ type: "error", message: err.message });
  }
}
