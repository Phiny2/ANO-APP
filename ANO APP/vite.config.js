import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    base: './',
    plugins: [react()],
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'firebase-core': ['firebase/app'],
                    'firebase-auth': ['firebase/auth'],
                    'firebase-firestore': ['firebase/firestore'],
                    'firebase-storage': ['firebase/storage'],
                    react: ['react', 'react-dom'],
                },
            },
        },
    },
});
