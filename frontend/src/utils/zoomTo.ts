import type { MapRef } from 'react-map-gl/maplibre';

type UseZoomArgs = {
    lat: number;
    lng: number;
    mapRef: React.RefObject<MapRef | null>;
};

export default function zoomTo({ lat, lng, mapRef }: UseZoomArgs) {
    if (mapRef && mapRef.current) {
        mapRef.current.flyTo({
            center: [lng, lat],
            zoom: 17,
            duration: 2000,
        });
    }
}
