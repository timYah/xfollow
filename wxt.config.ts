import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  // Ensure dev server runs on port 3001 to match page CSP during development
  server: { port: 3001 },
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'xfollow',
    permissions: ['storage'],
    host_permissions: ['https://x.com/*'],
  },
});
