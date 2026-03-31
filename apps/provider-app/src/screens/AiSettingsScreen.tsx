import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAiSettings, AiSettings } from "../hooks/useAiSettings";
import { isWebGPUAvailable } from "@skids/ai-scribe-local";

export function AiSettingsScreen() {
  const navigation = useNavigation();
  const { settings, loading, saveSettings } = useAiSettings();
  const [formData, setFormData] = useState<AiSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [webGpuAvailable] = useState(isWebGPUAvailable());

  useEffect(() => {
    if (!loading && settings && !formData) {
      setFormData(settings);
    }
  }, [loading, settings]);

  if (loading || !formData) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveSettings(formData);
      Alert.alert("Success", "AI configuration saved securely.");
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="p-2 -ml-2"
        >
          <Text className="text-blue-600 font-bold text-lg">← Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-black text-gray-900">
          AI Configuration
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          className="p-2 -mr-2"
        >
          {saving ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <Text className="text-blue-600 font-bold text-lg">Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 p-6"
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* ── MedScribe Local AI (Browser-Native) ──────────────────── */}
        <View className="bg-white rounded-2xl p-5 mb-6 border border-gray-200 shadow-sm">
          <View className="flex-row items-center mb-2">
            <Text className="text-lg font-bold text-gray-900 mr-2">
              MedScribe Local AI
            </Text>
            <View className="bg-green-100 px-2 py-0.5 rounded">
              <Text className="text-green-800 font-bold text-[10px] uppercase">
                Default
              </Text>
            </View>
          </View>
          <Text className="text-sm text-gray-500 mb-4">
            Runs entirely in the browser using WebGPU. No data leaves the
            device. Zero API cost.
          </Text>

          {/* WebGPU status */}
          <View
            className={`flex-row items-center p-3 rounded-xl mb-4 ${webGpuAvailable ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}
          >
            <Text className="mr-2">{webGpuAvailable ? "⚡" : "⚠️"}</Text>
            <View className="flex-1">
              <Text
                className={`text-xs font-bold ${webGpuAvailable ? "text-green-700" : "text-amber-700"}`}
              >
                {webGpuAvailable ? "WebGPU Available" : "WebGPU Not Available"}
              </Text>
              <Text
                className={`text-xs ${webGpuAvailable ? "text-green-600" : "text-amber-600"}`}
              >
                {webGpuAvailable
                  ? "LFM2.5-1.2B-Instruct will run locally in-browser"
                  : "Use Chrome 113+, Edge 113+, or Firefox 117+ for local AI"}
              </Text>
            </View>
          </View>

          {/* Toggle */}
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="font-bold text-gray-800">Enable Local AI</Text>
              <Text className="text-sm text-gray-500 mt-1">
                Use browser-native speech-to-text and medical extraction
              </Text>
            </View>
            <Switch
              value={formData.useLocalScribe}
              onValueChange={(val) =>
                setFormData({ ...formData, useLocalScribe: val })
              }
              trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
              thumbColor={formData.useLocalScribe ? "#2563eb" : "#f3f4f6"}
            />
          </View>
        </View>

        {/* Mode Selection */}
        <View className="bg-white rounded-2xl p-5 mb-6 border border-gray-200 shadow-sm">
          <Text className="text-lg font-bold text-gray-900 mb-4">
            Cloud Fallback Mode
          </Text>
          <Text className="text-sm text-gray-500 mb-4">
            When local AI is unavailable or fails, this determines the fallback
            behavior.
          </Text>

          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1 pr-4">
              <Text className="font-bold text-gray-800">
                Hybrid (Recommended)
              </Text>
              <Text className="text-sm text-gray-500 mt-1">
                Prefer local MedScribe AI. Fall back to Cloud AI if local fails.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setFormData({ ...formData, mode: "hybrid" })}
              className={`h-6 w-6 rounded-full border-2 items-center justify-center ${formData.mode === "hybrid" ? "border-blue-500 bg-blue-500" : "border-gray-300"}`}
            >
              {formData.mode === "hybrid" && (
                <View className="h-2 w-2 rounded-full bg-white" />
              )}
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1 pr-4">
              <Text className="font-bold text-gray-800">Local Only</Text>
              <Text className="text-sm text-gray-500 mt-1">
                Never send data to the cloud. Extraction fails if local AI
                unavailable.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setFormData({ ...formData, mode: "local_only" })}
              className={`h-6 w-6 rounded-full border-2 items-center justify-center ${formData.mode === "local_only" ? "border-blue-500 bg-blue-500" : "border-gray-300"}`}
            >
              {formData.mode === "local_only" && (
                <View className="h-2 w-2 rounded-full bg-white" />
              )}
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="font-bold text-gray-800">Cloud Only (BYOK)</Text>
              <Text className="text-sm text-gray-500 mt-1">
                Skip local AI and route all requests to your Cloud provider.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setFormData({ ...formData, mode: "cloud_only" })}
              className={`h-6 w-6 rounded-full border-2 items-center justify-center ${formData.mode === "cloud_only" ? "border-blue-500 bg-blue-500" : "border-gray-300"}`}
            >
              {formData.mode === "cloud_only" && (
                <View className="h-2 w-2 rounded-full bg-white" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Local Edge Node Config (legacy Ollama/WasmEdge) */}
        {(formData.mode === "hybrid" || formData.mode === "local_only") && (
          <View className="bg-white rounded-2xl p-5 mb-6 border border-gray-200 shadow-sm">
            <View className="flex-row items-center mb-2">
              <Text className="text-lg font-bold text-gray-900 mr-2">
                Legacy Local Node
              </Text>
              <View className="bg-gray-100 px-2 py-0.5 rounded">
                <Text className="text-gray-600 font-bold text-[10px] uppercase">
                  Optional
                </Text>
              </View>
            </View>
            <Text className="text-sm text-gray-500 mb-4">
              If you run a separate Ollama/WasmEdge node on your network,
              configure its URL here. MedScribe Local AI (above) takes priority.
            </Text>

            <Text className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">
              Node URL
            </Text>
            <TextInput
              value={formData.localNodeUrl}
              onChangeText={(text) =>
                setFormData({ ...formData, localNodeUrl: text })
              }
              placeholder="http://192.168.1.100:11434/api/generate"
              className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-800 mb-2"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        {/* Cloud BYOK Config */}
        {(formData.mode === "hybrid" || formData.mode === "cloud_only") && (
          <View className="bg-white rounded-2xl p-5 mb-6 border border-gray-200 shadow-sm">
            <View className="flex-row items-center mb-2">
              <Text className="text-lg font-bold text-gray-900 mr-2">
                Cloud Provider (BYOK)
              </Text>
              <View className="bg-purple-100 px-2 py-0.5 rounded">
                <Text className="text-purple-800 font-bold text-[10px] uppercase">
                  Fallback
                </Text>
              </View>
            </View>
            <Text className="text-sm text-gray-500 mb-4">
              Your API key for when local AI is unavailable. Billing goes
              directly to your provider account.
            </Text>

            <Text className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">
              Provider
            </Text>
            <View className="flex-row gap-2 mb-4">
              <TouchableOpacity
                onPress={() =>
                  setFormData({ ...formData, cloudProvider: "together_ai" })
                }
                className={`flex-1 p-3 rounded-xl border ${formData.cloudProvider === "together_ai" ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50"} items-center`}
              >
                <Text
                  className={`font-bold ${formData.cloudProvider === "together_ai" ? "text-blue-700" : "text-gray-600"}`}
                >
                  Together AI
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  setFormData({ ...formData, cloudProvider: "groq" })
                }
                className={`flex-1 p-3 rounded-xl border ${formData.cloudProvider === "groq" ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50"} items-center`}
              >
                <Text
                  className={`font-bold ${formData.cloudProvider === "groq" ? "text-blue-700" : "text-gray-600"}`}
                >
                  Groq
                </Text>
              </TouchableOpacity>
            </View>

            <Text className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">
              Secure API Key
            </Text>
            <TextInput
              value={formData.cloudApiKey}
              onChangeText={(text) =>
                setFormData({ ...formData, cloudApiKey: text })
              }
              placeholder="Paste your API key here (sk-...)"
              secureTextEntry
              className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-800"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
