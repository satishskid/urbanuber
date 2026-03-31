import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "@skids/firebase";

export interface AiSettings {
  localNodeUrl: string;
  cloudProvider: "groq" | "together_ai" | "aws_bedrock";
  cloudApiKey: string;
  mode: "hybrid" | "local_only" | "cloud_only";
  /** Whether to use MedScribe local WebGPU inference (default: true) */
  useLocalScribe: boolean;
}

const DEFAULT_SETTINGS: AiSettings = {
  localNodeUrl: "http://localhost:11434/api/generate",
  cloudProvider: "together_ai",
  cloudApiKey: "",
  mode: "hybrid",
  useLocalScribe: true,
};

export function useAiSettings() {
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser || !db) return;

    const docRef = doc(db, "providers", auth.currentUser.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().aiSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...docSnap.data().aiSettings });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const saveSettings = useCallback(async (newSettings: Partial<AiSettings>) => {
    if (!auth.currentUser || !db) throw new Error("Not authenticated");

    await setDoc(
      doc(db, "providers", auth.currentUser.uid),
      { aiSettings: newSettings },
      { merge: true },
    );
  }, []);

  return { settings, loading, saveSettings, DEFAULT_SETTINGS };
}
