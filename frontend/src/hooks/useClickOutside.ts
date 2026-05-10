import { useEffect } from 'react';

type UseClickOutsideArgs = {
    ref: React.RefObject<HTMLElement | null>;
    isEnabled?: boolean;
    onOutsideClick: () => void;
};

export function useClickOutside({ ref, isEnabled = true, onOutsideClick }: UseClickOutsideArgs) {
    useEffect(() => {
        if (!isEnabled) return;

        const handleMouseDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (ref.current && !ref.current.contains(target)) {
                onOutsideClick();
            }
        };

        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [isEnabled, onOutsideClick, ref]);
}
