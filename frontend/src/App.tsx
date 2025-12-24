import { MapComponent } from './components/MapComponent';
import { ThemeToggle } from './components/ThemeToggle';
import { AppDrawer } from './components/Drawer';
import { useLocationStream } from './hooks/useLocationStream';

export default function App() {
    const buses = useLocationStream();

    return (
        <div className="relative w-screen h-screen">
            <MapComponent busLocations={buses} />
            <ThemeToggle />
            <AppDrawer />
        </div>
    );
}
