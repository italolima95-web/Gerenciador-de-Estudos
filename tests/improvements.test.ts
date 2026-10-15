import { describe, it, expect } from 'vitest';
import { analyzeNotice, noticeDates } from '../shared/analyzer.js';
import { disciplineKey, disciplineCatalog, studyTopics } from '../shared/catalog.js';
import { syllabusComparison, syllabusCoverage, cycleExerciseScope } from '../shared/comparison.js';
import { recommendations } from '../shared/domain.js';
import type { State, Topic, SyllabusItem, StudySession, Contest } from '../shared/types.js';
const t = (
  id: string,
  title: string,
  parent_id: string | null = null,
  coverage: Topic['coverage'] = 'unread',
): Topic => ({
  id,
  title,
  parent_id,
  contest_id: 'c',
  kind: parent_id ? 'subject' : 'discipline',
  coverage,
  weight: 1,
  review_state: 'not_reviewed',
  source_document_id: null,
  source_page: null,
  source_section: '',
  source_excerpt: '',
  confidence: 1,
  verified: 1,
  position: 0,
});
const r = (
  id: string,
  title: string,
  topic_id: string | null,
  parent_id: string | null = null,
): SyllabusItem => ({
  id,
  title,
  topic_id,
  parent_id,
  contest_id: 'c',
  document_id: 'd',
  kind: parent_id ? 'subject' : 'discipline',
  page: 2,
  section: 'CONTEÚDO PROGRAMÁTICO',
  excerpt: title,
  confidence: 0.9,
  active: 1,
});
const state = (extra: Partial<State> = {}): State => ({
  contests: [],
  topics: [],
  documents: [],
  facts: [],
  mappings: [],
  readings: [],
  attempts: [],
  attempt_links: [],
  sessions: [],
  session_links: [],
  blocks: [],
  cycles: [],
  reviews: [],
  mocks: [],
  bookmarks: [],
  events: [],
  preferences: {},
  ...extra,
});
const session = (extra: Partial<StudySession> = {}): StudySession => ({
  id: 's',
  contest_id: 'c',
  topic_id: 't',
  date: '2026-10-15',
  minutes: 25,
  kind: 'theory',
  notes: '',
  interrupted: 0,
  block_id: 'b',
  cycle_lap: 0,
  cycle_kind: 'theory',
  ...extra,
});
describe('Extração de disposições e conteúdo de magistratura (dados de teste)', () => {
  it('lê cláusulas narrativas, data por extenso e guarda fonte verificável', () => {
    const a = analyzeNotice([
      'TRIBUNAL DE JUSTIÇA DO ESTADO DE SANTA CATARINA\nEDITAL DE ABERTURA Nº 01/2026\nConcurso público para o cargo de Juiz Substituto.\nA execução do concurso ficará sob responsabilidade da Fundação Getulio Vargas.\nO concurso destina-se ao preenchimento de 20 (vinte) vagas e formação de cadastro de reserva.\nO subsídio inicial será de R$ 30.000,00.\nÉ exigido diploma de bacharel em Direito e três anos de atividade jurídica.\nAs inscrições serão realizadas no período de 1/11/2026 a 30/11/2026.\nO valor da taxa de inscrição será de R$ 300,00.\nA Prova Escrita Objetiva será realizada em 31 de janeiro de 2027,\ncom duração de 5 (cinco) horas, contendo 100 (cem) questões de múltipla escolha.\nResultado da prova objetiva: 20/02/2027',
      'ANEXO II – CONTEÚDO PROGRAMÁTICO\nI – DIREITO CIVIL: 1. Das pessoas. 1.1 Personalidade. 1.2 Capacidade. 2. Obrigações.\nDIREITO PROCESSUAL PENAL\n1. Inquérito policial e investigação\ncriminal.\n2. Provas; cadeia de custódia.\nANEXO III – CRONOGRAMA\nDIREITO ADMINISTRATIVO\n1. Não é conteúdo programático',
    ]);
    const fields = new Set(a.facts.map((f) => f.field));
    for (const key of [
      'agency',
      'notice',
      'role',
      'board',
      'vacancies',
      'reserve',
      'salary',
      'education',
      'registration',
      'fee',
      'exam_date',
      'duration',
      'questions',
      'modality',
    ])
      expect(fields.has(key), key).toBe(true);
    expect(a.facts.filter((f) => f.field === 'exam_date').map((f) => f.value)).toEqual([
      '2027-01-31',
    ]);
    expect(a.facts.find((f) => f.field === 'exam_date')).toMatchObject({
      page: 1,
      excerpt: expect.stringContaining('31 de janeiro de 2027'),
    });
    expect(a.topics.filter((t) => t.kind === 'discipline').map((t) => t.title)).toEqual([
      'DIREITO CIVIL',
      'DIREITO PROCESSUAL PENAL',
    ]);
    expect(a.topics.find((t) => t.title === 'Personalidade.')?.parentKey).toBe(
      a.topics.find((t) => t.title === 'Das pessoas.')?.key,
    );
    expect(a.topics.map((t) => t.title)).toContain('Inquérito policial e investigação criminal.');
    expect(a.topics.some((t) => t.title.includes('Não é conteúdo'))).toBe(false);
  });
  it('associa colunas de tabela aos valores, sem converter cabeçalhos em valores', () => {
    const a = analyzeNotice([
      'Cargo\tEscolaridade\tVagas\tRemuneração\nJuiz Substituto\tBacharel em Direito\t20\tR$ 30.000,00\nProva objetiva\t31/01/2027',
    ]);
    expect(a.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'vacancies', value: '20' }),
        expect.objectContaining({ field: 'salary', value: 'R$ 30.000,00' }),
      ]),
    );
    expect(a.facts.some((f) => f.field === 'role' && f.value.includes('Escolaridade'))).toBe(false);
  });
  it('mantém datas divergentes para conferência e rejeita datas impossíveis', () => {
    expect(noticeDates('31/02/2027, 31 de janeiro de 2027 e 2027-02-01')).toEqual([
      '2027-02-01',
      '2027-01-31',
    ]);
    expect(
      analyzeNotice(['Data da prova: 31/01/2027\nData da prova: 07/02/2027']).facts.filter(
        (f) => f.field === 'exam_date',
      ),
    ).toHaveLength(2);
  });
  it('não usa referências ao anexo, sumário ou regras de inscrição como tópicos', () => {
    expect(
      analyzeNotice([
        'O conteúdo programático consta do Anexo II.\nDIREITO CIVIL\n1. Remuneração e inscrições\nCONTEÚDO PROGRAMÁTICO ........ 20',
      ]).topics,
    ).toEqual([]);
  });
  it('preserva hierarquia através de cabeçalhos repetidos e continuação em outra página', () => {
    const a = analyzeNotice([
      'CONTEÚDO PROGRAMÁTICO\nDIREITO CIVIL\n1. Pessoas\n1.1 Personalidade',
      'CONTEÚDO PROGRAMÁTICO\nDIREITO CIVIL (CONTINUAÇÃO)\n1.2 Capacidade\n2. Obrigações',
    ]);
    expect(a.topics.filter((t) => t.kind === 'discipline')).toHaveLength(1);
    expect(a.topics.find((t) => t.title === 'Capacidade')?.parentKey).toBe(
      a.topics.find((t) => t.title === 'Pessoas')?.key,
    );
  });
  it('não atribui à objetiva a data de resultado ou de outra prova na linha seguinte', () => {
    expect(
      analyzeNotice([
        'Prova objetiva: a definir\nProva discursiva: 31/01/2027\nResultado da prova objetiva: 01/03/2027',
      ]).facts.filter((f) => f.field === 'exam_date'),
    ).toEqual([]);
  });
  it('permite aliases jurídicos sem reunir matérias distintas', () => {
    expect(disciplineKey('Direito Processual Penal')).toBe(disciplineKey('Processo Penal'));
    expect(disciplineKey('Direito Penal Especial')).not.toBe(disciplineKey('Direito Penal'));
    expect(disciplineCatalog).toContain('Direito Processual Civil');
  });
});
describe('Comparação exclusiva com o edital', () => {
  const s = () =>
    state({
      topics: [
        t('d', 'Processo Penal', null, 'studied'),
        t('t', 'Inquérito', 'd', 'studied'),
        t('u', 'Provas', 'd'),
        t('extra', 'Disciplina que não cai'),
      ],
      syllabus_items: [
        r('rd', 'Direito Processual Penal', 'd'),
        r('rt', 'Inquérito', 't', 'rd'),
        r('ru', 'Provas', 'u', 'rd'),
      ],
    });
  it('exclui extras manuais e preserva lacunas específicas mesmo com pai estudado', () => {
    expect(syllabusCoverage(s(), 'c')).toMatchObject({
      total: 2,
      studied: 1,
      pending: 1,
      percent: 50,
    });
    const rec = recommendations(s(), { id: 'c' } as Contest);
    expect(rec.map((x) => x.topic.id)).toEqual(['u']);
    expect(rec[0].reasons.join(' ')).not.toMatch(/meta|amostra|revisão|remuneração/i);
  });
  it('não conclui conteúdo por tempo registrado e não considera questões como teoria', () => {
    const a = s();
    a.sessions = [session({ topic_id: 'u' })];
    expect(syllabusComparison(a, 'c').find((r) => r.topic?.id === 'u')?.status).toBe('partial');
    a.sessions = [session({ topic_id: 'u', kind: 'questions', cycle_kind: 'questions' })];
    expect(syllabusComparison(a, 'c').find((r) => r.topic?.id === 'u')?.status).toBe('unread');
  });
  it('remove exigência desativada do confronto e mantém histórico de estudos', () => {
    const a = s();
    a.syllabus_items![2].active = 0;
    expect(syllabusComparison(a, 'c').map((r) => r.item.id)).toEqual(['rt']);
    expect(a.topics).toHaveLength(4);
  });
});
describe('Conteúdos para Exercícios do Ciclo', () => {
  it('isola volta, plano, atividade e conteúdos efetivamente estudados; deduplica evidência', () => {
    const a = state({
      topics: [t('d', 'Direito Civil'), t('t', 'Pessoas', 'd'), t('u', 'Obrigações', 'd')],
      sessions: [
        session(),
        session({ id: 's2', block_id: null }),
        session({ topic_id: 'u', cycle_lap: 1 }),
        session({ topic_id: 'u', kind: 'cycle_questions', cycle_kind: 'cycle_questions' }),
        session({ topic_id: 'u', block_id: null, cycle_kind: null }),
        session({ topic_id: 'u', contest_id: 'outro' }),
      ],
      cycle_completions: [
        {
          id: 'done',
          contest_id: 'c',
          block_id: 'b',
          topic_id: 't',
          lap: 0,
          kind: 'theory',
          title: 'Pessoas',
          topic_path: ['Direito Civil', 'Pessoas'],
          created_at: '',
        },
      ],
    });
    expect(cycleExerciseScope(a, 'c', 0)).toEqual([
      { topicId: 't', path: ['Direito Civil', 'Pessoas'], minutes: 50, completed: true },
    ]);
    expect(cycleExerciseScope(a, 'c', 1).map((r) => r.topicId)).toEqual(['u']);
  });
  it('não inventa tópicos descendentes de estudo apenas na disciplina', () => {
    const a = state({
      topics: [t('d', 'Direito Penal'), t('t', 'Crimes', 'd')],
      sessions: [session({ topic_id: 'd' })],
    });
    expect(cycleExerciseScope(a, 'c', 0)[0].path).toEqual(['Direito Penal']);
    expect(cycleExerciseScope(a, 'c', 5)).toEqual([]);
  });
});

