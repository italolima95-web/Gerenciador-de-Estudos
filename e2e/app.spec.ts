import { test, expect } from '@playwright/test';
function makePdf(pages: string[][]) {
  const objects: string[] = ['<< /Type /Catalog /Pages 2 0 R >>', ''];
  const pageIds: number[] = [];
  for (const lines of pages) {
    const pageId = objects.length + 1,
      contentId = pageId + 1;
    pageIds.push(pageId);
    const content =
      'BT /F1 14 Tf 50 780 Td ' +
      lines
        .map((s, i) => `${i ? '0 -24 Td ' : ''}(${s.replace(/[\\()]/g, '\\$&')}) Tj`)
        .join('\n') +
      ' ET';
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> >> >> /Contents ${contentId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    );
  }
  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((i) => i + ' 0 R').join(' ')}] >>`;
  let pdf = '%PDF-1.4\n',
    offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const start = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((o) => String(o).padStart(10, '0') + ' 00000 n \n')
    .join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}
test('fluxo real: disciplinas sem edital, comparação, leitura, exercícios por volta, revisão e backup', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Um novo dia para avançar.' })).toBeVisible();
  await expect(page.getByText('Cadastrar meu primeiro concurso')).toBeVisible();
  await page.screenshot({
    path: 'test-results/inicio-vazio.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Cadastrar minhas disciplinas', exact: true }).click();
  await page.getByLabel('Processo Penal', { exact: true }).check();
  await page.getByLabel('Direito Civil', { exact: true }).check();
  await page.getByLabel('Outra disciplina').fill('Disciplina personalizada');
  await page.getByRole('button', { name: 'Cadastrar disciplinas', exact: true }).click();
  await expect(page.locator('.topic-row')).toHaveCount(3);
  await expect(page.getByRole('combobox', { name: 'Concurso selecionado' })).toContainText(
    'Meus estudos',
  );
  await page
    .locator('.topic-row')
    .filter({ hasText: 'Direito Civil' })
    .getByRole('button', { name: 'Adicionar assunto', exact: true })
    .click();
  await page.getByLabel('Título original').fill('Pessoas');
  await page.getByLabel('Cobertura teórica').selectOption('studied');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Analisar Edital', exact: true }).click();
  await page.getByRole('button', { name: 'Importar edital ou retificação' }).click();
  const pdf = makePdf([
    ['EDITAL 01/2026', 'Data da prova: 20/12/2026'],
    [
      'CONTEÚDO PROGRAMÁTICO',
      'DIREITO CIVIL',
      '1. Pessoas.',
      '2. Obrigações.',
      'DIREITO PROCESSUAL PENAL',
      '1. Inquérito.',
      'PORTUGUÊS',
      '1. Crase',
      '1.1 Emprego do acento grave',
    ],
  ]);
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'edital-teste.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.getByRole('button', { name: 'Importar e extrair texto' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 30000 });
  await page.getByRole('button', { name: 'Analisar documento', exact: true }).click();
  await expect(page.getByText('1. Crase', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Crase', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar sugestões para conferência' }).click();
  await expect(page.getByRole('cell', { name: /^20\/12\/2026/ })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Conteúdo programático × meus estudos' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('row')
      .filter({ has: page.getByRole('cell', { name: /^DIREITO CIVIL › Pessoas\./ }) })
      .getByRole('cell', { name: 'Estudado', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Confirmar', exact: true })
    .filter({ hasText: 'Confirmar' })
    .last()
    .click();
  await page.getByRole('button', { name: 'Disciplinas', exact: true }).click();
  await page.getByRole('button', { name: 'Expandir PORTUGUÊS' }).click();
  await page.getByRole('button', { name: 'Conferir com o Edital Original' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Leitor de PDF' })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Página atual' })).toHaveValue('2');
  await expect(page.getByLabel('Página 2 do documento')).toBeVisible();
  await page.getByRole('button', { name: 'Registrar leitura', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Registrar páginas estudadas' })
    .getByRole('button', { name: 'Salvar', exact: true })
    .click();
  await page.getByRole('button', { name: 'Fechar leitor' }).click();
  await page.getByRole('button', { name: 'Questões e Desempenho', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar questões', exact: true }).click();
  await page
    .getByLabel('Classificação principal')
    .selectOption({ label: 'PORTUGUÊS › Crase › Emprego do acento grave' });
  await page.getByLabel('Acertos', { exact: true }).fill('6');
  await page.getByLabel('Erros', { exact: true }).fill('2');
  await page.getByLabel('Em branco', { exact: true }).fill('2');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('.metric').first().getByText('75%', { exact: true })).toBeVisible();
  await expect(page.getByText('60% sobre 10 apresentadas')).toBeVisible();
  await page.getByRole('button', { name: 'Meu Ciclo', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar bloco', exact: true }).click();
  await page.getByLabel('Nome do bloco').fill('Revisar crase');
  await page.getByLabel('Disciplina ou tópico').selectOption({ label: 'PORTUGUÊS › Crase' });
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Você está aqui')).toBeVisible();
  await page.getByRole('button', { name: 'Concluir bloco', exact: true }).click();
  await expect(page.getByText('voltas concluídas')).toContainText('1');
  await page.getByRole('button', { name: 'Exercícios do Ciclo', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Exercícios do Ciclo — o que estudar nas questões' }),
  ).toBeVisible();
  await page.getByLabel('Volta de referência').selectOption('0');
  await expect(page.locator('.exercise-scope').getByText('Crase', { exact: true })).toBeVisible();
  await expect(page.locator('.exercise-scope').getByText('Pessoas', { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole('button', { name: 'Registrar questões deste conteúdo', exact: true })
    .click();
  await expect(page.getByLabel('Classificação principal').locator('option:checked')).toHaveText(
    'PORTUGUÊS › Crase',
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Revisões', exact: true }).click();
  await page.getByRole('button', { name: 'Programar revisões', exact: true }).click();
  await page.getByLabel('Assunto', { exact: true }).selectOption({ label: 'PORTUGUÊS › Crase' });
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('.review-item')).toHaveCount(3);
  await page.getByRole('button', { name: 'Pomodoro', exact: true }).click();
  await page.getByRole('button', { name: 'Iniciar sessão', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
  await expect(page.locator('.timer-ring strong')).toHaveText(/24:5\d/);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Pomodoro', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click();
  for (const section of [
    'Meus Concursos',
    'Biblioteca de PDFs',
    'Simulados',
    'Prontidão para a Prova',
    'Meus Hábitos',
    'Estatísticas',
  ]) {
    await page.getByRole('button', { name: section, exact: true }).click();
    await expect(page.locator('main')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup completo', exact: true }).click();
  expect((await dl).suggestedFilename()).toMatch(/\.zip$/);
  await page.getByRole('button', { name: 'Início', exact: true }).click();
  await page.screenshot({
    path: 'test-results/inicio-com-registros.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Alternar tema' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({
    path: 'test-results/tema-escuro.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
});

test('OCR em PDF digitalizado funciona sem serviços externos', async ({ page }) => {
  test.setTimeout(120000);
  const external: string[] = [];
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))
      return route.continue();
    if (['data:', 'blob:'].includes(url.protocol)) return route.continue();
    external.push(url.hostname);
    return route.abort();
  });
  await page.goto('/');
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1700;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 1200, 1700);
    ctx.fillStyle = 'black';
    ctx.font = '48px Arial';
    ctx.fillText('PORTUGUES', 100, 160);
    ctx.fillText('Crase e concordancia', 100, 260);
    return canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
  });
  const jpeg = Buffer.from(image, 'base64');
  const objects: Buffer[] = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Count 1 /Kids [3 0 R] >>'),
    Buffer.from(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 850] /Resources << /XObject << /Img 5 0 R >> >> /Contents 4 0 R >>',
    ),
    Buffer.from('<< /Length 32 >>\nstream\nq 600 0 0 850 0 0 cm /Img Do Q\nendstream'),
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width 1200 /Height 1700 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
      ),
      jpeg,
      Buffer.from('\nendstream'),
    ]),
  ];
  let pdf = Buffer.from('%PDF-1.4\n');
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf = Buffer.concat([pdf, Buffer.from(`${i + 1} 0 obj\n`), obj, Buffer.from('\nendobj\n')]);
  });
  const offset = pdf.length;
  pdf = Buffer.concat([
    pdf,
    Buffer.from(
      `xref\n0 6\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((n) => String(n).padStart(10, '0') + ' 00000 n \n')
        .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`,
    ),
  ]);
  await page.getByRole('button', { name: 'Biblioteca de PDFs', exact: true }).click();
  await page.getByRole('button', { name: 'Importar PDF', exact: true }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'ocr-offline-teste.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.getByLabel('Aplicar OCR local às páginas sem texto').check();
  await page.getByRole('button', { name: 'Importar e extrair texto' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 90000 });
  const extracted = await page.evaluate(async () => {
    const headers = { 'X-Study-Client': 'cronograma' };
    const state = await (await fetch('/api/state', { headers })).json();
    const doc = state.documents.find((d: { name: string }) => d.name === 'ocr-offline-teste');
    return await (await fetch('/api/documents/' + doc.id, { headers })).json();
  });
  expect(extracted.text_pages[0]).toMatch(/Crase/i);
  expect(external).toEqual([]);
});
