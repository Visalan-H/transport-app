import { Marker } from 'react-map-gl/maplibre';
import type { BusDetails } from '../../../../types';
import { SEC_Bus_Routes } from '../../constants/BusIdMap';

type BusPopupProps = {
    bus: BusDetails;
    onClose: () => void;
};

export const BusPopup = ({ bus, onClose }: BusPopupProps) => (
    <Marker longitude={bus.lng} latitude={bus.lat} anchor="top">
        <div
            className="bg-card shadow-md border border-border rounded px-2 py-1 backdrop-blur-sm cursor-pointer"
            onClick={onClose}
        >
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
    </Marker>
);
