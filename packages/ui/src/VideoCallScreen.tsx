import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    SafeAreaView,
    Alert,
} from 'react-native';

/**
 * VideoCallScreen — LiveKit-powered telehealth video consultation
 *
 * This component handles the full video call lifecycle:
 *   1. Fetches a room token from the Edge API
 *   2. Connects to LiveKit (via livekit-client in a real build)
 *   3. Renders video tiles + controls (mute, camera, end call)
 *
 * In this scaffold, the actual LiveKit RN SDK integration is stubbed.
 * To activate real video, install:
 *   npm install @livekit/react-native @livekit/react-native-webrtc livekit-client
 *   npx expo install @livekit/react-native-expo-plugin
 *
 * The component is designed to work identically in both patient-app and provider-app.
 */

const EDGE_API_URL = 'https://skids-edge-api.YOUR_SUBDOMAIN.workers.dev';

interface VideoCallScreenProps {
    roomName: string;
    identity: string;
    displayName?: string;
    role: 'patient' | 'provider';
    onCallEnd?: () => void;
    edgeApiUrl?: string;
}

export function VideoCallScreen({
    roomName,
    identity,
    displayName,
    role,
    onCallEnd,
    edgeApiUrl = EDGE_API_URL,
}: VideoCallScreenProps) {
    const [status, setStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [token, setToken] = useState<string | null>(null);
    const [livekitUrl, setLivekitUrl] = useState<string | null>(null);

    // Fetch room token from Edge API
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${edgeApiUrl}/api/video/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        roomName,
                        identity,
                        name: displayName || identity,
                    }),
                });
                const data = await res.json();
                if (data.token) {
                    setToken(data.token);
                    setLivekitUrl(data.url);
                    setStatus('connected');
                } else {
                    Alert.alert('Error', 'Failed to get video token');
                }
            } catch (err) {
                console.error('Token fetch error:', err);
                Alert.alert('Connection Error', 'Could not connect to video server');
            }
        })();
    }, [roomName, identity, displayName, edgeApiUrl]);

    // Call timer
    useEffect(() => {
        if (status !== 'connected') return;
        const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
        return () => clearInterval(interval);
    }, [status]);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    const handleEndCall = useCallback(() => {
        setStatus('ended');
        onCallEnd?.();
    }, [onCallEnd]);

    if (status === 'ended') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.endedContainer}>
                    <Text style={styles.endedIcon}>📞</Text>
                    <Text style={styles.endedTitle}>Call Ended</Text>
                    <Text style={styles.endedSub}>Duration: {formatTime(elapsed)}</Text>
                    <TouchableOpacity
                        style={styles.returnButton}
                        onPress={onCallEnd}
                    >
                        <Text style={styles.returnButtonText}>Return to Dashboard</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>
                        {role === 'patient' ? '🩺 Consulting with Doctor' : '👶 Patient Consultation'}
                    </Text>
                    <Text style={styles.headerRoom}>Room: {roomName}</Text>
                </View>
                {status === 'connected' && (
                    <View style={styles.timerBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
                    </View>
                )}
            </View>

            {/* Video Area */}
            <View style={styles.videoArea}>
                {status === 'connecting' ? (
                    <View style={styles.connectingOverlay}>
                        <ActivityIndicator size="large" color="#60a5fa" />
                        <Text style={styles.connectingText}>Connecting to video...</Text>
                        <Text style={styles.connectingHint}>
                            Fetching token from Edge API
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* Remote video (main) */}
                        <View style={styles.remoteVideo}>
                            <Text style={styles.videoPlaceholderIcon}>
                                {role === 'patient' ? '🩺' : '👶'}
                            </Text>
                            <Text style={styles.videoPlaceholderText}>
                                {role === 'patient' ? 'Doctor' : 'Patient'}
                            </Text>
                            {/* 
                Real implementation: Replace with <VideoView /> from @livekit/react-native
                <Room serverUrl={livekitUrl} token={token}>
                  <VideoTrack ... />
                </Room>
              */}
                        </View>

                        {/* Self video (PiP) */}
                        <View style={styles.selfVideo}>
                            <Text style={styles.selfVideoText}>
                                {isCameraOff ? '📷 Off' : '📹 You'}
                            </Text>
                        </View>
                    </>
                )}
            </View>

            {/* Controls */}
            {status === 'connected' && (
                <View style={styles.controls}>
                    <TouchableOpacity
                        style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
                        onPress={() => setIsMuted(!isMuted)}
                    >
                        <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🎤'}</Text>
                        <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.controlBtn, styles.endCallBtn]}
                        onPress={handleEndCall}
                    >
                        <Text style={styles.controlIcon}>📞</Text>
                        <Text style={[styles.controlLabel, { color: '#fff' }]}>End</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.controlBtn, isCameraOff && styles.controlBtnActive]}
                        onPress={() => setIsCameraOff(!isCameraOff)}
                    >
                        <Text style={styles.controlIcon}>{isCameraOff ? '📷' : '📹'}</Text>
                        <Text style={styles.controlLabel}>{isCameraOff ? 'Camera On' : 'Camera Off'}</Text>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0f',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#fff',
    },
    headerRoom: {
        fontSize: 10,
        color: '#666',
        marginTop: 2,
        fontFamily: 'monospace',
    },
    timerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(34,197,94,0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#4ade80',
        marginRight: 8,
    },
    timerText: {
        color: '#4ade80',
        fontSize: 12,
        fontWeight: '700',
        fontFamily: 'monospace',
    },
    videoArea: {
        flex: 1,
        position: 'relative',
    },
    connectingOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    connectingText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginTop: 16,
    },
    connectingHint: {
        color: '#666',
        fontSize: 12,
        marginTop: 6,
    },
    remoteVideo: {
        flex: 1,
        backgroundColor: '#111118',
        justifyContent: 'center',
        alignItems: 'center',
        margin: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    videoPlaceholderIcon: {
        fontSize: 64,
        marginBottom: 12,
    },
    videoPlaceholderText: {
        color: '#666',
        fontSize: 14,
        fontWeight: '600',
    },
    selfVideo: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: 100,
        height: 140,
        borderRadius: 16,
        backgroundColor: '#1a1a24',
        borderWidth: 2,
        borderColor: 'rgba(96,165,250,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    selfVideoText: {
        color: '#999',
        fontSize: 12,
        fontWeight: '600',
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 24,
        paddingHorizontal: 40,
        gap: 24,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    controlBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    controlBtnActive: {
        backgroundColor: 'rgba(239,68,68,0.2)',
    },
    endCallBtn: {
        backgroundColor: '#ef4444',
        width: 72,
        height: 72,
        borderRadius: 36,
    },
    controlIcon: {
        fontSize: 24,
    },
    controlLabel: {
        fontSize: 9,
        color: '#999',
        marginTop: 4,
        fontWeight: '600',
    },
    endedContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    endedIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    endedTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 8,
    },
    endedSub: {
        fontSize: 14,
        color: '#666',
        marginBottom: 32,
        fontFamily: 'monospace',
    },
    returnButton: {
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: '#2563eb',
    },
    returnButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
});
