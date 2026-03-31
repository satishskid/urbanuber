/**
 * ConsultationScreen.tsx — Track 2+4
 *
 * Doctor app consultation flow with hybrid AI scribe (local-first, cloud-fallback):
 * 1. Doctor records / types transcript (Web Speech API for real STT on web)
 * 2. Local MedScribe extraction attempted first (WebGPU, zero cost)
 * 3. If local unavailable → falls back to Groq SSE streaming
 * 4. JSON output → TriageScreen chips appear
 * 5. Doctor confirms/rejects chips → signs to clinical ledger
 */
import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AudioScribe } from "../components/AudioScribe";
import { LocalAiTriage } from "../components/LocalAiTriage";
import { TriageScreen } from "@skids/ui";
import { ReasoningPanel } from "@skids/ui";
import { useClinicalLedger } from "@skids/firebase/src/hooks/useClinicalLedger";
import { useAiSettings } from "../hooks/useAiSettings";
import {
  generateClinicalNoteStream,
  generateClinicalNoteLocal,
  canRunLocal,
  resetHybridScribe,
  type StreamEvent,
} from "../lib/aiClient";
import type {
  ScribeResult as LocalScribeResult,
  AiSource,
} from "@skids/ai-scribe-local";

const EDGE_API =
  process.env.EXPO_PUBLIC_EDGE_API_URL ||
  "https://skids-edge-api.satish-9f4.workers.dev";

// ── Types ──────────────────────────────────────────────────────
interface Vital {
  label: string;
  value: string;
  unit?: string;
  abnormal?: boolean;
}
interface ICD10 {
  code: string;
  description: string;
  primary?: boolean;
}
interface DosingNote {
  drug: string;
  dose_mg_kg: number;
  route: string;
  frequency: string;
  max_dose: string;
  safety_note?: string;
}
interface ScribeResult {
  summary: string;
  reasoning_summary?: string;
  red_flags?: string[];
  vitals?: Vital[];
  icd10_codes?: ICD10[];
  observations: any[];
  dosing_notes?: DosingNote[];
}

