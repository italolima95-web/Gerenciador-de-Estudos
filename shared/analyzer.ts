import { disciplineKey, normalizeTitle } from './catalog.js';
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
  notice: /\bEDITAL\s+(?:DE\s+ABERTURA\s+)?(?:N[º°o.]*\s*)?(\d+\s*[/.-]\s*\d{4})/i,
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
const tableLabels: Record<string, string> = {
  cargo: 'role',
  'cargo e especialidade': 'role',
  escolaridade: 'education',
  requisitos: 'education',
  vagas: 'vacancies',
  'numero de vagas': 'vacancies',
  remuneracao: 'salary',
  subsidio: 'salary',
  'taxa de inscricao': 'fee',
  banca: 'board',
  organizadora: 'board',
  'jornada de trabalho': 'workload',
  lotacao: 'location',
  'periodo de inscricoes': 'registration',
  inscricoes: 'registration',
  publicacao: 'publication',
  'data de publicacao': 'publication',
  'horario da prova': 'exam_time',
  duracao: 'duration',
  'quantidade de questoes': 'questions',
  'numero de questoes': 'questions',
};
const monthNames = [
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
const datePattern =
  /\b(\d{1,2})\s*(?:[/.-]\s*(\d{1,2})\s*[/.-]|de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de)\s*(\d{4})\b/gi;
export function noticeDates(s: string) {
  const isoDates = [...s.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)]
    .map((m) => m[0])
    .filter((value) => {
      const d = new Date(value + 'T12:00:00Z');
      return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
    });
  return [
    ...new Set([
      ...isoDates,
      ...[...s.matchAll(datePattern)].flatMap((m) => {
        const month = m[2] ? Number(m[2]) : monthNames.indexOf(normalize(m[3])) + 1;
        const iso = `${m[4]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        const d = new Date(iso + 'T12:00:00Z');
        return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? [iso] : [];
      }),
    ]),
  ];
}
const contexts: Record<string, RegExp> = {
  agency:
    /tribunal de justi[cç]a|minist[eé]rio p[uú]blico|defensoria p[uú]blica|prefeitura|secretaria de estado/i,
  board:
    /banca organizadora|execu[cç][aã]o.{0,80}(?:concurso|responsabilidade)|organiza[cç][aã]o.{0,60}(?:concurso|responsabilidade)|(?:funda[cç][aã]o get[uú]lio vargas|cebraspe|funda[cç][aã]o carlos chagas|instituto (?:consulplan|aocp))/i,
  education:
    /bacharel.{0,20}direito|diploma.{0,60}(?:curso|gradua[cç][aã]o)|(?:n[ií]vel superior|ensino m[eé]dio|atividade jur[ií]dica)/i,
  vacancies: /\d+\s*(?:\([^)]*\)\s*)?vagas?\b/i,
  reserve: /cadastro de reserva/i,
  salary:
    /(?:subs[ií]dio|remunera[cç][aã]o|vencimento|sal[aá]rio).{0,100}R\$|R\$.{0,80}(?:subs[ií]dio|remunera[cç][aã]o)/i,
  workload: /(?:jornada|carga hor[aá]ria).{0,60}\d+\s*horas|\d+\s*horas semanais/i,
  location: /(?:lota[cç][aã]o|localidade).{0,100}/i,
  registration:
    /inscri[cç][oõ]es.{0,90}(?:per[ií]odo|\d{1,2}[/.]|\d{1,2}\s+de)|per[ií]odo.{0,40}inscri[cç]/i,
  fee: /(?:taxa|valor).{0,35}inscri[cç][aã]o.{0,90}R\$|R\$.{0,50}inscri[cç][aã]o/i,
  exemption: /isen[cç][aã]o.{0,100}(?:taxa|inscri[cç][aã]o|cad[uú]nico|per[ií]odo|\d{1,2}[/])/i,
  duration: /(?:dura[cç][aã]o|tempo).{0,60}\d+\s*(?:\([^)]*\)\s*)?horas/i,
  questions:
    /\d+\s*(?:\([^)]*\)\s*)?quest[oõ]es.{0,60}(?:objetivas|m[uú]ltipla)|prova objetiva.{0,90}\d+\s*(?:\([^)]*\)\s*)?quest[oõ]es/i,
  weights: /(?:peso|pesos).{0,35}\d/i,
  maximum: /(?:pontua[cç][aã]o|nota).{0,15}m[aá]xima.{0,35}\d/i,
  minimum: /(?:pontua[cç][aã]o|nota).{0,15}m[ií]nima.{0,35}\d/i,
  approval: /(?:eliminado|aprovado|habilitado).{0,100}(?:pontos|nota|acertos|por cento|%)/i,
  essay:
    /provas? (?:escritas?|discursivas?).{0,100}(?:senten[cç]a|dissertativ|quest[oõ]es|car[aá]ter)/i,
  stages: /(?:primeira|segunda|terceira|quarta|quinta|[1-5][ªa]) etapa.{0,140}/i,
  modality: /m[uú]ltipla escolha|certo ou errado/i,
};
function cleanNumber(s: string) {
  return s.replace(/^(?:\d+(?:\.\d+)*\.?|[IVXLCDM]+)\s*[.)–—:-]?\s+/i, '').trim();
}
const headingPattern =
  /^(?:(?:direito\s+)?(?:processual\s+)?(?:constitucional|administrativo|civil|penal(?:\s+especial)?|tribut[aá]rio|empresarial|ambiental|eleitoral|do\s+consumidor)|processo\s+(?:penal|civil)|direitos humanos|c[oó]digo de defesa do consumidor|estatuto da crian[cç]a e do adolescente|no[cç][oõ]es gerais\s*[/–—-]?\s*forma[cç][aã]o human[ií]stica|forma[cç][aã]o human[ií]stica|jurisprud[eê]ncia|l[ií]ngua portuguesa|portugu[eê]s|matem[aá]tica|racioc[ií]nio l[oó]gico|inform[aá]tica|estat[ií]stica|contabilidade|l[ií]ngua inglesa)(?=\s*[:–—]|\s*\d+[.)]|$)/i;
export function analyzeNotice(pages: string[], selectedRole = '') {
  const facts: ExtractedFact[] = [],
    topics: ExtractedTopic[] = [];
  const roles = new Set<string>();
  const addFact = (
    field: string,
    value: string,
    page: number,
    section: string,
    excerpt: string,
    confidence = 0.8,
  ) => {
    value = value.trim();
    if (field === 'role' && selectedRole && !normalize(value).includes(normalize(selectedRole)))
      return;
    if (!value || facts.some((f) => f.field === field && normalize(f.value) === normalize(value)))
      return;
    facts.push({ field, value, page, section, excerpt, confidence });
  };
  let section = '',
    inSyllabus = false,
    activeRole = '',
    discipline: string | null = null;
  let last: ExtractedTopic | undefined;
  const numbered = new Map<string, string>();
  const push = (
    title: string,
    kind: ExtractedTopic['kind'],
    parentKey: string | null,
    page: number,
    excerpt: string,
    confidence = 0.85,
  ) => {
    const t: ExtractedTopic = {
      key: `t${topics.length}`,
      title: title.trim(),
      kind,
      parentKey,
      page,
      section,
      excerpt,
      confidence,
    };
    topics.push(t);
    last = t;
    return t.key;
  };
  for (const [index, pageText] of pages.entries()) {
    const rawLines = pageText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const tableHeaders = new Set<string>();
    for (let n = 0; n < rawLines.length; n++) {
      const cells = rawLines[n].split(/\t+| {3,}|\s*\|\s*/).filter(Boolean);
      const fields = cells.map((cell) => tableLabels[normalizeTitle(cell.replace(/:$/, ''))]);
      if (fields[0] && fields.filter(Boolean).length === 1) {
        const value =
          cells.length === 2 ? cells[1] : cells.length === 1 ? rawLines[n + 1] || '' : '';
        if (value && !tableLabels[normalizeTitle(value)] && !/^\d+(?:\.\d+)*[.)]\s/.test(value))
          addFact(
            fields[0],
            value,
            index + 1,
            section,
            rawLines[n] + (cells.length === 1 ? '\n' + value : ''),
            0.9,
          );
      }
      if (fields.filter(Boolean).length >= 2) {
        tableHeaders.add(rawLines[n].replace(/\s+/g, ' '));
        const values = (rawLines[n + 1] || '').split(/\t+| {3,}|\s*\|\s*/).filter(Boolean);
        if (
          selectedRole &&
          fields.includes('role') &&
          values[fields.indexOf('role')] &&
          !normalize(values[fields.indexOf('role')]).includes(normalize(selectedRole))
        )
          continue;
        if (values.length === cells.length)
          fields.forEach((field, k) => {
            if (field && !tableLabels[normalizeTitle(values[k])])
              addFact(
                field,
                values[k],
                index + 1,
                section,
                rawLines[n] + '\n' + rawLines[n + 1],
                0.93,
              );
          });
      }
    }
    const lines = pageText
      .split(/\r?\n/)
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      let line = cleanNumber(raw);
      if (
        /^(?:ANEXO\b|CONTE[UÚ]DOS? PROGRAM[AÁ]TICOS?\b|PROGRAMA DAS (?:DISCIPLINAS|PROVAS))/i.test(
          line,
        ) &&
        line.length < 180
      )
        section = raw;
      // Field labels may be followed by a value on the next line (tables).
      const labeled = raw.replace(/^\d+(?:\.\d+)*[.)]?\s+/, '');
      const candidates = [labeled, `${labeled} ${lines[i + 1] || ''}`];
      for (const [field, pattern] of Object.entries(patterns)) {
        if (tableHeaders.has(raw)) continue;
        if (field === 'exam_date') continue;
        for (const candidate of candidates) {
          const m = candidate.match(pattern);
          if (m && m[1].trim() && !tableLabels[normalizeTitle(m[1])]) {
            addFact(field, m[1], index + 1, section, candidate, 0.9);
            break;
          }
        }
      }
      // Narrative provisions, multi-line clauses and schedule rows. Never infer missing fields.
      const next = lines[i + 1] || '';
      const newProvision =
        /^(?:\d+(?:\.\d+)*[.)]?\s+|(?:A |As |O |Os )?(?:prova|resultado|gabarito|inscri[cç][oõ]es|taxa|remunera[cç][aã]o|subs[ií]dio|recurso|publica[cç][aã]o|edital|cargo|cadastro|etapa)\b)/i.test(
          next,
        );
      const context = newProvision ? raw : `${raw} ${next}`;
      if (!inSyllabus) {
        if (/^concurso p[uú]blico (?:para|de)\b/i.test(raw))
          addFact('name', context, index + 1, section, context, 0.85);
        const role = context.match(
          /\b(?:Juiz(?:a)?\s+Substitut[oa]|Promotor(?:a)?\s+de\s+Justi[cç]a|Defensor(?:a)?\s+P[uú]blic[oa])\b/i,
        );
        if (role) {
          roles.add(role[0]);
          addFact('role', role[0], index + 1, section, context, 0.93);
        }
        for (const [field, pattern] of Object.entries(contexts)) {
          if (
            !pattern.test(raw) &&
            !(
              pattern.test(context) &&
              /(?:R\$|\d|bacharel|diploma|tribunal|funda[cç][aã]o)/i.test(raw)
            )
          )
            continue;
          if (
            selectedRole &&
            /\bcargo\b/i.test(context) &&
            !normalize(context).includes(normalize(selectedRole))
          )
            continue;
          // Keep one complete provision as the value; avoid dozens of repeated fragments.
          if (facts.some((f) => f.field === field && normalize(f.excerpt).includes(normalize(raw))))
            continue;
          let value = raw;
          if (
            pattern.test(context) &&
            (!pattern.test(raw) || /(?:de|no|na|das|dos|R\$|:)$/i.test(raw))
          )
            value = context;
          if (field === 'agency')
            value =
              value.match(
                /(?:tribunal de justi[cç]a|minist[eé]rio p[uú]blico|defensoria p[uú]blica)(?:\s+(?:do|de|da|estado|santa|catarina|rio|grande|sul|norte|s[aã]o|paulo|paran[aá]|bahia|minas|gerais|federal|distrito|e|territ[oó]rios|esp[ií]rito|santo|goi[aá]s|pernambuco|cear[aá]|maranh[aã]o|para[ií]ba|mato|grosso|tocantins|rond[oô]nia|roraima|acre|amap[aá]|amazonas|par[aá]|alagoas|sergipe|piau[ií]))*/i,
              )?.[0] || raw;
          if (field === 'board')
            value =
              value.match(
                /funda[cç][aã]o get[uú]lio vargas|cebraspe|funda[cç][aã]o carlos chagas|instituto (?:consulplan|aocp)/i,
              )?.[0] || value;
          addFact(field, value, index + 1, section, context, 0.78);
        }
        if (/publica[cç][aã]o|publicado|disponibilizado/i.test(raw))
          for (const d of noticeDates(raw))
            addFact('publication', d, index + 1, section, raw, 0.85);
        // Only an objective exam date: registration/results/other stages do not qualify.
        if (
          /(?:prova\s+(?:objetiva|escrita objetiva)|data\s+(?:prevista\s+)?(?:da\s+|de\s+)?prova)(?!\s+(?:discursiva|oral|pr[aá]tica))/i.test(
            raw,
          ) &&
          !/resultado|gabarito|recurso|convoca[cç][aã]o|local de|locais de/i.test(raw)
        ) {
          const dates = noticeDates(raw).length ? noticeDates(raw) : noticeDates(context);
          for (const d of dates) addFact('exam_date', d, index + 1, section, context, 0.9);
          const time = context.match(/\b\d{1,2}(?::\d{2}|h\d{0,2})\s*(?:horas)?\b/i);
          if (time) addFact('exam_time', time[0], index + 1, section, context, 0.8);
        }
      }
      const roleHeading = line.match(
        /^(?:cargo(?:s)?(?: de)?|especialidade)\s*(?:[:–—-]\s*|\s+)(.+)/i,
      );
      if (roleHeading) {
        activeRole = roleHeading[1];
        roles.add(activeRole);
        if (inSyllabus) {
          discipline = null;
          numbered.clear();
          last = undefined;
        }
        continue;
      }
      // A reference in prose or a table of contents must not start the syllabus.
      if (
        /^(?:(?:ANEXO\s+[\dIVXLCDM]+\s*[-–—:]?\s*)?(?:CONTE[UÚ]DOS? PROGRAM[AÁ]TICOS?(?: DAS PROVAS(?: ESCRITAS?| OBJETIVAS?| DISCURSIVAS?)*)?|PROGRAMA(?:S)? (?:DAS|PARA AS) (?:DISCIPLINAS|PROVAS))|ANEXO\s+[\dIVXLCDM]+\s*[-–—:]\s*PROGRAMAS?)\s*(?:[-–—:](?!.*\.{3}).*)?$/i.test(
          line,
        )
      ) {
        if (!inSyllabus) {
          discipline = null;
          last = undefined;
          numbered.clear();
        }
        inSyllabus = true;
        continue;
      }
      if (
        /^(?:ANEXO\s+[IVXLCDM\d]+\b|DAS? DISPOSI[CÇ][OÕ]ES|DOS? RECURSOS|DO CRONOGRAMA)/i.test(
          line,
        ) &&
        !/conte[uú]do|programa/i.test(line)
      ) {
        inSyllabus = false;
        discipline = null;
        last = undefined;
      }
      if (
        !inSyllabus ||
        (selectedRole &&
          activeRole &&
          !/todos|comum|comuns|gerais/i.test(activeRole) &&
          !normalize(activeRole).includes(normalize(selectedRole)))
      )
        continue;
      if (
        /^(?:P[AÁ]GINA\b|\d+$|TRIBUNAL\b|EDITAL\b|CONHECIMENTOS (?:GERAIS|COMUNS|ESPEC[IÍ]FICOS)\s*$|BLOCO\s+[IVX\d]+\s*$|ANEXO\b)/i.test(
          line,
        )
      )
        continue;
      line = line.replace(/\s*(?:[-–—:]\s*|\()continua[cç][aã]o\)?\s*$/i, '');
      const heading = line.match(headingPattern);
      if (
        /^(?:JUIZ(?:A)? SUBSTITUT[OA]|PROVA (?:ESCRITA|OBJETIVA|DISCURSIVA)|CONCURSO P[UÚ]BLICO|PODER JUDICI[AÁ]RIO|SANTA CATARINA|FORMUL[AÁ]RIO)\b/i.test(
          line,
        )
      )
        continue;
      const customHeading =
        !heading &&
        line.length < 90 &&
        /^[A-ZÀ-Ý][A-ZÀ-Ý /()–—-]+:?$/.test(line) &&
        !/^\d/.test(raw);
      if (heading || customHeading) {
        const title = heading?.[0].trim() || line.replace(/:$/, '');
        const existing = topics.find(
          (t) => t.kind === 'discipline' && disciplineKey(t.title) === disciplineKey(title),
        );
        const sameDiscipline = existing?.key === discipline;
        discipline =
          existing?.key || push(title, 'discipline', null, index + 1, raw, heading ? 0.94 : 0.65);
        if (!sameDiscipline) {
          last = undefined;
          numbered.clear();
        }
        line = heading
          ? line
              .slice(heading[0].length)
              .replace(/^\s*(?:[:–—-]\s*|\s+)/, '')
              .trim()
          : '';
        if (!line) continue;
      } else line = raw;
      if (!discipline) continue;
      // Split inline numbered lists, then semicolon-separated unnumbered topics.
      const parts = line.split(/\s+(?=\d+(?:\.\d+)*[.)]\s+[A-ZÀ-Ýa-zà-ÿ])/);
      for (const part of parts) {
        const m = part.match(/^(\d+(?:\.\d+)*)(?:[.)]|\s)\s*(.+)$/);
        if (m) {
          const nums = m[1].split('.');
          const parentNumber = nums.slice(0, -1).join('.');
          let parentKey = discipline,
            kind: ExtractedTopic['kind'] = 'subject';
          if (parentNumber && numbered.has(parentNumber)) {
            const p = topics.find((t) => t.key === numbered.get(parentNumber));
            parentKey = p?.kind === 'subtopic' ? p.parentKey! : numbered.get(parentNumber)!;
            kind = 'subtopic';
          }
          const key = push(m[2], kind, parentKey, index + 1, raw);
          numbered.set(m[1], key);
        } else if (/^[-•●▪]/.test(part) || part.includes(';')) {
          for (const title of part
            .replace(/^[-•●▪]\s*/, '')
            .split(/;\s*/)
            .filter(Boolean))
            push(title, 'subject', discipline, index + 1, raw, 0.78);
        } else if (last && last.kind !== 'discipline' && last.parentKey) {
          last.title += ` ${part}`;
          last.excerpt += `\n${raw}`;
        } else if (part.length > 2) push(part, 'subject', discipline, index + 1, raw, 0.72);
      }
    }
  }
  return {
    facts,
    roles: [...roles],
    topics,
    warning:
      'Informação não confirmada. Confira os trechos e páginas antes de confirmar. Valores divergentes são apresentados separadamente. A comparação dos estudos usa somente o conteúdo programático selecionado.',
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
