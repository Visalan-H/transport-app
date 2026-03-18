import { Marker } from 'react-map-gl/maplibre';

type UserLocationMarkerProps = {
    location: { lat: number; lng: number };
};

export const UserLocationMarker = ({ location }: UserLocationMarkerProps) => (
    <Marker longitude={location.lng} latitude={location.lat}>
        <div className="flex flex-col items-center gap-1">
            <div className="bg-card shadow-md border border-border rounded px-2 py-1 backdrop-blur-sm">
                <div className="text-xs font-semibold text-card-foreground tracking-wide">My Location</div>
            </div>
            <div className="relative h-10 w-10">
                <span className="absolute inset-0 m-auto h-full w-full animate-ping rounded-full bg-blue-400 opacity-40" />
                <div className="absolute inset-0 m-auto h-3 w-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/80" />
            </div>
        </div>
    </Marker>
);
