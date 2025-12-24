import { useState, useMemo, memo } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { BusDetails } from '../../../types';
import { useTheme } from '../context/ThemeContext';

type MapComponentProps = {
    busLocations: BusDetails[];
};

export const MapComponent = memo(({ busLocations }: MapComponentProps) => {
    const { theme } = useTheme();
    const [viewState, setViewState] = useState({ longitude: 80.2707, latitude: 13.0827, zoom: 13 });
    const [hasUserMoved, setHasUserMoved] = useState(false);

    const validBuses = useMemo(() => busLocations.filter((b) => b?.lat != null && b?.lng != null), [busLocations]);
    const currentViewState =
        !hasUserMoved && validBuses[0]
            ? { ...viewState, longitude: validBuses[0].lng, latitude: validBuses[0].lat }
            : viewState;

    return (
        <Map
            {...currentViewState}
            onMove={(e) => {
                setHasUserMoved(true);
                setViewState(e.viewState);
            }}
            style={{ width: '100%', height: '100%' }}
            mapStyle={`https://tiles.openfreemap.org/styles/${theme}`}
        >
            {validBuses.map((bus) => (
                <Marker key={bus.id} longitude={bus.lng} latitude={bus.lat} anchor="bottom">
                    <div className="flex flex-col items-center">
                        <div className="bg-white text-[#282A37] px-1.5 py-0.5 text-xs font-bold border border-red-500">
                            {bus.id}
                        </div>
                        <div className="bg-white text-gray-800 text-[10px]">
                            {new Date(bus.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="w-3 h-3 bg-red-500 rounded-full" />
                    </div>
                </Marker>
            ))}
        </Map>
    );
});
