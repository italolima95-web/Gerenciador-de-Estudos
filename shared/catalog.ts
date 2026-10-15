import type { Topic } from './types.js';
export const disciplineCatalog = [
  'Processo Penal',
  'Direito Civil',
  'Direito Penal Especial',
  'Tributário',
  'Jurisprudência',
  'Direito Empresarial',
  'Direitos Humanos',
  'Noções Gerais/Formação Humanística',
  'Ambiental',
  'Eleitoral',
  'Código de Defesa do Consumidor',
  'Estatuto da Criança e do Adolescente',
  'Direito Penal',
  'Direito Administrativo',
  'Direito Constitucional',
  'Direito Processual Civil',
];
export const cycleActivities = ['Exercícios do Ciclo', 'SIMULADO'];
export const normalizeTitle = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const aliases: Record<string, string> = {
  'direito processual penal': 'processo penal',
  'processual penal': 'processo penal',
  'direito tributario': 'tributario',
  'direito ambiental': 'ambiental',
  'direito eleitoral': 'eleitoral',
  'direito do consumidor': 'codigo de defesa do consumidor',
  consumidor: 'codigo de defesa do consumidor',
  cdc: 'codigo de defesa do consumidor',
  'direito da crianca e do adolescente': 'estatuto da crianca e do adolescente',
  eca: 'estatuto da crianca e do adolescente',
  'formacao humanistica': 'nocoes gerais formacao humanistica',
  'processo civil': 'direito processual civil',
  'processual civil': 'direito processual civil',
};
export function disciplineKey(s: string) {
  const key = normalizeTitle(s);
  return aliases[key] || key;
}

export function isAdministrativeHeading(value: string) {
  const s = normalizeTitle(value.replace(/^\d+(?:\.\d+)*[.)]?\s+/, ''));
  return /^(?:(?:das?|dos?) )?(?:cronograma(?: de atividades| do concurso| das provas| previsto)?|inscricoes(?: preliminares| definitivas)?|quadro de provas|distribuicao (?:das?|de) (?:questoes|provas)|informacoes (?:do concurso|gerais)|taxa de inscricao|vagas|remuneracao|banca organizadora|quantidade de questoes|numero de questoes|datas e eventos|etapas do concurso)$/.test(
    s,
  );
}

/** Hide earlier automatic administrative extractions without deleting study history. */
export function studyTopics(topics: Topic[], contestId: string) {
  const rows = topics.filter((t) => t.contest_id === contestId),
    blocked = new Set(
      rows.filter((t) => t.source_document_id && isAdministrativeHeading(t.title)).map((t) => t.id),
    );
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of rows)
      if (t.parent_id && blocked.has(t.parent_id) && !blocked.has(t.id)) {
        blocked.add(t.id);
        changed = true;
      }
  }
  return rows.filter((t) => !blocked.has(t.id));
}
