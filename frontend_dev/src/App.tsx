import { useState } from 'react';
import { MapComponent } from './components/MapComponent/MapComponent';
import { ThemeToggle } from './components/ThemeToggle/ThemeToggle';
import { useLocationStream } from './hooks/useLocationStream';
import './App.css';

type StyleName = 'bright' | 'dark';

export default function App() {
    const [selectedStyle, setSelectedStyle] = useState<StyleName>('bright');
    const busLocations = useLocationStream();

    return (
        <div className="app-container">
            <MapComponent busLocations={busLocations} selectedStyle={selectedStyle} />
            <ThemeToggle selectedStyle={selectedStyle} onToggle={setSelectedStyle} />
        </div>
    );
}
