import { cpSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
mkdirSync('public/ocr', { recursive: true });
cpSync('node_modules/tesseract.js/dist/worker.min.js', 'public/ocr/worker.min.js');
for (const name of readdirSync('node_modules/tesseract.js-core')) {
  if (/\.(wasm|js)$/.test(name))
    cpSync(join('node_modules/tesseract.js-core', name), join('public/ocr', name));
}
cpSync(
  'node_modules/@tesseract.js-data/por/4.0.0/por.traineddata.gz',
  'public/ocr/por.traineddata.gz',
);

for (const folder of ['cmaps', 'standard_fonts', 'wasm']) {
  mkdirSync(`public/pdf-assets/${folder}`, { recursive: true });
  cpSync(`node_modules/pdfjs-dist/${folder}`, `public/pdf-assets/${folder}`, { recursive: true });
}

// Electron 44 downloads its runtime lazily. Prepare it now so desktop startup works offline.
if (
  existsSync('node_modules/electron/install.js') &&
  !['1', 'true'].includes(process.env.ELECTRON_SKIP_BINARY_DOWNLOAD || '')
) {
  const result = spawnSync(process.execPath, ['node_modules/electron/install.js'], {
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
