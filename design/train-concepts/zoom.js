// usage: node zoom.js <concept> <livery> <scheme> t1,t2,...  -> crops of the hero canvas at 2x
const { chromium } = require('playwright'); const path = require('path');
const [cid, liv, scheme, times] = [process.argv[2], process.argv[3] || 'metro', process.argv[4] || 'light', (process.argv[5] || '1500,7000').split(',').map(Number)];
const OUT = '/tmp/claude-0/-home-claude/f6b9244c-4f97-555f-abbd-40a5fe8bf56f/scratchpad/shots';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1366, height: 900 }, colorScheme: scheme, deviceScaleFactor: 2 });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('file://' + path.join(__dirname, 'dist', cid, '_preview.html'));
  await p.click(`[data-rail-livery="${liv}"]`, { force: true });
  let t0 = 0;
  for (const t of times) {
    await p.waitForTimeout(t - t0); t0 = t;
    const box = await p.locator('canvas').first().boundingBox();
    await p.screenshot({ path: `${OUT}/${cid}-zoom-${liv}-${scheme}-${t}.png`, clip: box });
  }
  await b.close();
})();
