import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { ContextChip, type ChipState } from './ContextChip';

export interface Demographic {
    name: string;
    age: number;
    gender: string;
}

export interface PatientHistory {
    demographic: Demographic;
    summary: string;
    notes: string;
}

export interface TriageScreenProps {
    patient: PatientHistory;
    contextItems: { id: string; label: string; initialState?: ChipState }[];
    onSubmit: (contextStates: Record<string, ChipState>) => void;
}

export const TriageScreen: React.FC<TriageScreenProps> = ({
    patient,
    contextItems,
    onSubmit,
}) => {
    const [chipStates, setChipStates] = useState<Record<string, ChipState>>(
        contextItems.reduce((acc, item) => ({ ...acc, [item.id]: item.initialState || 'suggested' }), {})
    );

    const toggleChipState = (id: string) => {
        setChipStates((prev) => {
            const current = prev[id];
            const nextState: ChipState =
                current === 'suggested'
                    ? 'confirmed'
                    : current === 'confirmed'
                        ? 'rejected'
                        : 'suggested';
            return { ...prev, [id]: nextState };
        });
    };

    return (
        <View className="flex-1 bg-white">
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {/* Patient History Card */}
                <View className="bg-gray-50 border border-gray-100 rounded-xl p-4 shadow-sm mb-6">
                    <Text className="text-xl font-bold text-gray-900 mb-1">
                        {patient.demographic.name}, {patient.demographic.age},{' '}
                        {patient.demographic.gender}
                    </Text>
                    <Text className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-2">
                        Patient History
                    </Text>
                    <Text className="text-base text-gray-700 leading-6 mb-3">
                        {patient.summary}
                    </Text>
                    {patient.notes ? (
                        <View className="bg-white rounded-lg p-3 border border-gray-100">
                            <Text className="text-xs font-semibold text-gray-500 uppercase mb-1">
                                Triage Notes
                            </Text>
                            <Text className="text-sm text-gray-600">{patient.notes}</Text>
                        </View>
                    ) : null}
                </View>

                {/* Clinical Context Section */}
                <View className="mb-8">
                    <Text className="text-lg font-bold text-gray-900 mb-4">
                        Clinical Context
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                        {contextItems.map((item) => (
                            <ContextChip
                                key={item.id}
                                label={item.label}
                                state={chipStates[item.id]}
                                onPress={() => toggleChipState(item.id)}
                            />
                        ))}
                    </View>
                </View>

                {/* Action Button */}
                <TouchableOpacity
                    onPress={() => onSubmit(chipStates)}
                    activeOpacity={0.8}
                    className="bg-green-500 rounded-xl py-4 items-center justify-center shadow-md mb-8"
                >
                    <Text className="text-white font-bold text-lg">Submit Triage</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};
