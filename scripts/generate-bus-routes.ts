/**
 * Generates `driver_app/lib/data/bus_routes.dart` from the frontend's `SEC_Bus_Routes`.
 *
 * The two used to be maintained by hand, with a comment in each asking the next person to remember
 * the other. They happened not to have drifted, but nothing stopped them: this map is the only
 * thing turning a bus id into a name, so a mismatch would show students one route and the driver
 * another, with no error anywhere to notice it by.
 *
 * Codegen rather than a shared JSON both sides read: Flutter would have to load that asset
 * asynchronously while the map is used synchronously, and the frontend would need build config to
 * reach outside its own root. Emitting Dart keeps a compile-time `const` map on that side and needs
 * no new dependency on this one, since Bun imports the TypeScript module directly.
 *
 *   bun scripts/generate-bus-routes.ts            # write the file
 *   bun scripts/generate-bus-routes.ts --check    # exit 1 if stale (CI uses this)
 */
import { SEC_Bus_Routes } from '../frontend/src/constants/BusIdMap';

const OUTPUT = new URL('../driver_app/lib/data/bus_routes.dart', import.meta.url);

const entries = Object.entries(SEC_Bus_Routes)
    .map(([id, name]) => [Number(id), name] as const)
    .sort((a, b) => a[0] - b[0]);

// JSON.stringify, not a hand-rolled quote wrapper: it emits a double-quoted string with quotes,
// backslashes and control characters already escaped, and that is valid Dart as-is. A route name
// containing an apostrophe would otherwise terminate a single-quoted Dart literal early and produce
// a file that does not compile -- none do today, which is precisely why it would go unnoticed.
const body = entries.map(([id, name]) => `    ${id}: ${JSON.stringify(name)},`).join('\n');

const contents = `// GENERATED FILE -- DO NOT EDIT.
//
// Written by scripts/generate-bus-routes.ts from frontend/src/constants/BusIdMap.ts, which is the
// source of truth for bus id -> route name. Edit that file and re-run:
//
//   bun scripts/generate-bus-routes.ts
//
// CI regenerates this and fails if the result differs, so a change to one side cannot be merged
// without the other.
const Map<int, String> secBusRoutes = {
${body}
};
`;

if (process.argv.includes('--check')) {
    const current = await Bun.file(OUTPUT)
        .text()
        .catch(() => '');
    if (current !== contents) {
        console.error('bus_routes.dart is out of date. Run: bun scripts/generate-bus-routes.ts');
        process.exit(1);
    }
    console.log(`bus_routes.dart is up to date (${entries.length} routes).`);
} else {
    await Bun.write(OUTPUT, contents);
    console.log(`Wrote ${entries.length} routes to driver_app/lib/data/bus_routes.dart`);
}
