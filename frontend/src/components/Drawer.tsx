import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, Star } from 'lucide-react';
import type { BusDetails } from '../../../types';
import { SEC_Bus_Routes } from '@/constants/BusIdMap';
import { LoadingSpinner } from './LoadingSpinner';
import type { MapRef } from 'react-map-gl/maplibre';
import zoomTo from '@/utils/zoomTo';
import { useDelayedVisibility } from '@/hooks/useDelayedVisibility';
import { useFavorites } from '@/hooks/useFavorites';
import { useNow } from '@/hooks/useNow';
import { formatAgo } from '@/utils/formatTime';
import { STALE_AFTER_MS } from '@/hooks/useBusLayer';

type NearbyBus = BusDetails & { distance: number };

type AppDrawerProps = {
    nearbyBuses: NearbyBus[];
    isLoadingLocation?: boolean;
    mapRef: React.RefObject<MapRef | null>;
};

export function AppDrawer({ nearbyBuses, isLoadingLocation, mapRef }: AppDrawerProps) {
    const [expanded, setExpanded] = useState(false);
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const isVisible = useDelayedVisibility({ delayMs: 100 });
    const { favorites, toggle, isFavorite } = useFavorites();
    // Ticks so the "last seen" ages count up even when no new snapshot arrives.
    // Only fast while the list is open -- collapsed, there is nothing on screen
    // that a per-second re-render would change.
    const now = useNow(expanded ? 1000 : 30000);

    // Starred buses first (each group stays in the nearest-first order it came
    // in), so a student's own route sits at the top without losing the
    // distance ordering everyone else relies on.
    const ordered = useMemo(() => {
        const favs = nearbyBuses.filter((b) => favorites.has(b.id));
        const rest = nearbyBuses.filter((b) => !favorites.has(b.id));
        return [...favs, ...rest];
    }, [nearbyBuses, favorites]);

    const shown = favoritesOnly ? ordered.filter((b) => favorites.has(b.id)) : ordered;

    const handleClick = (lat: number, lng: number) => {
        zoomTo({ lat, lng, mapRef });
    };

    return (
        <div
            className={`bg-background border-t border-x mx-2 border-border rounded-t-lg transition-all duration-500 shrink-0 min-h-16 ${
                expanded ? 'h-[45dvh]' : 'h-16'
            } ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
        >
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full h-16 px-4 flex items-center justify-between shrink-0 rounded-t-lg"
            >
                <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-lg">Nearby Buses</h2>
                    {favorites.size > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Star size={12} className="fill-amber-400 text-amber-400" />
                            {favorites.size}
                        </span>
                    )}
                </div>
                {expanded ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
            </button>

            {expanded && (
                <div className="px-4 pb-4 space-y-3 overflow-y-auto h-[calc(100%-4rem)]">
                    {favorites.size > 0 && (
                        <button
                            type="button"
                            onClick={() => setFavoritesOnly((v) => !v)}
                            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                favoritesOnly
                                    ? 'border-amber-400/50 bg-amber-400/10 text-amber-600 dark:text-amber-400'
                                    : 'border-border text-muted-foreground hover:bg-muted'
                            }`}
                        >
                            <Star size={12} className={favoritesOnly ? 'fill-amber-400 text-amber-400' : ''} />
                            {favoritesOnly ? 'Showing favorites' : 'Favorites only'}
                        </button>
                    )}

                    {isLoadingLocation ? (
                        <div className="flex items-center justify-center h-32">
                            <LoadingSpinner text="Finding your location..." size="sm" />
                        </div>
                    ) : shown.length === 0 ? (
                        <div className="flex items-center justify-center h-32">
                            <p className="text-muted-foreground text-sm">
                                {favoritesOnly ? 'None of your favorites are nearby right now' : 'No buses nearby'}
                            </p>
                        </div>
                    ) : (
                        shown.map((bus) => {
                            const stale = now - bus.timestamp > STALE_AFTER_MS;
                            const starred = isFavorite(bus.id);
                            return (
                                <div
                                    key={bus.id}
                                    className="w-full p-3 border border-border rounded flex justify-between items-center gap-2"
                                >
                                    <button
                                        type="button"
                                        onClick={() => handleClick(bus.lat, bus.lng)}
                                        className="flex-1 text-left cursor-pointer min-w-0"
                                    >
                                        {/* Falls back to the raw id for the same reason the map layer
                                            does: an id with no route name still has to be identifiable,
                                            and an empty heading reads as a broken row. */}
                                        <h3 className="font-semibold truncate">{SEC_Bus_Routes[bus.id] || bus.id}</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {(bus.distance * 1000).toFixed(0)} m away
                                            <span className={stale ? 'text-amber-600 dark:text-amber-500' : ''}>
                                                {' · '}
                                                {formatAgo(now - bus.timestamp)}
                                            </span>
                                        </p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => toggle(bus.id)}
                                        aria-label={starred ? 'Remove from favorites' : 'Add to favorites'}
                                        aria-pressed={starred}
                                        className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted"
                                    >
                                        <Star size={18} className={starred ? 'fill-amber-400 text-amber-400' : ''} />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
