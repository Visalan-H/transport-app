import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
    base: './',
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',
            registerType: 'autoUpdate',
            injectManifest: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
            },
            includeAssets: ['icon-192.png', 'icon-512.png'],
            manifest: {
                name: 'Polaris - Saveetha Transport',
                short_name: 'Polaris',
                description: 'Track Saveetha college buses in real time',
                start_url: '/',
                display: 'standalone',
                background_color: '#ffffff',
                theme_color: '#282a37',
                orientation: 'portrait-primary',
                icons: [
                    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
            },
        }),
    ],
    build: {
        rollupOptions: {
            output: {
                // Function form, not the object form this used to use. With the object form
                // (`{ vendor: ['react', 'react-dom', 'react-router-dom'] }`) React was not reaching
                // the vendor chunk at all: builds put react-dom in the entry chunk and left vendor
                // holding ~35kB of just the router, so every app-code change invalidated the whole
                // ~300kB entry rather than the app's own share of it.
                //
                // Rollup documents the object form as matching inclusively, so this arguably should
                // have worked -- but it measurably did not here, and matching on the resolved module
                // path is the reliable approach. Confirmed by comparing real builds either side of
                // the change: index 304kB -> 51kB, vendor 35kB -> 319kB, total JS unchanged.
                manualChunks(id) {
                    if (!id.includes('node_modules')) return;

                    // Must come before the catch-all: react-map-gl is a dependency like any other
                    // and would otherwise land in vendor, dragging the map bindings into the chunk
                    // every page loads. Everything else third-party is stable enough to share one
                    // long-lived chunk, which is the whole point -- app code changes on every
                    // deploy, these do not.
                    if (id.includes('maplibre-gl') || id.includes('react-map-gl')) return 'map';

                    return 'vendor';
                },
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
