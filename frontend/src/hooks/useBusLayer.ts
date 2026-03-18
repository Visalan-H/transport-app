import { useMemo } from 'react';
import type { LayerProps } from 'react-map-gl/maplibre';

export const useBusLayerProps = (theme: string): LayerProps => useMemo(() => ({
    id: 'bus-icons',
    type: 'symbol',
    layout: {
        'icon-image': 'bus-icon',
        'icon-size': 1.5,
        'icon-anchor': 'bottom',
        'icon-allow-overlap': true,
        'text-field': ['concat', ['get', 'label'], '\n', ['get', 'timeStr']],
        'text-size': 11,
        'text-offset': [0, 0.5],
        'text-anchor': 'top',
        'text-allow-overlap': false,
        'text-optional': true,
        'text-line-height': 1.4,
    },
    paint: {
        'text-color': theme === 'dark' ? '#ffffff' : '#1f2937',
        'text-halo-color': theme === 'dark' ? '#1f2937' : '#ffffff',
        'text-halo-width': 1.5,
    },
}), [theme]);

export const useBusGeoJSON = (
    validBuses: { id: number; lat: number; lng: number; timestamp: number }[],
    routes: Record<number, string>,
) =>
    useMemo(() => ({
        type: 'FeatureCollection' as const,
        features: validBuses.map(bus => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [bus.lng, bus.lat] },
            properties: {
                id: bus.id,
                label: String(routes[bus.id] || bus.id),
                timestamp: bus.timestamp,
                timeStr: new Date(bus.timestamp).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                }),
            },
        })),
    }), [validBuses, routes]);