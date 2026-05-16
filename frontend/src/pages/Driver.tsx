import { useCallback, useEffect, useRef, useState } from 'react';
import { SEC_Bus_Routes } from '@/constants/BusIdMap';

// ─── Types ────────────────────────────────────────────────────────────────────

type TrackingState = 'idle' | 'requesting' | 'tracking' | 'error';
type ErrorKind = 'permission' | 'location_off' | 'generic' | null;
type Coordinates = { lat: number; lng: number; accuracy: number };
type Lang = 'en' | 'ta';

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
        btnRetry: 'Try again',
        btnCancel: 'Cancel',
        errorNoBus: 'Select your bus first',
        updatesSent: 'Updates sent',
        lastSent: 'Last sent',
        permissionTitle: 'Location permission needed',
        permissionBody:
            'Polaris needs location access to broadcast to students. Allow location in your browser when prompted.',
        permissionBtn: 'Allow in browser',
        locationOffTitle: 'Location is turned off',
        locationOffBody: 'Your device location is disabled. Enable location services in your OS or browser settings.',
        locationOffBtn: 'Check browser settings',
        genericErrorTitle: 'Location error',
        genericErrorBody: 'Something went wrong getting your location.',
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
        btnRetry: 'மீண்டும் முயற்சி',
        btnCancel: 'ரத்து செய்',
        errorNoBus: 'பேருந்தை தேர்வு செய்யவும்',
        updatesSent: 'அனுப்பிய புதுப்பிப்புகள்',
        lastSent: 'கடைசியாக அனுப்பியது',
        permissionTitle: 'இருப்பிட அனுமதி தேவை',
        permissionBody: 'மாணவர்களுக்கு ஒளிபரப்ப Polaris உங்கள் இருப்பிட அனுமதி தேவை. உலாவியில் அனுமதிக்கவும்.',
        permissionBtn: 'உலாவியில் அனுமதிக்கவும்',
        locationOffTitle: 'இருப்பிடம் அணைக்கப்பட்டுள்ளது',
        locationOffBody: 'உங்கள் சாதன இருப்பிடம் முடக்கப்பட்டுள்ளது. OS அல்லது உலாவி அமைப்புகளில் இயக்கவும்.',
        locationOffBtn: 'உலாவி அமைப்புகளை சரிபார்க்கவும்',
        genericErrorTitle: 'இருப்பிட பிழை',
        genericErrorBody: 'இருப்பிடம் கண்டறிவதில் பிரச்சனை ஏற்பட்டது.',
    },
} as const;

type Translation = (typeof translations)[Lang];

// ─── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'polaris_tracking_session';
const JWT_KEY = 'polaris_driver_jwt';

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

function saveJwt(token: string): void {
    localStorage.setItem(JWT_KEY, token);
}
function loadJwt(): string | null {
    return localStorage.getItem(JWT_KEY);
}

// ─── Geo helpers ──────────────────────────────────────────────────────────────

function getCurrentPosition(opts: PositionOptions = {}): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, opts));
}

/**
 * Maps the standard Web Geolocation API error codes to the app's ErrorKind.
 *  1 → PERMISSION_DENIED  → 'permission'
 *  2 → POSITION_UNAVAILABLE → 'location_off'
 *  3 → TIMEOUT            → 'generic'
 */
function classifyGeoError(err: GeolocationPositionError | null): ErrorKind {
    if (!err) return 'generic';
    if (err.code === GeolocationPositionError.PERMISSION_DENIED) return 'permission';
    if (err.code === GeolocationPositionError.POSITION_UNAVAILABLE) return 'location_off';
    return 'generic';
}

// ─── Sub-component types ──────────────────────────────────────────────────────

type StatusBadgeProps = { isTracking: boolean; isPending: boolean; state: TrackingState; t: Translation };
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
    onCancel: () => void;
};
type LiveStatsProps = { updateCount: number; lastUpdated: Date | null; isTamil: boolean; t: Translation };
type ErrorPromptProps = { kind: ErrorKind; t: Translation; isTamil: boolean; onRetry: () => void };

// ─── Error Prompt ─────────────────────────────────────────────────────────────

