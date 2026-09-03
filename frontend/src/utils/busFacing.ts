import type { BusDetails } from '../../../types';

/**
 * How far a bus must travel from its anchor before its facing is reconsidered.
 *
 * A stationary phone still reports positions a few metres apart -- that is ordinary GPS scatter, not
 * travel. Without a floor, a bus parked at a stop flips its icon back and forth on every 5s fix.
 *
 * Crucially this is measured from an *anchor* that survives across snapshots, not from the previous
 * fix. Comparing consecutive fixes would silently make this a speed threshold instead of a distance
 * one: at a 5s SSE interval, 20m per tick is 14.4 km/h, so a bus crawling through traffic or pulling
 * into a stop would never flip no matter how far it actually went. Against an anchor, slow movement
 * accumulates until it clears the bar.
 */
const MIN_MOVE_METRES = 20;

/**
 * ...and this much of that travel has to be east/west before it decides the facing.
 *
 * A bus driving due north clears MIN_MOVE_METRES with an east/west component of nearly zero, and the
 * sign of nearly zero is noise. At 8m out of 20m the bus has to be genuinely leaning east or west,
 * not merely drifting. Below it the previous facing is kept: a bus that turns off an eastbound road
 * onto a northbound one should keep pointing the way it last definitely went.
 */
const MIN_EAST_WEST_METRES = 8;

/**
 * How long an anchor may stand before it is abandoned unused.
 *
 * Accumulating distance is what lets a slow bus flip, but left unbounded it also lets a *stationary*
 * bus flip: a receiver with a one-directional bias (multipath beside a building) inches along until
 * it has faked 20m of travel, and the icon turns around on a bus that never moved.
 *
 * Bounding the window separates the two by speed without needing a speed reading. Real travel covers
 * 20m fast -- 15s at 5 km/h, 40s even at a 2 km/h crawl -- while drift needs minutes. Anything that
 * has not covered the distance within a minute was not driving, so the anchor is dropped and the
 * measurement starts again from where the bus is now.
 */
const MAX_ANCHOR_AGE_MS = 60_000;

const METRES_PER_DEGREE_LAT = 111_320;

/**
 * A bus plus which way it is pointing, and the position that was decided from.
 *
 * The anchor is bookkeeping rather than something to render, but it belongs on the bus: it is per
 * bus, it has to survive between snapshots, and the alternative is a second parallel map that can
 * fall out of sync with this one.
 */
export type TrackedBus = BusDetails & {
    facingRight: boolean;
    facingAnchor: { lat: number; lng: number; timestamp: number };
};

/**
 * Which way `bus` should be drawn, given where it was last measured from.
 *
 * The bus icon is a side view facing left, so direction is shown by mirroring rather than rotating,
 * and the only question is east or west. A bus with no history faces left -- how the icon is drawn,
 * and how the map looked before this existed.
 *
 * Deliberately derived on the client. The alternative is the driver app reporting GPS heading, which
 * is more accurate at walking pace but changes the four-field `BusText` payload -- meaning every
 * driver installs a new APK for a cosmetic win.
 */
export const resolveFacing = (
    previous: TrackedBus | undefined,
    bus: BusDetails,
): Pick<TrackedBus, 'facingRight' | 'facingAnchor'> => {
    const anchorHere = { lat: bus.lat, lng: bus.lng, timestamp: bus.timestamp };

    if (!previous) {
        return { facingRight: false, facingAnchor: anchorHere };
    }

    // Same fix as last time -- nothing to learn from it, and the anchor must be carried through
    // rather than reset, or a duplicate snapshot would discard accumulated travel.
    if (previous.timestamp === bus.timestamp) {
        return { facingRight: previous.facingRight, facingAnchor: previous.facingAnchor };
    }

    // Equirectangular approximation. Over the tens of metres being measured here the error is far
    // below the thresholds above, and it avoids a haversine per bus per snapshot.
    const anchor = previous.facingAnchor;
    const latRadians = (bus.lat * Math.PI) / 180;
    const northMetres = (bus.lat - anchor.lat) * METRES_PER_DEGREE_LAT;
    const eastMetres = (bus.lng - anchor.lng) * METRES_PER_DEGREE_LAT * Math.cos(latRadians);
    const movedMetres = Math.hypot(northMetres, eastMetres);

    if (movedMetres < MIN_MOVE_METRES) {
        // Too slow to have been driving. Drop the stale anchor and start measuring from here, so a
        // parked bus cannot inch its way to 20m of imaginary travel over several minutes.
        if (bus.timestamp - anchor.timestamp > MAX_ANCHOR_AGE_MS) {
            return { facingRight: previous.facingRight, facingAnchor: anchorHere };
        }

        // Still inside the noise floor but recent: keep the anchor, so the next fix measures from
        // the same origin and short hops add up instead of each being dismissed on its own.
        return { facingRight: previous.facingRight, facingAnchor: anchor };
    }

    // Travelled far enough, fast enough, to trust. The anchor resets either way -- including when
    // the east/west component was too small to decide -- which bounds how much a bus heading due
    // north can accumulate sideways drift before it is allowed to flip on it.
    const facingRight = Math.abs(eastMetres) >= MIN_EAST_WEST_METRES ? eastMetres > 0 : previous.facingRight;
    return { facingRight, facingAnchor: anchorHere };
};
