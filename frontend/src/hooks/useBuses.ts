import { useEffect, useState } from 'react';
import { fetchBuses } from '@/utils/busesApi';

export type BusNames = Readonly<Record<number, string>>;

const EMPTY: BusNames = {};

// One request per page load, shared by every component that asks. A failed request is forgotten
// so the next mount can try again; until one succeeds, callers fall back to showing the raw id.
let cached: BusNames | null = null;
let inflight: Promise<BusNames> | null = null;

const load = (): Promise<BusNames> => {
    inflight ??= fetchBuses()
        .then(({ data }) => {
            cached = Object.fromEntries((data.buses ?? []).map((b) => [b.id, b.name]));
            return cached;
        })
        .catch((err: unknown) => {
            inflight = null;
            throw err;
        });
    return inflight;
};

/** Bus id -> route name, from the server. Empty until loaded, so readers must fall back to the id. */
export function useBuses(): BusNames {
    const [names, setNames] = useState<BusNames>(cached ?? EMPTY);

    useEffect(() => {
        if (cached) return;
        let live = true;
        load().then(
            (loaded) => live && setNames(loaded),
            () => {},
        );
        return () => {
            live = false;
        };
    }, []);

    return names;
}

/** For the admin page: after an add or rename, the map and drawer should show the new name. */
export const forgetBuses = () => {
    cached = null;
    inflight = null;
};
