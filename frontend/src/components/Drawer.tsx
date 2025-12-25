import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useNearbyBus } from '@/hooks/useNearbyBuses';
import type { BusDetails } from '../../../types';

type AppDrawerProps = {
    busLocations: BusDetails[];
};

export function AppDrawer({ busLocations }: AppDrawerProps) {
    const [expanded, setExpanded] = useState(false);
    const { nearbyBuses } = useNearbyBus(busLocations);

    return (
        <div
            className={`fixed bottom-0 left-0 right-0 bg-background border-t border-border z-1000 transition-all duration-500 ${expanded ? 'h-[45vh]' : 'h-16'}`}
        >
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full h-16 px-4 flex items-center justify-between"
            >
                <h2 className="font-semibold text-lg">Nearby Buses</h2>
                {expanded ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
            </button>

            {expanded && (
                <div className="px-4 pb-4 space-y-3 overflow-y-auto" style={{ height: 'calc(100% - 4rem)' }}>
                    {nearbyBuses.map((bus) => (
                        <div
                            key={bus.id}
                            className="p-3 border border-border rounded flex justify-between items-center"
                        >
                            <div>
                                <h3 className="font-semibold">{bus.id}</h3>
                                <p className="text-sm text-muted-foreground">{bus.distance} km away</p>
                            </div>
                            {/* <div className="text-right">
                                <p className="font-semibold">{bus.eta}</p>
                            </div> */}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
