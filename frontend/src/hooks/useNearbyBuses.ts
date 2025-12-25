import { useEffect, useMemo, useState } from 'react';
import type { BusDetails } from '../../../types';
import calculateDistance from '@/utils/calculateDistance';

export function useNearbyBus(busLocations: BusDetails[]) {
    const [location, setLocation] = useState({ lat: 13.085553497844336, lng: 80.27162759382163 });

    useEffect(() => {
        if (!navigator.geolocation) return;

        const handleSuccess = (position: GeolocationPosition) => {
            setLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
            });
            console.log(position);
            // alert(`Latitude: ${position.coords.latitude}, Longitude: ${position.coords.longitude}`);
        };

        const handleError = (err: GeolocationPositionError) => {
            console.error(err);
            alert(`Error getting location: ${err.message}`);
        };

        navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
        });

        const watcher = navigator.geolocation.watchPosition(handleSuccess, handleError, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
        });

        return () => navigator.geolocation.clearWatch(watcher);
    }, []);

    const nearbyBuses = useMemo(() => {
        if (!location || location.lat === 0) return [];

        return busLocations
            .map((bus) => ({
                ...bus,
                distance: calculateDistance(location.lat, location.lng, bus.lat, bus.lng),
            }))
            .sort((a, b) => a.distance - b.distance);
    }, [busLocations, location]);

    // useEffect(() => {
    //     console.log("User location updated:", location);
    // }, [location]);

    return {
        nearbyBuses,
        userLocation: location,
        hasBusesNearby: nearbyBuses.length > 0,
    };
}
