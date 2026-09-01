import type { BusDetails } from '../../types';

/**
 * An update is kept only if its timestamp beats the one already stored, so a single far-future
 * value would pin that bus at those coordinates permanently — no later real fix could ever win the
 * comparison, and nothing short of a restart would clear it.
 *
 * The future allowance is for driver phones with a drifting clock; the past bound only exists to
 * reject obvious garbage (an empty field parses to 0, i.e. 1970).
 */
const MAX_CLOCK_SKEW = 2 * 60 * 1000;
const MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * Parses the wire format a driver's phone sends: `"{busId},{lat},{lng},{timestampMillis}"`.
 *
 * Returns null for anything malformed rather than throwing, so a bad body is a 400 and never
 * reaches stored state. This validation used to live in the batcher; it moved here when that
 * service was removed, and it is now the only thing standing between the network and the map.
 *
 * Number.isFinite rather than `typeof === 'number'`, which NaN and Infinity both satisfy: a payload
 * like "1,x,y,z" parses to NaN throughout, and NaN reaching the SSE snapshot surfaces to the
 * frontend as {"lat":null,"lng":null}.
 */
export const parseBusText = (text: string): BusDetails | null => {
    const parts = text.trim().split(',');
    if (parts.length !== 4) return null;

    const [id, lat, lng, timestamp] = parts.map(Number) as [number, number, number, number];
    const now = Date.now();

    const valid =
        Number.isInteger(id) &&
        id > 0 &&
        Number.isFinite(lat) &&
        lat >= -90 &&
        lat <= 90 &&
        Number.isFinite(lng) &&
        lng >= -180 &&
        lng <= 180 &&
        Number.isFinite(timestamp) &&
        timestamp <= now + MAX_CLOCK_SKEW &&
        timestamp >= now - MAX_AGE;

    return valid ? { id, lat, lng, timestamp } : null;
};
