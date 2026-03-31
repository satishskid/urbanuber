import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { ContextChip } from "@skids/ui";
import { createServiceRequest } from "@skids/api-client";

export const IntakeScreen = ({ navigation }: any) => {
  const [symptomText, setSymptomText] = useState("");
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Common pediatric symptoms
  const commonSymptoms = [
    { id: "s1", label: "Fever > 100.4°F" },
    { id: "s2", label: "Ear Pain" },
    { id: "s3", label: "Cough" },
    { id: "s4", label: "Vomiting" },
    { id: "s5", label: "Rash" },
    { id: "s6", label: "Difficulty Breathing" },
  ];

  const handleChipToggle = (id: string) => {
    setSelectedChips((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const handleFindDoctor = async () => {
    if (selectedChips.length === 0 && !symptomText) {
      Alert.alert(
        "Details Needed",
        "Please select at least one symptom or describe what is wrong.",
      );
      return;
    }

    setIsSearching(true);
    try {
      const contextPayload = {
        selectedSymptoms: commonSymptoms
          .filter((s) => selectedChips.includes(s.id))
          .map((s) => s.label),
        additionalNotes: symptomText,
      };

      const result = await createServiceRequest({
        patient_id: "patient_mock_123",
        status: "pending",
        service_type: "telehealth",
        context_payload: contextPayload,
      });

      console.log("Created Service Request:", result.id);

      setTimeout(() => {
        setIsSearching(false);
        Alert.alert("Match Found!", "Dr. Smith is available right now.");
      }, 2000);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to request consultation");
      setIsSearching(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View className="mt-8 mb-8">
          <Text className="text-3xl font-black text-gray-900 leading-tight">
            What's bothering your little one today?
          </Text>
          <Text className="text-base text-gray-500 mt-2">
            Select symptoms to help us match you with the right pediatrician
            instantly.
          </Text>
        </View>

        <View className="mb-8">
          <Text className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
            Common Symptoms
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {commonSymptoms.map((symptom) => (
              <ContextChip
                key={symptom.id}
                label={symptom.label}
                state={
                  selectedChips.includes(symptom.id) ? "confirmed" : "suggested"
                }
                onPress={() => handleChipToggle(symptom.id)}
              />
            ))}
          </View>
        </View>

        <View className="mb-10">
          <Text className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">
            Additional Notes (Optional)
          </Text>
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-base text-gray-900 min-h-[100]"
            placeholder="e.g. He's been tugging at his right ear since last night..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={symptomText}
            onChangeText={setSymptomText}
          />
        </View>

        <TouchableOpacity
          onPress={handleFindDoctor}
          disabled={isSearching}
          activeOpacity={0.8}
          className={`w-full py-4 rounded-xl items-center justify-center shadow-md ${
            isSearching ? "bg-blue-400" : "bg-blue-600"
          }`}
        >
          <Text className="text-white font-bold text-lg">
            {isSearching ? "Finding Doctor..." : "Find a Pediatrician Now"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};
