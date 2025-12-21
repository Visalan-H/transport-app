const BUS_COUNT = 60;

type Bus = {
    name: string;
    lat: number;
    lng: number;
};

const buses: Bus[] = Array.from({ length: BUS_COUNT }, (_, i) => ({
    name: `bus${i + 1}`,
    lat: 13.0827 + (Math.random() - 0.5) * 0.02,
    lng: 80.2707 + (Math.random() - 0.5) * 0.02,
}));

const simulateMovement = async () => {
    // Move all buses first
    buses.forEach((bus) => {
        bus.lat += (Math.random() - 0.5) * 0.002;
        bus.lng += (Math.random() - 0.5) * 0.002;
    });

    // Fire 60 requests WITHOUT WAITING (realistic)
    buses.forEach((bus) =>
        fetch('http://localhost:3000/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bus),
        }).catch((e) => console.error(`Failed ${bus.name}:`, e)),
    );

    console.log(
        `${new Date().toLocaleTimeString()} Fired ${BUS_COUNT} bus updates`,
        buses
            .slice(0, 3)
            .map((b) => `${b.name}: (${b.lat.toFixed(4)}, ${b.lng.toFixed(4)})`)
            .join(' | '),
    );
};

console.log(`Starting simulation of ${BUS_COUNT} buses...`);
setInterval(simulateMovement, 2000);
