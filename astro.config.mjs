import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import netlify from '@astrojs/netlify';

export default defineConfig({
  integrations: [react(), tailwind()],
  output: 'server',
  adapter: netlify(),
  vite: {
    ssr: {
      noExternal: ['@tanstack/react-table']
    },
    define: {
      'import.meta.env.R2_ACCOUNT_ID': JSON.stringify(process.env.R2_ACCOUNT_ID),
      'import.meta.env.R2_ACCESS_KEY_ID': JSON.stringify(process.env.R2_ACCESS_KEY_ID),
      'import.meta.env.R2_SECRET_ACCESS_KEY': JSON.stringify(process.env.R2_SECRET_ACCESS_KEY),
      'import.meta.env.R2_BUCKET_NAME': JSON.stringify(process.env.R2_BUCKET_NAME),
      'import.meta.env.R2_PUBLIC_URL': JSON.stringify(process.env.R2_PUBLIC_URL),
    }
  }
});
