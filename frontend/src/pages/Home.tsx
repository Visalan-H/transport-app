import { MapComponent } from '@/components/MapComponent';
import { Header } from '@/components/Header';
import { AppDrawer } from '@/components/Drawer';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useLocationStream } from '@/hooks/useLocationStream';
import { useNearbyBus } from '@/hooks/useNearbyBuses';
import { useRef } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';

export default function Home() {
    const { busLocations, isLoading: isLoadingBuses, error } = useLocationStream();
    const { nearbyBuses, userLocation, isLoadingLocation } = useNearbyBus(busLocations);

    const mapRef = useRef<MapRef>(null);

    if (isLoadingBuses) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <LoadingSpinner text="Fetching bus locations.." size="lg" />
            </div>
        );
    }

    // Show error screen if initial connection failed and no data
    if (error && busLocations.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
                {/* <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" /> */}
                <div className="text-center">
                    <h2 className="text-lg font-semibold text-foreground mb-1">{error}</h2>
                    <p className="text-sm text-muted-foreground">Make sure the server is running</p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 overflow-hidden">
            {error && (
                <div className="mx-2 px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm flex items-center gap-2 mb-2">
                    {/* <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" /> */}
                    {error}
                </div>
            )}
            <div className="flex-1 relative min-h-0 px-2 pb-1.5 will-change-[height]">
                <MapComponent busLocations={busLocations} userLocation={userLocation} mapRef={mapRef} />
            </div>
            <AppDrawer nearbyBuses={nearbyBuses} isLoadingLocation={isLoadingLocation} mapRef={mapRef} />
        </div>
    );
}
