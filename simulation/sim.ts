import type { BusDetails, BusText } from '../types';

const BUS_COUNT = 100;
const INTERVAL = 5000;
const TARGET_URL = Bun.env.TARGET_URL || 'http://localhost:4000/update';
const GPS_API_KEY = Bun.env.GPS_API_KEY;

if (!GPS_API_KEY) throw new Error('GPS_API_KEY is not set');

let failedRequests = 0;

const buses: BusDetails[] = Array.from({ length: BUS_COUNT }, (_, i) => ({
    id: i + 1,
    lat: 13.0827 + (Math.random() - 0.5) * 0.02,
    lng: 80.2707 + (Math.random() - 0.5) * 0.02,
    timestamp: Date.now(),
}));

const moveBus = (bus: BusDetails) => {
    bus.lat += (Math.random() - 0.5) * 0.0008;
    bus.lng += (Math.random() - 0.5) * 0.0008;
    bus.timestamp = Date.now();
};

const simulateMovement = () => {
    buses.forEach(moveBus);
    console.log(`[SIM] sending ${BUS_COUNT} updates to ${TARGET_URL}`);

    buses.forEach((bus) => {
        const payload: BusText = `${bus.id},${bus.lat},${bus.lng},${bus.timestamp}`;

        fetch(TARGET_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain', 'x-api-key': GPS_API_KEY! },
            body: payload,
        }).catch((error) => {
            failedRequests++;
            if (failedRequests % 50 === 1) {
                console.error(`[SIM] failed to send to ${TARGET_URL} (failures: ${failedRequests})`, error);
            }
        });
    });
};

console.log(`Simulating ${BUS_COUNT} buses`);
setInterval(simulateMovement, INTERVAL);