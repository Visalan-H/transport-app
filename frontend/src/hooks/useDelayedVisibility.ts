import { useEffect, useState } from 'react';

type UseDelayedVisibilityArgs = {
    delayMs?: number;
};

export function useDelayedVisibility({ delayMs = 100 }: UseDelayedVisibilityArgs = {}) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), delayMs);
        return () => clearTimeout(timer);
    }, [delayMs]);

    return isVisible;
}
