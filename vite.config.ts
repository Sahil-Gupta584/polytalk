import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitroV2Plugin } from "@tanstack/nitro-v2-vite-plugin";
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    nitroV2Plugin({
      preset: "vercel",
      compatibilityDate: "2025-10-26",
    }),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
