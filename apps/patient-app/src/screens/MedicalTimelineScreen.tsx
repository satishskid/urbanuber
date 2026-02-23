import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useClinicalLedger } from '@skids/firebase/src/hooks/useClinicalLedger';
import { ContextChip } from '@skids/ui';
import { db } from '@skids/firebase/src/index';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

export const MedicalTimelineScreen = ({ route }: any) => {
    const patientId = route?.params?.patientId || 'patient_mock_123';
    const { events, loading } = useClinicalLedger(patientId);

    // Group events by day to match the 'Timeline' feel
    // We're flattening the context payload down to a digestible timeline

    const handleFulfillment = async (serviceType: string, itemName: string, providerId: string, eventId?: string) => {
        try {
            // Create a dispatch event requesting a service
            // The cloud function listens to this collection or clinical_ledger to finalize dispatching
            await addDoc(collection(db, 'service_requests'), {
                patientId,
                providerId,
                sourceEventId: eventId,
                serviceType,
                itemName,
                status: 'pending',
                createdAt: serverTimestamp(),
            });
            alert(`${itemName} order request sent! Tracking details will appear shortly.`);
        } catch (err) {
            console.error('Failed to trigger fulfillment', err);
            alert('Unable to process the request right now.');
        }
    };

    const renderEducationalSnippet = (item: any) => {
        if (item.type === 'ddx') {
            return (
                <View className="bg-blue-50 border border-blue-100 p-3 rounded-xl mt-2">
                    <Text className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-1">Doctor's Diagnosis</Text>
                    <Text className="text-sm text-blue-900 leading-5">
                        <Text className="font-bold">{item.label}</Text> is an infection. It's very common and fully treatable. Let's make sure they rest and stay hydrated.
                    </Text>
                </View>
            );
        }
        if (item.type === 'rx') {
            return (
                <View className="bg-orange-50 border border-orange-100 p-3 rounded-xl mt-2">
                    <Text className="text-xs font-bold text-orange-800 uppercase tracking-widest mb-1">Prescription</Text>
                    <Text className="text-sm text-orange-900 leading-5">
                        <Text className="font-bold">{item.label}</Text> helps fight the infection. Please follow the 10-day course completely even if they feel better.
                    </Text>
                </View>
            );
        }
        return null;
    };

    if (loading) {
        return (
            <View className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        )
    }

    return (
        <View className="flex-1 bg-gray-50">
            <ScrollView contentContainerStyle={{ padding: 20 }}>

                <View className="mt-8 mb-6">
                    <Text className="text-3xl font-black text-gray-900 leading-tight">
                        Health Timeline
                    </Text>
                    <Text className="text-base text-gray-500 mt-1">
                        Your child's medical history, simplified.
                    </Text>
                </View>

                {events.length === 0 ? (
                    <View className="bg-white rounded-2xl p-6 items-center shadow-sm border border-gray-100 mt-10">
                        <Text className="text-gray-400 font-medium text-lg text-center">No health events recorded yet.</Text>
                    </View>
                ) : (
                    events.map((event, index) => {
                        if (event.type !== 'triage_context') return null; // Filtering for demo 

                        const payload = event.payload as any;
                        const dateObj = event.createdAt?.toDate ? event.createdAt.toDate() : new Date();
                        const dateString = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                        return (
                            <View key={event.id || index} className="mb-6 relative">
                                {/* Timeline Connection Line */}
                                {index !== events.length - 1 && (
                                    <View className="absolute left-6 top-16 bottom-[-24px] w-0.5 bg-gray-200 z-0" />
                                )}

                                <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-2">
                                    {dateString}
                                </Text>

                                <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 z-10 w-full">
                                    <View className="flex-row items-center mb-4 pb-4 border-b border-gray-100">
                                        <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
                                            <Text className="text-xl">🩺</Text>
                                        </View>
                                        <View>
                                            <Text className="font-bold text-gray-900 text-base">Pediatric Consult</Text>
                                            <Text className="text-gray-500 text-sm">Dr. {event.providerId.split('_')[1] || 'Provider'}</Text>
                                        </View>
                                    </View>

                                    {/* Rendering the Confirmed Context Chips */}
                                    <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                        Clinical Context
                                    </Text>
                                    <View className="flex-row flex-wrap gap-2 mb-4">
                                        {payload.context?.filter((c: any) => c.state === 'confirmed').map((chip: any) => (
                                            <ContextChip
                                                key={chip.id}
                                                label={chip.label}
                                                state="confirmed"
                                            />
                                        ))}
                                    </View>

                                    {/* Educational Snippets for DDx and Rx */}
                                    {payload.context?.filter((c: any) => c.state === 'confirmed' && ['ddx', 'rx'].includes(c.type)).map((chip: any) => (
                                        <View key={`edu-${chip.id}`} className="mb-2">
                                            {renderEducationalSnippet(chip)}

                                            {/* CTA Buttons for specific types of chips */}
                                            {chip.type === 'rx' && (
                                                <TouchableOpacity
                                                    onPress={() => handleFulfillment('pharmacy_order', chip.label, event.providerId, event.id)}
                                                    className="bg-blue-600 rounded-xl py-3 mt-3 items-center"
                                                >
                                                    <Text className="text-white font-bold">Insta-Order Medication to Home</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    ))}

                                    {/* Fulfillment for Lab Orders */}
                                    {payload.context?.filter((c: any) => c.state === 'confirmed' && c.type === 'lab_order').map((chip: any) => (
                                        <TouchableOpacity
                                            key={`lab-${chip.id}`}
                                            onPress={() => handleFulfillment('lab_dispatch', chip.label, event.providerId, event.id)}
                                            className="bg-purple-600 rounded-xl py-3 mt-3 items-center"
                                        >
                                            <Text className="text-white font-bold">Book Home Phlebotomist for {chip.label}</Text>
                                        </TouchableOpacity>
                                    ))}

                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </View>
    );
};
