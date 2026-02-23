import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';

export interface PhoneAuthScreenProps {
    onRequestOtp: (phoneNumber: string) => Promise<void>;
    onVerifyOtp: (otp: string) => Promise<void>;
    logo?: React.ReactNode;
}

export const PhoneAuthScreen: React.FC<PhoneAuthScreenProps> = ({
    onRequestOtp,
    onVerifyOtp,
    logo,
}) => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState<'request' | 'verify'>('request');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleRequestOtp = async () => {
        if (!phoneNumber) {
            setError('Please enter a valid phone number');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await onRequestOtp(phoneNumber);
            setStep('verify');
        } catch (err: any) {
            setError(err.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp) {
            setError('Please enter the OTP');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await onVerifyOtp(otp);
            // Success, parent component will handle navigation or state update
        } catch (err: any) {
            setError(err.message || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-white justify-center items-center px-6">
            <View className="w-full max-w-sm">
                {logo && <View className="mb-8 items-center">{logo}</View>}

                <Text className="text-3xl font-bold text-gray-900 mb-2">
                    {step === 'request' ? 'Welcome Back' : 'Enter OTP'}
                </Text>
                <Text className="text-base text-gray-500 mb-8">
                    {step === 'request'
                        ? 'Sign in or create an account with your phone number'
                        : `We sent a code to ${phoneNumber}`}
                </Text>

                {error ? (
                    <View className="bg-red-50 p-3 rounded-lg mb-4 border border-red-100">
                        <Text className="text-sm text-red-600 font-medium">{error}</Text>
                    </View>
                ) : null}

                {step === 'request' ? (
                    <>
                        <View className="mb-6">
                            <Text className="text-sm font-semibold text-gray-700 mb-2">
                                Phone Number
                            </Text>
                            <TextInput
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg text-gray-900"
                                placeholder="+1 234 567 8900"
                                keyboardType="phone-pad"
                                value={phoneNumber}
                                onChangeText={setPhoneNumber}
                                autoFocus
                            />
                        </View>

                        <TouchableOpacity
                            onPress={handleRequestOtp}
                            disabled={loading}
                            activeOpacity={0.8}
                            className={`w-full py-4 rounded-xl items-center justify-center flex-row ${loading ? 'bg-green-400' : 'bg-green-500'
                                }`}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" className="mr-2" />
                            ) : null}
                            <Text className="text-white font-bold text-lg">Send Code</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <View className="mb-6">
                            <Text className="text-sm font-semibold text-gray-700 mb-2">
                                6-Digit Code
                            </Text>
                            <TextInput
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg text-center tracking-widest text-gray-900"
                                placeholder="000000"
                                keyboardType="number-pad"
                                maxLength={6}
                                value={otp}
                                onChangeText={setOtp}
                                autoFocus
                            />
                        </View>

                        <TouchableOpacity
                            onPress={handleVerifyOtp}
                            disabled={loading}
                            activeOpacity={0.8}
                            className={`w-full py-4 rounded-xl items-center justify-center flex-row ${loading ? 'bg-green-400' : 'bg-green-500'
                                }`}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" className="mr-2" />
                            ) : null}
                            <Text className="text-white font-bold text-lg">Verify & Sign In</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            className="mt-6 items-center"
                            onPress={() => setStep('request')}
                            disabled={loading}
                        >
                            <Text className="text-green-600 font-semibold">
                                Use a different number
                            </Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </View>
    );
};
