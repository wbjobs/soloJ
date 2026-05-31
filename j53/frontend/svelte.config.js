import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter(),
    csrf: {
      checkOrigin: false,
      trustedOrigins: ['http://localhost:5173', 'http://localhost:4000']
    }
  }
};

export default config;
