import { BusMarker } from './BusMarker';
import { SEC_Bus_Routes } from '../constants/BusIdMap';
import { memo } from 'react';
import { Marker, type MapRef } from 'react-map-gl/maplibre';
import type { BusDetails } from '../../../types';
import { useCallback } from 'react';
import useZoom from '@/utils/zoomTo';

type BusMarkerItemProps = {
    bus: BusDetails;
    mapRef: React.RefObject<MapRef | null>;
};

const BusMarkerItem = memo(
    ({ bus, mapRef }: BusMarkerItemProps) => {
        const zoomToLocation = useCallback(() => useZoom({ lat: bus.lat, lng: bus.lng, mapRef }), [bus, mapRef]);

        return (
            <Marker longitude={bus.lng} latitude={bus.lat} anchor="bottom" onClick={zoomToLocation}>
                <div className="flex flex-col items-center gap-1 cursor-pointer">
                    <BusMarker />
                    <div className="bg-card shadow-md border border-border rounded px-2 py-1 backdrop-blur-sm">
                        <div className="text-xs font-semibold text-card-foreground tracking-wide font-sans">
                            {SEC_Bus_Routes[bus.id] || bus.id}
                        </div>
                        <div className="text-[11px] text-muted-foreground text-center font-light">
                            {new Date(bus.timestamp).toLocaleTimeString(undefined, {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                            })}
                        </div>
                    </div>
                </div>
            </Marker>
        );
    },
    (prev, next) =>
        prev.bus.id === next.bus.id &&
        prev.bus.lat === next.bus.lat &&
        prev.bus.lng === next.bus.lng &&
        prev.bus.timestamp === next.bus.timestamp,
);

export default BusMarkerItem;
