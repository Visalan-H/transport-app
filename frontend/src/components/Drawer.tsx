import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

type Bus = {
    id: string;
    name: string;
    distance: number;
    eta: string;
};

const DUMMY_BUSES: Bus[] = [
    { id: '1', name: 'Route 101', distance: 0.5, eta: '2 min' },
    { id: '2', name: 'Route 202', distance: 1.2, eta: '5 min' },
    { id: '3', name: 'Route 303', distance: 1.8, eta: '8 min' },
    { id: '4', name: 'Route 404', distance: 2.3, eta: '11 min' },
];

export function AppDrawer() {
    const [expanded, setExpanded] = useState(false);

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
                    {DUMMY_BUSES.map((bus) => (
                        <div
                            key={bus.id}
                            className="p-3 border border-border rounded flex justify-between items-center"
                        >
                            <div>
                                <h3 className="font-semibold">{bus.name}</h3>
                                <p className="text-sm text-muted-foreground">{bus.distance} km away</p>
                            </div>
                            <div className="text-right">
                                <p className="font-semibold">{bus.eta}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
