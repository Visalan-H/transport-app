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
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
