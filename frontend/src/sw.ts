/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

type TrackingPayload = { busId: string; lat: number; lng: number };

const SEND_INTERVAL = 5000;
let latestCoords: TrackingPayload | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

function sendUpdate() {
    if (!latestCoords) return;
    const { busId, lat, lng } = latestCoords;
    const timestamp = Date.now();

    self.fetch('/update', {
        method: 'POST',
        credentials: 'include',
        body: `${busId},${lat},${lng},${timestamp}`,
    })
        .then(() => {
            self.clients.matchAll().then((clients) => {
                clients.forEach((c) => c.postMessage({ type: 'UPDATE_SENT', timestamp }));
            });
        })
        .catch(() => { });
}

function startInterval() {
    if (intervalId) return;
    intervalId = setInterval(sendUpdate, SEND_INTERVAL);
}

function stopInterval() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

self.addEventListener('message', (event: ExtendableMessageEvent) => {
    const data = event.data as { type: string } & Partial<TrackingPayload>;
    const { type, busId, lat, lng } = data;

    switch (type) {
        case 'START_TRACKING':
            if (busId && lat !== undefined && lng !== undefined) {
                latestCoords = { busId, lat, lng };
                startInterval();
            }
            break;

        case 'UPDATE_COORDS':
            if (lat !== undefined && lng !== undefined) {
                if (latestCoords) {
                    // Normal update
                    latestCoords = { ...latestCoords, lat, lng };
                } else if (busId) {
                    // SW was killed and restarted — busId included so we can recover
                    latestCoords = { busId, lat, lng };
                    startInterval();
                }
                // If neither, we genuinely can't recover — page will re-send START_TRACKING on next visibility
            }
            break;

        case 'STOP_TRACKING':
            latestCoords = null;
            stopInterval();
            break;

        case 'PING':
            // Keeps SW alive + restarts interval if it died
            if (latestCoords && !intervalId) {
                startInterval();
            }
            break;
    }
});