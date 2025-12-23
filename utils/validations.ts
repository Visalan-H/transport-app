import type { BusDetails } from '../types';

export const isBus = (obj: any): obj is BusDetails => {
    return (
        obj &&
        typeof obj.id === 'number' &&
        typeof obj.lat === 'number' &&
        typeof obj.lng === 'number' &&
        typeof obj.timestamp === 'number'
    );
};
