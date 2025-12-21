import type { BusDetails } from '../types';

const BUS_COUNT = 60;
const INTERVAL = 5000; // 2 seconds

const buses: BusDetails[] = Array.from({ length: BUS_COUNT }, (_, i) => ({
    name: `bus${i + 1}`,
    lat: 13.0827 + (Math.random() - 0.5) * 0.02,
    lng: 80.2707 + (Math.random() - 0.5) * 0.02,
    timestamp: Date.now(),
}));

const moveBus = (bus: BusDetails) => {
    // simple random walk (good enough for demo)
    bus.lat += (Math.random() - 0.5) * 0.0008;
    bus.lng += (Math.random() - 0.5) * 0.0008;
    bus.timestamp = Date.now(); // IMPORTANT
};

const simulateMovement = () => {
    buses.forEach(moveBus);

    // fire all updates concurrently
    buses.forEach((bus) =>
        fetch('http://localhost:4000/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bus),
        }).catch(() => {}),
    );

    console.log(
        `${new Date().toLocaleTimeString()} sent ${BUS_COUNT} updates`,
        buses
            .slice(0, 3)
            .map((b) => `${b.name}: (${b.lat.toFixed(4)}, ${b.lng.toFixed(4)})`)
            .join(' | '),
    );
};

console.log(`Simulating ${BUS_COUNT} buses`);
setInterval(simulateMovement, INTERVAL);
