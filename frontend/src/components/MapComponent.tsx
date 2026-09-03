import { useState, useMemo, memo, useCallback, useEffect, useRef } from 'react';
import Map, { AttributionControl } from 'react-map-gl/maplibre';
import { shadow } from '@versatiles/style';
import type { StyleSpecification } from 'maplibre-gl';
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { TrackedBus } from '@/utils/busFacing';
import { useTheme } from '../hooks/useTheme';
import { MemoizedLocate } from '@/constants/MemoizedLocate';
import { BusLayer } from './map/BusLayer';
import { BusPopup } from './map/BusPopup';
import { UserLocationMarker } from './map/UserLocationMarker';
import { registerBusImage } from './map/BusIcon';
import zoomTo from '@/utils/zoomTo';

type MapComponentProps = {
    busLocations: TrackedBus[];
    userLocation: { lat: number; lng: number } | null;
    mapRef: React.RefObject<MapRef | null>;
};

type ValidBus = TrackedBus;

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

// Map styles are generated here rather than fetched from tiles.versatiles.org/assets/styles/*.
// Two reasons: the hosted presets are tuned for a general-purpose map and clash with this app's
// monochrome palette (white / #282a37), and fetching one costs a ~168kB request before the map can
// draw anything. Building them locally removes that request entirely.
//
// baseUrl is not optional in practice: the builder defaults it to document.location.origin in a
// browser, which would point tiles, glyphs and sprites at our own domain instead of VersaTiles.
const TILE_HOST = 'https://tiles.versatiles.org';

// Both themes are recoloured rather than used as shipped: VersaTiles' presets are tuned for a
// general-purpose map and read as too saturated beside a UI that is white and #282a37 and nothing
// else. Dark blends `shadow` toward the app background so the map belongs to the theme instead of
// sitting on top of it as a separate grey panel.
//
// Light is the tonal mirror of dark, not a second style: same base, same recolour, with
// invertBrightness flipping the luminosity and the blend aimed at white rather than the navy. One
// visual character across both themes, rather than two maps that happen to share an app.
//
// Two things learned the hard way and worth not repeating. Desaturating fully (saturate:-1) looks
// tempting for a monochrome UI but flattens the map: colour is what separates water from parks from
// road classes, and without it everything becomes one grey mass. And contrast pushes light tones
// toward white, so on the light theme a near-white default building fill lands on exactly #ffffff
// and the buildings vanish into the land.
//
// The mirror inherits dark's very subtle background-to-building separation -- 7 steps of luminance,
// which reads fine dark and weakly light. blendColor is the knob if that needs widening; dropping
// the blend takes it to 12.
const BRIGHT_MAP_STYLE = shadow({
    baseUrl: TILE_HOST,
    recolor: { invertBrightness: true, saturate: -0.8, blend: 0.4, blendColor: '#ffffff', contrast: 1.6 },
}) as StyleSpecification;

// Blended toward the app background so the map reads as part of the dark theme rather than a
// separate panel sitting on top of it.
const DARK_MAP_STYLE = shadow({
    baseUrl: TILE_HOST,
    recolor: { saturate: -0.8, blend: 0.4, blendColor: '#282a37', contrast: 1.6 },
}) as StyleSpecification;

export const MapComponent = memo(({ busLocations, userLocation, mapRef }: MapComponentProps) => {
    const { theme } = useTheme();

    const [selectedBus, setSelectedBus] = useState<TrackedBus | null>(null);
    const hasUserMovedRef = useRef(false);

    const mapStyle = theme === 'dark' ? DARK_MAP_STYLE : BRIGHT_MAP_STYLE;

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
