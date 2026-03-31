export interface Vital {
  label: string;
  value: string;
  unit?: string;
  abnormal?: boolean;
}

export interface ICD10 {
  code: string;
  description: string;
  primary?: boolean;
}

export interface DosingNote {
  drug: string;
  dose_mg_kg: number;
  route: string;
  frequency: string;
  max_dose: string;
  safety_note?: string;
}

export interface Observation {
  id: string;
  label: string;
  state: "suggested" | "confirmed" | "rejected";
  type:
    | "symptom"
    | "rx"
    | "ddx"
    | "lab_order"
    | "radiology"
    | "diet"
    | "treatment";
  probability: "high" | "medium" | "low";
}

export interface ScribeResult {
  summary: string;
  reasoning_summary?: string;
  red_flags?: string[];
  vitals?: Vital[];
  icd10_codes?: ICD10[];
  observations: Observation[];
  dosing_notes?: DosingNote[];
}

export interface MedScribeExtraction {
  incident_record: string;
  prescription: Array<{
    drug: string;
    dose: string;
    frequency: string;
    duration: string;
  }>;
  lab_recommendations: string[];
  radiology_recommendations: string[];
  treatment_plan: string;
  diet_advice: string[];
  summary: string;
}

export interface ScribeProgress {
  phase: "init" | "transcribing" | "extracting" | "done" | "error";
  message: string;
  source?: "local" | "cloud";
  percent?: number;
}

export type AiSource = "local" | "cloud";
