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
                // Function form, not the object form this used to use. Object form matches a
                // module only by its exact resolved id, so listing 'react'/'react-dom' never caught
                // react/jsx-runtime or react-dom/client -- which is what React 19 actually pulls in.
                // React therefore ended up fused into the entry chunk, and every app-code change
                // invalidated all ~300kB of it instead of just the app's share.
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
