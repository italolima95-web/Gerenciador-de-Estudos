import { _electron as electron } from 'playwright';
import { expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const profile = mkdtempSync(path.join(tmpdir(), 'cronograma-desktop-test-'));
const packaged = process.argv.includes('--packaged');
const executablePath = packaged
  ? path.resolve('release/linux-unpacked/cronograma-de-estudos')
  : require('electron');
const flags =
  process.platform === 'linux'
    ? ['--headless', '--ozone-platform=headless', '--no-sandbox', '--disable-gpu']
    : [];
const args = [...(packaged ? [] : [process.cwd()]), `--user-data-dir=${profile}`, ...flags];
let app;
try {
  app = await electron.launch({
    executablePath,
    args,
    env: { ...process.env, XDG_CACHE_HOME: path.join(profile, 'cache') },
    timeout: 30000,
  });
  let page = await app.firstWindow();
  await expect(page.getByRole('heading', { name: 'Um novo dia para avançar.' })).toBeVisible();
  await page.getByRole('button', { name: 'Cadastrar meu primeiro concurso' }).click();
  await page.getByLabel('Nome do concurso').fill('Teste desktop persistente');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await app.close();
  app = await electron.launch({
    executablePath,
    args,
    env: { ...process.env, XDG_CACHE_HOME: path.join(profile, 'cache') },
    timeout: 30000,
  });
  page = await app.firstWindow();
  await expect(page.getByRole('combobox', { name: 'Concurso selecionado' })).toContainText(
    'Teste desktop persistente',
  );
  console.log(
    `Desktop ${packaged ? 'empacotado' : 'de desenvolvimento'}: interface carregada, cadastro salvo e persistência após reinício confirmada.`,
  );
} finally {
  if (app) await app.close().catch(() => {});
  rmSync(profile, { recursive: true, force: true });
}
