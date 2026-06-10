import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [],
  test: {
    include: ['./src/**/*.{test.ts,test.tsx,test.js,test.jsx}'],
    environment: 'node',
    globals: true,
    setupFiles: './src/modules/tests/setup.ts',
  },
});
