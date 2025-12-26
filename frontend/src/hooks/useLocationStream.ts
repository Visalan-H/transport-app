import { useEffect, useRef, useState } from 'react';
import type { BusDetails } from '../../../types';

export function useLocationStream() {
    const [busLocations, setBusLocations] = useState<BusDetails[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const sourceRef = useRef<EventSource | null>(null);
    const hasConnectedRef = useRef(false);

    useEffect(() => {
        const apiUrl = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;
        sourceRef.current = new EventSource(`${apiUrl}/stream`);

        sourceRef.current.onopen = () => {
            hasConnectedRef.current = true;
            setError(null);
        };

        sourceRef.current.onmessage = (event) => {
            const data = JSON.parse(event.data) as BusDetails[];
            setBusLocations(data);
            setIsLoading(false);
            setError(null);
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
