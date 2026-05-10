import { useState, useEffect, useRef, useCallback } from 'react';
import { SEC_Bus_Routes } from '@/constants/BusIdMap';

type TrackingState = 'idle' | 'requesting' | 'tracking' | 'error';
type Language = 'en' | 'ta';

type NavigatorWithWakeLock = Navigator & {
    wakeLock?: {
        request: (type: 'screen') => Promise<WakeLockSentinel>;
    };
};

const SEND_INTERVAL = 5000;

const COPY: Record<
    Language,
    {
        english: string;
        tamil: string;
        title: string;
        subtitle: string;
        notBroadcasting: string;
        requesting: string;
        broadcasting: string;
        errorState: string;
        busNumber: string;
        busPlaceholder: string;
        start: string;
        stop: string;
        enterBusFirst: string;
        geoUnsupported: string;
        geoDenied: string;
        geoUnavailable: string;
        geoTimeout: string;
        updatesSent: string;
        lastSent: string;
        wakeLockHint: string;
        busSearch: string;
        selectBus: string;
    }
> = {
    en: {
        english: 'English',
        tamil: 'Tamil',
        title: 'Driver Mode',
        subtitle: 'Your location will be shared with students',
        notBroadcasting: 'Not broadcasting',
        requesting: 'Getting location...',
        broadcasting: 'Broadcasting live',
        errorState: 'Error',
        busNumber: 'Bus number',
        busPlaceholder: 'e.g. 42',
        start: 'Start broadcasting',
        stop: 'Stop broadcasting',
        enterBusFirst: 'Enter your bus number first',
        geoUnsupported: 'Geolocation is not supported on this device',
        geoDenied: 'Location permission denied. Enable it in your browser settings.',
        geoUnavailable: 'Location unavailable. Check your GPS signal.',
        geoTimeout: 'Location request timed out. Try again.',
        updatesSent: 'Updates sent',
        lastSent: 'Last sent',
        wakeLockHint: "Keep your screen on. Your browser doesn't support wake lock.",
        busSearch: 'Search routes...',
        selectBus: 'Select your bus',
    },
    ta: {
        english: 'English',
        tamil: 'தமிழ்',
        title: 'ஓட்டுநர் பயன்முறை', // ஓட்டுநர் is the natural word for driver
        subtitle: 'உங்கள் இருப்பிடம் மாணவர்களுக்கு அனுப்பப்படும்', // more natural phrasing
        notBroadcasting: 'ஒளிபரப்பு இல்லை',
        requesting: 'இருப்பிடம் கண்டறிகிறது...', // more natural than பெறுகிறது
        broadcasting: 'நேரடி ஒளிபரப்பு இயங்குகிறது', // இயங்குகிறது sounds more active
        errorState: 'பிழை',
        busNumber: 'பேருந்து எண்',
        busPlaceholder: 'எ.கா. 42',
        start: 'தொடங்கு', // shorter — fits the button better
        stop: 'நிறுத்து', // shorter — fits the button better
        enterBusFirst: 'பேருந்து எண்ணை உள்ளிடவும்', // removed redundant முதலில்
        geoUnsupported: 'இந்த சாதனத்தில் இருப்பிட சேவை இல்லை',
        geoDenied: 'இருப்பிட அனுமதி மறுக்கப்பட்டது. உலாவி அமைப்பில் இயக்கவும்.',
        geoUnavailable: 'இருப்பிடம் கிடைக்கவில்லை. GPS சரிபார்க்கவும்.',
        geoTimeout: 'நேரம் முடிந்தது. மீண்டும் முயற்சிக்கவும்.',
        updatesSent: 'அனுப்பிய புதுப்பிப்புகள்',
        lastSent: 'கடைசியாக அனுப்பியது',
        wakeLockHint: 'திரையை அணைக்காதீர்கள். இந்த உலாவி wake lock ஆதரிக்காது.',
        busSearch: 'வழிகளை தேடவும்...',
        selectBus: 'உங்கள் பேருந்தை தேர்வு செய்யவும்',
    },
};

