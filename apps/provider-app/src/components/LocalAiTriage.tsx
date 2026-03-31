import React from "react";
import { View, Text } from "react-native";

/**
 * LocalAiTriage — shows raw transcript preview during consultation
 * Stub component for the local AI triage preview
 */
export const LocalAiTriage: React.FC<{ transcript: string }> = ({
  transcript,
}) => {
  if (!transcript || transcript.length < 20) return null;

  return (
    <View
      style={{
        marginTop: 16,
        padding: 12,
        backgroundColor: "#f0fdf4",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#bbf7d0",
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: "700",
          color: "#166534",
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 4,
        }}
      >
        Transcript Preview
      </Text>
      <Text
        style={{ fontSize: 12, color: "#374151", lineHeight: 18 }}
        numberOfLines={3}
      >
        {transcript}
      </Text>
    </View>
  );
};
