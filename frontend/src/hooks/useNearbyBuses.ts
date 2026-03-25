import { useEffect, useMemo, useState } from 'react';
import type { BusDetails } from '../../../types';
import calculateDistance from '@/utils/calculateDistance';

const NEARBY_BUS_LIMIT = 10;

export function useNearbyBus(busLocations: BusDetails[]) {
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [isLoadingLocation, setIsLoadingLocation] = useState(() => !!navigator.geolocation);

    useEffect(() => {
        if (!navigator.geolocation) {
            return;
        }

        const handleSuccess = (position: GeolocationPosition) => {
            setLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
            });
            setIsLoadingLocation(false);
        };

        const handleError = (err: GeolocationPositionError) => {
            console.error(err);
            setIsLoadingLocation(false);
        };

        navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000,
        });

        const watcher = navigator.geolocation.watchPosition(handleSuccess, handleError, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000,
        });

        return () => navigator.geolocation.clearWatch(watcher);
    }, []);

    const nearbyBuses = useMemo(() => {
        if (!location) return [];

        const topNearby: (BusDetails & { distance: number })[] = [];

        for (const bus of busLocations) {
            const next = {
                ...bus,
                distance: calculateDistance(location.lat, location.lng, bus.lat, bus.lng),
            };

            if (topNearby.length < NEARBY_BUS_LIMIT) {
                topNearby.push(next);
                topNearby.sort((a, b) => a.distance - b.distance);
                continue;
            }

            if (next.distance >= topNearby[topNearby.length - 1].distance) continue;

            topNearby[topNearby.length - 1] = next;
            topNearby.sort((a, b) => a.distance - b.distance);
        }

        return topNearby;
    }, [busLocations, location]);

    return {
        nearbyBuses,
        userLocation: location,
        hasBusesNearby: nearbyBuses.length > 0,
        isLoadingLocation,
    };
}
