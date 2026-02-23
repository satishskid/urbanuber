import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { IntakeScreen } from './src/screens/IntakeScreen';
import { MedicalTimelineScreen } from './src/screens/MedicalTimelineScreen';
import { PhoneAuthScreen, VideoCallScreen } from '@skids/ui';

import './global.css';

// ── Stack & Tab Navigators ──────────────────────────────────
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ── Placeholder Home Screen ─────────────────────────────────
function HomeScreen({ navigation }: any) {
    return (
        <View className="flex-1 bg-white items-center justify-center px-6">
            <View className="items-center mb-10">
                <Text className="text-4xl font-black text-gray-900">Skids</Text>
                <Text className="text-base text-gray-500 mt-1">Healthcare, on demand.</Text>
            </View>
            <View className="w-full gap-4">
                <View className="bg-blue-600 rounded-2xl p-5"
                    onTouchEnd={() => navigation.navigate('Intake')}
                >
                    <Text className="text-white font-bold text-lg">🩺 Find a Pediatrician</Text>
                    <Text className="text-blue-200 text-sm mt-1">
                        Instant telehealth consult for your child
                    </Text>
                </View>
                <View className="bg-purple-600 rounded-2xl p-5"
                    onTouchEnd={() => navigation.navigate('Timeline', { patientId: 'patient_mock_123' })}
                >
                    <Text className="text-white font-bold text-lg">📋 Health Timeline</Text>
                    <Text className="text-purple-200 text-sm mt-1">
                        View your child's complete medical history
                    </Text>
                </View>
                <View className="bg-green-600 rounded-2xl p-5"
                    onTouchEnd={() => navigation.navigate('VideoCall', {
                        roomName: 'consult_patient_mock_123',
                        identity: 'patient_mock_123',
                        displayName: 'Parent',
                    })}
                >
                    <Text className="text-white font-bold text-lg">📹 Start Video Consult</Text>
                    <Text className="text-green-200 text-sm mt-1">
                        Connect live with your child's doctor
                    </Text>
                </View>
            </View>
        </View>
    );
}

// ── Main Tab Navigator ──────────────────────────────────────
function MainTabs() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: '#fff',
                    borderTopWidth: 1,
                    borderTopColor: '#f3f4f6',
                    height: 85,
                    paddingBottom: 28,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: '#2563EB',
                tabBarInactiveTintColor: '#9ca3af',
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                },
            }}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{ tabBarLabel: 'Home', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>🏠</Text> }}
            />
            <Tab.Screen
                name="Timeline"
                component={MedicalTimelineScreen}
                options={{ tabBarLabel: 'Health', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>📋</Text> }}
            />
        </Tab.Navigator>
    );
}

// ── Root App ────────────────────────────────────────────────
export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    return (
        <NavigationContainer>
            <StatusBar style="dark" />
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: '#fff' },
                    animation: 'slide_from_right',
                }}
            >
                {!isAuthenticated ? (
                    <Stack.Screen name="Auth">
                        {(props) => (
                            <PhoneAuthScreen
                                {...props}
                                onRequestOtp={async (phone) => {
                                    console.log('OTP requested for:', phone);
                                    // In production: signInWithPhoneNumber(auth, phone)
                                }}
                                onVerifyOtp={async (code) => {
                                    console.log('OTP verified:', code);
                                    setIsAuthenticated(true);
                                    // In production: confirmationResult.confirm(code)
                                }}
                            />
                        )}
                    </Stack.Screen>
                ) : (
                    <>
                        <Stack.Screen name="MainTabs" component={MainTabs} />
                        <Stack.Screen
                            name="Intake"
                            component={IntakeScreen}
                            options={{
                                headerShown: true,
                                title: 'Find a Doctor',
                                headerTintColor: '#2563EB',
                                headerStyle: { backgroundColor: '#fff' },
                            }}
                        />
                        <Stack.Screen name="VideoCall">
                            {(props: any) => (
                                <VideoCallScreen
                                    roomName={props.route?.params?.roomName || 'default'}
                                    identity={props.route?.params?.identity || 'patient'}
                                    displayName={props.route?.params?.displayName}
                                    role="patient"
                                    onCallEnd={() => props.navigation.goBack()}
                                />
                            )}
                        </Stack.Screen>
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
