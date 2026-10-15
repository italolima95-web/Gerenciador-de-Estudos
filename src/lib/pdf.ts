import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker } from 'tesseract.js';
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
export { pdfjs };
export const pdfOptions = {
  standardFontDataUrl: '/pdf-assets/standard_fonts/',
  cMapUrl: '/pdf-assets/cmaps/',
  cMapPacked: true,
  wasmUrl: '/pdf-assets/wasm/',
};
export function textFromContent(items: unknown[]) {
  let result = '',
    lastY: number | undefined,
    lastEnd: number | undefined;
  for (const value of items) {
    const item = value as { str?: string; hasEOL?: boolean; width?: number; transform?: number[] };
    if (typeof item.str !== 'string') continue;
    const y = item.transform?.[5];
    if (lastY !== undefined && y !== undefined && Math.abs(lastY - y) > 3 && !result.endsWith('\n'))
      result += '\n';
    const x = item.transform?.[4];
    if (
      x !== undefined &&
      lastEnd !== undefined &&
      y === lastY &&
      x - lastEnd > 18 &&
      !result.endsWith('\n')
    )
      result += '\t';
    result += item.str + (item.hasEOL ? '\n' : ' ');
    lastEnd = x === undefined ? undefined : x + (item.width || 0);
    lastY = y;
  }
  return result.trim();
}
export async function ocrCanvas(canvas: HTMLCanvasElement, onProgress: (progress: number) => void) {
  const worker = await createWorker('por', 1, {
    workerPath: '/ocr/worker.min.js',
    langPath: '/ocr',
    corePath: '/ocr',
    workerBlobURL: false,
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress(m.progress);
    },
  });
  try {
    return (await worker.recognize(canvas)).data.text;
  } finally {
    await worker.terminate();
  }
}
export async function extractPdf(file: File, ocr: boolean, onProgress: (message: string) => void) {
  const task = pdfjs.getDocument({ ...pdfOptions, data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      onProgress(`Extraindo página ${i} de ${doc.numPages}…`);
      const page = await doc.getPage(i);
      let text = textFromContent((await page.getTextContent()).items);
      if (ocr && text.replace(/\s/g, '').length < 20) {
        const viewport = page.getViewport({ scale: 1.5 }),
          canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, viewport }).promise;
        text = await ocrCanvas(canvas, (p) =>
          onProgress(`OCR local · página ${i}/${doc.numPages} · ${Math.round(p * 100)}%`),
        );
        canvas.width = 0;
      }
      pages.push(text);
    }
    const outline = await doc.getOutline();
    return {
      pages,
      outline: (outline || []).map((o) => ({
        title: o.title,
        dest: o.dest,
        items: o.items.map((c) => ({ title: c.title, dest: c.dest })),
      })),
    };
  } finally {
    await task.destroy();
  }
}
