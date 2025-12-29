import { useState, useMemo, memo, useCallback, useRef } from 'react';
import Map, { Marker, AttributionControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { BusDetails } from '../../../types';
import type { MapRef, ViewStateChangeEvent } from 'react-map-gl/maplibre';
import { useTheme } from '../context/ThemeContext';
import { LoadingSpinner } from './LoadingSpinner';
import { MemoizedLocate } from '@/constants/MemoizedLocate';
import BusMarkerItem from './BusMarkerItem';
import useZoom from '@/hooks/useZoom';

type MapComponentProps = {
    busLocations: BusDetails[];
    userLocation: { lat: number; lng: number } | null;
    mapRef: React.RefObject<MapRef | null>;
};

export const MapComponent = memo(({ busLocations, userLocation, mapRef }: MapComponentProps) => {
    const { theme } = useTheme();

    const [viewState, setViewState] = useState({ longitude: 80.2707, latitude: 13.0827, zoom: 13 });
    const [hasUserMoved, setHasUserMoved] = useState(false);
    const [isMapLoading, setIsMapLoading] = useState(true);

    // const mapRef = useRef<MapRef>(null);

    const validBuses = useMemo(() => busLocations.filter((b) => b?.lat != null && b?.lng != null), [busLocations]);
    const currentViewState =
        !hasUserMoved && validBuses[0]
            ? { ...viewState, longitude: validBuses[0].lng, latitude: validBuses[0].lat }
            : viewState;

    const zoomToUser = useCallback(() => {
        if (userLocation) {
            useZoom({ lat: userLocation.lat, lng: userLocation.lng, mapRef });
            setHasUserMoved(true);
        }
    }, [userLocation]);

    const handleMove = useCallback((e: ViewStateChangeEvent) => {
        setHasUserMoved(true);
        setViewState(e.viewState);
    }, []);

    return (
        <>
            {isMapLoading && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
                    <LoadingSpinner text="Loading map..." size="md" />
                </div>
            )}
            <Map
                {...currentViewState}
                onMove={handleMove}
                onLoad={() => setIsMapLoading(false)}
                ref={mapRef}
                style={{ width: '100%', height: '100%', borderRadius: '0.5rem' }}
                attributionControl={false}
                mapStyle={`https://tiles.openfreemap.org/styles/${theme}`}
            >
                {validBuses.map((bus) => (
                    <BusMarkerItem key={bus.id} bus={bus} mapRef={mapRef} />
                ))}
                <AttributionControl position="top-left" />

                {userLocation && (
                    <Marker longitude={userLocation.lng} latitude={userLocation.lat}>
                        <div className="flex flex-col items-center gap-1">
                            <div className="bg-card shadow-md border border-border rounded px-2 py-1 backdrop-blur-sm">
                                <div className="text-xs font-semibold text-card-foreground tracking-wide">
                                    My Location
                                </div>
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
                    className="w-12 h-12 flex justify-center items-center absolute bottom-3 right-3 z-10 bg-card text-card-foreground border border-border p-2 rounded-2xl shadow-lg hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50 cursor-pointer"
                    title="Zoom to my location"
                >
                    <MemoizedLocate />
                </button>
            </Map>
        </>
    );
});
