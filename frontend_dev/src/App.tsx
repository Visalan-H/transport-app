import { useState } from 'react';
import { MapComponent } from './components/MapComponent';
import { ThemeToggle } from './components/ThemeToggle';
import { useLocationStream } from './hooks/useLocationStream';

type StyleName = 'bright' | 'dark';

export default function App() {
    const [selectedStyle, setSelectedStyle] = useState<StyleName>('bright');
    const busLocation = useLocationStream();

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
            <MapComponent busLocation={busLocation} selectedStyle={selectedStyle} />
            <ThemeToggle selectedStyle={selectedStyle} onToggle={setSelectedStyle} />
        </div>
    );
}
