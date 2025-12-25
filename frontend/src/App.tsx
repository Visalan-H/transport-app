import { MapComponent } from './components/MapComponent';
import { Header } from './components/Header';
import { AppDrawer } from './components/Drawer';
import { useLocationStream } from './hooks/useLocationStream';
import { useNearbyBus } from './hooks/useNearbyBuses';

export default function App() {
    const buses = useLocationStream();
    const { nearbyBuses, userLocation } = useNearbyBus(buses);

    return (
        <div className="flex flex-col w-screen h-dvh overflow-hidden">
            <Header />
            <div className="flex-1 relative min-h-0 px-2 pb-1.5 will-change-[height]">
                <MapComponent busLocations={buses} userLocation={userLocation} />
            </div>
            <AppDrawer nearbyBuses={nearbyBuses} />
        </div>
    );
}
