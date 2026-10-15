export type ExtractedFact = {
  field: string;
  value: string;
  page: number;
  section: string;
  excerpt: string;
  confidence: number;
};
export type ExtractedTopic = {
  key: string;
  parentKey: string | null;
  kind: 'discipline' | 'subject' | 'subtopic';
  title: string;
  page: number;
  section: string;
  excerpt: string;
  confidence: number;
};
export const factLabels: Record<string, string> = {
  name: 'Nome do concurso',
  agency: 'Órgão',
  notice: 'Número e ano do edital',
  board: 'Banca organizadora',
  publication: 'Publicação',
  role: 'Cargo',
  education: 'Escolaridade',
  vacancies: 'Vagas',
  reserve: 'Cadastro de reserva',
  salary: 'Remuneração',
  workload: 'Jornada',
  location: 'Lotação',
  registration: 'Período de inscrições',
  fee: 'Taxa de inscrição',
  exemption: 'Isenção',
  exam_date: 'Data da prova',
  exam_time: 'Horário da prova',
  duration: 'Duração',
  modality: 'Modalidade',
  questions: 'Quantidade de questões',
  weights: 'Pesos',
  maximum: 'Pontuação máxima',
  minimum: 'Pontuação mínima',
  approval: 'Aprovação e eliminação',
  essay: 'Prova discursiva',
  stages: 'Outras etapas',
  urls: 'Endereços oficiais',
};
const patterns: Record<string, RegExp> = {
  name: /^(?:nome do concurso|concurso público)\s*[:–—-]\s*(.+)/i,
  agency: /^(?:órgão|orgão|instituição)\s*[:–—-]\s*(.+)/i,
  notice: /\bEDITAL\s+(?:(?:DE\s+ABERTURA|N[º°o.]*)\s*)?(\d+\s*[/.-]\s*\d{4})/i,
  board: /^(?:banca(?: organizadora)?|organizadora|execução)\s*[:–—-]\s*(.+)/i,
  publication: /^(?:data de publicação|publicação)\s*[:–—-]\s*(.+)/i,
  role: /^(?:cargo|cargo e especialidade)\s*[:–—-]\s*(.+)/i,
  education: /^(?:escolaridade|requisitos de escolaridade)\s*[:–—-]\s*(.+)/i,
  vacancies: /^(?:número de vagas|vagas)\s*[:–—-]\s*(.+)/i,
  reserve: /^(?:cadastro de reserva)\s*[:–—-]\s*(.+)/i,
  salary: /^(?:remuneração|salário|vencimento)\s*[:–—-]\s*(.+)/i,
  workload: /^(?:jornada(?: de trabalho)?|carga horária)\s*[:–—-]\s*(.+)/i,
  location: /^(?:lotação|localidade)\s*[:–—-]\s*(.+)/i,
  registration: /^(?:período de inscrições|inscrições)\s*[:–—-]\s*(.+)/i,
  fee: /^(?:taxa de inscrição|valor da inscrição)\s*[:–—-]\s*(.+)/i,
  exemption: /^(?:pedidos de isenção|isenção)\s*[:–—-]\s*(.+)/i,
  exam_date:
    /(?:data(?: prevista)? (?:da |de )?prova(?: objetiva)?|prova objetiva)\s*[:–—-]\s*(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
  exam_time: /^(?:horário(?: da prova)?)\s*[:–—-]\s*(.+)/i,
  duration: /^(?:duração(?: da prova)?)\s*[:–—-]\s*(.+)/i,
  modality: /^(?:modalidade(?: de avaliação)?)\s*[:–—-]\s*(.+)/i,
  questions: /^(?:quantidade de questões|número de questões)\s*[:–—-]\s*(.+)/i,
  weights: /^(?:pesos(?: das disciplinas)?)\s*[:–—-]\s*(.+)/i,
  maximum: /^pontuação máxima\s*[:–—-]\s*(.+)/i,
  minimum: /^pontuação mínima\s*[:–—-]\s*(.+)/i,
  approval: /^(?:critérios de aprovação|critérios de eliminação)\s*[:–—-]\s*(.+)/i,
  essay: /^prova discursiva\s*[:–—-]\s*(.+)/i,
  stages: /^(?:outras etapas|etapas)\s*[:–—-]\s*(.+)/i,
  urls: /(https?:\/\/[^\s<>]+)/i,
};
const normalize = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function analyzeNotice(pages: string[], selectedRole = '') {
  const facts: ExtractedFact[] = [];
  const roles = new Set<string>();
  const topics: ExtractedTopic[] = [];
  let section = '',
    inSyllabus = false,
    discipline: string | null = null,
    subject: string | null = null,
    activeRole = '',
    serial = 0;
  for (const [index, page] of pages.entries())
    for (const raw of page.split(/\r?\n/)) {
      const line = raw.trim().replace(/\s+/g, ' ');
      if (!line) continue;
      if (/anexo|conte[uú]do program[aá]tico/i.test(line) && line.length < 180) section = line;
      for (const [field, pattern] of Object.entries(patterns)) {
        const m = line.match(pattern);
        if (m) {
          const value = m[1].trim();
          if (field === 'role') roles.add(value);
          if (!facts.some((f) => f.field === field && f.value === value))
            facts.push({
              field,
              value,
              page: index + 1,
              section,
              excerpt: raw,
              confidence: field === 'exam_date' ? 0.85 : 0.65,
            });
        }
      }
      const role = line.match(/^(?:cargo(?:s)?|especialidade)\s*[:–—-]\s*(.+)/i);
      if (role) {
        activeRole = role[1];
        roles.add(activeRole);
        discipline = null;
        subject = null;
        continue;
      }
      if (/conte[uú]dos? program[aá]ticos?/i.test(line)) {
        inSyllabus = true;
        continue;
      }
      if (!inSyllabus) continue;
      if (
        selectedRole &&
        activeRole &&
        !/todos|comu(ns|m)|gerais/i.test(activeRole) &&
        !normalize(activeRole).includes(normalize(selectedRole))
      )
        continue;
      if (
        /^(?:ANEXO\s+[IVX\d]+\s*[-–—:]\s*(?!CONTE[UÚ]DO)|\d+[.)]?\s+(?:DAS? DISPOSIÇÕES|DOS? RECURSOS|DO CRONOGRAMA))/i.test(
          line,
        )
      ) {
        inSyllabus = false;
        continue;
      }
      const knownHeading =
        /^(?:[\dIVX]+[.)\s–—:-]+)?(?:L[IÍ]NGUA PORTUGUESA|PORTUGU[EÊ]S|DIREITO [A-ZÀ-Ú ]+|MATEM[AÁ]TICA|RACIOC[IÍ]NIO L[OÓ]GICO|INFORM[AÁ]TICA|ESTAT[IÍ]STICA|CONTABILIDADE|ADMINISTRA[ÇC][ÃA]O [A-ZÀ-Ú ]+|CONHECIMENTOS [A-ZÀ-Ú ]+|LEGISLA[ÇC][ÃA]O [A-ZÀ-Ú ]+|L[IÍ]NGUA INGLESA)\s*:?$/i.test(
          line,
        );
      const caps =
        line === line.toLocaleUpperCase('pt-BR') &&
        /[A-ZÀ-Ú]/.test(line) &&
        line.length > 3 &&
        line.length < 100 &&
        !/^\d+[.]/.test(line) &&
        !/^(ANEXO|PÁGINA|CONHECIMENTOS (GERAIS|COMUNS|ESPECÍFICOS))/.test(line);
      if (knownHeading || caps) {
        const title = line.replace(/^[\dIVX]+[.)\s–—:-]+/, '').replace(/:$/, '');
        const key = `t${serial++}`;
        topics.push({
          key,
          parentKey: null,
          kind: 'discipline',
          title,
          page: index + 1,
          section,
          excerpt: raw,
          confidence: 0.6,
        });
        discipline = key;
        subject = null;
        continue;
      }
      if (!discipline) continue;
      const number = line.match(/^(\d+(?:\.\d+)*)(?:[.)]|\s)\s*(.+)$/);
      const bullet = line.match(/^[-•●▪]\s*(.+)/);
      if (number || bullet) {
        const title = (number?.[2] || bullet?.[1] || '').trim();
        if (!title) continue;
        const sub = !!bullet || !!number?.[1].includes('.');
        const key = `t${serial++}`;
        topics.push({
          key,
          parentKey: sub ? subject || discipline : discipline,
          kind: sub && subject ? 'subtopic' : 'subject',
          title,
          page: index + 1,
          section,
          excerpt: raw,
          confidence: 0.55,
        });
        if (!sub) subject = key;
      }
    }
  return {
    facts,
    roles: [...roles],
    topics,
    warning:
      'Extração local por regras. Informação não confirmada. Verifique no edital. Tabelas e estruturas complexas podem exigir cadastro manual.',
  };
}
export function suggestMatches(
  topics: { id: string; title: string }[],
  documentId: string,
  pages: string[],
) {
  const tokenize = (s: string) =>
    normalize(s)
      .match(/[a-z]{3,}/g)
      ?.filter(
        (w) => !['para', 'dos', 'das', 'com', 'uma', 'por', 'que', 'direito', 'sobre'].includes(w),
      ) || [];
  return topics.flatMap((topic) => {
    const words = new Set(tokenize(topic.title));
    if (!words.size) return [];
    let best = 0,
      start = 0;
    for (const [i, page] of pages.entries()) {
      const tokens = new Set(tokenize(page));
      const score = [...words].filter((w) => tokens.has(w)).length / words.size;
      if (score > best) {
        best = score;
        start = i + 1;
      }
    }
    return best >= 0.65
      ? [
          {
            topic_id: topic.id,
            document_id: documentId,
            start_page: start,
            end_page: start,
            confidence: best,
            confirmed: 0,
          },
        ]
      : [];
  });
}
