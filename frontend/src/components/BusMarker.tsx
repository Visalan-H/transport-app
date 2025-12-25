import { memo } from 'react';

export const BusMarker = memo(() => (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Bus body */}
        <rect x="3" y="8" width="34" height="18" rx="3" fill="#FBBF24" stroke="#B45309" strokeWidth="2" />

        {/* Windshield */}
        <path d="M 6 8 L 12 8 L 10 4 L 5 4 Z" fill="#87CEEB" stroke="#1F2937" strokeWidth="1" />

        {/* Main windows */}
        <rect x="8" y="10" width="6" height="6" rx="1" fill="#87CEEB" stroke="#1F2937" strokeWidth="0.5" />
        <rect x="17" y="10" width="6" height="6" rx="1" fill="#87CEEB" stroke="#1F2937" strokeWidth="0.5" />
        <rect x="26" y="10" width="6" height="6" rx="1" fill="#87CEEB" stroke="#1F2937" strokeWidth="0.5" />

        {/* Door line */}
        <line x1="16" y1="8" x2="16" y2="26" stroke="#1F2937" strokeWidth="1.5" opacity="0.6" />

        {/* Headlights */}
        <circle cx="5" cy="16" r="1.5" fill="#FDE047" stroke="#B45309" strokeWidth="0.5" />
        <circle cx="5" cy="20" r="1.5" fill="#FDE047" stroke="#B45309" strokeWidth="0.5" />

        {/* Mirror */}
        <rect x="3" y="14" width="1.5" height="3" fill="#4B5563" stroke="#1F2937" strokeWidth="0.5" />

        {/* Bumper */}
        <rect x="3" y="26" width="34" height="2.5" rx="1" fill="#1F2937" />

        {/* Wheels - larger and more detailed */}
        <circle cx="10" cy="32" r="3" fill="#1F2937" stroke="#4B5563" strokeWidth="1.5" />
        <circle cx="30" cy="32" r="3" fill="#1F2937" stroke="#4B5563" strokeWidth="1.5" />

        {/* Wheel rims */}
        <circle cx="10" cy="32" r="1.8" fill="none" stroke="#9CA3AF" strokeWidth="1" />
        <circle cx="30" cy="32" r="1.8" fill="none" stroke="#9CA3AF" strokeWidth="1" />

        {/* Hub caps */}
        <circle cx="10" cy="32" r="0.8" fill="#9CA3AF" />
        <circle cx="30" cy="32" r="0.8" fill="#9CA3AF" />

        {/* Roof accent */}
        <path d="M 5 8 L 35 8 Q 35 5 30 4 L 10 4 Q 5 5 5 8" fill="#FCD34D" opacity="0.5" />
    </svg>
));
