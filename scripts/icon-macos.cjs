'use strict';
// Render the existing product SVG; no new artwork or external image service.
const fs = require('node:fs/promises');
const path = require('node:path');
async function buildIcon() {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const root = path.resolve(__dirname, '..', 'manager');
    const svg = await fs.readFile(path.join(root, 'icon.svg'), 'utf8');
    const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
    await page.setContent(
      `<style>body{margin:0}svg{width:1024px;height:1024px;display:block}</style>${svg}`
    );
    const png = await page.screenshot({ omitBackground: true });
    const header = Buffer.alloc(16);
    header.write('icns', 0);
    header.writeUInt32BE(png.length + 16, 4);
    header.write('ic10', 8);
    header.writeUInt32BE(png.length + 8, 12);
    await fs.writeFile(path.join(root, 'icon.icns'), Buffer.concat([header, png]));
    console.log('macOS icon generated from manager/icon.svg');
  } finally {
    await browser.close();
  }
}
if (require.main === module)
  buildIcon().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
module.exports = { buildIcon };
