import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TARGET_URL = 'https://gabrielrondon.github.io/brain-computer-interface/';
const OUTPUT_DIR = path.resolve('docs/images');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function run() {
  console.log('Launching Chrome from', CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu-sandbox', '--use-gl=angle'],
    defaultViewport: {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
    },
  });

  const page = await browser.newPage();
  console.log('Navigating to', TARGET_URL);
  await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait 3 seconds for WebAssembly, Three.js shaders, and oscilloscope to stabilize
  await new Promise((r) => setTimeout(r, 3000));

  // 1. Capture Studio View
  console.log('Capturing Studio Mode...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'studio_mode.png') });

  // 2. Capture NeuroPrompt View
  console.log('Capturing NeuroPrompt Mode...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('nav button'));
    const npBtn = buttons.find((b) => b.textContent?.includes('NeuroPrompt'));
    if (npBtn) npBtn.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  // Trigger generation
  await page.evaluate(() => {
    const genBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Generate with Brain State')
    );
    if (genBtn) genBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'neuroprompt_mode.png') });

  // 3. Capture GhostType View
  console.log('Capturing GhostType Mode...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('nav button'));
    const gtBtn = buttons.find((b) => b.textContent?.includes('GhostType'));
    if (gtBtn) gtBtn.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  // Trigger quick phrase to populate
  await page.evaluate(() => {
    const phraseBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('I need assistance')
    );
    if (phraseBtn) phraseBtn.click();
  });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'ghosttype_mode.png') });

  // 4. Capture NeuroTrigger View
  console.log('Capturing NeuroTrigger Mode...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('nav button'));
    const ntBtn = buttons.find((b) => b.textContent?.includes('NeuroTrigger'));
    if (ntBtn) ntBtn.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  // Fire a test trigger
  await page.evaluate(() => {
    const blinkBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Test Blink Trigger')
    );
    if (blinkBtn) blinkBtn.click();
  });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'neurotrigger_mode.png') });

  console.log('All screenshots captured successfully in', OUTPUT_DIR);
  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
