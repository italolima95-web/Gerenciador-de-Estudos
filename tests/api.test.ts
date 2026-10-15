import { zipSync, strToU8 } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { Store, migration } from '../server/db.js';
import type { State } from '../shared/types.js';
let ctx: Awaited<ReturnType<typeof createApp>>, dir: string;
const client = () => request(ctx.app);
const post = (url: string, body: unknown) =>
  client()
    .post('/api' + url)
    .set('X-Study-Client', 'cronograma')
    .send(body);
const put = (url: string, body: unknown) =>
  client()
    .put('/api' + url)
    .set('X-Study-Client', 'cronograma')
    .send(body);
const get = (url: string) =>
  client()
    .get('/api' + url)
    .set('X-Study-Client', 'cronograma');
async function contest(name = 'Concurso real') {
  const res = await post('/contests', { name });
  expect(res.status).toBe(201);
  return res.body.id as string;
}
async function topic(
  contest_id: string,
  title = 'Português',
  parent_id: string | null = null,
  kind = 'discipline',
) {
  const res = await post('/topics', { contest_id, title, parent_id, kind });
  expect(res.status).toBe(201);
  return res.body.id as string;
}
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF');
async function document(
  contest_id: string,
  pages = [
    'EDITAL Nº 01/2026\nData da prova: 20/12/2026\nCONTEÚDO PROGRAMÁTICO\nPORTUGUÊS\n1. Crase',
  ],
  kind = 'notice',
) {
  const res = await client()
    .post('/api/documents')
    .set('X-Study-Client', 'cronograma')
    .field('name', 'Edital original')
    .field('kind', kind)
    .field('contest_id', contest_id)
    .field('pages', pages.length)
    .field('text_pages', JSON.stringify(pages))
    .attach('file', pdf, 'edital.pdf');
  expect(res.status).toBe(201);
  return res.body.id as string;
}
async function state() {
  return (await get('/state')).body as State;
}
beforeEach(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'cronograma-test-'));
  ctx = await createApp(dir);
});
afterEach(() => {
  ctx.store.close();
  rmSync(dir, { recursive: true, force: true });
});
describe('Persistência e documentos', () => {
  it('10. retificação preserva original e só aplica dado após confirmação', async () => {
    const c = await contest();
    const original = await document(c);
    const analysis = (await post(`/documents/${original}/analyze`, {})).body;
    await post(`/documents/${original}/apply-analysis`, {
      fields: ['exam_date'],
      topicKeys: analysis.topics.map((t: { key: string }) => t.key),
    });
    let s = await state();
    expect(s.contests[0].exam_date).toBe('');
    await put(`/facts/${s.facts[0].id}`, { value: s.facts[0].value, status: 'confirmed' });
    expect((await state()).contests[0].exam_date).toBe('2026-12-20');
    const amendment = await document(
      c,
      ['Data da prova: 15/01/2027\nCONTEÚDO PROGRAMÁTICO\nPORTUGUÊS\n1. Concordância'],
      'amendment',
    );
    const a = (await post(`/documents/${amendment}/analyze`, {})).body;
    await post(`/documents/${amendment}/apply-analysis`, {
      fields: ['exam_date'],
      topicKeys: a.topics.map((t: { key: string }) => t.key),
    });
    s = await state();
    const fact = s.facts.find((f) => f.document_id === amendment)!;
    expect(fact.previous_value).toBe('2026-12-20');
    expect(s.contests[0].exam_date).toBe('2026-12-20');
    await put(`/facts/${fact.id}`, { value: fact.value, status: 'confirmed' });
    s = await state();
    expect(s.contests[0].exam_date).toBe('2027-01-15');
    expect(s.facts).toHaveLength(2);
    expect(s.topics.map((t) => t.title)).toContain('Crase');
    expect(s.topics.map((t) => t.title)).toContain('Concordância');
    expect(s.events.filter((e) => e.action === 'notice_change')).toHaveLength(2);
  });
  it('11. reabre SQLite com concursos, PDFs, leituras, estudos e questões', async () => {
    const c = await contest(),
      t = await topic(c),
      doc = await document(c);
    await post('/readings', {
      document_id: doc,
      start_page: 1,
      end_page: 1,
      resume_page: 1,
      date: '2026-10-15',
    });
    await post('/sessions', {
      contest_id: c,
      topic_id: t,
      date: '2026-10-15',
      minutes: 25,
      kind: 'theory',
    });
    await post('/attempts', {
      date: '2026-10-15',
      correct: 6,
      wrong: 2,
      links: [{ contest_id: c, topic_id: t }],
    });
    ctx.store.close();
    ctx = await createApp(dir);
    const s = await state();
    expect(s.contests).toHaveLength(1);
    expect(s.documents).toHaveLength(1);
    expect(s.readings).toHaveLength(1);
    expect(s.sessions[0].minutes).toBe(25);
    expect(s.attempts[0].correct).toBe(6);
    const file = await get(`/documents/${doc}/file`);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toContain('application/pdf');
  });
  it('12. tópico guarda página de origem e permite confirmação/correção', async () => {
    const c = await contest(),
      d = await document(c, ['Página introdutória', 'CONTEÚDO PROGRAMÁTICO\nPORTUGUÊS\n1. Crase']);
    const a = (await post(`/documents/${d}/analyze`, {})).body;
    await post(`/documents/${d}/apply-analysis`, {
      fields: [],
      topicKeys: a.topics.map((t: { key: string }) => t.key),
    });
    const t = (await state()).topics.find((t) => t.kind === 'subject')!;
    expect(t.source_page).toBe(2);
    expect(t.source_document_id).toBe(d);
    expect(t.verified).toBe(0);
    expect(t.source_excerpt).toBe('1. Crase');
    const res = await put(`/topics/${t.id}`, { ...t, title: 'Crase e acentuação', verified: 1 });
    expect(res.status).toBe(200);
    expect((await state()).topics.find((x) => x.id === t.id)).toMatchObject({
      title: 'Crase e acentuação',
      source_page: 2,
      verified: 1,
    });
  });
  it('backup completo restaura banco e PDFs e cria cópia anterior', async () => {
    const c = await contest(),
      d = await document(c);
    const backup = await get('/backup')
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    await post('/contests', { name: 'Depois do backup' });
    expect((await state()).contests).toHaveLength(2);
    const restored = await client()
      .post('/api/restore')
      .set('X-Study-Client', 'cronograma')
      .field('confirm', 'true')
      .attach('file', backup.body, 'backup.zip');
    expect(restored.status).toBe(200);
    expect((await state()).contests).toHaveLength(1);
    expect((await get(`/documents/${d}/file`)).status).toBe(200);
  });
  it('restauração exige confirmação e rejeita arquivo inválido', async () => {
    const res = await client()
      .post('/api/restore')
      .set('X-Study-Client', 'cronograma')
      .attach('file', Buffer.from('invalid'), 'backup.zip');
    expect(res.status).toBe(400);
    expect((await get('/health')).status).toBe(200);
  });
  it('recusa páginas inválidas e vínculos entre concursos', async () => {
    const c = await contest(),
      c2 = await contest('Outro'),
      t = await topic(c),
      d = await document(c);
    expect(
      (
        await post('/readings', {
          document_id: d,
          start_page: 1,
          end_page: 2,
          resume_page: 1,
          date: '2026-10-15',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post('/sessions', {
          contest_id: c2,
          topic_id: t,
          date: '2026-10-15',
          minutes: 20,
          kind: 'theory',
        })
      ).status,
    ).toBe(400);
  });
  it('protege registros vinculados e exige confirmação de exclusão', async () => {
    const c = await contest();
    await topic(c);
    const noConfirm = await client()
      .delete(`/api/contests/${c}`)
      .set('X-Study-Client', 'cronograma')
      .send({});
    expect(noConfirm.status).toBe(400);
    const res = await client()
      .delete(`/api/contests/${c}`)
      .set('X-Study-Client', 'cronograma')
      .send({ confirm: true });
    expect(res.status).toBe(409);
    expect((await state()).contests).toHaveLength(1);
  });
  it('não aceita calendário inválido nem níveis hierárquicos inválidos', async () => {
    expect((await post('/contests', { name: 'Teste', exam_date: '2026-02-31' })).status).toBe(400);
    const c = await contest();
    expect(
      (await post('/topics', { contest_id: c, title: 'Órfão', kind: 'subtopic' })).status,
    ).toBe(400);
  });
  it('protege API contra origem externa e cliente ausente', async () => {
    expect((await client().get('/api/state')).status).toBe(403);
    expect(
      (
        await client()
          .post('/api/contests')
          .set('X-Study-Client', 'cronograma')
          .set('Origin', 'https://site-externo.example')
          .send({ name: 'x' })
      ).status,
    ).toBe(403);
  });
});
describe('Questões, ciclos e revisões', () => {
  it('impede mais de uma classificação principal da tentativa no concurso', async () => {
    const c = await contest(),
      t = await topic(c);
    const res = await post('/attempts', {
      date: '2026-10-15',
      correct: 5,
      wrong: 5,
      links: [{ contest_id: c, topic_id: t }, { contest_id: c }],
    });
    expect(res.status).toBe(400);
    expect((await state()).attempts).toHaveLength(0);
  });
  it('sessão distribuída é atômica e não deixa uma linha parcialmente salva', async () => {
    const c = await contest();
    const res = await post('/attempts/batch', {
      rows: [
        { date: '2026-10-15', correct: 5, wrong: 5, links: [{ contest_id: c }] },
        { date: '2026-10-15', correct: -1, wrong: 5, links: [{ contest_id: c }] },
      ],
    });
    expect(res.status).toBe(400);
    expect((await state()).attempts).toHaveLength(0);
  });
  it('uma tentativa pode ser reutilizada sem criar cópia', async () => {
    const c = await contest(),
      c2 = await contest('Outro');
    const a = await post('/attempts', {
      date: '2026-10-15',
      correct: 5,
      wrong: 5,
      links: [{ contest_id: c }],
    });
    const res = await put(`/attempts/${a.body.id}`, {
      date: '2026-10-15',
      correct: 5,
      wrong: 5,
      links: [{ contest_id: c }, { contest_id: c2 }],
    });
    expect(res.status).toBe(200);
    const s = await state();
    expect(s.attempts).toHaveLength(1);
    expect(s.attempt_links).toHaveLength(2);
  });
  it('reutiliza estudo com chave única sem duplicar tempo global', async () => {
    const c = await contest(),
      c2 = await contest('Outro');
    const s = await post('/sessions', {
      contest_id: c,
      date: '2026-10-15',
      minutes: 25,
      kind: 'theory',
    });
    for (let i = 0; i < 2; i++)
      expect(
        (await post(`/sessions/${s.body.id}/reuse`, { contest_id: c2, confirmed: true })).status,
      ).toBe(200);
    const data = await state();
    expect(data.sessions).toHaveLength(1);
    expect(data.session_links).toHaveLength(1);
  });
  it('completa o último bloco, volta ao primeiro e preserva voltas', async () => {
    const c = await contest();
    const a = await post('/blocks', {
      contest_id: c,
      title: 'A',
      minutes: 25,
      kind: 'theory',
      position: 0,
    });
    const b = await post('/blocks', {
      contest_id: c,
      title: 'B',
      minutes: 30,
      kind: 'questions',
      position: 1,
    });
    await post(`/cycles/${c}/advance`, { completed: true, expected_block_id: a.body.id });
    expect((await state()).cycles[0].block_id).toBe(b.body.id);
    await post(`/cycles/${c}/advance`, { completed: true, expected_block_id: b.body.id });
    expect((await state()).cycles[0]).toMatchObject({ block_id: a.body.id, lap: 1 });
    expect(
      (await post(`/cycles/${c}/advance`, { completed: true, expected_block_id: b.body.id }))
        .status,
    ).toBe(409);
  });
  it('agendamento de revisões é repetível sem duplicação', async () => {
    const c = await contest(),
      d = await topic(c),
      t = await topic(c, 'Crase', d, 'subject');
    for (let i = 0; i < 2; i++)
      await post('/reviews/schedule', {
        contest_id: c,
        topic_id: t,
        date: '2026-10-15',
        intervals: [1, 7, 30],
      });
    expect((await state()).reviews.map((r) => r.due_date)).toEqual([
      '2026-10-16',
      '2026-10-22',
      '2026-11-14',
    ]);
  });
  it('integra ou separa resultados do simulado sem duplicá-los', async () => {
    const c = await contest();
    const m = await post('/mocks', {
      contest_id: c,
      title: 'Simulado',
      date: '2026-10-15',
      include_stats: 0,
    });
    await post('/attempts', {
      date: '2026-10-15',
      correct: 6,
      wrong: 4,
      mock_id: m.body.id,
      links: [{ contest_id: c }],
    });
    let s = await state();
    expect(s.attempts[0].include_stats).toBe(0);
    await put(`/mocks/${m.body.id}`, { ...s.mocks[0], include_stats: 1 });
    s = await state();
    expect(s.attempts).toHaveLength(1);
    expect(s.attempts[0].include_stats).toBe(1);
  });
});
describe('Pomodoro persistente', () => {
  async function setup() {
    const c = await contest();
    return {
      revision: 0,
      contest_id: c,
      topic_id: null,
      mode: 'focus',
      remaining: 1500,
      deadline: null,
      elapsed: 60,
      focus_count: 0,
      running: false,
      block_id: null,
      focus_minutes: 25,
      short_minutes: 5,
      long_minutes: 15,
    };
  }
  it('registra somente tempo de foco, não registra pausas e evita finalização duplicada', async () => {
    const t = await setup();
    expect((await put('/timer', t)).status).toBe(200);
    const timer = (await state()).preferences.timer as {
      revision: number;
      deadline: number | null;
      mode: string;
    };
    const body = {
      interrupted: true,
      expected_revision: timer.revision,
      expected_mode: timer.mode,
      expected_deadline: timer.deadline,
    };
    expect((await post('/timer/finish', body)).status).toBe(200);
    expect((await post('/timer/finish', body)).status).toBe(409);
    let s = await state();
    expect(s.sessions).toHaveLength(1);
    expect(s.sessions[0].minutes).toBe(1);
    const next = s.preferences.timer as typeof timer;
    await post('/timer/finish', {
      interrupted: false,
      expected_revision: next.revision,
      expected_mode: next.mode,
      expected_deadline: next.deadline,
    });
    s = await state();
    expect(s.sessions).toHaveLength(1);
  });
  it('restaura deadline após reinício e rejeita estado desatualizado', async () => {
    const t = await setup();
    t.running = true;
    t.deadline = Date.now() + 60000;
    await put('/timer', t);
    expect((await put('/timer', t)).status).toBe(409);
    ctx.store.close();
    ctx = await createApp(dir);
    expect((await state()).preferences.timer).toMatchObject({
      deadline: t.deadline,
      running: true,
      revision: 1,
    });
  });
});

describe('Recriação do ciclo', () => {
  it('seleciona o primeiro bloco após excluir todos, preservando as voltas', async () => {
    const c = await contest();
    const a = await post('/blocks', {
      contest_id: c,
      title: 'Anterior',
      minutes: 25,
      kind: 'theory',
      position: 0,
    });
    await post(`/cycles/${c}/advance`, { completed: true, expected_block_id: a.body.id });
    expect((await state()).cycles[0].lap).toBe(1);
    await client()
      .delete(`/api/blocks/${a.body.id}`)
      .set('X-Study-Client', 'cronograma')
      .send({ confirm: true });
    const b = await post('/blocks', {
      contest_id: c,
      title: 'Novo',
      minutes: 25,
      kind: 'theory',
      position: 0,
    });
    expect((await state()).cycles[0]).toMatchObject({ block_id: b.body.id, lap: 1 });
    await post(`/cycles/${c}/advance`, { completed: true, expected_block_id: b.body.id });
    expect((await state()).cycles[0].lap).toBe(2);
  });
});

it('importa texto extenso de um PDF sem o limite padrão de campo de 1 MB', async () => {
  const c = await contest();
  const pages = Array.from({ length: 6 }, () => 'Conteúdo original do material. '.repeat(6000));
  const d = await document(c, pages, 'material');
  const saved = await get(`/documents/${d}`);
  expect(saved.status).toBe(200);
  expect(saved.body.text_pages).toEqual(pages);
});

describe('Disciplinas primeiro, edital opcional e exercícios por volta', () => {
  it('cria um plano sem concurso e cadastra catálogo/customizadas sem duplicatas por alias', async () => {
    const first = await post('/study-plan', {}),
      second = await post('/study-plan', {});
    expect(first.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(
      (
        await post('/disciplines', {
          contest_id: first.body.id,
          titles: ['Processo Penal', 'Direito Processual Penal', 'Disciplina personalizada'],
        })
      ).status,
    ).toBe(201);
    const s = await state();
    expect(s.contests[0]).toMatchObject({ name: 'Meus estudos', kind: 'plan', exam_date: '' });
    expect(s.topics.map((t) => t.title)).toEqual(['Processo Penal', 'Disciplina personalizada']);
    expect(s.syllabus_items).toEqual([]);
  });
  it('reutiliza disciplinas/tópicos manuais e seus estudos, mantém fonte independente e reanálise idempotente', async () => {
    const c = (await post('/study-plan', {})).body.id;
    const d = await topic(c, 'Processo Penal'),
      t = await topic(c, 'Inquérito policial', d, 'subject');
    const before = (await state()).topics.find((x) => x.id === t)!;
    await put(`/topics/${t}`, { ...before, coverage: 'studied' });
    const doc = await document(c, [
      'CONTEÚDO PROGRAMÁTICO\nDIREITO PROCESSUAL PENAL\n1. Inquérito policial.\n2. Provas.',
    ]);
    const a = (await post(`/documents/${doc}/analyze`, {})).body;
    const apply = () =>
      post(`/documents/${doc}/apply-analysis`, {
        fields: [],
        topicKeys: a.topics.map((x: { key: string }) => x.key),
      });
    expect((await apply()).status).toBe(200);
    expect((await apply()).status).toBe(200);
    const s = await state();
    expect(s.topics).toHaveLength(3);
    expect(s.topics.find((x) => x.id === t)?.coverage).toBe('studied');
    expect(s.topics.find((x) => x.id === t)?.source_document_id).toBeNull();
    const requirements = s.syllabus_items!.filter((x) => x.active);
    expect(requirements).toHaveLength(3);
    expect(requirements.find((x) => x.topic_id === t)).toMatchObject({
      document_id: doc,
      page: 1,
      title: 'Inquérito policial.',
    });
  });
  it('registra sessão e conclusão com volta e preserva histórico sem duplicar minutos', async () => {
    const c = (await post('/study-plan', {})).body.id,
      d = await topic(c, 'Direito Civil'),
      t = await topic(c, 'Pessoas', d, 'subject');
    const block = (
      await post('/blocks', {
        contest_id: c,
        topic_id: t,
        title: 'Pessoas',
        kind: 'theory',
        minutes: 25,
      })
    ).body.id;
    await post('/blocks', {
      contest_id: c,
      title: 'Exercícios do Ciclo',
      kind: 'cycle_questions',
      minutes: 30,
      position: 1,
    });
    expect(
      (
        await post('/sessions', {
          contest_id: c,
          topic_id: t,
          block_id: block,
          cycle_lap: 0,
          date: '2026-10-15',
          minutes: 25,
          kind: 'theory',
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await post(`/cycles/${c}/advance`, {
          completed: true,
          expected_block_id: block,
          expected_lap: 0,
        })
      ).status,
    ).toBe(200);
    const s = await state();
    expect(s.sessions).toHaveLength(1);
    expect(s.sessions[0]).toMatchObject({
      block_id: block,
      cycle_lap: 0,
      cycle_kind: 'theory',
      minutes: 25,
    });
    expect(s.cycle_completions).toHaveLength(1);
    expect(s.cycle_completions![0]).toMatchObject({
      lap: 0,
      topic_path: ['Direito Civil', 'Pessoas'],
    });
    expect(s.cycles[0].lap).toBe(0);
  });
  it('adiamento não vira estudo e não aceita associação de outro plano', async () => {
    const c = await contest(),
      other = await contest('Outro'),
      t = await topic(c),
      foreign = await topic(other);
    const b = (
      await post('/blocks', {
        contest_id: c,
        topic_id: t,
        title: 'Teoria',
        kind: 'theory',
        minutes: 20,
      })
    ).body.id;
    await post(`/cycles/${c}/advance`, { completed: false, expected_block_id: b });
    expect((await state()).cycle_completions).toEqual([]);
    const doc = await document(c),
      a = (await post(`/documents/${doc}/analyze`, {})).body;
    await post(`/documents/${doc}/apply-analysis`, {
      topicKeys: a.topics.map((x: { key: string }) => x.key),
    });
    const item = (await state()).syllabus_items!.find((i) => i.kind === 'subject')!;
    expect((await put(`/syllabus/${item.id}`, { topic_id: foreign })).status).toBe(400);
    expect((await put(`/syllabus/${item.id}`, { topic_id: t })).status).toBe(400);
  });
});

it('restaura um backup da versão 1.0 e migra preservando dados', async () => {
  const legacy = new ctx.store.SQL.Database();
  legacy.run(migration);
  legacy.run(
    "INSERT INTO contests(id,name,created_at) VALUES('legacy','Concurso da versão 1.0','2026-10-15')",
  );
  const bytes = zipSync({
    'manifest.json': strToU8(JSON.stringify({ app: 'cronograma-de-estudos', version: 1 })),
    'studies.sqlite': legacy.export(),
  });
  legacy.close();
  const res = await client()
    .post('/api/restore')
    .set('X-Study-Client', 'cronograma')
    .field('confirm', 'true')
    .attach('file', Buffer.from(bytes), 'backup-v1.zip');
  expect(res.status).toBe(200);
  expect((await state()).contests[0].name).toBe('Concurso da versão 1.0');
  expect(ctx.store.one('SELECT MAX(version) as version FROM schema_migrations')).toEqual({
    version: 2,
  });
  expect(ctx.store.one('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
});
