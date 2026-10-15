import { useSyncExternalStore } from 'react';
import { fetchBuses } from '@/utils/busesApi';

export type BusNames = Readonly<Record<number, string>>;

const EMPTY: BusNames = {};

// One shared store for every reader on the page. The map layer and the drawer each used to run their
// own retry loop, so a failing endpoint got one request per reader per round; now there is a single
// request and a single backoff, and every reader updates the moment it lands.
let cached: BusNames | null = null;
// Set by forgetBuses: the names still show, but the next reader to subscribe fetches a fresh copy.
let stale = false;
let inflight = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retryDelay = 5_000;
const listeners = new Set<() => void>();

const fetchNow = () => {
    if (inflight) return;
    inflight = true;
    fetchBuses().then(
        ({ data }) => {
            inflight = false;
            cached = Object.fromEntries((data.buses ?? []).map((b) => [b.id, b.name]));
            stale = false;
            retryDelay = 5_000;
            listeners.forEach((notify) => notify());
        },
        () => {
            inflight = false;
            // Retries only while someone is reading, backing off to once a minute: a map left open on
            // a failed first fetch would otherwise show bare ids until the student reloads.
            if (listeners.size === 0) return;
            retryTimer = setTimeout(() => {
                retryTimer = undefined;
                fetchNow();
            }, retryDelay);
            retryDelay = Math.min(retryDelay * 2, 60_000);
        },
    );
};

const subscribe = (notify: () => void) => {
    listeners.add(notify);
    if ((!cached || stale) && retryTimer === undefined) fetchNow();
    return () => {
        listeners.delete(notify);
        if (listeners.size === 0 && retryTimer !== undefined) {
            clearTimeout(retryTimer);
            retryTimer = undefined;
        }
    };
};

const getSnapshot = () => cached ?? EMPTY;

/** Bus id -> route name, from the server. Empty until loaded, so readers must fall back to the id. */
export const useBuses = (): BusNames => useSyncExternalStore(subscribe, getSnapshot);

/** For the admin page: after an add or rename, the map and drawer should show the new name. */
export const forgetBuses = () => {
    stale = true;
};
