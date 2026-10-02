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
          const dir = path.resolve('tools', file.endsWith('.png') ? 'catalog' : '');
          fs.mkdirSync(dir, { recursive: true });
          const png = body.match(/^data:image\/png;base64,(.*)$/s);
          fs.writeFileSync(path.join(dir, file), png ? Buffer.from(png[1], 'base64') : body);
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
