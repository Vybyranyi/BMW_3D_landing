import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

/** Dev-only: lets tools/inspector.js save JSON into tools/ (POST /__save?file=name.json). */
function devSave() {
  return {
    name: 'dev-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save', (req, res) => {
        const url = new URL(req.url, 'http://x');
        const file = path.basename(url.searchParams.get('file') || 'out.json');
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          fs.writeFileSync(path.resolve('tools', file), body);
          res.end('ok');
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [devSave()],
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
