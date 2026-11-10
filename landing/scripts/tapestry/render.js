const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 500, height: 250 }, deviceScaleFactor: 2 });
  for (const f of fs.readdirSync(__dirname + '/svg').filter((f) => f.endsWith('.html'))) {
    await p.goto('file://' + __dirname + '/svg/' + f);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(150);
    await p.screenshot({ path: __dirname + '/out/' + f.replace('.html', '.png') });
  }
  await b.close();
})();
