import { useCallback, useEffect, useRef, useState } from 'react';
import { SEC_Bus_Routes } from '@/constants/BusIdMap';

// ─── Types ────────────────────────────────────────────────────────────────────

type TrackingState = 'idle' | 'requesting' | 'tracking' | 'error';
type Coordinates = { lat: number; lng: number; accuracy: number };
type Lang = 'en' | 'ta';

type NavigatorWithWakeLock = Navigator & {
    wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> };
};

// ─── Translations ─────────────────────────────────────────────────────────────

const translations = {
    en: {
        title: 'Driver Mode',
        subtitle: 'Your location will be shared with students',
        busNumber: 'Bus number',
        selectBus: 'Select your bus',
        busSearch: 'Search routes...',
        noRoutes: 'No routes found',
        statusBroadcasting: 'Broadcasting live',
        statusGetting: 'Getting location...',
        statusError: 'Error',
        statusIdle: 'Not broadcasting',
        btnStart: 'Start broadcasting',
        btnStop: 'Stop broadcasting',
        btnPending: 'Getting location...',
        errorNoBus: 'Select your bus first',
        errorNoGeo: 'Geolocation is not supported on this device',
        errCodes: {
            1: 'Location permission denied. Enable it in your browser settings.',
            2: 'Location unavailable. Check your GPS signal.',
            3: 'Location request timed out. Try again.',
        },
        updatesSent: 'Updates sent',
        lastSent: 'Last sent',
        keepScreen: "Keep your screen on — your browser doesn't support automatic screen lock prevention.",
    },
    ta: {
        title: 'ஓட்டுநர் பயன்முறை',
        subtitle: 'உங்கள் இருப்பிடம் மாணவர்களுக்கு அனுப்பப்படும்',
        busNumber: 'பேருந்து எண்',
        selectBus: 'உங்கள் பேருந்தை தேர்வு செய்யவும்',
        busSearch: 'வழிகளை தேடவும்...',
        noRoutes: 'வழிகள் எதுவும் இல்லை',
        statusBroadcasting: 'நேரடி ஒளிபரப்பு இயங்குகிறது',
        statusGetting: 'இருப்பிடம் கண்டறிகிறது...',
        statusError: 'பிழை',
        statusIdle: 'ஒளிபரப்பு இல்லை',
        btnStart: 'தொடங்கு',
        btnStop: 'நிறுத்து',
        btnPending: 'இருப்பிடம் கண்டறிகிறது...',
        errorNoBus: 'பேருந்தை தேர்வு செய்யவும்',
        errorNoGeo: 'இந்த சாதனத்தில் இருப்பிட சேவை இல்லை',
        errCodes: {
            1: 'இருப்பிட அனுமதி மறுக்கப்பட்டது. உலாவி அமைப்பில் இயக்கவும்.',
            2: 'இருப்பிடம் கிடைக்கவில்லை. GPS சரிபார்க்கவும்.',
            3: 'நேரம் முடிந்தது. மீண்டும் முயற்சிக்கவும்.',
        },
        updatesSent: 'அனுப்பிய புதுப்பிப்புகள்',
        lastSent: 'கடைசியாக அனுப்பியது',
        keepScreen: 'திரையை அணைக்காதீர்கள். இந்த உலாவி wake lock ஆதரிக்காது.',
    },
} as const;

type Translation = (typeof translations)[Lang];

// ─── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'polaris_tracking_session';

function saveSession(busId: string) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ busId }));
}

function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
}

function loadSession(): { busId: string } | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}
// ─── SW messaging ─────────────────────────────────────────────────────────────

