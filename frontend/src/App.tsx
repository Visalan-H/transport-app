import { MapComponent } from './components/MapComponent';
import { ThemeToggle } from './components/ThemeToggle';
import { AppDrawer } from './components/Drawer';
import { useLocationStream } from './hooks/useLocationStream';
import { useNearbyBus } from './hooks/useNearbyBuses';

export default function App() {
    const buses = useLocationStream();
    const { nearbyBuses, userLocation } = useNearbyBus(buses);

    return (
        <div className="flex flex-col w-screen overflow-hidden" style={{ height: '100dvh' }}>
            <div className="flex-1 relative min-h-0">
                <MapComponent busLocations={buses} userLocation={userLocation} />
                <ThemeToggle />
            </div>
            <AppDrawer nearbyBuses={nearbyBuses} />
        </div>
    );
}
