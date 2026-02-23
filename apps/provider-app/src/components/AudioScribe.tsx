import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';

export interface AudioScribeProps {
    onTranscriptReady: (transcript: string) => void;
    isProcessing: boolean;
}

export const AudioScribe: React.FC<AudioScribeProps> = ({
    onTranscriptReady,
    isProcessing,
}) => {
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [permissionResponse, requestPermission] = Audio.usePermissions();

    useEffect(() => {
        return () => {
            // Cleanup recording if component unmounts
            if (recording) {
                recording.stopAndUnloadAsync();
            }
        };
    }, [recording]);

    const startRecording = async () => {
        try {
            if (permissionResponse?.status !== 'granted') {
                const response = await requestPermission();
                if (response.status !== 'granted') {
                    alert('Permission to access microphone is required!');
                    return;
                }
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            console.log('Starting recording..');
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            setRecording(recording);
            setIsRecording(true);
            console.log('Recording started');
        } catch (err) {
            console.error('Failed to start recording', err);
        }
    };

    const stopRecording = async () => {
        try {
            console.log('Stopping recording..');
            setIsRecording(false);

            if (!recording) return;

            await recording.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });
            const uri = recording.getURI();
            console.log('Recording stopped and stored at', uri);
            setRecording(null);

            // In a real app, you would upload the audio file to Whisper/Groq here
            // For this MVP, we simulate the transcription
            if (uri) {
                simulateTranscription();
            }

        } catch (error) {
            console.error('Failed to stop recording', error);
        }
    };

    const simulateTranscription = () => {
        // Simulating a transcript that would normally come from an audio-to-text service like Whisper
        const mockTranscript = "The patient is a 5 year old male presenting with a 2-day history of high fever and right ear pain. Examination shows a bulging, erythematous right tympanic membrane. Diagnosis is acute otitis media. Plan is to start Amoxicillin 40mg/kg/day divided twice daily for 10 days.";

        onTranscriptReady(mockTranscript);
    };

    if (isProcessing) {
        return (
            <View className="items-center justify-center p-6 bg-gray-50 rounded-2xl border border-gray-100">
                <ActivityIndicator size="large" color="#10B981" />
                <Text className="mt-4 text-gray-600 font-medium">Analyzing consultation context...</Text>
            </View>
        )
    }

    return (
        <View className="items-center justify-center p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <View className="mb-4">
                <Text className="text-xl font-bold text-gray-900 text-center">
                    {isRecording ? 'Listening...' : 'Ready to record'}
                </Text>
                <Text className="text-sm text-gray-500 text-center mt-1">
                    {isRecording
                        ? 'Speak clearly to capture the consultation'
                        : 'Tap the microphone to start the AI scribe'}
                </Text>
            </View>

            <TouchableOpacity
                onPress={isRecording ? stopRecording : startRecording}
                className={`w-20 h-20 rounded-full items-center justify-center shadow-md ${isRecording ? 'bg-red-500' : 'bg-green-500'
                    }`}
                activeOpacity={0.8}
            >
                {/* Placeholder for an actual mic icon */}
                <Text className="text-white text-3xl">{isRecording ? '■' : '🎤'}</Text>
            </TouchableOpacity>

            {isRecording && (
                <View className="flex-row items-center mt-6">
                    <View className="w-2 h-2 rounded-full bg-red-500 mr-2 animate-pulse" />
                    <Text className="text-red-500 font-semibold uppercase tracking-wider text-xs">Recording Audio</Text>
                </View>
            )}
        </View>
    );
};