async function postToSW(message: Record<string, unknown>) {
    if (!('serviceWorker' in navigator)) return;
    try {
        const reg = await navigator.serviceWorker.ready;
        const target = navigator.serviceWorker.controller ?? reg.active;
        target?.postMessage(message);
    } catch {}
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type StatusBadgeProps = {
    isTracking: boolean;
    isPending: boolean;
    state: TrackingState;
    isTamil: boolean;
    t: Translation;
};

type BusSelectorProps = {
    busId: string;
    isDisabled: boolean;
    isTamil: boolean;
    t: Translation;
    onChange: (id: string) => void;
};

type TrackingButtonProps = {
    isTracking: boolean;
    isPending: boolean;
    isTamil: boolean;
    t: Translation;
    onClick: () => void;
};

type LiveStatsProps = {
    updateCount: number;
    lastUpdated: Date | null;
    isTamil: boolean;
    t: Translation;
};

function StatusBadge({ isTracking, isPending, state, isTamil, t }: StatusBadgeProps) {
    const label = isTracking
        ? t.statusBroadcasting
        : isPending
          ? t.statusGetting
          : state === 'error'
            ? t.statusError
            : t.statusIdle;

    const colorClass = isTracking
        ? 'bg-green-100/60 text-green-800 border-green-300 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800/50'
        : isPending
          ? 'bg-amber-100/60 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50'
          : state === 'error'
            ? 'bg-destructive/10 text-destructive border-destructive/30'
            : 'bg-secondary text-secondary-foreground border-border/60';

    return (
        <div
            className={`rounded-2xl px-4 py-3 border-2 font-bold text-center transition-colors shadow-sm ${isTamil ? 'text-sm' : 'text-base'} ${colorClass}`}
        >
            {label}
        </div>
    );
}

function BusSelector({ busId, isDisabled, t, onChange }: BusSelectorProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const options = Object.entries(SEC_Bus_Routes)
        .filter(([, name]) => name.toLowerCase().includes(search.toLowerCase()))
        .sort(([a], [b]) => Number(a) - Number(b));

    const selectedName = busId ? SEC_Bus_Routes[Number(busId)] : null;

    return (
        <div className="rounded-2xl border border-border/60 bg-background/50 p-4 shadow-sm relative">
            <p className="text-sm font-semibold text-muted-foreground mb-2 px-1">{t.busNumber}</p>
            <button
                type="button"
                disabled={isDisabled}
                onClick={() => setOpen((o) => !o)}
                className="w-full h-14 rounded-xl border-2 border-border/60 bg-card px-4 text-left flex items-center justify-between font-bold text-lg focus:outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10 disabled:opacity-60 transition-all shadow-inner"
            >
                <span className={selectedName ? 'text-foreground' : 'text-muted-foreground text-base font-normal'}>
                    {selectedName ?? t.selectBus}
                </span>
                <svg
                    className={`w-5 h-5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div className="absolute left-4 right-4 top-[calc(100%-0.5rem)] z-50 mt-1 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-border/50">
                        <input
                            autoFocus
                            type="text"
                            placeholder={t.busSearch}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
                        />
                    </div>
                    <ul className="max-h-52 overflow-y-auto divide-y divide-border/30">
                        {options.length === 0 ? (
                            <li className="px-4 py-3 text-sm text-muted-foreground text-center">{t.noRoutes}</li>
                        ) : (
                            options.map(([id, name]) => (
                                <li key={id}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onChange(id);
                                            setOpen(false);
                                            setSearch('');
                                        }}
                                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-secondary/60 transition-colors ${busId === id ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                                    >
                                        {name}
                                    </button>
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}

function TrackingButton({ isTracking, isPending, isTamil, t, onClick }: TrackingButtonProps) {
    const label = isTracking ? t.btnStop : isPending ? t.btnPending : t.btnStart;
    const colorClass = isTracking
        ? 'bg-destructive text-destructive-foreground shadow-destructive/40'
        : 'bg-primary text-primary-foreground shadow-primary/40';

    return (
        <button
            onClick={onClick}
            disabled={isPending}
            className={`aspect-square w-56 sm:w-64 rounded-full shadow-2xl transition-all duration-300 disabled:opacity-60 flex items-center justify-center px-6 text-center hover:scale-105 active:scale-95 ${isTamil ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl md:text-3xl'} font-extrabold tracking-wide ${colorClass}`}
        >
            <span className="w-full wrap-break-word leading-snug">{label}</span>
        </button>
    );
}

function LiveStats({ updateCount, lastUpdated, isTamil, t }: LiveStatsProps) {
    return (
        <div className="rounded-2xl border border-border bg-background px-4 py-3 space-y-2 text-base">
            <div className="flex justify-between">
                <span className={`text-muted-foreground ${isTamil ? 'text-sm' : ''}`}>{t.updatesSent}</span>
                <span className="font-bold text-foreground">{updateCount}</span>
            </div>
            {lastUpdated && (
                <div className="flex justify-between">
                    <span className={`text-muted-foreground ${isTamil ? 'text-sm' : ''}`}>{t.lastSent}</span>
                    <span className="font-semibold text-foreground">{lastUpdated.toLocaleTimeString()}</span>
                </div>
            )}
        </div>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

type UseDriverTrackingOptions = {
    busId: string;
    noBusError: string;
    noGeoError: string;
    geolocationErrorMessages: Record<number, string>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useDriverTracking({ busId, noBusError, noGeoError, geolocationErrorMessages }: UseDriverTrackingOptions) {
    const [state, setState] = useState<TrackingState>('idle');
    const [coords, setCoords] = useState<Coordinates | null>(null);
    const [error, setError] = useState('');
    const [updateCount, setUpdateCount] = useState(0);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const watchIdRef = useRef<number | null>(null);
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);
    const activeBusIdRef = useRef('');
    const isTrackingRef = useRef(false);
    const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Listen for UPDATE_SENT from SW
    useEffect(() => {
        const handler = (e: MessageEvent) => {
            if (e.data?.type === 'UPDATE_SENT') {
                setUpdateCount((c) => c + 1);
                setLastUpdated(new Date(e.data.timestamp));
            }
        };
        navigator.serviceWorker?.addEventListener('message', handler);
        return () => navigator.serviceWorker?.removeEventListener('message', handler);
    }, []);

    const releaseWakeLock = useCallback(() => {
        wakeLockRef.current?.release().catch(() => {});
        wakeLockRef.current = null;
    }, []);

    const acquireWakeLock = useCallback(async () => {
        try {
            const nav = navigator as NavigatorWithWakeLock;
            if (nav.wakeLock) wakeLockRef.current = await nav.wakeLock.request('screen');
        } catch {}
    }, []);

    const stopPing = useCallback(() => {
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
        }
    }, []);

    const startPing = useCallback(() => {
        stopPing();
        // Ping SW every 20s to keep it alive and let it self-heal if interval died
        pingIntervalRef.current = setInterval(() => {
            postToSW({ type: 'PING' });
        }, 20000);
    }, [stopPing]);

    const stopTracking = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        isTrackingRef.current = false;
        stopPing();
        postToSW({ type: 'STOP_TRACKING' });
        clearSession();
        releaseWakeLock();
        activeBusIdRef.current = '';
        setState('idle');
        setCoords(null);
        setUpdateCount(0);
        setLastUpdated(null);
    }, [releaseWakeLock, stopPing]);

    const startTracking = useCallback(
        async (overrideBusId?: string) => {
            const trimmedId = (overrideBusId ?? busId).trim();
            if (!trimmedId) { setError(noBusError); return; }
            if (!navigator.geolocation) { setError(noGeoError); return; }

            activeBusIdRef.current = trimmedId;
            setError('');
            setState('requesting');
            await acquireWakeLock();

            watchIdRef.current = navigator.geolocation.watchPosition(
                (position) => {
                    const { latitude: lat, longitude: lng, accuracy } = position.coords;
                    setCoords({ lat, lng, accuracy });
                    setState('tracking');

                    if (!isTrackingRef.current) {
                        isTrackingRef.current = true;
                        // First fix — start SW interval
                        postToSW({ type: 'START_TRACKING', busId: activeBusIdRef.current, lat, lng });
                        saveSession(activeBusIdRef.current);
                        startPing();
                    } else {
                        // ← always include busId so SW can recover if it was killed
                        postToSW({ type: 'UPDATE_COORDS', busId: activeBusIdRef.current, lat, lng });
                    }
                },
                (geolocationError) => {
                    const message = geolocationErrorMessages[geolocationError.code] ?? geolocationError.message;
                    setError(message);
                    setState('error');
                    releaseWakeLock();
                    stopPing();
                    postToSW({ type: 'STOP_TRACKING' });
                    clearSession();
                    isTrackingRef.current = false;
                    watchIdRef.current = null;
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
            );
        },
        [acquireWakeLock, busId, geolocationErrorMessages, noBusError, noGeoError, releaseWakeLock, startPing, stopPing],
    );

    // Auto-resume on reload — wait for SW to be ready before calling startTracking
    useEffect(() => {
        const session = loadSession();
        if (!session) return;

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(() => {
                startTracking(session.busId);
            });
        } else {
            startTracking(session.busId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // On tab visible: re-send START_TRACKING in case SW was killed while away
    useEffect(() => {
        const handleVisibility = async () => {
            if (document.visibilityState === 'visible' && watchIdRef.current !== null) {
                await acquireWakeLock();
                // Force re-announce to SW in case it was restarted while we were away
                if (activeBusIdRef.current) {
                    isTrackingRef.current = false; // triggers START_TRACKING on next GPS tick
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [acquireWakeLock]);

    useEffect(() => {
        if (state !== 'tracking') return;
        const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [state]);

    useEffect(() => () => stopTracking(), [stopTracking]);

    return {
        coords,
        error,
        isPending: state === 'requesting',
        isTracking: state === 'tracking',
        lastUpdated,
        startTracking: () => startTracking(),
        state,
        stopTracking,
        updateCount,
    };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Driver() {
    const [busId, setBusId] = useState('');
    const [lang, setLang] = useState<Lang>('en');
    const t = translations[lang];
    const isTamil = lang === 'ta';

    const { coords, error, isPending, isTracking, lastUpdated, startTracking, state, stopTracking, updateCount } =
        useDriverTracking({
            busId,
            noBusError: t.errorNoBus,
            noGeoError: t.errorNoGeo,
            geolocationErrorMessages: t.errCodes,
        });

    return (
        <div className="h-full min-h-0 bg-background text-foreground p-3 md:p-6 flex items-center justify-center">
            <div className="w-full max-w-md rounded-3xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl p-5 md:p-6 min-h-[78dvh] flex flex-col">
                {/* Header */}
                <div className="flex flex-col gap-3 pb-5 border-b border-border/50 relative">
                    <div className="absolute right-0 top-0">
                        <button
                            type="button"
                            onClick={() => setLang((l) => (l === 'en' ? 'ta' : 'en'))}
                            className="group flex h-9 items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 text-xs font-bold shadow-sm transition-all hover:bg-secondary/80"
                        >
                            <span
                                className={`transition-colors uppercase tracking-wider ${lang === 'en' ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}
                            >
                                EN
                            </span>
                            <span className="text-border/80 font-normal">|</span>
                            <span
                                className={`transition-colors uppercase tracking-wider ${lang === 'ta' ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}
                            >
                                TA
                            </span>
                        </button>
                    </div>
                    <div className="text-left w-full pt-1 pr-24">
                        <h1
                            className={`font-extrabold text-foreground tracking-tight leading-tight mb-1.5 ${isTamil ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'}`}
                        >
                            {t.title}
                        </h1>
                        <p
                            className={`font-medium text-muted-foreground leading-relaxed ${isTamil ? 'text-xs' : 'text-sm'}`}
                        >
                            {t.subtitle}
                        </p>
                    </div>
                </div>

                {/* Body */}
                <div className="space-y-4 mt-5">
                    <BusSelector
                        busId={busId}
                        isDisabled={isTracking || isPending}
                        isTamil={isTamil}
                        t={t}
                        onChange={setBusId}
                    />

                    <StatusBadge isTracking={isTracking} isPending={isPending} state={state} isTamil={isTamil} t={t} />

                    {error && (
                        <p className="text-destructive text-sm font-bold bg-destructive/10 border-2 border-destructive/20 rounded-xl px-4 py-3 text-center">
                            {error}
                        </p>
                    )}
                </div>

                {/* Button */}
                <div className="flex-1 flex items-center justify-center py-6 min-h-60">
                    <TrackingButton
                        isTracking={isTracking}
                        isPending={isPending}
                        isTamil={isTamil}
                        t={t}
                        onClick={isTracking ? stopTracking : startTracking}
                    />
                </div>

                {/* Stats */}
                <div className="space-y-3">
                    {isTracking && coords && (
                        <LiveStats updateCount={updateCount} lastUpdated={lastUpdated} isTamil={isTamil} t={t} />
                    )}
                    {isTracking && !('wakeLock' in navigator) && (
                        <p
                            className={`text-amber-700 dark:text-amber-300 text-center ${isTamil ? 'text-xs' : 'text-sm'}`}
                        >
                            {t.keepScreen}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
