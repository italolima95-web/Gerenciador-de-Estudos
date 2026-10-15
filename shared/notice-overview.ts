export { isAdministrativeHeading } from './catalog.js';
import { normalizeTitle, isAdministrativeHeading } from './catalog.js';
import type { ExtractedFact } from './analyzer.js';
export const overviewFields = {
  agency: 'Órgão',
  board: 'Banca',
  role: 'Cargo',
  exam_date: 'Data da prova',
  vacancies: 'Número de vagas',
  questions: 'Quantidade de questões',
  registration_url: 'Página de inscrição',
  fee: 'Valor da inscrição',
};
export type QuestionDistribution = { subject: string; questions: number };
export function parseQuestionDistribution(value: string): QuestionDistribution[] {
  return value.split('\n').flatMap((line) => {
    const m = line.trim().match(/^(.+):\s*(\d+)\s*(?:quest[oõ]es)?\s*$/i);
    return m ? [{ subject: m[1].trim(), questions: Number(m[2]) }] : [];
  });
}
export function extractNoticeOverview(pages: string[], selectedRole = ''): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  let questionTable = false,
    questionIndex = 1,
    schedule = false,
    syllabus = false,
    activeRole = '',
    pendingSubject = '';
  const add = (field: string, value: string, page: number, excerpt: string) => {
    if (!facts.some((f) => f.field === field && f.value === value))
      facts.push({
        field,
        value,
        page,
        excerpt,
        section:
          field === 'schedule'
            ? 'Cronograma'
            : field === 'registration_url'
              ? 'Inscrições'
              : 'Quadro de questões',
        confidence: 0.88,
      });
  };
  pages.forEach((text, pageIndex) => {
    const lines = text
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const rows: QuestionDistribution[] = [],
      events: string[] = [],
      sources: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i],
        plain = normalizeTitle(raw);
      const role = raw.match(/^(?:cargo|especialidade)\s*[:–—-]\s*(.+)/i);
      if (role) activeRole = role[1];
      if (
        /^(?:anexo\b.*)?(?:conteudo programatico|programa das provas|programa das disciplinas)/.test(
          plain,
        ) ||
        /^conteudo programatico/.test(plain)
      ) {
        syllabus = true;
        questionTable = false;
        schedule = false;
        pendingSubject = '';
      }
      if (
        (isAdministrativeHeading(raw) &&
          !(questionTable && /^(?:numero|quantidade|n) (?:de )?questoes$/.test(plain))) ||
        (/^anexo\b/.test(plain) && !/conteudo programatico/.test(plain))
      ) {
        syllabus = false;
        questionTable = false;
        schedule = /cronograma/.test(plain);
        pendingSubject = '';
      }
      if (!syllabus && /cronograma/.test(plain) && raw.length < 130 && !/[.;]$/.test(raw))
        schedule = true;
      const cells = raw.split(/\t+| {3,}|\s*\|\s*/).filter(Boolean);
      if (
        !syllabus &&
        /^(?:disciplinas?|materias?)$/.test(plain) &&
        /questoes/.test(normalizeTitle(lines[i + 1] || ''))
      ) {
        questionTable = true;
        questionIndex = 1;
        continue;
      }
      const tableHeader =
        /(?:disciplinas?|materias?|areas? de conhecimento|conteudos?)/.test(plain) &&
        /questoes|itens/.test(plain);
      if (!syllabus && tableHeader) {
        questionTable = true;
        pendingSubject = '';
        const idx = cells.findIndex((c) => /questoes|itens/.test(normalizeTitle(c)));
        questionIndex = idx > 0 ? idx : 1;
        continue;
      }
      if (!syllabus && /^(?:quadro de provas|distribuicao (?:de|das) questoes)/.test(plain)) {
        questionTable = true;
        continue;
      }
      if (!syllabus && questionTable && /^(?:numero|quantidade|n) (?:de )?questoes$/.test(plain))
        continue;
      if (
        !syllabus &&
        questionTable &&
        /^(?:peso|total|pontuacao|prova|disciplinas?|materias?|bloco)$/.test(plain)
      )
        continue;
      if (!syllabus) {
        const urls = [...raw.matchAll(/https?:\/\/[^\s<>"']+/gi)].map((m) =>
          m[0].replace(/[.,;)]$/, ''),
        );
        const context = [lines[i - 1] || '', raw, lines[i + 1] || ''].join(' ');
        if (
          /inscri[cç][aãõo]/i.test(context) &&
          !/isen[cç][aã]o|recurso|resultado|gabarito/i.test(raw)
        )
          for (const url of urls) add('registration_url', url, pageIndex + 1, context);
      }
      if (
        !syllabus &&
        schedule &&
        /\d{1,2}[/.]\d{1,2}[/.]\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+de\s+\w+\s+de\s+\d{4}/i.test(raw)
      ) {
        events.push(raw);
        sources.push(raw);
      }
      if (
        syllabus ||
        (selectedRole &&
          activeRole &&
          !/todos|comu[mn]s?/i.test(activeRole) &&
          !normalizeTitle(activeRole).includes(normalizeTitle(selectedRole)))
      )
        continue;
      const explicit = raw.match(
        /^(.+?)\s*[:–—-]\s*(\d+)\s*(?:\([^)]*\)\s*)?quest[oõ]es\s*[.;]?$/i,
      );
      let subject = '',
        count: number | undefined;
      if (explicit && !/^(?:total|prova|quantidade|numero|n[uú]mero)/i.test(explicit[1])) {
        subject = explicit[1];
        count = Number(explicit[2]);
      } else if (questionTable) {
        if (cells.length > questionIndex && /^\d+(?:\s*\([^)]*\))?$/.test(cells[questionIndex])) {
          subject = cells[0];
          count = Number(cells[questionIndex].match(/^\d+/)![0]);
        } else {
          const m = raw.match(/^(.+?)\s+(\d+)(?:\s+\d+(?:[,.]\d+)*)*$/);
          if (m) {
            subject = m[1];
            count = Number(m[2]);
          } else if (
            !/\d|https?:|tribunal|edital|p[aá]gina/i.test(raw) &&
            raw.length < 160 &&
            !/(?:questoes|disciplinas?|peso|pontuacao)/.test(plain)
          )
            pendingSubject += (pendingSubject ? ' ' : '') + raw;
        }
      }
      if (questionTable && /^(?:total|total geral|total de questoes)\b/.test(plain)) {
        const value = cells[questionIndex]?.match(/^\d+$/)?.[0] || raw.match(/\s(\d+)\s*$/)?.[1];
        if (value) add('questions', value, pageIndex + 1, raw);
      }
      if (
        subject &&
        count !== undefined &&
        !/^(?:total|soma|pontua[cç][aã]o|peso|n[uú]mero|quantidade)\b/i.test(subject)
      ) {
        subject = (pendingSubject ? pendingSubject + ' ' : '') + subject;
        pendingSubject = '';
        rows.push({ subject: subject.trim(), questions: count });
        sources.push(raw);
      }
    }
    if (rows.length)
      add(
        'question_distribution',
        rows.map((r) => `${r.subject}: ${r.questions} questões`).join('\n'),
        pageIndex + 1,
        sources.join('\n'),
      );
    if (events.length) add('schedule', events.join('\n'), pageIndex + 1, events.join('\n'));
  });
  return facts;
}
