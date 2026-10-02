// Wspólne dla narzędzi: serwer statyczny + Chromium z otwartą stroną,
// która wystawia window.__player. Canvas ustawiany na stały rozmiar.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, relative } from 'node:path';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

export function parseArgs(argv) {
  const args = argv.slice(2);
  return {
    page: args.find((a) => !a.startsWith('--')),
    opt(name, def) {
      const i = args.indexOf(`--${name}`);
      if (i < 0) return def;
      const v = args[i + 1];
      return v === undefined || v.startsWith('--') ? true : v;
    },
  };
}

export async function openPlayer(page, { width = 1280 } = {}) {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('Brak pakietu "playwright". Zainstaluj: npm i -D playwright');
    process.exit(1);
  }
  // prosty serwer statyczny (moduły ES nie działają z file://)
  const root = resolve('.');
  const server = createServer(async (req, res) => {
    try {
      const p = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (relative(root, p).startsWith('..')) throw new Error('poza katalogiem');
      const body = await readFile(p);
      res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/${page}`;

  // Chromium sam czyta HTTPS_PROXY ze środowiska i omija proxy dla 127.0.0.1.
  // Dodatkowe flagi (np. zaufanie do CA proxy): zmienna CHROMIUM_ARGS.
  const extra = (process.env.CHROMIUM_ARGS ?? '').split(' ').filter(Boolean);
  const browser = await chromium.launch({ args: extra });
  const tab = await browser.newPage({ viewport: { width, height: Math.round((width * 9) / 16) }, deviceScaleFactor: 1 });
  tab.on('pageerror', (e) => console.error('błąd strony:', e.message));
  tab.on('console', (m) => m.type() === 'error' && console.error('konsola:', m.text()));
  tab.on('requestfailed', (r) => console.error('nieudane żądanie:', r.url(), r.failure()?.errorText));
  await tab.goto(url, { waitUntil: 'load' });
  await tab.waitForFunction(() => window.__player, null, { timeout: 10000 });
  await tab.evaluate(() => window.__player.ready);

  // canvas renderujemy w docelowej rozdzielczości niezależnie od układu strony
  const dims = await tab.evaluate((w) => {
    const p = window.__player;
    p.pause();
    const c = p.canvas;
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: '9999', maxWidth: 'none', aspectRatio: 'auto' });
    c.style.width = `${w}px`;
    c.style.height = `${Math.round((w * p.scene.h) / p.scene.w)}px`;
    p.resize();
    return { duration: p.duration, w: c.width, h: c.height };
  }, width);

  return {
    tab,
    dims,
    async close() {
      await browser.close();
      server.close();
    },
  };
}
