import { useState, useMemo, memo, useCallback, useEffect, useRef } from 'react';
import Map, { AttributionControl } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { BusDetails } from '../../../types';
import { useTheme } from '../context/ThemeContext';
import { MemoizedLocate } from '@/constants/MemoizedLocate';
import { BusLayer } from './map/BusLayer';
import { BusPopup } from './map/BusPopup';
import { UserLocationMarker } from './map/UserLocationMarker';
import { registerBusImage } from './map/BusIcon';
import zoomTo from '@/utils/zoomTo';

type MapComponentProps = {
    busLocations: BusDetails[];
    userLocation: { lat: number; lng: number } | null;
    mapRef: React.RefObject<MapRef | null>;
};

type ValidBus = {
    id: number;
    lat: number;
    lng: number;
    timestamp: number;
};

type UseMapLoadStateArgs = {
    mapRef: React.RefObject<MapRef | null>;
};

type UseAutoCenterFirstBusArgs = {
    mapRef: React.RefObject<MapRef | null>;
    validBuses: ValidBus[];
    hasUserMovedRef: React.MutableRefObject<boolean>;
};

function useMapLoadState({ mapRef }: UseMapLoadStateArgs) {
    const [isMapLoading, setIsMapLoading] = useState(true);
    const [isImageLoaded, setIsImageLoaded] = useState(false);
    const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const ensureBusImage = useCallback(async () => {
        const map = mapRef.current?.getMap();
        if (!map) return;

        await registerBusImage(map);
        setIsImageLoaded(true);
    }, [mapRef]);

    const handleMapLoad = useCallback(async () => {
        if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current);
            loadTimeoutRef.current = null;
        }

        setIsMapLoading(false);
        await ensureBusImage();
    }, [ensureBusImage]);

    useEffect(() => {
        loadTimeoutRef.current = setTimeout(() => setIsMapLoading(false), 1800);

        return () => {
            if (loadTimeoutRef.current) {
                clearTimeout(loadTimeoutRef.current);
                loadTimeoutRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        let isCancelled = false;

        const bootstrap = async () => {
            const map = mapRef.current?.getMap();
            if (!map) {
                if (!isCancelled) requestAnimationFrame(bootstrap);
                return;
            }

            await ensureBusImage();
        };

        bootstrap();

        return () => {
            isCancelled = true;
        };
    }, [ensureBusImage, mapRef]);

    return { ensureBusImage, handleMapLoad, isImageLoaded, isMapLoading };
}

function useAutoCenterFirstBus({ mapRef, validBuses, hasUserMovedRef }: UseAutoCenterFirstBusArgs) {
    const hasCenteredOnBusRef = useRef(false);

    useEffect(() => {
        if (hasUserMovedRef.current || hasCenteredOnBusRef.current || !validBuses.length) return;

        const map = mapRef.current?.getMap();
        if (!map) return;

        const firstBus = validBuses[0];
        map.easeTo({ center: [firstBus.lng, firstBus.lat], duration: 700 });
        hasCenteredOnBusRef.current = true;
    }, [hasUserMovedRef, mapRef, validBuses]);
}

export const MapComponent = memo(({ busLocations, userLocation, mapRef }: MapComponentProps) => {
    const { theme } = useTheme();

    const [selectedBus, setSelectedBus] = useState<BusDetails | null>(null);
    const hasUserMovedRef = useRef(false);

    const mapStyle =
        theme === 'dark'
            ? 'https://tiles.openfreemap.org/styles/dark'
            : 'https://tiles.openfreemap.org/styles/positron';

    const validBuses = useMemo(() => busLocations.filter((b) => b?.lat != null && b?.lng != null), [busLocations]);
    const busesById = useMemo(() => new globalThis.Map(validBuses.map((bus) => [bus.id, bus])), [validBuses]);
    const { ensureBusImage, handleMapLoad, isImageLoaded, isMapLoading } = useMapLoadState({ mapRef });

    useAutoCenterFirstBus({ mapRef, validBuses, hasUserMovedRef });

    const handleMapClick = useCallback(
        (e: MapLayerMouseEvent) => {
            const features = e.features;
            if (features && features.length > 0) {
                const props = features[0].properties as { id: number };
                const bus = busesById.get(Number(props.id));
                if (bus) {
                    setSelectedBus(bus);
                    zoomTo({ lat: bus.lat, lng: bus.lng, mapRef });
                }
            } else {
                setSelectedBus(null);
            }
        },
        [busesById, mapRef],
    );

    const zoomToUser = useCallback(() => {
        if (userLocation) {
            zoomTo({ lat: userLocation.lat, lng: userLocation.lng, mapRef });
            hasUserMovedRef.current = true;
        }
    }, [userLocation, mapRef]);

    const handleMove = useCallback(() => {
        hasUserMovedRef.current = true;
    }, []);

    return (
        <>
            {isMapLoading && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-card border border-border rounded-full px-3 py-1.5 text-xs text-muted-foreground shadow flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                    Loading map tiles…
                </div>
            )}
            <Map
                initialViewState={{ longitude: 80.2707, latitude: 13.0827, zoom: 13 }}
                onMove={handleMove}
                onLoad={handleMapLoad}
                onStyleData={ensureBusImage}
                onClick={handleMapClick}
                interactiveLayerIds={['bus-icons']}
                reuseMaps
                ref={mapRef}
                style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border)',
                    boxShadow: '0 2px 3px rgba(0, 0, 0, 0.2)',
                }}
                attributionControl={false}
                mapStyle={mapStyle}
            >
                {isImageLoaded && <BusLayer buses={validBuses} theme={theme} />}
                {selectedBus && <BusPopup bus={selectedBus} onClose={() => setSelectedBus(null)} />}
                {userLocation && <UserLocationMarker location={userLocation} />}

                <AttributionControl position="top-left" />

                <button
                    onClick={zoomToUser}
                    disabled={!userLocation}
                    className="size-12 flex justify-center items-center absolute bottom-3 right-3 z-10 bg-card text-card-foreground border border-border p-2 rounded-2xl shadow-lg hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50 cursor-pointer"
                    title="Zoom to my location"
                >
                    <MemoizedLocate />
                </button>
            </Map>
        </>
    );
});
