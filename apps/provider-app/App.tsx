import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text, View, TouchableOpacity } from 'react-native';
import { ConsultationScreen } from './src/screens/ConsultationScreen';
import { PhoneAuthScreen, TriageScreen, VideoCallScreen } from '@skids/ui';

import './global.css';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ── Provider Dashboard (Home) ───────────────────────────────
function ProviderDashboard({ navigation }: any) {
  const [isOnline, setIsOnline] = useState(false);

  return (
    <View className="flex-1 bg-gray-50 px-5 pt-16">
      <View className="flex-row items-center justify-between mb-8">
        <View>
          <Text className="text-3xl font-black text-gray-900">Dr. Dashboard</Text>
          <Text className="text-sm text-gray-500 mt-1">Skids Provider</Text>
        </View>
        <TouchableOpacity
          onPress={() => setIsOnline(!isOnline)}
          className={`px-5 py-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`}
        >
          <Text className="text-white font-bold text-sm">
            {isOnline ? '🟢 Online' : '⚪ Offline'}
          </Text>
        </TouchableOpacity>
      </View>

      {isOnline && (
        <View className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-5">
          <Text className="text-blue-800 font-bold text-base mb-1">
            📞 Incoming Consult Request
          </Text>
          <Text className="text-blue-600 text-sm mb-4">
            Patient: Mock Child (5y, M) — Symptoms: Fever, Ear Pain
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Consultation', {
              patientId: 'patient_mock_123',
              serviceRequestId: 'sr_mock_001',
            })}
            className="bg-blue-600 rounded-xl py-3 items-center mb-2"
          >
            <Text className="text-white font-bold">Accept & Start Consult</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('VideoCall', {
              roomName: 'consult_patient_mock_123',
              identity: 'dr_mock_001',
              displayName: 'Dr. Smith',
            })}
            className="bg-green-600 rounded-xl py-3 items-center"
          >
            <Text className="text-white font-bold">📹 Start Video Call</Text>
          </TouchableOpacity>
        </View>
      )}

      <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
        <Text className="font-bold text-gray-900 mb-2">Today's Stats</Text>
        <View className="flex-row justify-between">
          <View className="items-center">
            <Text className="text-2xl font-black text-blue-600">0</Text>
            <Text className="text-xs text-gray-500">Consults</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-black text-green-600">₹0</Text>
            <Text className="text-xs text-gray-500">Earned</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-black text-purple-600">0</Text>
            <Text className="text-xs text-gray-500">Prescriptions</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Triage Wrapper (for Tab) ────────────────────────────────
function TriageTab() {
  return (
    <TriageScreen
      demographics={{ name: 'Active Patient', age: 5, gender: 'M' }}
      historyText="No active consultation. Accept a consult request from the Dashboard to begin."
      initialChips={[]}
    />
  );
}

// ── Main Tabs ───────────────────────────────────────────────
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
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={ProviderDashboard}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>🏠</Text> }}
      />
      <Tab.Screen
        name="Triage"
        component={TriageTab}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>🩺</Text> }}
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
                  console.log('Provider OTP requested for:', phone);
                }}
                onVerifyOtp={async (code) => {
                  console.log('Provider OTP verified:', code);
                  setIsAuthenticated(true);
                }}
              />
            )}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen
              name="Consultation"
              component={ConsultationScreen}
              options={{
                headerShown: true,
                title: 'Live Consultation',
                headerTintColor: '#2563EB',
                headerStyle: { backgroundColor: '#fff' },
              }}
            />
            <Stack.Screen name="VideoCall">
              {(props: any) => (
                <VideoCallScreen
                  roomName={props.route?.params?.roomName || 'default'}
                  identity={props.route?.params?.identity || 'provider'}
                  displayName={props.route?.params?.displayName}
                  role="provider"
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
