import { useState, useMemo, memo } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapComponent.css';
import type { BusDetails } from '../../../../types';

interface MapComponentProps {
    busLocations: BusDetails[];
    selectedStyle: string;
}

export const MapComponent = memo(function MapComponent({ busLocations, selectedStyle }: MapComponentProps) {
    const [viewState, setViewState] = useState({
        longitude: 80.2707,
        latitude: 13.0827,
        zoom: 13,
    });
    const [hasUserMoved, setHasUserMoved] = useState(false);

    const mapStyle =
        selectedStyle === 'bright'
            ? 'https://tiles.openfreemap.org/styles/bright'
            : 'https://tiles.openfreemap.org/styles/dark';

    // Memoized valid buses (no ESLint issues)
    const validBuses = useMemo(
        () =>
            busLocations.filter(
                (bus) =>
                    bus &&
                    typeof bus.lat === 'number' &&
                    typeof bus.lng === 'number' &&
                    !isNaN(bus.lat) &&
                    !isNaN(bus.lng),
            ),
        [busLocations],
    );

    // Auto-center logic (no setState in useEffect)
    const currentViewState =
        !hasUserMoved && validBuses.length > 0
            ? { ...viewState, longitude: validBuses[0].lng, latitude: validBuses[0].lat }
            : viewState;

    return (
        <Map
            {...currentViewState}
            onMove={(evt) => {
                setHasUserMoved(true);
                setViewState(evt.viewState);
            }}
            style={{ width: '100%', height: '100%' }}
            mapStyle={mapStyle}
        >
            {validBuses.map((bus) => (
                <Marker key={bus.name} longitude={bus.lng} latitude={bus.lat} anchor="bottom">
                    <div className="bus-marker-container">
                        <div className="bus-marker-label">{bus.name}</div>
                        <div className="bus-marker-timestamp">{new Date(bus.timestamp).toLocaleTimeString()}</div>
                        <div className="bus-marker-dot" />
                    </div>
                </Marker>
            ))}
        </Map>
    );
});
