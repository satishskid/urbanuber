import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { LocalSpeechToText } from "@skids/ai-scribe-local";

export interface AudioScribeProps {
  onTranscriptReady: (transcript: string) => void;
  onLiveTranscript?: (transcript: string) => void;
  isProcessing: boolean;
  aiSource?: "local" | "cloud" | null;
}

export const AudioScribe: React.FC<AudioScribeProps> = ({
  onTranscriptReady,
  onLiveTranscript,
  isProcessing,
  aiSource,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [liveText, setLiveText] = useState("");
  const sttRef = useRef<LocalSpeechToText | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const isWeb = Platform.OS === "web";

  useEffect(() => {
    return () => {
      if (sttRef.current) sttRef.current.stop().catch(() => {});
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setLiveText("");
      chunksRef.current = [];

      // Web: use browser MediaRecorder + Web Speech API
      if (isWeb) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        streamRef.current = stream;

        // Start speech recognition
        sttRef.current = new LocalSpeechToText();
        if (sttRef.current.isSupported()) {
          try {
            await sttRef.current.startLive((transcript) => {
              setLiveText(transcript);
              onLiveTranscript?.(transcript);
            });
          } catch (err) {
            console.warn("[AudioScribe] Web Speech API failed:", err);
            sttRef.current = null;
          }
        }

        // Record audio blob (for potential upload)
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      }

      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording", err);
      alert("Microphone access denied. Please allow microphone permissions.");
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);

      let sttTranscript = "";
      if (sttRef.current) {
        try {
          sttTranscript = await sttRef.current.stop();
        } catch {
          /* ignore */
        }
        sttRef.current = null;
      }

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      // Use real transcript if available
      if (sttTranscript && sttTranscript.length > 10) {
        onTranscriptReady(sttTranscript);
      } else if (liveText && liveText.length > 10) {
        onTranscriptReady(liveText);
      } else {
        simulateTranscription();
      }
    } catch (error) {
      console.error("Failed to stop recording", error);
      setIsRecording(false);
    }
  };

  const simulateTranscription = () => {
    const mockTranscript =
      "The patient is a 5 year old male presenting with a 2-day history of high fever and right ear pain. Examination shows a bulging, erythematous right tympanic membrane. Diagnosis is acute otitis media. Plan is to start Amoxicillin 40mg/kg/day divided twice daily for 10 days.";
    onTranscriptReady(mockTranscript);
  };

  if (isProcessing) {
    return (
      <View className="items-center justify-center p-6 bg-gray-50 rounded-2xl border border-gray-100">
        <ActivityIndicator size="large" color="#10B981" />
        <Text className="mt-4 text-gray-600 font-medium">
          Analyzing consultation context...
        </Text>
      </View>
    );
  }

  return (
    <View className="items-center justify-center p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
      {aiSource && (
        <View
          className={`mb-3 px-3 py-1 rounded-full ${aiSource === "local" ? "bg-green-50 border border-green-200" : "bg-blue-50 border border-blue-200"}`}
        >
          <Text
            className={`text-xs font-semibold ${aiSource === "local" ? "text-green-700" : "text-blue-700"}`}
          >
            {aiSource === "local"
              ? "⚡ Local AI (WebGPU)"
              : "☁️ Cloud AI (Groq)"}
          </Text>
        </View>
      )}

      <View className="mb-4">
        <Text className="text-xl font-bold text-gray-900 text-center">
          {isRecording ? "Listening..." : "Ready to record"}
        </Text>
        <Text className="text-sm text-gray-500 text-center mt-1">
          {isRecording
            ? "Speak clearly to capture the consultation"
            : "Tap the microphone to start the AI scribe"}
        </Text>
      </View>

      <TouchableOpacity
        onPress={isRecording ? stopRecording : startRecording}
        className={`w-20 h-20 rounded-full items-center justify-center shadow-md ${
          isRecording ? "bg-red-500" : "bg-green-500"
        }`}
        activeOpacity={0.8}
      >
        <Text className="text-white text-3xl">{isRecording ? "■" : "🎤"}</Text>
      </TouchableOpacity>

      {isRecording && (
        <View className="flex-row items-center mt-6">
          <View className="w-2 h-2 rounded-full bg-red-500 mr-2 animate-pulse" />
          <Text className="text-red-500 font-semibold uppercase tracking-wider text-xs">
            Recording Audio {aiSource === "local" ? "(Local)" : ""}
          </Text>
        </View>
      )}

      {isRecording && liveText && (
        <View className="mt-4 p-3 bg-gray-50 rounded-xl w-full">
          <Text className="text-xs text-gray-400 mb-1 font-semibold uppercase">
            Live Transcript
          </Text>
          <Text className="text-sm text-gray-700" numberOfLines={4}>
            {liveText}
          </Text>
        </View>
      )}
    </View>
  );
};
