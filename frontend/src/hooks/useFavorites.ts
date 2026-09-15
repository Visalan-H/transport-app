import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'polaris:favorite-buses';

/**
 * Bus ids a student has starred, remembered in localStorage so their route is
 * still pinned next time they open the app. It is a per-device convenience, not
 * shared state -- nothing here reaches the server -- so every access is guarded:
 * a private window or blocked storage just yields an empty, in-memory set.
 */
const read = (): Set<number> => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? new Set(parsed.filter((n) => typeof n === 'number')) : new Set();
    } catch {
        return new Set();
    }
};

const write = (ids: Set<number>) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } catch {
        // Storage full or unavailable -- the in-memory set still works for this session.
    }
};

export function useFavorites() {
    const [favorites, setFavorites] = useState<Set<number>>(read);

    // Keep two tabs in sync: starring a bus in one updates the list in the other.
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) setFavorites(read());
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const toggle = useCallback((id: number) => {
        setFavorites((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            write(next);
            return next;
        });
    }, []);

    const isFavorite = useCallback((id: number) => favorites.has(id), [favorites]);

    return { favorites, toggle, isFavorite };
}