describe('Resumo administrativo separado do conteúdo programático', () => {
  it('extrai questões por matéria com coluna de peso sem confundir números', () => {
    const a = analyzeNotice([
      'QUADRO DE PROVAS\nDisciplina\tNúmero de questões\tPeso\nDireito Civil\t20\t2\nDireito Penal\t15\t1\nTotal\t35\t3\nCONTEÚDO PROGRAMÁTICO\nDIREITO CIVIL\n1. Contratos\nDIREITO PENAL\n1. Crimes contra a honra',
    ]);
    expect(a.facts.find((f) => f.field === 'question_distribution')?.value).toBe(
      'Direito Civil: 20 questões\nDireito Penal: 15 questões',
    );
    expect(a.topics.map((t) => t.title)).toEqual([
      'DIREITO CIVIL',
      'Contratos',
      'DIREITO PENAL',
      'Crimes contra a honra',
    ]);
  });
  it('cronograma, taxa e inscrições depois do programa não viram disciplinas nem tópicos', () => {
    const a = analyzeNotice([
      'CONTEÚDO PROGRAMÁTICO\nDIREITO CIVIL\n1. Contratos\nCRONOGRAMA\nInscrições: 01/11/2026 a 30/11/2026\nProva objetiva: 31/01/2027\nINSCRIÇÕES\nInscrições pelo endereço https://banca.example/inscricao\nTaxa de inscrição: R$ 300,00',
    ]);
    expect(a.topics.map((t) => t.title)).toEqual(['DIREITO CIVIL', 'Contratos']);
    expect(a.facts.find((f) => f.field === 'schedule')?.value).toContain('31/01/2027');
    expect(a.facts.find((f) => f.field === 'registration_url')).toMatchObject({
      value: 'https://banca.example/inscricao',
      page: 1,
    });
  });
  it('mantém a quantidade por grupo sem atribuí-la a cada disciplina e sem criar conteúdo de estudo', () => {
    const a = analyzeNotice([
      'QUADRO DE PROVAS\nMatérias | Questões\nBloco I (Direito Civil e Direito Penal) | 40\nBloco II (Processo Penal e Direitos Humanos) | 30',
    ]);
    expect(a.topics).toEqual([]);
    const value = a.facts.find((f) => f.field === 'question_distribution')?.value || '';
    expect(value).toContain('Bloco I (Direito Civil e Direito Penal): 40 questões');
    expect(value).not.toMatch(/^Direito Civil: 40/m);
  });
});

it('oculta extração administrativa antiga sem excluir histórico nem impedir disciplina manual personalizada', () => {
  const rows = [
    t('d', 'Direito Civil'),
    t('t', 'Contratos', 'd'),
    { ...t('bad', 'Cronograma'), source_document_id: 'doc' },
    t('child', 'Inscrições', 'bad'),
    t('custom', 'Disciplina personalizada'),
  ];
  expect(studyTopics(rows, 'c').map((t) => t.id)).toEqual(['d', 't', 'custom']);
  expect(rows).toHaveLength(5);
});
it('lê cabeçalhos quebrados e o total explícito do quadro de questões', () => {
  const a = analyzeNotice([
    'QUADRO DE PROVAS\nDisciplinas\nQuantidade de questões\nDireito Civil 20\nDireito Penal 30\nTotal 50',
  ]);
  expect(a.facts.find((f) => f.field === 'question_distribution')?.value).toContain(
    'Direito Civil: 20 questões',
  );
  expect(a.facts.find((f) => f.field === 'questions')?.value).toBe('50');
});
