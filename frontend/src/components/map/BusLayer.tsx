import { Source, Layer } from 'react-map-gl/maplibre';
import type { BusDetails } from '../../../../types';
import { SEC_Bus_Routes } from '../../constants/BusIdMap';
import { useBusLayerProps, useBusGeoJSON } from '../../hooks/useBusLayer';

type BusLayerProps = {
    buses: BusDetails[];
    theme: string;
};

export const BusLayer = ({ buses, theme }: BusLayerProps) => {
    const layerProps = useBusLayerProps(theme);
    const geojson = useBusGeoJSON(buses, SEC_Bus_Routes);

    return (
        <Source id="buses" type="geojson" data={geojson}>
            <Layer {...layerProps} />
        </Source>
    );
};
