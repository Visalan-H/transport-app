import { useState, useMemo, memo, useCallback, useEffect } from 'react';
import Map, { AttributionControl } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent, MapRef, ViewStateChangeEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { BusDetails } from '../../../types';
import { useTheme } from '../context/ThemeContext';
import { LoadingSpinner } from './LoadingSpinner';
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

export const MapComponent = memo(({ busLocations, userLocation, mapRef }: MapComponentProps) => {
    const { theme } = useTheme();

    const [viewState, setViewState] = useState({ longitude: 80.2707, latitude: 13.0827, zoom: 13 });
    const [hasUserMoved, setHasUserMoved] = useState(false);
    const [isMapLoading, setIsMapLoading] = useState(true);
    const [selectedBus, setSelectedBus] = useState<BusDetails | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);

    const mapStyle =
        theme === 'dark'
            ? 'https://tiles.openfreemap.org/styles/dark'
            : 'https://tiles.openfreemap.org/styles/positron';

    const validBuses = useMemo(() => busLocations.filter((b) => b?.lat != null && b?.lng != null), [busLocations]);

    const currentViewState =
        !hasUserMoved && validBuses[0]
            ? { ...viewState, longitude: validBuses[0].lng, latitude: validBuses[0].lat }
            : viewState;

    const handleMapLoad = useCallback(async () => {
        setIsMapLoading(false);
        const map = mapRef.current?.getMap();
        if (!map) return;
        await registerBusImage(map);
        setImageLoaded(true);
    }, [mapRef]);

    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!map) return;
        const reloadImage = async () => {
            await registerBusImage(map);
            setImageLoaded(true);
        };
        map.on('styledata', reloadImage);
        return () => {
            map.off('styledata', reloadImage);
        };
    }, [mapRef, isMapLoading]);

    const handleMapClick = useCallback(
        (e: MapLayerMouseEvent) => {
            const features = e.features;
            if (features && features.length > 0) {
                const props = features[0].properties as { id: number };
                const bus = validBuses.find((b) => b.id === Number(props.id));
                if (bus) {
                    setSelectedBus(bus);
                    zoomTo({ lat: bus.lat, lng: bus.lng, mapRef });
                }
            } else {
                setSelectedBus(null);
            }
        },
        [validBuses, mapRef],
    );

    const zoomToUser = useCallback(() => {
        if (userLocation) {
            zoomTo({ lat: userLocation.lat, lng: userLocation.lng, mapRef });
            setHasUserMoved(true);
        }
    }, [userLocation, mapRef]);

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
                onLoad={handleMapLoad}
                onClick={handleMapClick}
                interactiveLayerIds={['bus-icons']}
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
                {imageLoaded && <BusLayer buses={validBuses} theme={theme} />}
                {selectedBus && <BusPopup bus={selectedBus} onClose={() => setSelectedBus(null)} />}
                {userLocation && <UserLocationMarker location={userLocation} />}

                <AttributionControl position="top-left" />

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
