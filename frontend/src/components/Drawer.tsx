import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { BusDetails } from '../../../types';
import { SEC_Bus_Routes } from '@/constants/BusIdMap';
import { LoadingSpinner } from './LoadingSpinner';
import type { MapRef } from 'react-map-gl/maplibre';
import useZoom from '@/hooks/useZoom';

type NearbyBus = BusDetails & { distance: number };

type AppDrawerProps = {
    nearbyBuses: NearbyBus[];
    isLoadingLocation?: boolean;
    mapRef: React.RefObject<MapRef | null>;
};

export function AppDrawer({ nearbyBuses, isLoadingLocation, mapRef }: AppDrawerProps) {
    const [expanded, setExpanded] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Trigger animation after component mounts
        const timer = setTimeout(() => setIsVisible(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const handleClick = (lat: number, lng: number) => {
        useZoom({ lat, lng, mapRef });
    };

    return (
        <div
            className={`bg-background border-t border-x mx-2 border-border rounded-t-lg transition-all duration-500 shrink-0 min-h-16 ${
                expanded ? 'h-[45dvh]' : 'h-16'
            } ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
        >
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full h-16 px-4 flex items-center justify-between shrink-0 rounded-t-lg"
            >
                <h2 className="font-semibold text-lg">Nearby Buses</h2>
                {expanded ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
            </button>

            {expanded && (
                <div className="px-4 pb-4 space-y-3 overflow-y-auto h-[calc(100%-4rem)]">
                    {isLoadingLocation ? (
                        <div className="flex items-center justify-center h-32">
                            <LoadingSpinner text="Finding your location..." size="sm" />
                        </div>
                    ) : nearbyBuses.length === 0 ? (
                        <div className="flex items-center justify-center h-32">
                            <p className="text-muted-foreground text-sm">No buses nearby</p>
                        </div>
                    ) : (
                        nearbyBuses.slice(0, 10).map((bus) => (
                            <div
                                key={bus.id}
                                onClick={() => handleClick(bus.lat, bus.lng)}
                                className="p-3 border border-border rounded flex justify-between items-center cursor-pointer"
                            >
                                <div>
                                    <h3 className="font-semibold">{SEC_Bus_Routes[bus.id]}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {(bus.distance * 1000).toFixed(0)} m away
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
