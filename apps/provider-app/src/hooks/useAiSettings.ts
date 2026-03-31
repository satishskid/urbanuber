import { useState, useEffect, useCallback } from "react";
import {
  getProvider,
  updateProviderSettings,
  Provider,
} from "@skids/api-client";
import { auth } from "@skids/firebase";

export interface AiSettings {
  localNodeUrl: string;
  cloudProvider: "groq" | "together_ai" | "aws_bedrock";
  cloudApiKey: string;
  mode: "hybrid" | "local_only" | "cloud_only";
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
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchSettings = async () => {
      try {
        const provider = await getProvider(auth.currentUser!.uid);
        if (!cancelled && provider?.ai_settings) {
          const parsed = JSON.parse(provider.ai_settings);
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        }
      } catch (err) {
        console.warn("[useAiSettings] Failed to fetch settings:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveSettings = useCallback(async (newSettings: Partial<AiSettings>) => {
    if (!auth.currentUser) throw new Error("Not authenticated");
    await updateProviderSettings(auth.currentUser.uid, newSettings);
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  return { settings, loading, saveSettings, DEFAULT_SETTINGS };
}
