import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { BusDetails } from '../../../types';

type NearbyBus = BusDetails & { distance: number };

type AppDrawerProps = {
    nearbyBuses: NearbyBus[];
};

export function AppDrawer({ nearbyBuses }: AppDrawerProps) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div
            className={`bg-background border-t border-border rounded-t-2xl transition-all duration-500 shrink-0 ${expanded ? '' : 'h-16'}`}
            style={{ minHeight: '4rem', height: expanded ? '45dvh' : '4rem' }}
        >
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full h-16 px-4 flex items-center justify-between shrink-0 rounded-t-2xl"
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
                                <p className="text-sm text-muted-foreground">{bus.distance.toFixed(2)} km away</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