function ErrorPrompt({ kind, t, isTamil, onRetry }: ErrorPromptProps) {
    // On web there's no deep-link to OS settings; nudge the user via an alert.
    const openBrowserSettings = () => {
        if ('permissions' in navigator) {
            navigator.permissions
                .query({ name: 'geolocation' })
                .then(() =>
                    alert('Please allow location access in your browser address bar or site settings, then try again.'),
                )
                .catch(() => {});
        } else {
            alert('Please allow location access in your browser settings, then try again.');
        }
    };

    const isPermission = kind === 'permission';
    const isLocationOff = kind === 'location_off';

    const title = isPermission ? t.permissionTitle : isLocationOff ? t.locationOffTitle : t.genericErrorTitle;
    const body = isPermission ? t.permissionBody : isLocationOff ? t.locationOffBody : t.genericErrorBody;
    const settingsLabel = isPermission ? t.permissionBtn : isLocationOff ? t.locationOffBtn : null;

    return (
        <div className="flex flex-col items-center gap-5 py-6 text-center">
            <div
                className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    isLocationOff ? 'bg-blue-100 dark:bg-blue-950/40' : 'bg-amber-100 dark:bg-amber-950/40'
                }`}
            >
                {isLocationOff ? (
                    <svg
                        className="w-8 h-8 text-blue-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.8}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M3 3l18 18"
                        />
                    </svg>
                ) : (
                    <svg
                        className="w-8 h-8 text-amber-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.8}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z"
                        />
                        <circle cx="12" cy="9" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
            </div>

            <div className="space-y-1.5">
                <p className={`font-bold text-foreground ${isTamil ? 'text-base' : 'text-lg'}`}>{title}</p>
                <p className={`text-muted-foreground max-w-xs ${isTamil ? 'text-xs' : 'text-sm'}`}>{body}</p>
            </div>

            <div className="flex flex-col items-center gap-2 w-full max-w-xs">
                {settingsLabel && (
                    <button
                        type="button"
                        onClick={openBrowserSettings}
                        className="w-full rounded-xl bg-primary text-primary-foreground font-bold px-6 py-3 text-sm hover:opacity-90 active:scale-95 transition-all shadow-md shadow-primary/30"
                    >
                        {settingsLabel}
                    </button>
                )}
                <button
                    type="button"
                    onClick={onRetry}
                    className="w-full rounded-xl border border-border bg-secondary/60 text-foreground font-semibold px-6 py-3 text-sm hover:bg-secondary active:scale-95 transition-all"
                >
                    {t.btnRetry}
                </button>
            </div>
        </div>
    );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ isTracking, isPending, state, t }: StatusBadgeProps) {
    const label = isTracking
        ? t.statusBroadcasting
        : isPending
          ? t.statusGetting
          : state === 'error'
            ? t.statusError
            : t.statusIdle;
    const dotClass = isTracking
        ? 'bg-green-500'
        : isPending
          ? 'bg-amber-400'
          : state === 'error'
            ? 'bg-destructive'
            : 'bg-muted-foreground/40';
    const textClass = isTracking
        ? 'text-green-600 dark:text-green-400'
        : isPending
          ? 'text-amber-600 dark:text-amber-400'
          : state === 'error'
            ? 'text-destructive'
            : 'text-muted-foreground';

    return (
        <div className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass} ${isTracking ? 'animate-pulse' : ''}`} />
            <span className={`font-semibold ${textClass}`}>{label}</span>
        </div>
    );
}

// ─── Bus Selector ─────────────────────────────────────────────────────────────

