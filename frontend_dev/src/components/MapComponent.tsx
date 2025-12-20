import { useState } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { BusLocation } from '../hooks/useLocationStream';

interface MapComponentProps {
    busLocation: BusLocation | null;
    selectedStyle: string;
}

export function MapComponent({ busLocation, selectedStyle }: MapComponentProps) {
    const [viewState, setViewState] = useState({
        longitude: 80.2707,
        latitude: 13.0827,
        zoom: 13,
    });

    const mapStyle =
        selectedStyle === 'bright'
            ? 'https://tiles.openfreemap.org/styles/bright'
            : 'https://tiles.openfreemap.org/styles/dark';

    const updatedViewState = busLocation
        ? { ...viewState, longitude: busLocation.lng, latitude: busLocation.lat }
        : viewState;

    return (
        <Map
            {...updatedViewState}
            onMove={(evt) => setViewState(evt.viewState)}
            style={{ width: '100%', height: '100%' }}
            mapStyle={mapStyle}
        >
            {busLocation && <Marker longitude={busLocation.lng} latitude={busLocation.lat} color="#ef4444" />}
        </Map>
    );
}
