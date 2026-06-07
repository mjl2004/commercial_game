import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'src/testing/parityRunner.ts',
    outDir: '.parity-dist',
    emptyOutDir: true,
    target: 'node18',
    minify: false,
    rollupOptions: {
      output: {
        entryFileNames: 'parityRunner.js',
      },
    },
  },
});
