const react = require('@vitejs/plugin-react');
const { defineConfig } = require('vite');

module.exports = defineConfig({
  base: './',
  server: {
    allowedHosts: ['courts-run-robert-confidence.trycloudflare.com'],
  },
  plugins: [react()],
});
