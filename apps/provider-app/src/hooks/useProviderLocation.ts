import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { db, updateProviderLocation, generateGeohash } from '@skids/firebase';

/**
 * useProviderLocation — Expo Location hook for provider-app
 *
 * Tracks the provider's GPS position and updates Firestore with
 * the new position + geohash whenever it changes significantly.
 *
 * Usage:
 *   const { location, isTracking, error, startTracking, stopTracking } = useProviderLocation(providerId);
 */

interface LocationState {
    lat: number;
    lng: number;
    geohash: string;
    accuracy: number | null;
    timestamp: number;
}

export function useProviderLocation(providerId: string) {
    const [location, setLocation] = useState<LocationState | null>(null);
    const [isTracking, setIsTracking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

    const startTracking = useCallback(async () => {
        try {
            // Request permissions
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setError('Location permission denied');
                return;
            }

            setIsTracking(true);
            setError(null);

            // Get initial position
            const current = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const initialGeohash = generateGeohash(
                current.coords.latitude,
                current.coords.longitude
            );

            const initialState: LocationState = {
                lat: current.coords.latitude,
                lng: current.coords.longitude,
                geohash: initialGeohash,
                accuracy: current.coords.accuracy,
                timestamp: current.timestamp,
            };

            setLocation(initialState);

            // Update Firestore with initial position
            await updateProviderLocation(
                db,
                providerId,
                current.coords.latitude,
                current.coords.longitude
            );

            // Start watching position (updates every ~10 seconds / 50m movement)
            subscriptionRef.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: 10000,     // 10 seconds
                    distanceInterval: 50,     // 50 meters
                },
                async (newLocation) => {
                    const { latitude, longitude } = newLocation.coords;
                    const geohash = generateGeohash(latitude, longitude);

                    setLocation({
                        lat: latitude,
                        lng: longitude,
                        geohash,
                        accuracy: newLocation.coords.accuracy,
                        timestamp: newLocation.timestamp,
                    });

                    // Update Firestore
                    try {
                        await updateProviderLocation(db, providerId, latitude, longitude);
                    } catch (err) {
                        console.warn('Failed to update provider location:', err);
                    }
                }
            );
        } catch (err: any) {
            setError(err.message || 'Failed to start location tracking');
            setIsTracking(false);
        }
    }, [providerId]);

    const stopTracking = useCallback(() => {
        if (subscriptionRef.current) {
            subscriptionRef.current.remove();
            subscriptionRef.current = null;
        }
        setIsTracking(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (subscriptionRef.current) {
                subscriptionRef.current.remove();
            }
        };
    }, []);

    return {
        location,
        isTracking,
        error,
        startTracking,
        stopTracking,
    };
}