function BusSelector({ busId, isDisabled, t, onChange }: BusSelectorProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const options = Object.entries(SEC_Bus_Routes)
        .filter(([, name]) => name.toLowerCase().includes(search.toLowerCase()))
        .sort(([a], [b]) => Number(a) - Number(b));

    const selectedName = busId ? SEC_Bus_Routes[Number(busId)] : null;

    return (
        <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{t.busNumber}</p>
            <button
                type="button"
                disabled={isDisabled}
                onClick={() => setOpen((o) => !o)}
                className="w-full h-14 border-b-2 border-border bg-transparent px-0 text-left flex items-center justify-between font-bold text-lg focus:outline-none focus:border-primary disabled:opacity-50 transition-colors"
            >
                <span className={selectedName ? 'text-foreground' : 'text-muted-foreground/60 font-normal text-base'}>
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
                <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
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

// ─── Tracking Button ──────────────────────────────────────────────────────────

function TrackingButton({ isTracking, isPending, isTamil, t, onClick, onCancel }: TrackingButtonProps) {
    const label = isTracking ? t.btnStop : isPending ? t.btnPending : t.btnStart;
    const colorClass = isTracking
        ? 'bg-destructive text-destructive-foreground shadow-destructive/30'
        : 'bg-primary text-primary-foreground shadow-primary/30';

    return (
        <div className="flex flex-col items-center gap-4">
            <button
                onClick={onClick}
                disabled={isPending}
                className={`aspect-square w-52 sm:w-60 rounded-full shadow-2xl transition-all duration-300 disabled:opacity-60 flex items-center justify-center px-6 text-center hover:scale-105 active:scale-95 ${isTamil ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'} font-extrabold tracking-wide ${colorClass}`}
            >
                <span className="w-full wrap-break-word leading-snug">{label}</span>
            </button>

            {isPending && (
                <button
                    type="button"
                    onClick={onCancel}
                    className={`text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground ${isTamil ? 'text-xs' : 'text-sm'}`}
                >
                    {t.btnCancel}
                </button>
            )}
        </div>
    );
}

// ─── Live Stats ───────────────────────────────────────────────────────────────

function LiveStats({ updateCount, lastUpdated, isTamil, t }: LiveStatsProps) {
    return (
        <div className="space-y-3 pt-4 border-t border-border/40">
            <div className="flex justify-between items-center">
                <span className={`text-muted-foreground ${isTamil ? 'text-xs' : 'text-sm'}`}>{t.updatesSent}</span>
                <span className="font-bold text-foreground tabular-nums">{updateCount}</span>
            </div>
            {lastUpdated && (
                <div className="flex justify-between items-center">
                    <span className={`text-muted-foreground ${isTamil ? 'text-xs' : 'text-sm'}`}>{t.lastSent}</span>
                    <span className="font-semibold text-foreground tabular-nums">
                        {lastUpdated.toLocaleTimeString()}
                    </span>
                </div>
            )}
        </div>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

type UseDriverTrackingOptions = { busId: string; noBusError: string };

function useDriverTracking({ busId, noBusError }: UseDriverTrackingOptions) {
    const [state, setState] = useState<TrackingState>('idle');
    const [errorKind, setErrorKind] = useState<ErrorKind>(null);
    const [coords, setCoords] = useState<Coordinates | null>(null);
    const [updateCount, setUpdateCount] = useState(0);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [validationError, setValidationError] = useState('');

    // watchPosition returns a number on the web, not a string.
    const watcherIdRef = useRef<number | null>(null);
    const lastSentRef = useRef<number>(0);
    const busIdRef = useRef<string>('');
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const cancelledRef = useRef(false);

    // ── Post logic ────────────────────────────────────────────────────────────
    const postLocation = useCallback(async (lat: number, lng: number) => {
        const now = Date.now();
        if (now - lastSentRef.current < 5_000) return;
        lastSentRef.current = now;
        try {
            const jwt = loadJwt();
            const response = await fetch(`${import.meta.env.VITE_API_BASE}/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain',
                    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
                },
                body: `${busIdRef.current},${lat},${lng},${now}`,
            });

            const data = await response.json().catch(() => null);
            const incomingJwt = data?.token ?? response.headers.get('x-token');
            if (incomingJwt) saveJwt(incomingJwt);

            setUpdateCount((c) => c + 1);
            setLastUpdated(new Date(now));
        } catch {
            lastSentRef.current = 0;
        }
    }, []);

    // ── Teardown ──────────────────────────────────────────────────────────────
    const teardown = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (watcherIdRef.current !== null) {
            navigator.geolocation.clearWatch(watcherIdRef.current);
            watcherIdRef.current = null;
        }
    }, []);

    // ── Stop ──────────────────────────────────────────────────────────────────
    const stopTracking = useCallback(() => {
        teardown();
        clearSession();
        setState('idle');
        setErrorKind(null);
        setCoords(null);
        setUpdateCount(0);
        setLastUpdated(null);
        lastSentRef.current = 0;
    }, [teardown]);

    // ── Cancel (while still in 'requesting') ─────────────────────────────────
    const cancelTracking = useCallback(() => {
        cancelledRef.current = true;
        teardown();
        clearSession();
        setState('idle');
        setErrorKind(null);
    }, [teardown]);

    // ── Start ─────────────────────────────────────────────────────────────────
    const startTracking = useCallback(
        async (overrideBusId?: string) => {
            const trimmedId = (overrideBusId ?? busId).trim();
            if (!trimmedId) {
                setValidationError(noBusError);
                return;
            }

            setValidationError('');
            busIdRef.current = trimmedId;
            cancelledRef.current = false;

            teardown();
            setState('requesting');
            setErrorKind(null);
            saveSession(trimmedId);

            // Pre-flight: detect location-off before registering the watcher.
            // On web, code 2 (POSITION_UNAVAILABLE) means the device has GPS
            // disabled; code 1 (PERMISSION_DENIED) means we need to request —
            // fall through so watchPosition triggers the browser prompt.
            try {
                await getCurrentPosition({ enableHighAccuracy: false, timeout: 3_000 });
            } catch (e: unknown) {
                if (cancelledRef.current) return;
                const kind = classifyGeoError(e as GeolocationPositionError);
                if (kind === 'location_off') {
                    setErrorKind('location_off');
                    setState('error');
                    clearSession();
                    return;
                }
            }

            if (cancelledRef.current) return;

            // Register the persistent watcher.
            watcherIdRef.current = navigator.geolocation.watchPosition(
                async (position) => {
                    if (cancelledRef.current) return;
                    const { latitude: lat, longitude: lng, accuracy } = position.coords;
                    setCoords({ lat, lng, accuracy });
                    setState('tracking');
                    await postLocation(lat, lng);
                },
                (err) => {
                    if (cancelledRef.current) return;
                    console.error('[Polaris] watcher error:', err);
                    setErrorKind(classifyGeoError(err));
                    setState('error');
                    clearSession();
                    if (watcherIdRef.current !== null) {
                        navigator.geolocation.clearWatch(watcherIdRef.current);
                        watcherIdRef.current = null;
                    }
                },
                { enableHighAccuracy: true, maximumAge: 0 },
            );

            // Supplemental foreground interval (mirrors the original's 5 s poll).
            intervalRef.current = setInterval(async () => {
                if (watcherIdRef.current === null) return;
                try {
                    const pos = await getCurrentPosition({ enableHighAccuracy: true, timeout: 4_000 });
                    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
                    setCoords({ lat, lng, accuracy });
                    await postLocation(lat, lng);
                } catch {
                    // Silently skip — watcher callback handles error state.
                }
            }, 5_000);
        },
        [busId, noBusError, teardown, postLocation],
    );

    const retry = useCallback(() => startTracking(), [startTracking]);

    // Auto-resume on page reload if a session was persisted.
    useEffect(() => {
        const session = loadSession();
        if (session) startTracking(session.busId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(
        () => () => {
            teardown();
        },
        [teardown],
    );

    return {
        cancelTracking,
        coords,
        errorKind,
        validationError,
        isPending: state === 'requesting',
        isTracking: state === 'tracking',
        lastUpdated,
        retry,
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

    const {
        cancelTracking,
        coords,
        errorKind,
        validationError,
        isPending,
        isTracking,
        lastUpdated,
        retry,
        startTracking,
        state,
        stopTracking,
        updateCount,
    } = useDriverTracking({ busId, noBusError: t.errorNoBus });

    const showErrorPrompt = state === 'error' && errorKind !== null;

    return (
        <div className="h-full min-h-0 bg-background text-foreground px-6 py-8 md:px-10 flex flex-col max-w-md mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1
                        className={`font-extrabold text-foreground tracking-tight leading-tight mb-1 ${isTamil ? 'text-2xl' : 'text-3xl sm:text-4xl'}`}
                    >
                        {t.title}
                    </h1>
                    <p className={`text-muted-foreground ${isTamil ? 'text-xs' : 'text-sm'}`}>{t.subtitle}</p>
                </div>

                <button
                    type="button"
                    onClick={() => setLang((l) => (l === 'en' ? 'ta' : 'en'))}
                    className="shrink-0 flex h-9 items-center gap-2 rounded-xl border border-border/60 bg-secondary/50 px-3 text-xs font-bold transition-all hover:bg-secondary ml-4"
                >
                    <span className={lang === 'en' ? 'text-primary' : 'text-muted-foreground'}>EN</span>
                    <span className="text-border font-normal">|</span>
                    <span className={lang === 'ta' ? 'text-primary' : 'text-muted-foreground'}>TA</span>
                </button>
            </div>

            {/* Bus selector */}
            <BusSelector
                busId={busId}
                isDisabled={isTracking || isPending}
                isTamil={isTamil}
                t={t}
                onChange={setBusId}
            />

            {/* Status */}
            <div className="mt-5">
                <StatusBadge isTracking={isTracking} isPending={isPending} state={state} t={t} />
            </div>

            {/* Validation error */}
            {validationError && <p className="mt-2 text-destructive text-sm font-semibold">{validationError}</p>}

            {/* Main area */}
            <div className="flex-1 flex items-center justify-center py-6">
                {showErrorPrompt ? (
                    <ErrorPrompt kind={errorKind} t={t} isTamil={isTamil} onRetry={retry} />
                ) : (
                    <TrackingButton
                        isTracking={isTracking}
                        isPending={isPending}
                        isTamil={isTamil}
                        t={t}
                        onClick={isTracking ? stopTracking : startTracking}
                        onCancel={cancelTracking}
                    />
                )}
            </div>

            {/* Live stats */}
            {isTracking && coords && (
                <LiveStats updateCount={updateCount} lastUpdated={lastUpdated} isTamil={isTamil} t={t} />
            )}
        </div>
    );
}
