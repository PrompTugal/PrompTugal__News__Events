// Render _site/preview.svg (made by scripts/build.mjs) to src/preview.png, the social-card image (1200x630).
// Run by the agent at each wake after a build, in a session with Playwright's Chromium (CI has none, so the PNG is
// the one committed at the last wake; the SVG is rebuilt at every deploy). events.b@PrompTugal.dinis, 18 Nov 2026. Apache-2.0.
const { chromium } = require('playwright');
const { readFileSync } = require('node:fs');
(async () => {
  const svg = readFileSync('_site/preview.svg', 'utf8');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
  await p.screenshot({ path: 'src/preview.png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await b.close();
  console.log('wrote src/preview.png');
})();
