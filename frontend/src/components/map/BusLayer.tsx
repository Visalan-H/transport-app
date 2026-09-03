import { Source, Layer } from 'react-map-gl/maplibre';
import type { TrackedBus } from '@/utils/busFacing';
import { SEC_Bus_Routes } from '../../constants/BusIdMap';
import { useBusLayerProps, useBusGeoJSON } from '../../hooks/useBusLayer';
import { useNow } from '../../hooks/useNow';

type BusLayerProps = {
    buses: TrackedBus[];
    theme: string;
};

export const BusLayer = ({ buses, theme }: BusLayerProps) => {
    const layerProps = useBusLayerProps(theme);
    // Ticks independently of SSE data so a bus greys out even if no new
    // snapshot arrives (the stream dedupes unchanged snapshots, see
    // useLocationStream's hasBusSnapshotChanged).
    const now = useNow(5000);
    const geojson = useBusGeoJSON(buses, SEC_Bus_Routes, now);

    return (
        <Source id="buses" type="geojson" data={geojson}>
            <Layer {...layerProps} />
        </Source>
    );
};
