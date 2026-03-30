import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "node:path";
import { VitePWA } from "vite-plugin-pwa";
import mkcert from "vite-plugin-mkcert";

export default defineConfig({
  plugins: [
    react(),
    mkcert({
      // So https://127.0.0.1:… matches the cert (not only "localhost")
      hosts: ["localhost", "127.0.0.1"],
    }),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: [
        "icons/icon.svg",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-192.png",
        "icons/icon-maskable-512.png",
      ],
      manifest: {
        name: "Shaxmatchi Admin",
        short_name: "Admin",
        description: "Shaxmatchi admin panel",
        theme_color: "#312e81",
        background_color: "#312e81",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webp,ico}"],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/localhost:3000\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 24 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    https: true,
    // Listen on all interfaces so https://127.0.0.1:5173 works (not only localhost / ::1)
    host: true,
    port: 5173,
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname, "../..")]
    }
  }
});

