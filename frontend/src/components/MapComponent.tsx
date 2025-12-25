import { useState, useMemo, memo, useCallback } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { BusDetails } from '../../../types';
import { useTheme } from '../context/ThemeContext';
import { BusMarker } from './BusMarker';
import { SEC_Bus_Routes } from '../constants/BusIdMap';
import MemoizedLocate from '@/constants/icons/Locate';

type MapComponentProps = {
    busLocations: BusDetails[];
    userLocation: { lat: number; lng: number } | null;
};

type BusMarkerItemProps = {
    bus: BusDetails;
};

const BusMarkerItem = memo(
    ({ bus }: BusMarkerItemProps) => (
        <Marker longitude={bus.lng} latitude={bus.lat} anchor="bottom">
            <div className="flex flex-col items-center">
                <BusMarker />
                <div className="bg-white text-[#282A37] px-1.5 py-0.5 text-xs font-bold border border-red-500 mt-1">
                    {SEC_Bus_Routes[bus.id] || bus.id}
                </div>
                <div className="bg-white text-gray-800 text-[10px]">{new Date(bus.timestamp).toLocaleTimeString()}</div>
            </div>
        </Marker>
    ),
    (prev, next) =>
        prev.bus.id === next.bus.id &&
        prev.bus.lat === next.bus.lat &&
        prev.bus.lng === next.bus.lng &&
        prev.bus.timestamp === next.bus.timestamp,
);

export const MapComponent = memo(({ busLocations, userLocation }: MapComponentProps) => {
    const { theme } = useTheme();

    const [viewState, setViewState] = useState({ longitude: 80.2707, latitude: 13.0827, zoom: 13 });
    const [hasUserMoved, setHasUserMoved] = useState(false);

    const validBuses = useMemo(() => busLocations.filter((b) => b?.lat != null && b?.lng != null), [busLocations]);
    const currentViewState =
        !hasUserMoved && validBuses[0]
            ? { ...viewState, longitude: validBuses[0].lng, latitude: validBuses[0].lat }
            : viewState;

    const zoomToUser = useCallback(() => {
        if (userLocation) {
            setViewState((prev) => ({ ...prev, latitude: userLocation.lat, longitude: userLocation.lng, zoom: 15 }));
            setHasUserMoved(true);
        }
    }, [userLocation]);

    return (
        <Map
            {...currentViewState}
            onMove={(e) => {
                setHasUserMoved(true);
                setViewState(e.viewState);
            }}
            attributionControl={{ compact: true }}
            style={{ width: '100%', height: '100%' }}
            mapStyle={`https://tiles.openfreemap.org/styles/${theme}`}
        >
            {validBuses.map((bus) => (
                <BusMarkerItem key={bus.id} bus={bus} />
            ))}

            {userLocation && (
                <Marker longitude={userLocation.lng} latitude={userLocation.lat}>
                    <div className="flex flex-col items-center">
                        <div className="bg-white text-[#282A37] px-1.5 py-0.5 text-xs font-bold border border-red-500">
                            My location
                        </div>
                        <div className="relative h-10 w-10">
                            <span className="absolute inset-0 m-auto h-full w-full animate-ping rounded-full bg-blue-400 opacity-40"></span>
                            <div className="absolute inset-0 m-auto h-3 w-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/80"></div>
                        </div>
                    </div>
                </Marker>
            )}

            <button
                onClick={zoomToUser}
                disabled={!userLocation}
                className="absolute bottom-16 right-4 z-10 bg-white dark:bg-gray-800 text-gray-800 dark:text-white p-2 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                title="Zoom to my location"
            >
                <MemoizedLocate />
            </button>
        </Map>
    );
});
