import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import sveltePreprocess from 'svelte-preprocess'
import path from 'path'

export default defineConfig({
  plugins: [
    svelte({
      preprocess: sveltePreprocess({
        typescript: {
          compilerOptions: {
            verbatimModuleSyntax: true,
          }
        },
        aliases: [],
        babel: false,
        coffeescript: false,
        globalStyle: false,
        less: false,
        postcss: false,
        pug: false,
        replace: false,
        sass: false,
        scss: false,
        stylus: false,
      }),
      compilerOptions: {
        css: 'external',
      },
      onwarn: (warning, handler) => {
        if (warning.code?.startsWith('a11y-')) return;
        handler(warning);
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve('./src'),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
})
