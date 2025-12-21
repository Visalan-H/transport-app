import { useEffect, useRef, useState } from 'react';

export interface BusLocation {
    lat: number;
    lng: number;
    name: string;
}

export function useLocationStream() {
    const [busLocations, setBusLocations] = useState<BusLocation[]>([]);
    const sourceRef = useRef<EventSource | null>(null);

    useEffect(() => {
        sourceRef.current = new EventSource('http://localhost:3000/stream');

        sourceRef.current.onmessage = (event) => {
            const data = JSON.parse(event.data) as BusLocation[];
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
