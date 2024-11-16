import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  extensionApi: 'chrome',
  manifest: {
    permissions: ['bookmarks', 'tabs',
    'scripting'
    ],
    host_permissions: ['<all_urls>'],
  }
});
