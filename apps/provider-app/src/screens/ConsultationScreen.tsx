import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { AudioScribe } from '../components/AudioScribe';
import { TriageScreen, ContextChip } from '@skids/ui';
import { useClinicalLedger } from '@skids/firebase/src/hooks/useClinicalLedger';

export const ConsultationScreen = ({ route, navigation }: any) => {
    const { patientId, providerId, patientDemographics, patientSummary } = route.params || {
        patientId: 'patient_mock_123',
        providerId: 'dr_mock_456',
        patientDemographics: { name: 'Jimmy Doe', age: 5, gender: 'M' },
        patientSummary: 'Presenting with fever and ear pain.'
    };

    const { addEvent } = useClinicalLedger(patientId);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [contextItems, setContextItems] = useState<any[]>([]);
    const [showTriage, setShowTriage] = useState(false);

    // Example Edge API Call
    // Real implementation points to your deployed Cloudflare Worker URL
    const fetchScribeContext = async (audioTranscript: string) => {
        setIsProcessing(true);
        try {
            // Mocking edge API call since we don't have the live URL right here
            // const response = await fetch('YOUR_WORKER_URL/api/scribe', {
            //   method: 'POST',
            //   headers: { 'Content-Type': 'application/json' },
            //   body: JSON.stringify({ audioTranscript, patientContext: patientSummary })
            // });
            // const data = await response.json();

            console.log('Fetching context for transcript: ', audioTranscript);

            // Simulated Delay & Output matching our Llama 3 prompt from edge-api
            await new Promise(resolve => setTimeout(resolve, 2000));
            const simulatedData = {
                summary: "Patient presents with a 2-day history of high fever and right ear pain. Examination confirms AOM.",
                vitals: [{ label: "Temp", value: "39.2C" }],
                observations: [
                    { id: 'obs-1', label: 'High Fever', type: 'symptom', state: 'suggested' },
                    { id: 'obs-2', label: 'Right Ear Pain', type: 'symptom', state: 'suggested' },
                    { id: 'ddx-1', label: 'Acute Otitis Media', type: 'ddx', state: 'suggested' },
                    { id: 'rx-1', label: 'Amoxicillin 40mg/kg BID x 10d', type: 'rx', state: 'suggested' },
                    { id: 'lab-1', label: 'CRP/CBC', type: 'lab_order', state: 'rejected' }
                ]
            };

            setContextItems(simulatedData.observations);
            setShowTriage(true);
        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Failed to generate context chips');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTranscriptReady = (newTranscript: string) => {
        setTranscript(newTranscript);
        fetchScribeContext(newTranscript);
    };

    const handleSubmitTriage = async (finalChipStates: Record<string, string>) => {
        try {
            // Re-map the state back to the original objects
            const finalContext = contextItems.map(item => ({
                ...item,
                state: finalChipStates[item.id] || item.state
            }));

            // Append to clinical ledger
            await addEvent(providerId, 'triage_context', {
                transcript,
                context: finalContext,
                status: 'signed'
            });

            Alert.alert('Success', 'Consultation signed & committed to Clinical Ledger!');
            // navigation.goBack();
        } catch (err) {
            Alert.alert('Error', 'Failed to save consultation');
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-white"
        >
            {!showTriage ? (
                <View className="flex-1 px-4 py-8 justify-center">
                    <View className="mb-10 items-center">
                        <Text className="text-2xl font-black text-gray-900 mb-2">Patient Consultation</Text>
                        <Text className="text-gray-500 font-medium text-center px-4">
                            Record your conversation or dictate notes. The AI Scribe will extract structured medical data.
                        </Text>
                    </View>
                    <AudioScribe
                        onTranscriptReady={handleTranscriptReady}
                        isProcessing={isProcessing}
                    />
                </View>
            ) : (
                <TriageScreen
                    patient={{
                        demographic: patientDemographics,
                        summary: patientSummary,
                        notes: transcript // Placing raw transcript as triage notes
                    }}
                    contextItems={contextItems}
                    onSubmit={handleSubmitTriage}
                />
            )}
        </KeyboardAvoidingView>
    );
};
