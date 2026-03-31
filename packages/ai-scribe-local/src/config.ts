export const LOCAL_MODEL_CONFIG = {
  stt: {
    modelId: "onnx-community/whisper-small",
    subfolder: "onnx",
    dtype: "q4",
    sampleRate: 16000,
    language: "english",
  },
  llm: {
    modelId: "onnx-community/LFM2.5-1.2B-Instruct-ONNX",
    subfolder: "onnx",
    modelFileName: "model_q4",
    dtype: "q4",
    preferredDevice: "webgpu" as const,
    maxTokens: 2048,
    temperature: 0.1,
  },
  cache: {
    cacheName: "skids-ai-scribe-v1",
    idbName: "skids-ai-scribe-cache",
    idbStore: "models",
  },
};

export function isWebGPUAvailable(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as any).gpu;
}