export default function Driver() {
    const [language, setLanguage] = useState<Language>('en');
    const [busId, setBusId] = useState('');
    const [state, setState] = useState<TrackingState>('idle');
    const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
    const [error, setError] = useState('');
    const [updateCount, setUpdateCount] = useState(0);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const t = COPY[language];
    const isTamil = language === 'ta';

    const [busOpen, setBusOpen] = useState(false);
    const [busSearch, setBusSearch] = useState('');

    const busOptions = Object.entries(SEC_Bus_Routes)
        .filter(([, name]) => name.toLowerCase().includes(busSearch.toLowerCase()))
        .sort(([a], [b]) => Number(a) - Number(b));

    const selectedBusName = busId ? SEC_Bus_Routes[Number(busId)] : null;

    const watchIdRef = useRef<number | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);
    const busIdRef = useRef(busId);
    const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
    useEffect(() => {
        busIdRef.current = busId;
    }, [busId]);

    const acquireWakeLock = async () => {
        try {
            const navigatorWithWakeLock = navigator as NavigatorWithWakeLock;
            if (navigatorWithWakeLock.wakeLock) {
                wakeLockRef.current = await navigatorWithWakeLock.wakeLock.request('screen');
            }
        } catch {
            // Wake lock not supported or denied — not a blocking issue
        }
    };

    const releaseWakeLock = () => {
        wakeLockRef.current?.release().catch(() => {});
        wakeLockRef.current = null;
    };

    useEffect(() => {
        const handleVisibility = async () => {
            if (document.visibilityState === 'visible' && watchIdRef.current !== null) {
                await acquireWakeLock();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []);

    const sendUpdate = useCallback((lat: number, lng: number) => {
        const payload = `${busIdRef.current},${lat},${lng},${Date.now()}`;
        fetch('/update', {
            method: 'POST',
            body: payload,
        }).catch(() => {});
        setUpdateCount((c) => c + 1);
        setLastUpdated(new Date());
    }, []);

    const startTracking = async () => {
        const trimmedId = busId.trim();
        if (!trimmedId) {
            setError('enterBusFirst');
            return;
        }
        if (!navigator.geolocation) {
            setError('geoUnsupported');
            return;
        }

        setError('');
        setState('requesting');
        await acquireWakeLock();

        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude: lat, longitude: lng, accuracy } = pos.coords;
                coordsRef.current = { lat, lng };
                setCoords({ lat, lng, accuracy });
                setState('tracking');
            },
            (err) => {
                const messages: Record<number, string> = {
                    1: 'geoDenied',
                    2: 'geoUnavailable',
                    3: 'geoTimeout',
                };
                setError(messages[err.code] ?? err.message);
                setState('error');
                releaseWakeLock();
                watchIdRef.current = null;
                if (intervalRef.current !== null) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0,
            },
        );

        intervalRef.current = setInterval(() => {
            if (coordsRef.current) {
                sendUpdate(coordsRef.current.lat, coordsRef.current.lng);
            }
        }, SEND_INTERVAL);
    };

    const stopTracking = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        coordsRef.current = null;
        releaseWakeLock();
        setState('idle');
        setUpdateCount(0);
        setLastUpdated(null);
    }, []);

    useEffect(() => () => stopTracking(), [stopTracking]);

    const isTracking = state === 'tracking';
    const isPending = state === 'requesting';

    const displayError = error ? (error in t ? t[error as keyof typeof t] : error) : '';

    return (
        <div className="h-full min-h-0 bg-background text-foreground p-3 md:p-6 flex items-center justify-center">
            <div className="w-full max-w-md rounded-3xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl p-5 md:p-6 min-h-[78dvh] flex flex-col">
                <div className="space-y-5">
                    <div className="flex flex-col gap-3 pb-5 border-b border-border/50 relative">
                        {/* Language toggle */}
                        <div className="absolute right-0 top-0">
                            <button
                                type="button"
                                onClick={() => setLanguage((prev) => (prev === 'en' ? 'ta' : 'en'))}
                                className="group flex h-9 items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 text-xs font-bold shadow-sm transition-all hover:bg-secondary/80 hover:shadow"
                                aria-label="Toggle language"
                            >
                                <span
                                    className={`transition-colors uppercase tracking-wider ${language === 'en' ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}
                                >
                                    EN
                                </span>
                                <span className="text-border/80 font-normal">|</span>
                                <span
                                    className={`transition-colors uppercase tracking-wider ${language === 'ta' ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}
                                >
                                    TA
                                </span>
                            </button>
                        </div>

                        {/* Title — smaller font in Tamil to prevent overflow */}
                        <div className="text-left w-full pt-1 pr-24">
                            <h1
                                className={`font-extrabold text-foreground tracking-tight leading-tight mb-1.5 drop-shadow-sm ${
                                    isTamil ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'
                                }`}
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

                    {/* Bus number input */}
                    {/* <div className="rounded-2xl border border-border/60 bg-background/50 p-4 shadow-sm">
                        <p className="text-sm font-semibold text-muted-foreground mb-2 px-1">{t.busNumber}</p>
                        <input
                            type="number"
                            id="bus-number"
                            placeholder={t.busPlaceholder}
                            value={busId}
                            onChange={(e) => setBusId(e.target.value)}
                            disabled={isTracking || isPending}
                            className="w-full h-16 rounded-xl border-2 border-border/60 bg-card px-4 text-4xl font-black tracking-widest text-center font-mono focus:outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10 disabled:opacity-60 transition-all shadow-inner"
                        />
                    </div> */}

                    {/* Bus selector */}
                    <div className="rounded-2xl border border-border/60 bg-background/50 p-4 shadow-sm relative">
                        <p className="text-sm font-semibold text-muted-foreground mb-2 px-1">{t.busNumber}</p>
                        <button
                            type="button"
                            disabled={isTracking || isPending}
                            onClick={() => setBusOpen((o) => !o)}
                            className="w-full h-14 rounded-xl border-2 border-border/60 bg-card px-4 text-left flex items-center justify-between font-bold text-lg focus:outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10 disabled:opacity-60 transition-all shadow-inner"
                        >
                            <span
                                className={
                                    selectedBusName ? 'text-foreground' : 'text-muted-foreground text-base font-normal'
                                }
                            >
                                {selectedBusName ? `${selectedBusName}` : t.selectBus}
                            </span>
                            <svg
                                className={`w-5 h-5 text-muted-foreground transition-transform ${busOpen ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {busOpen && (
                            <div className="absolute left-4 right-4 top-[calc(100%-0.5rem)] z-50 mt-1 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                                <div className="p-2 border-b border-border/50">
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder={t.busSearch}
                                        value={busSearch}
                                        onChange={(e) => setBusSearch(e.target.value)}
                                        className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
                                    />
                                </div>
                                <ul className="max-h-52 overflow-y-auto divide-y divide-border/30">
                                    {busOptions.length === 0 ? (
                                        <li className="px-4 py-3 text-sm text-muted-foreground text-center">
                                            No routes found
                                        </li>
                                    ) : (
                                        busOptions.map(([id, name]) => (
                                            <li key={id}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setBusId(id);
                                                        setBusOpen(false);
                                                        setBusSearch('');
                                                    }}
                                                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-secondary/60 transition-colors ${busId === id ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                                                >
                                                    <span>{name}</span>
                                                </button>
                                            </li>
                                        ))
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Status badge */}
                    <div
                        className={`rounded-2xl px-4 py-3 border-2 font-bold text-center transition-colors shadow-sm ${
                            isTamil ? 'text-sm' : 'text-base'
                        } ${
                            isTracking
                                ? 'bg-green-100/60 text-green-800 border-green-300 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800/50'
                                : isPending
                                  ? 'bg-amber-100/60 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50'
                                  : state === 'error'
                                    ? 'bg-destructive/10 text-destructive border-destructive/30'
                                    : 'bg-secondary text-secondary-foreground border-border/60'
                        }`}
                    >
                        {isTracking
                            ? t.broadcasting
                            : isPending
                              ? t.requesting
                              : state === 'error'
                                ? t.errorState
                                : t.notBroadcasting}
                    </div>

                    {error && (
                        <p className="text-destructive text-sm font-bold bg-destructive/10 border-2 border-destructive/20 rounded-xl px-4 py-3 text-center">
                            {displayError}
                        </p>
                    )}
                </div>

                {/* Main action button */}
                <div className="flex-1 flex items-center justify-center py-6 min-h-60">
                    <button
                        onClick={isTracking ? stopTracking : startTracking}
                        disabled={isPending}
                        className={`aspect-square w-56 sm:w-64 rounded-full shadow-2xl transition-all duration-300 disabled:opacity-60 flex flex-col items-center justify-center px-4 py-6 text-center hover:scale-105 active:scale-95 ${
                            isTamil ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl md:text-3xl'
                        } font-extrabold tracking-wide ${
                            isTracking
                                ? 'bg-destructive text-destructive-foreground shadow-destructive/40'
                                : 'bg-primary text-primary-foreground shadow-primary/40'
                        }`}
                    >
                        <span className="w-full wrap-break-word leading-snug">
                            {isTracking ? t.stop : isPending ? t.requesting : t.start}
                        </span>
                    </button>
                </div>

                {/* Stats */}
                <div className="space-y-3">
                    {isTracking && coords && (
                        <div className="rounded-2xl border border-border bg-background px-4 py-3 space-y-2 text-base">
                            <div className="flex justify-between">
                                <span className={`text-muted-foreground ${isTamil ? 'text-sm' : ''}`}>
                                    {t.updatesSent}
                                </span>
                                <span className="font-bold text-foreground">{updateCount}</span>
                            </div>
                            {lastUpdated && (
                                <div className="flex justify-between">
                                    <span className={`text-muted-foreground ${isTamil ? 'text-sm' : ''}`}>
                                        {t.lastSent}
                                    </span>
                                    <span className="font-semibold text-foreground">
                                        {lastUpdated.toLocaleTimeString()}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {isTracking && !('wakeLock' in navigator) && (
                        <p
                            className={`text-amber-700 dark:text-amber-300 text-center ${isTamil ? 'text-xs' : 'text-sm'}`}
                        >
                            {t.wakeLockHint}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