// ── Screen ─────────────────────────────────────────────────────
export const ConsultationScreen = ({ route, navigation }: any) => {
  const {
    patientId = "patient_mock_123",
    providerId = "dr_mock_456",
    patientDemographics = {
      name: "Patient",
      age: 5,
      gender: "M",
      weight_kg: 18,
    },
    patientSummary = "Presenting for consultation.",
  } = route.params || {};

  const { addEvent } = useClinicalLedger(patientId);

  // Stream state
  const [phase, setPhase] = useState<"record" | "reasoning" | "triage">(
    "record",
  );
  const [reasoning, setReasoning] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [scribeResult, setScribeResult] = useState<ScribeResult | null>(null);
  const [contextItems, setContextItems] = useState<any[]>([]);
  const [manualInput, setManualInput] = useState("");
  const [aiSource, setAiSource] = useState<AiSource | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const abortRef = useRef<(() => void) | null>(null);
  const { settings } = useAiSettings();

  // Track local AI availability
  const [localAvailable] = useState(canRunLocal());

  // ── Hybrid scribe: local-first, cloud-fallback ────────────────────────
  const runScribe = useCallback(
    async (text: string) => {
      setPhase("reasoning");
      setReasoning("");
      setIsStreaming(true);
      setAiSource(null);

      // ── Attempt 1: Local MedScribe extraction ─────────────────────────
      if (localAvailable || settings.mode === "local_only") {
        try {
          setReasoning(
            "⚡ Initializing local AI model (MedScribe / LFM2.5-1.2B)...",
          );
          const {
            result,
            source,
            reasoning: localReasoning,
          } = await generateClinicalNoteLocal(
            {
              audioTranscript: text,
              patientContext: patientSummary,
              patientWeight: patientDemographics.weight_kg,
            },
            settings,
            (progress) => {
              setReasoning(
                `⚡ [${source === "local" ? "Local" : "Cloud"}] ${progress.message}`,
              );
            },
          );
          setAiSource(source);
          setReasoning(localReasoning);
          setScribeResult(result as any);
          setContextItems(result.observations || []);
          setPhase("triage");
          setIsStreaming(false);
          return;
        } catch (err: any) {
          console.warn(
            "[Scribe] Local extraction failed, trying cloud streaming:",
            err.message,
          );
          if (settings.mode === "local_only") {
            setReasoning(
              "Local extraction failed and cloud fallback is disabled.",
            );
            setIsStreaming(false);
            return;
          }
        }
      }

      // ── Attempt 2: Cloud streaming (Groq) ────────────────────────────
      try {
        setReasoning("☁️ Connecting to cloud AI (Groq)...");
        let outputBuffer = "";

        await generateClinicalNoteStream(
          {
            audioTranscript: text,
            patientContext: patientSummary,
            patientWeight: patientDemographics.weight_kg,
          },
          settings,
          (evt: StreamEvent) => {
            if (evt.type === "thinking") setReasoning((r) => r + evt.delta);
            else if (evt.type === "output") outputBuffer += evt.delta;
            else if (evt.type === "done" && evt.result && !evt.result.error) {
              setScribeResult(evt.result);
              setContextItems(evt.result.observations || []);
              setAiSource("cloud");
              setPhase("triage");
            }
          },
        );
      } catch (err: any) {
        console.warn(
          "[Scribe] Cloud streaming also failed, using offline demo:",
          err.message,
        );
        // ── Attempt 3: Offline demo fallback ───────────────────────────
        setReasoning(
          `Clinical Reasoning (offline demo):\n5-year-old with fever and ear pain. Onset 2 days ago.\n\nDifferential considerations:\n1. Acute Otitis Media (AOM) — most likely.\n2. Viral URI with referred ear pain — possible.\n\nDosing: Amoxicillin 90 mg/kg/day in 2 divided doses × 10 days.`,
        );
        const fallback: ScribeResult = {
          summary:
            "Patient presents with 2-day history of fever and right ear pain. Consistent with AOM.",
          reasoning_summary:
            "Age, fever, ear pain pattern most consistent with AOM.",
          red_flags: [],
          vitals: [
            { label: "Temp", value: "39.2", unit: "°C", abnormal: true },
          ],
          icd10_codes: [
            {
              code: "H66.91",
              description: "Otitis media, unspecified, right ear",
              primary: true,
            },
          ],
          observations: [
            {
              id: "obs-1",
              label: "Fever (39.2°C)",
              type: "symptom",
              state: "suggested",
              probability: "high",
            },
            {
              id: "obs-2",
              label: "Right Ear Pain",
              type: "symptom",
              state: "suggested",
              probability: "high",
            },
            {
              id: "ddx-1",
              label: "Acute Otitis Media",
              type: "ddx",
              state: "suggested",
              probability: "high",
            },
            {
              id: "ddx-2",
              label: "Viral URI",
              type: "ddx",
              state: "suggested",
              probability: "medium",
            },
            {
              id: "rx-1",
              label: "Amoxicillin 90mg/kg/day × 10d",
              type: "rx",
              state: "suggested",
              probability: "high",
            },
          ],
          dosing_notes: [
            {
              drug: "Amoxicillin",
              dose_mg_kg: 90,
              route: "oral",
              frequency: "BD",
              max_dose: "3g/day",
              safety_note: "High-dose for AOM. Check penicillin allergy.",
            },
          ],
        };
        setScribeResult(fallback);
        setContextItems(fallback.observations);
        setAiSource(null);
        setPhase("triage");
      } finally {
        setIsStreaming(false);
      }
    },
    [localAvailable, settings, patientSummary, patientDemographics.weight_kg],
  );

  // ── Submit triage ──────────────────────────────────────────
  const handleSubmitTriage = async (
    finalChipStates: Record<string, string>,
    manualItems: any[] = [],
  ) => {
    try {
      // Include both AI generated context AND manual items added by the doctor
      const finalContext = [
        ...contextItems.map((item) => ({
          ...item,
          state: finalChipStates[item.id] || item.state,
        })),
        ...manualItems.map((item) => ({
          ...item,
          state: finalChipStates[item.id] || "suggested", // default to suggested
        })),
      ];
      const eventRef = await addEvent(providerId, "triage_context", {
        transcript,
        context: finalContext,
        reasoning: reasoning.slice(0, 2000), // store first 2000 chars
        icd10: scribeResult?.icd10_codes,
        dosing: scribeResult?.dosing_notes,
        status: "signed",
        aiSource: aiSource || "unknown",
      });

      await fetch(`${EDGE_API}/api/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: eventRef,
          eventData: {
            type: finalContext.find(
              (c) => c.type === "lab_order" && c.state === "confirmed",
            )
              ? "LAB_ORDER"
              : "CONSULTATION_FEE",
            consultationId: eventRef,
            patientId,
            providerId,
            amount: 500,
            labDetails: finalContext.filter(
              (c) => c.type === "lab_order" && c.state === "confirmed",
            ),
          },
        }),
      }).catch(() => {}); // non-fatal

      Alert.alert("✅ Signed", "Consultation committed to Clinical Ledger.");
      navigation.goBack();
    } catch {
      Alert.alert("Error", "Failed to save consultation.");
    }
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#f8fafc" }}
    >
      {/* Patient header — always visible */}
      <View
        style={{
          backgroundColor: "#1e3a5f",
          paddingTop: 56,
          paddingBottom: 14,
          paddingHorizontal: 20,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <View>
            <Text
              style={{
                color: "#93c5fd",
                fontSize: 10,
                fontWeight: "700",
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Consultation
            </Text>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }}>
              {patientDemographics.name}
            </Text>
            <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
              {patientDemographics.age}y {patientDemographics.gender}
              {patientDemographics.weight_kg
                ? ` · ${patientDemographics.weight_kg} kg`
                : ""}
              {" · "}
              {patientSummary}
            </Text>
          </View>

          {/* Video Call Button */}
          <TouchableOpacity
            style={{
              backgroundColor: "#2563eb",
              padding: 10,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
            onPress={() => navigation.navigate("Call", { roomId: patientId })}
          >
            <Ionicons name="videocam" size={20} color="white" />
            <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>
              Call
            </Text>
          </TouchableOpacity>
        </View>

        {/* Vitals row — shown once scribe result available */}
        {scribeResult?.vitals && scribeResult.vitals.length > 0 && (
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              marginTop: 10,
              flexWrap: "wrap",
            }}
          >
            {scribeResult.vitals.map((v, i) => (
              <View
                key={i}
                style={{
                  backgroundColor: v.abnormal ? "#7f1d1d" : "#1e3a5f",
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: v.abnormal ? "#ef4444" : "#2d5a8e",
                }}
              >
                <Text
                  style={{
                    color: v.abnormal ? "#fca5a5" : "#93c5fd",
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  {v.label}: {v.value}
                  {v.unit}
                  {v.abnormal ? " ⚠" : ""}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ICD-10 codes */}
        {scribeResult?.icd10_codes && scribeResult.icd10_codes.length > 0 && (
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginTop: 8,
              flexWrap: "wrap",
            }}
          >
            {scribeResult.icd10_codes.map((c, i) => (
              <View
                key={i}
                style={{
                  backgroundColor: "#0f2744",
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderWidth: 1,
                  borderColor: "#334155",
                }}
              >
                <Text
                  style={{ color: "#7dd3fc", fontSize: 10, fontWeight: "700" }}
                >
                  {c.code} {c.primary ? "(Primary)" : ""}
                </Text>
                <Text style={{ color: "#64748b", fontSize: 9 }}>
                  {c.description}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Red flags banner */}
        {scribeResult?.red_flags && scribeResult.red_flags.length > 0 && (
          <View
            style={{
              backgroundColor: "#7f1d1d",
              borderRadius: 8,
              marginTop: 10,
              padding: 10,
              borderWidth: 1,
              borderColor: "#ef4444",
            }}
          >
            <Text
              style={{
                color: "#fca5a5",
                fontSize: 11,
                fontWeight: "900",
                marginBottom: 4,
              }}
            >
              🚨 RED FLAGS DETECTED
            </Text>
            {scribeResult.red_flags.map((f, i) => (
              <Text key={i} style={{ color: "#fecaca", fontSize: 11 }}>
                • {f}
              </Text>
            ))}
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Phase: record */}
        {phase === "record" && (
          <View>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: "#1e293b",
                marginBottom: 4,
              }}
            >
              Record Consultation
            </Text>
            <Text style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              Speak your consultation — the AI will reason through it and
              generate structured notes.
            </Text>

            <AudioScribe
              onTranscriptReady={(t: string) => {
                setTranscript(t);
                runScribe(t);
              }}
              onLiveTranscript={(t: string) => setLiveTranscript(t)}
              isProcessing={false}
              aiSource={aiSource}
            />

            {/* Local AI Spike — available in the record phase */}
            <LocalAiTriage transcript={transcript} />

            {/* Manual text input fallback */}
            <View style={{ marginTop: 20 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: "#94a3b8",
                  marginBottom: 6,
                }}
              >
                Or type transcript manually:
              </Text>
              <TextInput
                multiline
                value={manualInput}
                onChangeText={setManualInput}
                placeholder="Type or paste consultation notes here..."
                placeholderTextColor="#94a3b8"
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: "#e2e8f0",
                  minHeight: 100,
                  fontSize: 14,
                  color: "#1e293b",
                }}
              />
              {manualInput.length > 20 && (
                <TouchableOpacity
                  onPress={() => {
                    setTranscript(manualInput);
                    runScribe(manualInput);
                  }}
                  style={{
                    backgroundColor: "#2563eb",
                    borderRadius: 12,
                    paddingVertical: 14,
                    marginTop: 10,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}
                  >
                    ✦ Analyze with AI Scribe
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Phase: reasoning — streaming think panel */}
        {phase === "reasoning" && (
          <View>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: "#1e293b",
                marginBottom: 12,
              }}
            >
              Clinical Analysis
            </Text>
            <ReasoningPanel reasoning={reasoning} isStreaming={isStreaming} />
            {isStreaming && (
              <View style={{ alignItems: "center", marginTop: 20 }}>
                <ActivityIndicator color="#3b82f6" />
                <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 8 }}>
                  Generating SOAP note…
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Phase: triage — chip review */}
        {phase === "triage" && (
          <View>
            {/* HITL Disclaimer Banner */}
            <View
              style={{
                backgroundColor: "#fff7ed",
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: "#fdba74",
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Text style={{ fontSize: 24 }}>🚨</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: "#c2410c",
                    fontWeight: "800",
                    fontSize: 13,
                    marginBottom: 2,
                  }}
                >
                  Human-in-the-Loop Review Required
                </Text>
                <Text style={{ color: "#9a3412", fontSize: 11 }}>
                  The following notes and codes were generated by AI (
                  {aiSource === "local"
                    ? "⚡ Local — MedScribe / LFM2.5-1.2B (WebGPU)"
                    : aiSource === "cloud"
                      ? "☁️ Cloud — Groq"
                      : "Offline Demo"}
                  ). You MUST review, edit, and approve these signs and symptoms
                  before saving to the patient ledger.
                </Text>
              </View>
            </View>

            {/* Always show reasoning panel (collapsed) for audit */}
            {reasoning.length > 0 && (
              <ReasoningPanel reasoning={reasoning} isStreaming={false} />
            )}

            {/* Reasoning summary */}
            {scribeResult?.reasoning_summary && (
              <View
                style={{
                  backgroundColor: "#f0fdf4",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: "#bbf7d0",
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: "#166534",
                    marginBottom: 2,
                  }}
                >
                  AI CONCLUSION
                </Text>
                <Text style={{ fontSize: 13, color: "#15803d" }}>
                  {scribeResult.reasoning_summary}
                </Text>
              </View>
            )}

            {/* Dosing notes */}
            {scribeResult?.dosing_notes &&
              scribeResult.dosing_notes.length > 0 && (
                <View
                  style={{
                    backgroundColor: "#fffbeb",
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: "#fde68a",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: "#92400e",
                      marginBottom: 6,
                    }}
                  >
                    PEDIATRIC DOSING GUIDE
                  </Text>
                  {scribeResult.dosing_notes.map((d, i) => (
                    <View key={i} style={{ marginBottom: 6 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: "#78350f",
                        }}
                      >
                        {d.drug} — {d.dose_mg_kg} mg/kg {d.route} {d.frequency}
                      </Text>
                      <Text style={{ fontSize: 11, color: "#92400e" }}>
                        Max: {d.max_dose}
                        {d.safety_note ? ` · ⚠ ${d.safety_note}` : ""}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

            <TriageScreen
              patient={{
                demographic: patientDemographics,
                summary: patientSummary,
                notes: transcript,
              }}
              contextItems={contextItems}
              onSubmit={handleSubmitTriage}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
