import { useEffect, useRef, useState } from 'react';
import type { BusDetails } from '../../../types';
import { resolveFacing, type TrackedBus } from '../utils/busFacing';

const hasBusSnapshotChanged = (prev: TrackedBus[], next: BusDetails[]) => {
    if (prev.length !== next.length) return true;

    const prevById = new globalThis.Map(prev.map((bus) => [bus.id, bus]));

    for (const bus of next) {
        const previous = prevById.get(bus.id);
        if (!previous) return true;

        if (previous.lat !== bus.lat || previous.lng !== bus.lng || previous.timestamp !== bus.timestamp) {
            return true;
        }
    }

    return false;
};

/**
 * Attaches a facing to each bus by comparing it against where it was in the previous snapshot.
 *
 * This lives in the state updater rather than downstream, because the facing is a function of the
 * *previous* state -- exactly what a reducer is for. Deriving it in a component would mean holding
 * the last positions in a ref and reading that ref during render.
 */
const withFacing = (prev: TrackedBus[], next: BusDetails[]): TrackedBus[] => {
    const prevById = new globalThis.Map(prev.map((bus) => [bus.id, bus]));
    return next.map((bus) => ({ ...bus, ...resolveFacing(prevById.get(bus.id), bus) }));
};

export function useLocationStream() {
    const [busLocations, setBusLocations] = useState<TrackedBus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const sourceRef = useRef<EventSource | null>(null);
    const hasConnectedRef = useRef(false);

    useEffect(() => {
        const apiUrl = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3000' : '');
        sourceRef.current = new EventSource(`${apiUrl}/stream`, { withCredentials: true });

        sourceRef.current.onopen = () => {
            hasConnectedRef.current = true;
            setError(null);
            setIsLoading(false);
        };

        sourceRef.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data) as BusDetails[];
                setBusLocations((prev) => (hasBusSnapshotChanged(prev, data) ? withFacing(prev, data) : prev));
                setIsLoading(false);
                setError(null);
            } catch (parseError) {
                console.error('Failed to parse bus location data:', parseError);
                // Continue listening for next valid message instead of crashing
            }
        };

        sourceRef.current.onerror = () => {
            if (!hasConnectedRef.current) {
                // Initial connection failed
                setError('Unable to connect to server');
                setIsLoading(false);
            } else {
                // Connection lost after successful connect
                setError('Connection lost. Please wait or refresh.');
            }
            console.error('EventSource connection error');
        };

        return () => {
            sourceRef.current?.close();
        };
    }, []);

    return { busLocations, isLoading, error };
}
