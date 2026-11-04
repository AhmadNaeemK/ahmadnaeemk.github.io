// usage: node shot.js <concept> [wait ms]  -> screenshots in scratchpad/shots
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const cid = process.argv[2] || 'a', wait = +(process.argv[3] || 2500);
const OUT = '/tmp/claude-0/-home-claude/f6b9244c-4f97-555f-abbd-40a5fe8bf56f/scratchpad/shots';
const dist = path.join(__dirname, 'dist', cid);
const body = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
fs.writeFileSync(path.join(dist, '_preview.html'), `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${body}</body></html>`);
(async () => {
  const b = await chromium.launch();
  for (const [name, w, h, scheme] of [['desk-light', 1366, 900, 'light'], ['desk-dark', 1366, 900, 'dark'], ['phone-light', 390, 844, 'light']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1 });
    const errs = [];
    p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    await p.goto('file://' + path.join(dist, '_preview.html'));
    await p.waitForTimeout(wait);
    await p.screenshot({ path: `${OUT}/${cid}-${name}.png` });
    if (name === 'desk-light') await p.screenshot({ path: `${OUT}/${cid}-full.png`, fullPage: true });
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    console.log(name, 'overflowX', ov, errs.filter(e => !/fonts\.g/.test(e)).join(' | '));
    await p.close();
  }
  await b.close();
})();
