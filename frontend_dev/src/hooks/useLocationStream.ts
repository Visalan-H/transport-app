import { useEffect, useRef, useState } from 'react';

export interface BusLocation {
    lat: number;
    lng: number;
    name: string;
}

export function useLocationStream() {
    const [busLocation, setBusLocation] = useState<BusLocation | null>(null);
    const sourceRef = useRef<EventSource | null>(null);

    useEffect(() => {
        sourceRef.current = new EventSource('http://localhost:3000/stream');

        sourceRef.current.onmessage = (event) => {
            const data: BusLocation = JSON.parse(event.data);
            setBusLocation(data);
        };

        sourceRef.current.onerror = () => {
            console.error('EventSource connection error');
            sourceRef.current?.close();
        };

        return () => {
            sourceRef.current?.close();
        };
    }, []);

    return busLocation;
}
