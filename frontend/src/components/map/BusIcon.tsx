const BUS_SVG = `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="8" width="34" height="18" rx="3" fill="#FBBF24" stroke="#B45309" stroke-width="2" />
  <path d="M 6 8 L 12 8 L 10 4 L 5 4 Z" fill="#87CEEB" stroke="#1F2937" stroke-width="1" />
  <rect x="8" y="10" width="6" height="6" rx="1" fill="#87CEEB" stroke="#1F2937" stroke-width="0.5" />
  <rect x="17" y="10" width="6" height="6" rx="1" fill="#87CEEB" stroke="#1F2937" stroke-width="0.5" />
  <rect x="26" y="10" width="6" height="6" rx="1" fill="#87CEEB" stroke="#1F2937" stroke-width="0.5" />
  <line x1="16" y1="8" x2="16" y2="26" stroke="#1F2937" stroke-width="1.5" opacity="0.6" />
  <circle cx="5" cy="16" r="1.5" fill="#FDE047" stroke="#B45309" stroke-width="0.5" />
  <circle cx="5" cy="20" r="1.5" fill="#FDE047" stroke="#B45309" stroke-width="0.5" />
  <rect x="3" y="14" width="1.5" height="3" fill="#4B5563" stroke="#1F2937" stroke-width="0.5" />
  <rect x="3" y="26" width="34" height="2.5" rx="1" fill="#1F2937" />
  <circle cx="10" cy="32" r="3" fill="#1F2937" stroke="#4B5563" stroke-width="1.5" />
  <circle cx="30" cy="32" r="3" fill="#1F2937" stroke="#4B5563" stroke-width="1.5" />
  <circle cx="10" cy="32" r="1.8" fill="none" stroke="#9CA3AF" stroke-width="1" />
  <circle cx="30" cy="32" r="1.8" fill="none" stroke="#9CA3AF" stroke-width="1" />
  <circle cx="10" cy="32" r="0.8" fill="#9CA3AF" />
  <circle cx="30" cy="32" r="0.8" fill="#9CA3AF" />
  <path d="M 5 8 L 35 8 Q 35 5 30 4 L 10 4 Q 5 5 5 8" fill="#FCD34D" opacity="0.5" />
</svg>`;

let cachedBusImagePromise: Promise<HTMLImageElement> | null = null;

const loadBusImage = (): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const img = new Image();
        const blob = new Blob([BUS_SVG], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = reject;
        img.src = url;
    });

const getBusImage = (): Promise<HTMLImageElement> => {
    if (!cachedBusImagePromise) {
        cachedBusImagePromise = loadBusImage();
    }
    return cachedBusImagePromise;
};

export const registerBusImage = async (map: maplibregl.Map) => {
    try {
        if (map.hasImage('bus-icon')) return;

        const img = await getBusImage();
        map.addImage('bus-icon', img, { pixelRatio: 2 });
    } catch (e) {
        console.error('Failed to load bus icon', e);
    }
};
