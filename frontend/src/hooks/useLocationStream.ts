import { useEffect, useRef, useState } from 'react';
import type { BusDetails } from '../../../types';
import { resolveFacing, type TrackedBus } from '../utils/busFacing';
import api from '../utils/axiosInstance';
import { errorStatus } from '../utils/errorMessage';

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
    const hasConnectedRef = useRef(false);

    useEffect(() => {
        const apiUrl = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3000' : '');
        let source: EventSource | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        // EventSource reconnects by itself only after a dropped connection. An HTTP error such as the
        // 502 nginx returns while the backend restarts on deploy closes it for good, so every open map
        // froze until a refresh. Reopen it ourselves, backing off so a whole campus of tabs does not
        // hit the backend in the same second it comes back.
        let retryDelay = 2000;
        let stopped = false;

        const connect = () => {
            source = new EventSource(`${apiUrl}/stream`, { withCredentials: true });

            source.onopen = () => {
                hasConnectedRef.current = true;
                retryDelay = 2000;
                setError(null);
                setIsLoading(false);
            };

            source.onmessage = (event) => {
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

            source.onerror = () => {
                setError(hasConnectedRef.current ? 'Connection lost. Reconnecting...' : 'Unable to connect to server');
                setIsLoading(false);
                console.error('EventSource connection error');

                // CONNECTING means the browser is already retrying a dropped connection itself.
                if (source?.readyState !== EventSource.CLOSED) return;
                source.close();
                retryTimer = setTimeout(reconnect, retryDelay);
                retryDelay = Math.min(retryDelay * 2, 30000);
            };
        };

        // The stream answers an expired session with a 401 too, and no retry fixes that. Ask
        // /auth/me first so an expired tab stops and says why instead of retrying forever.
        const reconnect = () => {
            api.get('/auth/me').then(
                () => !stopped && connect(),
                (err: unknown) => {
                    if (stopped) return;
                    if (errorStatus(err) === 401) {
                        setError('Your session expired. Sign in again.');
                        return;
                    }
                    connect();
                },
            );
        };

        connect();

        return () => {
            stopped = true;
            clearTimeout(retryTimer);
            source?.close();
        };
    }, []);

    return { busLocations, isLoading, error };
}
