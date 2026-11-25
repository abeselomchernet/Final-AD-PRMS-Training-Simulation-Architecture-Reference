import fs from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const FRONTEND_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg', '.ico']);

function isClientOnlyOutDir(outDir: string | undefined): boolean {
  if (!outDir) return false;
  const normalized = outDir.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized === 'dist/client' || normalized.endsWith('/dist/client');
}

function frontendClientIsolationPlugin(): Plugin {
  let clientOnlyBuild = false;
  let resolvedOutDir = '';

  return {
    name: 'adprms-frontend-client-isolation',
    enforce: 'post',
    config(userConfig, env) {
      if (env.command === 'build' && isClientOnlyOutDir(userConfig.build?.outDir)) {
        return {
          build: {
            sourcemap: false,
          },
        };
      }
      return undefined;
    },
    configResolved(resolvedConfig) {
      clientOnlyBuild =
        resolvedConfig.command === 'build' && isClientOnlyOutDir(resolvedConfig.build.outDir);
      resolvedOutDir = path.resolve(resolvedConfig.root, resolvedConfig.build.outDir);
    },
    transformIndexHtml(html) {
      if (!clientOnlyBuild) return html;
      return html.replace(
        /<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]*"\s*\/?>/i,
        `<meta\n      http-equiv="Content-Security-Policy"\n      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; connect-src 'self' wss: https:; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';"\n    />`
      );
    },
    closeBundle() {
      if (!clientOnlyBuild || !resolvedOutDir) return;
      const aistudioDir = path.join(resolvedOutDir, 'assets', 'aistudio');
      if (!fs.existsSync(aistudioDir)) return;
      for (const entry of fs.readdirSync(aistudioDir, { withFileTypes: true })) {
        const fullPath = path.join(aistudioDir, entry.name);
        if (entry.isDirectory()) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          continue;
        }
        const ext = path.extname(entry.name).toLowerCase();
        if (!FRONTEND_IMAGE_EXTENSIONS.has(ext)) {
          fs.rmSync(fullPath, { force: true });
        }
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        includeAssets: [
          'apple-touch-icon.png',
          'icon.svg',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'AD-PRMS Mobile & Office Suite',
          short_name: 'AD-PRMS',
          description:
            'Abdulwehab Dekebo Property & Rental Management System — Installable Tenant & Out-of-Office Owner PWA.',
          theme_color: '#0D1D30',
          background_color: '#0D1D30',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,jpg}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
        devOptions: {
          // Disabled in dev: vite-plugin-pwa's registerDevSW calls import.meta.hot.send()
          // on startup, which throws in Vite 8 when HMR WebSocket is disabled/blocked.
          enabled: false,
        },
      }),
      frontendClientIsolationPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'lucide-react',
        'motion/react',
        'recharts',
        '@supabase/supabase-js',
        '@supabase/ssr',
      ],
    },
    build: {
      sourcemap: (process.env.NODE_ENV === 'production' ? 'hidden' : true) as 'hidden' | boolean,
      rolldownOptions: {
        input: path.resolve(import.meta.dirname, 'index.html'),
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'react-vendor',
                test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                priority: 30,
              },
              {
                name: 'ui-vendor',
                test: /node_modules[\\/](lucide-react|motion|framer-motion)[\\/]/,
                priority: 25,
              },
              {
                name: 'supabase-vendor',
                test: /node_modules[\\/]@supabase[\\/]/,
                priority: 28,
              },
              {
                name: 'seed-data',
                test: /src[\\/]data[\\/](seedData|extendedSeedData|trainingCatalog)/,
                priority: 20,
              },
            ],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
