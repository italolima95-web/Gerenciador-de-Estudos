import { describe, it, expect } from 'vitest';
import {
  statistics,
  mergeIntervals,
  readPages,
  coverage,
  effectiveCoverage,
  recommendations,
  habitStats,
  planning,
  contestSessions,
  libraryProgress,
} from '../shared/domain.js';
import { analyzeNotice, suggestMatches } from '../shared/analyzer.js';
import type {
  Attempt,
  AttemptLink,
  Topic,
  State,
  Mapping,
  Reading,
  Contest,
} from '../shared/types.js';
const topic = (
  id: string,
  parent_id: string | null = null,
  kind: Topic['kind'] = 'subject',
  extra: Partial<Topic> = {},
): Topic => ({
  id,
  contest_id: 'c',
  parent_id,
  kind,
  title: id,
  weight: 1,
  coverage: 'unread',
  review_state: 'not_reviewed',
  source_document_id: null,
  source_page: null,
  source_section: '',
  source_excerpt: '',
  confidence: 1,
  verified: 1,
  position: 0,
  ...extra,
});
const attempt = (
  id: string,
  correct: number,
  wrong: number,
  blank = 0,
  extra: Partial<Attempt> = {},
): Attempt => ({
  id,
  date: '2026-10-15',
  board: '',
  origin: '',
  question_type: 'multiple',
  correct,
  wrong,
  blank,
  minutes: 0,
  weight: 1,
  penalty: 0,
  notes: '',
  mock_id: null,
  include_stats: 1,
  tags: [],
  ...extra,
});
const link = (
  attempt_id: string,
  topic_id: string | null = null,
  contest_id = 'c',
): AttemptLink => ({ attempt_id, topic_id, contest_id });
const contest: Contest = {
  id: 'c',
  name: 'Teste',
  board: '',
  role: '',
  exam_date: '2026-10-20',
  main: 1,
  target: 80,
  min_sample: 20,
  daily_minutes: 120,
  topic_minutes: 60,
  question_goal: 20,
  rest_days: '[0]',
  metadata: {},
  created_at: '',
};
const state = (extra: Partial<State> = {}): State => ({
  contests: [contest],
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
const reading = (start_page: number, end_page: number, completed = 1): Reading => ({
  id: String(start_page),
  document_id: 'pdf',
  topic_id: null,
  start_page,
  end_page,
  resume_page: end_page,
  date: '2026-10-15',
  completed,
  notes: '',
});
const mapping: Mapping = {
  id: 'map',
  topic_id: 'topic',
  document_id: 'pdf',
  start_page: 115,
  end_page: 148,
  confirmed: 1,
  confidence: 1,
};
describe('Estatísticas obrigatórias do prompt', () => {
  it('1. calcula 780 / 1000 = 78%', () =>
    expect(statistics([attempt('a', 780, 220)], [link('a')], [], { contestId: 'c' }).accuracy).toBe(
      78,
    ));
  it('2. disciplina: 160 / 200 = 80%', () =>
    expect(
      statistics([attempt('a', 160, 40)], [link('a', 'd')], [topic('d', null, 'discipline')], {
        contestId: 'c',
        topicId: 'd',
      }).accuracy,
    ).toBe(80));
  it('3. assunto: 24 / 40 = 60%', () =>
    expect(
      statistics([attempt('a', 24, 16)], [link('a', 't')], [topic('t')], {
        contestId: 'c',
        topicId: 't',
      }).accuracy,
    ).toBe(60));
  it('4. pondera os totais em vez da média de taxas', () => {
    const s = statistics(
      [attempt('a', 9, 1), attempt('b', 54, 36)],
      [link('a', 'a'), link('b', 'b')],
      [topic('d', null, 'discipline'), topic('a', 'd'), topic('b', 'd')],
      { contestId: 'c', topicId: 'd' },
    );
    expect(s.answered).toBe(100);
    expect(s.accuracy).toBe(63);
  });
  it('5. separa em branco: 75% de acertos e 60% sobre apresentadas', () => {
    const s = statistics([attempt('a', 6, 2, 2)], [link('a')], [], { contestId: 'c' });
    expect(s.accuracy).toBe(75);
    expect(s.yield).toBe(60);
    expect(s.blank).toBe(2);
  });
  it('6. sem tentativas retorna null (Sem dados)', () =>
    expect(statistics([], [], [], { contestId: 'c' }).accuracy).toBeNull());
  it('7. agrega subassuntos uma vez, mesmo com links repetidos e etiquetas', () => {
    const t = [topic('d', null, 'discipline'), topic('s', 'd'), topic('ss', 's', 'subtopic')];
    const a = attempt('a', 24, 16, 0, { tags: ['d', 's', 'ss'] });
    const l = [link('a', 'ss'), link('a', 'ss')];
    expect(statistics([a], l, t, { contestId: 'c', topicId: 's' }).answered).toBe(40);
    expect(statistics([a], l, t, { contestId: 'c' }).answered).toBe(40);
  });
  it('8. reaproveita a mesma tentativa em concursos diferentes sem duplicar', () => {
    const a = [attempt('a', 6, 2)];
    const links = [link('a', null, 'c'), link('a', null, 'c2'), link('a', null, 'c')];
    for (const contestId of ['c', 'c2'])
      expect(statistics(a, links, [], { contestId }).answered).toBe(8);
  });
  it('9. leitura parcial não conclui um tópico', () => {
    const t = topic('topic');
    expect(effectiveCoverage(t, [mapping], [reading(115, 130)])).toBe('partial');
    expect(coverage([t], [mapping], [reading(115, 130)]).percent).toBe(0);
    expect(effectiveCoverage(t, [mapping], [reading(115, 148)])).toBe('studied');
  });
  it('não inventa taxas para assuntos de um agregado só da disciplina', () => {
    const t = [topic('d', null, 'discipline'), topic('s', 'd')];
    expect(
      statistics([attempt('a', 8, 2)], [link('a', 'd')], t, { contestId: 'c', topicId: 's' })
        .accuracy,
    ).toBeNull();
  });
  it('questões não classificadas permanecem no concurso', () => {
    const a = [attempt('a', 8, 2)];
    expect(statistics(a, [link('a')], [], { contestId: 'c' }).answered).toBe(10);
  });
  it('mantém pontuação negativa separada da taxa bruta', () => {
    const s = statistics([attempt('a', 6, 4, 2, { weight: 2, penalty: 1 })], [link('a')], [], {
      contestId: 'c',
    });
    expect(s.score).toBe(8);
    expect(s.accuracy).toBe(60);
    expect(s.yield).toBe(50);
  });
  it('filtra por data, banca, origem e modalidade', () => {
    const a = [
      attempt('a', 5, 5, 0, { board: 'A', origin: 'Livro' }),
      attempt('b', 9, 1, 0, { board: 'B' }),
    ];
    expect(
      statistics(a, [link('a'), link('b')], [], {
        contestId: 'c',
        board: 'A',
        origin: 'Livro',
        from: '2026-10-01',
        to: '2026-10-31',
        questionType: 'multiple',
      }).accuracy,
    ).toBe(50);
  });
  it('simulados excluídos não entram na estatística geral', () =>
    expect(
      statistics([attempt('a', 9, 1, 0, { include_stats: 0 })], [link('a')], [], { contestId: 'c' })
        .answered,
    ).toBe(0));
});
describe('Leitura e cobertura', () => {
  it('une intervalos adjacentes e sobrepostos sem alterar a entrada', () => {
    const ranges: [number, number][] = [
      [8, 12],
      [1, 8],
      [20, 21],
    ];
    expect(mergeIntervals(ranges)).toEqual([
      [1, 12],
      [20, 21],
    ]);
    expect(ranges[0]).toEqual([8, 12]);
  });
  it('não conta leitura interrompida nem página só visualizada', () =>
    expect(readPages([reading(1, 10), reading(5, 15), reading(16, 20, 0)], 'pdf')).toBe(15));
  it('não duplica cobertura entre pais e filhos', () => {
    const t = [
      topic('d', null, 'discipline'),
      topic('s', 'd'),
      topic('ss', 's', 'subtopic', { coverage: 'studied' }),
    ];
    expect(coverage(t, [], [])).toMatchObject({ total: 1, studied: 1, percent: 100 });
  });
  it('correspondência não confirmada não muda cobertura', () =>
    expect(
      effectiveCoverage(topic('topic'), [{ ...mapping, confirmed: 0 }], [reading(115, 148)]),
    ).toBe('unread'));
  it('respeita pesos dos tópicos finais', () =>
    expect(
      coverage(
        [topic('a', null, 'subject', { coverage: 'studied', weight: 3 }), topic('b')],
        [],
        [],
      ).percent,
    ).toBe(75));
  it('não duplica intervalos de material no denominador de cobertura', () =>
    expect(
      effectiveCoverage(
        topic('topic'),
        [mapping, { ...mapping, id: '2', start_page: 120 }],
        [reading(115, 148)],
      ),
    ).toBe('studied'));
});
describe('Análise documental conservadora', () => {
  const pages = [
    'EDITAL Nº 01/2026\nNome do concurso: Concurso de teste\nData da prova: 20/12/2026\nCargo: Analista',
    'ANEXO II — CONTEÚDO PROGRAMÁTICO\nDIREITO CONSTITUCIONAL\n1. Controle de Constitucionalidade\n1.1 Controle difuso\n1.2 Controle concentrado',
  ];
  it('extrai a hierarquia e preserva página e trecho', () => {
    const a = analyzeNotice(pages);
    expect(a.topics.map((t) => t.kind)).toEqual(['discipline', 'subject', 'subtopic', 'subtopic']);
    expect(a.topics[1]).toMatchObject({ page: 2, excerpt: '1. Controle de Constitucionalidade' });
    expect(a.topics[2].parentKey).toBe(a.topics[1].key);
  });
  it('não inventa fatos ausentes e rotula incerteza', () => {
    const a = analyzeNotice(pages);
    expect(a.facts.some((f) => f.field === 'salary')).toBe(false);
    expect(a.facts.find((f) => f.field === 'exam_date')?.value).toBe('20/12/2026');
    expect(a.warning).toContain('não confirmada');
  });
  it('filtra conteúdo por cargo sem eliminar conteúdos comuns', () => {
    const a = analyzeNotice(
      [
        'CONTEÚDO PROGRAMÁTICO\nCargo: Todos os cargos\nPORTUGUÊS\n1. Crase\nCargo: Analista\nDIREITO CONSTITUCIONAL\n1. Constituição\nCargo: Técnico\nINFORMÁTICA\n1. Redes',
      ],
      'Analista',
    );
    expect(a.topics.map((t) => t.title)).toContain('Crase');
    expect(a.topics.map((t) => t.title)).not.toContain('Redes');
  });
  it('similaridade textual gera apenas sugestões não confirmadas', () =>
    expect(
      suggestMatches([{ id: 't', title: 'Controle de Constitucionalidade' }], 'p', [
        'Controle de Constitucionalidade e conceitos',
      ])[0],
    ).toMatchObject({ confirmed: 0, start_page: 1 }));
});
describe('Recomendações e planejamento', () => {
  it('não rotula como baixo desempenho uma amostra de cinco questões', () => {
    const t = topic('t', null, 'subject', { coverage: 'studied' }),
      s = state({ topics: [t], attempts: [attempt('a', 1, 4)], attempt_links: [link('a', 't')] });
    const rec = recommendations(s, contest)[0];
    expect(rec.reasons.join(' ')).toContain('Amostra insuficiente');
    expect(rec.reasons.join(' ')).not.toContain('meta de');
  });
  it('respeita descansos ao estimar disponibilidade', () => {
    const p = planning(contest, [topic('t')], [], [], '2026-10-15');
    expect(p).toMatchObject({ days: 5, planned: 5, hours: 10, remaining: 1, estimatedHours: 1 });
  });
  it('respeita descanso na sequência', () => {
    const sessions = [
      { id: '1', date: '2026-10-16', minutes: 30 },
      { id: '2', date: '2026-10-19', minutes: 30 },
    ] as State['sessions'];
    expect(habitStats(sessions, [0, 6], '2026-10-19')).toMatchObject({ best: 2, current: 2 });
  });
  it('reutiliza estudo no destino mantendo uma sessão global', () => {
    const s = state({
      sessions: [
        {
          id: 'x',
          contest_id: 'c',
          topic_id: 't',
          date: '2026-10-15',
          minutes: 30,
          kind: 'theory',
          notes: '',
          interrupted: 0,
        },
      ],
      session_links: [{ session_id: 'x', contest_id: 'c2', topic_id: 't2' }],
    });
    expect(contestSessions(s, 'c2')[0].topic_id).toBe('t2');
    expect(s.sessions.reduce((n, x) => n + x.minutes, 0)).toBe(30);
  });
});

describe('Leitura global e por disciplina', () => {
  const doc = {
    id: 'pdf',
    contest_id: 'c',
    topic_id: null,
    name: 'Material',
    kind: 'material',
    filename: 'pdf.pdf',
    pages: 200,
    resume_page: 1,
    text_pages: [],
    outline: [],
    created_at: '',
  };
  it('conta páginas globais sem sobrepor intervalos', () => {
    const s = state({ documents: [doc], readings: [reading(1, 10), reading(5, 15)] });
    expect(libraryProgress(s, 'c')).toMatchObject({
      total: 200,
      done: 15,
      pending: 185,
      percent: 7.5,
    });
  });
  it('usa apenas intervalos associados à disciplina, sem duplicar materiais', () => {
    const s = state({
      documents: [doc],
      topics: [topic('d', null, 'discipline'), topic('topic', 'd')],
      mappings: [mapping, { ...mapping, id: 'outro', start_page: 120 }],
      readings: [reading(115, 130)],
    });
    expect(libraryProgress(s, 'c', 'd')).toMatchObject({
      total: 34,
      done: 16,
      pending: 18,
      documentIds: ['pdf'],
    });
  });
});
