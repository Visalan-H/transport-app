import { useEffect, useRef, useState } from 'react';
import type { BusDetails } from '../../../types';

export function useLocationStream() {
    const [busLocations, setBusLocations] = useState<BusDetails[]>([]);
    const sourceRef = useRef<EventSource | null>(null);

    useEffect(() => {
        sourceRef.current = new EventSource('http://localhost:3000/stream');

        sourceRef.current.onmessage = (event) => {
            const data = JSON.parse(event.data) as BusDetails[];
            setBusLocations(data);
        };

        sourceRef.current.onerror = (error) => {
            // Don't close the connection - EventSource will automatically attempt to reconnect
            console.error('EventSource connection error, will auto-retry:', error);
        };

        return () => {
            sourceRef.current?.close();
        };
    }, []);

    return busLocations;
}
