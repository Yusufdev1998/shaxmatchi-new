/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module "*.mp3" {
  const src: string;
  export default src;
}

