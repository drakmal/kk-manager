import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

// Default environment is node. UI and game tests opt into the DOM with a
// `// @vitest-environment happy-dom` docblock at the top of the file.
export default defineConfig({
  plugins: [preact()],
  test: {
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
