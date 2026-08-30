import type { BusDetails } from '../../types';

// Number.isFinite rather than typeof === 'number', which NaN and Infinity both satisfy: a payload
// like "1,x,y,z" parses to NaN throughout, passed the old check, and reached the SSE snapshot as
// {"lat":null,"lng":null}. The batcher validates too; this is the last line before stored state.
export const isBus = (obj: any): obj is BusDetails => {
    return (
        obj &&
        Number.isInteger(obj.id) &&
        obj.id > 0 &&
        Number.isFinite(obj.lat) &&
        obj.lat >= -90 &&
        obj.lat <= 90 &&
        Number.isFinite(obj.lng) &&
        obj.lng >= -180 &&
        obj.lng <= 180 &&
        Number.isFinite(obj.timestamp)
    );
};
