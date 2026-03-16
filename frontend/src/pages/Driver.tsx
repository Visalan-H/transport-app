import { useState, useEffect, useRef, useCallback } from 'react';

type TrackingState = 'idle' | 'requesting' | 'tracking' | 'error';

const SEND_INTERVAL = 5000;

export default function Driver() {
    const [busId, setBusId] = useState('');
    const [state, setState] = useState<TrackingState>('idle');
    const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
    const [error, setError] = useState('');
    const [updateCount, setUpdateCount] = useState(0);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
            if ('wakeLock' in navigator) {
                wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            }
        } catch {
            // Wake lock not supported or denied — not a blocking issue
        }
    };

    const releaseWakeLock = () => {
        wakeLockRef.current?.release().catch(() => {});
        wakeLockRef.current = null;
    };

    // Re-acquire wake lock when tab becomes visible again (e.g. after switching apps)
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
        }).catch(() => {
            // Batcher retries failed sends — safe to silently ignore here
        });
        setUpdateCount((c) => c + 1);
        setLastUpdated(new Date());
    }, []);

    const startTracking = async () => {
        const trimmedId = busId.trim();
        if (!trimmedId) {
            setError('Enter your bus number first');
            return;
        }
        if (!navigator.geolocation) {
            setError('Geolocation is not supported on this device');
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
                    1: 'Location permission denied. Enable it in your browser settings.',
                    2: 'Location unavailable. Check your GPS signal.',
                    3: 'Location request timed out. Try again.',
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

    // Cleanup on unmount
    useEffect(() => () => stopTracking(), [stopTracking]);

    const isTracking = state === 'tracking';
    const isPending = state === 'requesting';

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm space-y-6">
                {/* Header */}
                <div className="text-center space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight">Driver Mode</h1>
                    <p className="text-muted-foreground text-sm">Your location will be shared with students</p>
                </div>

                {/* Status pill */}
                <div className="flex justify-center">
                    <span
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                            isTracking
                                ? 'bg-green-950 text-green-400 border border-green-900'
                                : isPending
                                  ? 'bg-yellow-950 text-yellow-400 border border-yellow-900'
                                  : state === 'error'
                                    ? 'bg-destructive/20 text-destructive border border-destructive/50'
                                    : 'bg-secondary text-secondary-foreground border border-border'
                        }`}
                    >
                        <span
                            className={`w-1.5 h-1.5 rounded-full ${
                                isTracking
                                    ? 'bg-green-400 animate-pulse'
                                    : isPending
                                      ? 'bg-yellow-400 animate-pulse'
                                      : state === 'error'
                                        ? 'bg-destructive'
                                        : 'bg-muted-foreground'
                            }`}
                        />
                        {isTracking
                            ? 'Broadcasting live'
                            : isPending
                              ? 'Getting location...'
                              : state === 'error'
                                ? 'Error'
                                : 'Not broadcasting'}
                    </span>
                </div>

                {/* Bus ID input */}
                <div className="space-y-2">
                    <label className="block text-sm text-muted-foreground">Bus number</label>
                    <input
                        type="number"
                        placeholder="e.g. 42"
                        value={busId}
                        onChange={(e) => setBusId(e.target.value)}
                        disabled={isTracking || isPending}
                        className="w-full bg-card border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground text-lg font-mono focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                    />
                </div>

                {/* Error message */}
                {error && (
                    <p className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
                        {error}
                    </p>
                )}

                {/* Start / Stop button */}
                <button
                    onClick={isTracking ? stopTracking : startTracking}
                    disabled={isPending}
                    className={`w-full py-4 rounded-xl font-semibold text-base transition-all disabled:opacity-50 ${
                        isTracking
                            ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                            : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                    }`}
                >
                    {isTracking ? 'Stop broadcasting' : isPending ? 'Getting location...' : 'Start broadcasting'}
                </button>

                {/* Live stats */}
                {isTracking && coords && (
                    <div className="bg-card border border-border rounded-xl p-4 space-y-3 text-sm">
                        <div className="flex justify-between text-muted-foreground">
                            <span>Latitude</span>
                            <span className="font-mono text-foreground">{coords.lat.toFixed(6)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                            <span>Longitude</span>
                            <span className="font-mono text-foreground">{coords.lng.toFixed(6)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                            <span>Accuracy</span>
                            <span className="font-mono text-foreground">±{Math.round(coords.accuracy)}m</span>
                        </div>
                        <div className="border-t border-border pt-3 flex justify-between text-muted-foreground">
                            <span>Updates sent</span>
                            <span className="font-mono text-green-500 dark:text-green-400">{updateCount}</span>
                        </div>
                        {lastUpdated && (
                            <div className="flex justify-between text-muted-foreground">
                                <span>Last sent</span>
                                <span className="font-mono text-foreground">{lastUpdated.toLocaleTimeString()}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Keep screen on warning */}
                {isTracking && !('wakeLock' in navigator) && (
                    <p className="text-yellow-600 text-xs text-center">
                        Keep your screen on — your browser doesn't support automatic screen lock prevention.
                    </p>
                )}
            </div>
        </div>
    );
}
