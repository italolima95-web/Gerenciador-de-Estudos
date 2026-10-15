import express, { type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  rmSync,
  readdirSync,
} from 'node:fs';
import path from 'node:path';
import { zipSync, unzipSync, strToU8 } from 'fflate';
import { Store, id } from './db.js';
import { analyzeNotice, suggestMatches } from '../shared/analyzer.js';
import { addDays, dayKey, descendants, statistics } from '../shared/domain.js';
import type {
  Contest,
  Document,
  Fact,
  Topic,
  State,
  Block,
  Attempt,
  Timer,
} from '../shared/types.js';
const text = z.string().trim().max(20000),
  short = z.string().trim().max(500),
  uuid = z.string().uuid(),
  nullableId = uuid.nullable().default(null);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + 'T12:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'Data inválida');
const positive = z.number().int().min(1).max(100000),
  count = z.number().int().min(0).max(1000000),
  minutes = z.number().min(0).max(100000);
const contestSchema = z.object({
  name: short.min(1),
  board: short.default(''),
  role: short.default(''),
  exam_date: z.union([date, z.literal('')]).default(''),
  main: z.number().int().min(0).max(1).default(0),
  target: z.number().min(1).max(100).default(80),
  min_sample: positive.default(20),
  daily_minutes: positive.max(1440).default(120),
  topic_minutes: positive.default(60),
  question_goal: count.default(20),
  rest_days: z
    .string()
    .default('[0]')
    .refine((v) => {
      try {
        const a = JSON.parse(v);
        return (
          Array.isArray(a) &&
          a.every((x: unknown) => Number.isInteger(x) && Number(x) >= 0 && Number(x) <= 6)
        );
      } catch {
        return false;
      }
    }),
  metadata: z.record(z.string(), text).default({}),
});
const topicSchema = z.object({
  contest_id: uuid,
  parent_id: nullableId,
  kind: z.enum(['discipline', 'subject', 'subtopic']),
  title: short.min(1),
  weight: z.number().min(0.01).max(100).default(1),
  coverage: z.enum(['unverified', 'unread', 'partial', 'studied']).default('unread'),
  review_state: z.enum(['not_reviewed', 'pending', 'reviewed', 'again']).default('not_reviewed'),
  verified: z.number().min(0).max(1).default(1),
  position: count.default(0),
});
const attemptSchema = z
  .object({
    date,
    board: short.default(''),
    origin: short.default(''),
    question_type: z.enum(['multiple', 'true_false', 'essay']).default('multiple'),
    correct: count,
    wrong: count,
    blank: count.default(0),
    minutes: minutes.default(0),
    weight: z.number().min(0).max(100).default(1),
    penalty: z.number().min(0).max(100).default(0),
    notes: text.default(''),
    mock_id: nullableId,
    include_stats: z.number().min(0).max(1).default(1),
    tags: z.array(short).max(30).default([]),
    links: z
      .array(z.object({ contest_id: uuid, topic_id: nullableId }))
      .min(1)
      .max(100),
  })
  .refine((v) => v.correct + v.wrong + v.blank > 0, 'Informe ao menos uma questão')
  .refine(
    (v) => new Set(v.links.map((l) => l.contest_id)).size === v.links.length,
    'Uma tentativa só pode ter uma classificação principal por concurso',
  );
const schemas = {
  contests: contestSchema,
  topics: topicSchema,
  mappings: z.object({
    topic_id: uuid,
    document_id: uuid,
    start_page: positive,
    end_page: positive,
    confirmed: z.number().min(0).max(1).default(0),
    confidence: z.number().min(0).max(1).default(1),
  }),
  readings: z.object({
    document_id: uuid,
    topic_id: nullableId,
    start_page: positive,
    end_page: positive,
    resume_page: positive,
    date,
    completed: z.number().min(0).max(1).default(1),
    notes: text.default(''),
  }),
  blocks: z.object({
    contest_id: uuid,
    topic_id: nullableId,
    title: short.min(1),
    minutes: positive.max(1440),
    kind: z.enum(['theory', 'review', 'questions', 'mock']),
    position: count.default(0),
  }),
  sessions: z.object({
    contest_id: uuid,
    topic_id: nullableId,
    date,
    minutes: minutes.refine((n) => n > 0),
    kind: z.enum(['theory', 'review', 'questions', 'mock', 'pomodoro']),
    notes: text.default(''),
    interrupted: z.number().min(0).max(1).default(0),
  }),
  reviews: z.object({
    contest_id: uuid,
    topic_id: uuid,
    document_id: nullableId,
    pages: short.default(''),
    due_date: date,
    completed_at: date.nullable().default(null),
    minutes: minutes.default(0),
    difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  }),
  mocks: z.object({
    contest_id: uuid,
    title: short.min(1),
    board: short.default(''),
    date,
    minutes: minutes.default(0),
    include_stats: z.number().min(0).max(1).default(1),
  }),
  bookmarks: z.object({ document_id: uuid, page: positive, note: text.default('') }),
};
type Table = keyof typeof schemas;
const tables = Object.keys(schemas) as Table[];
class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (message: string, status = 400): never => {
  throw new ApiError(status, message);
};
function requireRow<T = Record<string, unknown>>(s: Store, table: string, key: string): T {
  uuid.parse(key);
  const row = s.one<T>(`SELECT * FROM ${table} WHERE id=?`, [key]);
  if (!row) fail('Registro não encontrado', 404);
  return row!;
}
function validateTopic(s: Store, topicId: unknown, contestId: unknown) {
  if (topicId) {
    const t = requireRow<Topic>(s, 'topics', String(topicId));
    if (t.contest_id !== contestId) fail('Tópico pertence a outro concurso');
  }
}
function validateEntity(s: Store, table: Table, v: Record<string, unknown>, key?: string) {
  if (v.contest_id) requireRow(s, 'contests', String(v.contest_id));
  if (v.topic_id) {
    const topic = requireRow<Topic>(s, 'topics', String(v.topic_id));
    if (v.contest_id && topic.contest_id !== v.contest_id) fail('Tópico pertence a outro concurso');
  }
  if (table === 'topics') {
    if (v.parent_id) {
      const p = requireRow<Topic>(s, 'topics', String(v.parent_id));
      if (p.contest_id !== v.contest_id) fail('Hierarquia pertence a outro concurso');
      if (
        (v.kind === 'subject' && p.kind !== 'discipline') ||
        (v.kind === 'subtopic' && p.kind !== 'subject') ||
        v.kind === 'discipline'
      )
        fail('Nível hierárquico inválido');
      if (key && descendants(s.all<Topic>('SELECT * FROM topics'), key).has(String(v.parent_id)))
        fail('Uma hierarquia não pode conter ciclos');
    } else if (v.kind !== 'discipline') fail('Assunto ou subassunto precisa de um nível superior');
    if (key) {
      const previous = requireRow<Topic>(s, 'topics', key);
      if (previous.contest_id !== v.contest_id || previous.kind !== v.kind)
        fail('Concurso e nível de um tópico existente não podem ser alterados');
    }
  }
  if (v.document_id) {
    const d = requireRow<Document>(s, 'documents', String(v.document_id));
    for (const k of ['start_page', 'end_page', 'resume_page', 'page'])
      if (typeof v[k] === 'number' && (v[k] as number) > d.pages) fail('Página fora do documento');
    if (v.end_page && Number(v.end_page) < Number(v.start_page))
      fail('Página final anterior à inicial');
    if (table === 'mappings' && d.contest_id) {
      const t = requireRow<Topic>(s, 'topics', String(v.topic_id));
      if (d.contest_id !== t.contest_id) fail('Material pertence a outro concurso');
    }
  }
}
function fullState(s: Store): State {
  const result: Record<string, unknown> = {};
  for (const table of [
    ...tables,
    'documents',
    'facts',
    'attempts',
    'attempt_links',
    'session_links',
    'cycles',
  ])
    result[table] = s.all(`SELECT * FROM ${table}`);
  result.documents = (result.documents as Document[]).map((d) => ({ ...d, text_pages: [] }));
  result.events = s.all('SELECT * FROM events ORDER BY created_at DESC LIMIT 250');
  result.preferences = Object.fromEntries(
    s
      .all<{ key: string; value: string }>('SELECT * FROM preferences')
      .map((p) => [p.key, JSON.parse(p.value)]),
  );
  return result as State;
}
export async function createApp(dataDir: string, frontendDir?: string) {
  const store = await new Store(dataDir).init();
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '30mb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(req.hostname))
      return res.status(403).json({ error: 'Acesso permitido apenas neste computador' });
    if (req.path.startsWith('/api') && req.headers['x-study-client'] !== 'cronograma')
      return res.status(403).json({ error: 'Cliente local obrigatório' });
    const origin = req.headers.origin;
    if (origin && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))
      return res.status(403).json({ error: 'Origem não permitida' });
    next();
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024, files: 1, fieldSize: 32 * 1024 * 1024, fields: 10 },
  });
  app.get('/api/health', (_req, res) =>
    res.json({ ok: true, database: store.one('PRAGMA integrity_check') }),
  );
  app.get('/api/state', (_req, res) => res.json(fullState(store)));
  for (const table of tables) {
    app.post(`/api/${table}`, (req, res) => {
      const value = schemas[table].parse(req.body) as Record<string, unknown>;
      validateEntity(store, table, value);
      const key = id();
      store.transaction(() => {
        if (table === 'contests') {
          value.created_at = new Date().toISOString();
          if (!store.one('SELECT id FROM contests LIMIT 1')) value.main = 1;
          if (value.main) store.run('UPDATE contests SET main=0');
        }
        if (table === 'topics')
          Object.assign(value, {
            source_document_id: null,
            source_page: null,
            source_section: '',
            source_excerpt: '',
            confidence: 1,
          });
        store.insert(table, { id: key, ...value });
        store.audit(table, key, 'created', null, value);
        if (table === 'blocks')
          store.run(
            'INSERT INTO cycles(contest_id,block_id,lap) VALUES(?,?,0) ON CONFLICT(contest_id) DO UPDATE SET block_id=excluded.block_id WHERE cycles.block_id IS NULL',
            [value.contest_id, key],
          );
        if (table === 'readings')
          store.update('documents', String(value.document_id), { resume_page: value.resume_page });
      });
      res.status(201).json({ id: key });
    });
    app.put(`/api/${table}/:id`, (req, res) => {
      const before = requireRow<Record<string, unknown>>(store, table, String(req.params.id));
      const value = schemas[table].parse(req.body) as Record<string, unknown>;
      validateEntity(store, table, value, String(req.params.id));
      store.transaction(() => {
        if (table === 'contests' && value.main) store.run('UPDATE contests SET main=0');
        store.update(table, String(req.params.id), value);
        store.audit(table, String(req.params.id), 'updated', before, value);
        if (table === 'mocks')
          store.run('UPDATE attempts SET include_stats=? WHERE mock_id=?', [
            value.include_stats,
            req.params.id,
          ]);
        if (table === 'readings')
          store.update('documents', String(value.document_id), { resume_page: value.resume_page });
      });
      res.json({ ok: true });
    });
    app.delete(`/api/${table}/:id`, (req, res) => {
      if (req.body.confirm !== true) fail('Confirmação explícita necessária');
      const before = requireRow(store, table, String(req.params.id));
      store.transaction(() => {
        if (table === 'blocks') {
          const block = before as unknown as Block;
          const next = store.one<Block>(
            'SELECT * FROM blocks WHERE contest_id=? AND id<>? ORDER BY position,id',
            [block.contest_id, req.params.id],
          );
          store.run('UPDATE cycles SET block_id=? WHERE block_id=?', [
            next?.id || null,
            req.params.id,
          ]);
        }
        if (table === 'mocks') {
          store.run(
            'DELETE FROM attempt_links WHERE attempt_id IN (SELECT id FROM attempts WHERE mock_id=?)',
            [req.params.id],
          );
          store.run('DELETE FROM attempts WHERE mock_id=?', [req.params.id]);
        }
        if (table === 'sessions')
          store.run('DELETE FROM session_links WHERE session_id=?', [req.params.id]);
        store.run(`DELETE FROM ${table} WHERE id=?`, [req.params.id]);
        store.audit(table, String(req.params.id), 'deleted', before, null);
      });
      res.json({ ok: true });
    });
  }
  app.post('/api/attempts', (req, res) => saveAttempt(req, res));
  app.put('/api/attempts/:id', (req, res) => saveAttempt(req, res));
  function saveAttempt(req: Request, res: Response) {
    const v = attemptSchema.parse(req.body);
    for (const l of v.links) {
      requireRow(store, 'contests', l.contest_id);
      validateTopic(store, l.topic_id, l.contest_id);
    }
    if (v.mock_id) {
      const m = requireRow<{ contest_id: string; include_stats: number }>(
        store,
        'mocks',
        v.mock_id,
      );
      if (!v.links.some((l) => l.contest_id === m.contest_id))
        fail('Simulado não pertence ao concurso');
      v.include_stats = m.include_stats;
    }
    const key = req.params.id ? String(req.params.id) : id(),
      before = req.params.id ? requireRow<Attempt>(store, 'attempts', key) : null;
    const { links, ...data } = v;
    if (before && before.mock_id !== v.mock_id)
      fail('Não é possível mover uma tentativa entre simulados');
    store.transaction(() => {
      if (before) {
        store.update('attempts', key, data);
        store.run('DELETE FROM attempt_links WHERE attempt_id=?', [key]);
      } else store.insert('attempts', { id: key, ...data });
      for (const l of links) store.insert('attempt_links', { attempt_id: key, ...l });
      store.audit('attempts', key, before ? 'updated' : 'created', before, v);
    });
    res.status(before ? 200 : 201).json({ id: key });
  }
  app.post('/api/attempts/batch', (req, res) => {
    const values = z.array(attemptSchema).min(1).max(200).parse(req.body.rows);
    for (const v of values) {
      for (const l of v.links) {
        requireRow(store, 'contests', l.contest_id);
        validateTopic(store, l.topic_id, l.contest_id);
      }
      if (v.mock_id) {
        const m = requireRow<{ contest_id: string; include_stats: number }>(
          store,
          'mocks',
          v.mock_id,
        );
        if (!v.links.some((l) => l.contest_id === m.contest_id))
          fail('Simulado pertence a outro concurso');
        v.include_stats = m.include_stats;
      }
    }
    const ids: string[] = [];
    store.transaction(() => {
      for (const v of values) {
        const key = id();
        ids.push(key);
        const { links, ...data } = v;
        store.insert('attempts', { id: key, ...data });
        for (const link of links) store.insert('attempt_links', { attempt_id: key, ...link });
        store.audit('attempts', key, 'created', null, v);
      }
    });
    res.status(201).json({ ids });
  });
  app.delete('/api/attempts/:id', (req, res) => {
    if (req.body.confirm !== true) fail('Confirmação explícita necessária');
    const before = requireRow(store, 'attempts', String(req.params.id));
    store.transaction(() => {
      store.run('DELETE FROM attempt_links WHERE attempt_id=?', [req.params.id]);
      store.run('DELETE FROM attempts WHERE id=?', [req.params.id]);
      store.audit('attempts', String(req.params.id), 'deleted', before, null);
    });
    res.json({ ok: true });
  });
  app.post('/api/sessions/:id/reuse', (req, res) => {
    const session = requireRow(store, 'sessions', String(req.params.id));
    const v = z
      .object({ contest_id: uuid, topic_id: nullableId, confirmed: z.literal(true) })
      .parse(req.body);
    requireRow(store, 'contests', v.contest_id);
    validateTopic(store, v.topic_id, v.contest_id);
    store.transaction(() => {
      store.run(
        'INSERT INTO session_links(session_id,contest_id,topic_id) VALUES(?,?,?) ON CONFLICT(session_id,contest_id) DO UPDATE SET topic_id=excluded.topic_id',
        [session.id, v.contest_id, v.topic_id],
      );
      store.audit('sessions', String(req.params.id), 'reused', null, v);
    });
    res.json({ ok: true });
  });
  app.post('/api/documents', upload.single('file'), (req, res) => {
    if (!req.file || req.file.buffer.subarray(0, 5).toString() !== '%PDF-')
      fail('Selecione um PDF válido');
    const v = z
      .object({
        name: short.min(1),
        kind: z.enum(['material', 'notice', 'amendment', 'annex', 'schedule']),
        contest_id: z.union([uuid, z.literal('')]).default(''),
        topic_id: z.union([uuid, z.literal('')]).default(''),
        pages: z.coerce.number().int().min(1).max(20000),
        text_pages: z.string(),
        outline: z.string().default('[]'),
      })
      .parse(req.body);
    const textPages = z.array(z.string().max(300000)).max(20000).parse(JSON.parse(v.text_pages));
    if (textPages.length !== v.pages) fail('Quantidade de páginas inconsistente');
    const outline = z.array(z.unknown()).max(20000).parse(JSON.parse(v.outline));
    if (v.contest_id) requireRow(store, 'contests', v.contest_id);
    if (v.topic_id) validateTopic(store, v.topic_id, v.contest_id);
    const key = id(),
      filename = key + '.pdf';
    writeFileSync(path.join(dataDir, 'files', filename), req.file!.buffer);
    try {
      store.transaction(() => {
        store.insert('documents', {
          id: key,
          ...v,
          contest_id: v.contest_id || null,
          topic_id: v.topic_id || null,
          filename,
          text_pages: textPages,
          outline,
          resume_page: 1,
          created_at: new Date().toISOString(),
        });
        store.audit('documents', key, 'imported', null, { name: v.name, kind: v.kind });
      });
    } catch (e) {
      rmSync(path.join(dataDir, 'files', filename));
      throw e;
    }
    res.status(201).json({ id: key });
  });
  app.get('/api/documents/:id', (req, res) =>
    res.json(requireRow(store, 'documents', String(req.params.id))),
  );
  app.get('/api/documents/:id/file', (req, res) => {
    const d = requireRow<Document>(store, 'documents', String(req.params.id));
    res.type('application/pdf').sendFile(path.join(dataDir, 'files', d.filename));
  });
  app.put('/api/documents/:id/position', (req, res) => {
    const d = requireRow<Document>(store, 'documents', String(req.params.id));
    const { page } = z.object({ page: positive }).parse(req.body);
    if (page > d.pages) fail('Página fora do documento');
    store.update('documents', d.id, { resume_page: page });
    res.json({ ok: true });
  });
  app.put('/api/documents/:id/text', (req, res) => {
    const d = requireRow<Document>(store, 'documents', String(req.params.id));
    const v = z.object({ page: positive, text: z.string().max(300000) }).parse(req.body);
    if (v.page > d.pages) fail('Página fora do documento');
    d.text_pages[v.page - 1] = v.text;
    store.update('documents', d.id, { text_pages: d.text_pages });
    res.json({ ok: true });
  });
  app.post('/api/documents/:id/analyze', (req, res) => {
    const d = requireRow<Document>(store, 'documents', String(req.params.id));
    res.json(
      analyzeNotice(d.text_pages, z.object({ role: short.default('') }).parse(req.body).role),
    );
  });
  app.post('/api/documents/:id/apply-analysis', (req, res) => {
    const d = requireRow<Document>(store, 'documents', String(req.params.id));
    if (!d.contest_id) fail('Associe o edital a um concurso');
    const contest = requireRow<Contest>(store, 'contests', d.contest_id!);
    const input = z
      .object({
        role: short.default(''),
        topicKeys: z.array(short).max(10000).default([]),
        fields: z.array(short).max(1000).default([]),
      })
      .parse(req.body);
    const analysis = analyzeNotice(d.text_pages, input.role);
    const keys = new Map<string, string>();
    store.transaction(() => {
      for (const f of analysis.facts.filter((f) => input.fields.includes(f.field))) {
        if (
          store.one('SELECT id FROM facts WHERE document_id=? AND field=? AND value=?', [
            d.id,
            f.field,
            f.value,
          ])
        )
          continue;
        const previous =
          (contest as unknown as Record<string, unknown>)[f.field] ||
          contest.metadata[f.field] ||
          '';
        store.insert('facts', {
          id: id(),
          contest_id: contest.id,
          document_id: d.id,
          ...f,
          status: 'pending',
          previous_value: String(previous),
        });
      }
      for (const t of analysis.topics.filter((t) => input.topicKeys.includes(t.key))) {
        if (t.parentKey && !keys.has(t.parentKey)) continue;
        const existing = store.one<Topic>(
          'SELECT * FROM topics WHERE contest_id=? AND title=? AND parent_id IS ?',
          [contest.id, t.title, t.parentKey ? keys.get(t.parentKey) : null],
        );
        const key = existing?.id || id();
        keys.set(t.key, key);
        if (!existing)
          store.insert('topics', {
            id: key,
            contest_id: contest.id,
            parent_id: t.parentKey ? keys.get(t.parentKey) : null,
            kind: t.kind,
            title: t.title,
            weight: 1,
            coverage: 'unverified',
            review_state: 'not_reviewed',
            source_document_id: d.id,
            source_page: t.page,
            source_section: t.section,
            source_excerpt: t.excerpt,
            confidence: t.confidence,
            verified: 0,
            position: 0,
          });
      }
      store.audit('documents', d.id, 'analysis_saved', null, {
        role: input.role,
        facts: input.fields,
        topics: input.topicKeys,
      });
    });
    res.json({ ok: true });
  });
  app.put('/api/facts/:id', (req, res) => {
    const f = requireRow<Fact>(store, 'facts', String(req.params.id));
    const v = z
      .object({ value: text.min(1), status: z.enum(['confirmed', 'corrected', 'rejected']) })
      .parse(req.body);
    const contest = requireRow<Contest>(store, 'contests', f.contest_id);
    store.transaction(() => {
      store.update('facts', f.id, v);
      if (v.status !== 'rejected') {
        let value = v.value;
        if (f.field === 'exam_date') {
          const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (m) value = `${m[3]}-${m[2]}-${m[1]}`;
          date.parse(value);
        }
        const direct = ['name', 'board', 'role', 'exam_date'].includes(f.field);
        const before = direct
          ? (contest as unknown as Record<string, unknown>)[f.field]
          : contest.metadata[f.field];
        if (direct) store.update('contests', contest.id, { [f.field]: value });
        else
          store.update('contests', contest.id, {
            metadata: { ...contest.metadata, [f.field]: value },
          });
        store.audit(
          'contests',
          contest.id,
          'notice_change',
          { field: f.field, value: before ?? '' },
          { field: f.field, value, document_id: f.document_id, fact_id: f.id },
        );
      }
      store.audit('facts', f.id, v.status, f, v);
    });
    res.json({ ok: true });
  });
  app.post('/api/documents/:id/match', (req, res) => {
    const d = requireRow<Document>(store, 'documents', String(req.params.id));
    const v = z.object({ contest_id: uuid }).parse(req.body);
    const suggestions = suggestMatches(
      store.all<Topic>('SELECT * FROM topics WHERE contest_id=? AND kind<>?', [
        v.contest_id,
        'discipline',
      ]),
      d.id,
      d.text_pages,
    );
    store.transaction(() => {
      for (const m of suggestions)
        if (
          !store.one('SELECT id FROM mappings WHERE topic_id=? AND document_id=?', [
            m.topic_id,
            m.document_id,
          ])
        )
          store.insert('mappings', { id: id(), ...m });
    });
    res.json({ count: suggestions.length });
  });
  app.post('/api/reviews/schedule', (req, res) => {
    const v = z
      .object({
        contest_id: uuid,
        topic_id: uuid,
        document_id: nullableId,
        pages: short.default(''),
        date,
        intervals: z.array(positive.max(3650)).min(1).max(20),
      })
      .parse(req.body);
    validateTopic(store, v.topic_id, v.contest_id);
    if (v.document_id) requireRow(store, 'documents', v.document_id);
    store.transaction(() => {
      for (const interval of new Set(v.intervals)) {
        const due = addDays(v.date, interval);
        if (!store.one('SELECT id FROM reviews WHERE topic_id=? AND due_date=?', [v.topic_id, due]))
          store.insert('reviews', {
            id: id(),
            contest_id: v.contest_id,
            topic_id: v.topic_id,
            document_id: v.document_id,
            pages: v.pages,
            due_date: due,
            completed_at: null,
            minutes: 0,
            difficulty: 'medium',
          });
      }
    });
    res.json({ ok: true });
  });
  app.post('/api/cycles/:contestId/advance', (req, res) => {
    const contestId = String(req.params.contestId);
    requireRow(store, 'contests', contestId);
    const v = z
      .object({ completed: z.boolean(), expected_block_id: uuid.nullable() })
      .parse(req.body);
    const blocks = store.all<Block>(
      'SELECT * FROM blocks WHERE contest_id=? ORDER BY position,id',
      [contestId],
    );
    if (!blocks.length) fail('Adicione blocos ao ciclo');
    const cycle = store.one<{ block_id: string | null; lap: number }>(
      'SELECT * FROM cycles WHERE contest_id=?',
      [contestId],
    );
    if (cycle && cycle.block_id !== v.expected_block_id)
      fail('O bloco atual mudou. Atualize a tela antes de avançar.', 409);
    const index = blocks.findIndex((b) => b.id === cycle?.block_id),
      next = (index + 1) % blocks.length;
    store.transaction(() => {
      const lap = (cycle?.lap || 0) + (v.completed && next === 0 ? 1 : 0);
      store.run(
        'INSERT INTO cycles(contest_id,block_id,lap) VALUES(?,?,?) ON CONFLICT(contest_id) DO UPDATE SET block_id=excluded.block_id,lap=excluded.lap',
        [contestId, blocks[next].id, lap],
      );
      store.audit('cycles', contestId, v.completed ? 'completed' : 'postponed', cycle, {
        block_id: blocks[next].id,
        lap,
      });
    });
    res.json({ ok: true });
  });
  app.post('/api/blocks/reorder', (req, res) => {
    const v = z.object({ contest_id: uuid, ids: z.array(uuid) }).parse(req.body);
    const blocks = store.all<Block>('SELECT * FROM blocks WHERE contest_id=?', [v.contest_id]);
    if (
      v.ids.length !== blocks.length ||
      new Set(v.ids).size !== blocks.length ||
      blocks.some((b) => !v.ids.includes(b.id))
    )
      fail('Lista de blocos inconsistente');
    store.transaction(() =>
      v.ids.forEach((key, i) => store.update('blocks', key, { position: i })),
    );
    res.json({ ok: true });
  });
  app.put('/api/preferences/:key', (req, res) => {
    const key = z
      .enum([
        'theme',
        'review_intervals',
        'ignored_recommendations',
        'notifications',
        'timer_settings',
      ])
      .parse(req.params.key);
    let value: unknown;
    if (key === 'theme') value = z.enum(['light', 'dark']).parse(req.body.value);
    else if (key === 'review_intervals')
      value = z.array(positive.max(3650)).min(1).max(20).parse(req.body.value);
    else if (key === 'ignored_recommendations')
      value = z.array(uuid).max(10000).parse(req.body.value);
    else if (key === 'notifications') value = z.boolean().parse(req.body.value);
    else
      value = z
        .object({ focus: positive.max(180), short: positive.max(60), long: positive.max(120) })
        .parse(req.body.value);
    store.preference(key, value);
    res.json({ ok: true });
  });
  const timerSchema = z.object({
    revision: count.default(0),
    contest_id: uuid,
    topic_id: nullableId,
    mode: z.enum(['focus', 'short', 'long']),
    remaining: z.number().min(0).max(86400),
    deadline: z.number().nullable(),
    elapsed: z.number().min(0).max(86400),
    focus_count: count,
    running: z.boolean(),
    block_id: nullableId,
    focus_minutes: positive.max(180),
    short_minutes: positive.max(60),
    long_minutes: positive.max(120),
  });
  app.put('/api/timer', (req, res) => {
    const timer = timerSchema.parse(req.body);
    requireRow(store, 'contests', timer.contest_id);
    validateTopic(store, timer.topic_id, timer.contest_id);
    const old = store.one<{ value: string }>("SELECT value FROM preferences WHERE key='timer'");
    const revision = old ? JSON.parse(old.value).revision || 0 : 0;
    if (timer.revision !== revision)
      fail('Cronômetro alterado em outra janela. Atualize a tela.', 409);
    store.preference('timer', { ...timer, revision: revision + 1 });
    res.json({ ok: true });
  });
  app.post('/api/timer/finish', (req, res) => {
    const v = z
      .object({
        interrupted: z.boolean().default(false),
        expected_revision: count,
        expected_mode: z.enum(['focus', 'short', 'long']),
        expected_deadline: z.number().nullable(),
      })
      .parse(req.body);
    const row = store.one<{ value: string }>("SELECT value FROM preferences WHERE key='timer'");
    if (!row) fail('Nenhuma sessão em andamento');
    const timer = timerSchema.parse(JSON.parse(row!.value));
    if (
      timer.revision !== v.expected_revision ||
      timer.mode !== v.expected_mode ||
      timer.deadline !== v.expected_deadline
    )
      fail('Esta sessão já foi finalizada ou alterada.', 409);
    const remaining =
      timer.running && timer.deadline
        ? Math.max(0, Math.ceil((timer.deadline - Date.now()) / 1000))
        : timer.remaining;
    const elapsed = Math.min(
      timer.focus_minutes * 60,
      timer.elapsed + Math.max(0, timer.remaining - remaining),
    );
    store.transaction(() => {
      if (timer.mode === 'focus' && elapsed > 0) {
        const key = id();
        store.insert('sessions', {
          id: key,
          contest_id: timer.contest_id,
          topic_id: timer.topic_id,
          date: dayKey(),
          minutes: elapsed / 60,
          kind: 'pomodoro',
          notes: 'Sessão do cronômetro',
          interrupted: v.interrupted ? 1 : 0,
        });
        store.audit('sessions', key, 'timer_finished', null, {
          elapsed,
          interrupted: v.interrupted,
        });
        timer.focus_count++;
      }
      const mode =
        timer.mode === 'focus' ? (timer.focus_count % 4 === 0 ? 'long' : 'short') : 'focus';
      store.preference('timer', {
        ...timer,
        revision: timer.revision + 1,
        mode,
        remaining:
          (mode === 'focus'
            ? timer.focus_minutes
            : mode === 'short'
              ? timer.short_minutes
              : timer.long_minutes) * 60,
        deadline: null,
        running: false,
        elapsed: 0,
      });
    });
    res.json({ ok: true });
  });
  function archive() {
    const files: Record<string, Uint8Array> = {
      'manifest.json': strToU8(
        JSON.stringify({
          app: 'cronograma-de-estudos',
          version: 1,
          created_at: new Date().toISOString(),
        }),
      ),
      'studies.sqlite': store.snapshot(),
    };
    for (const name of readdirSync(path.join(dataDir, 'files')))
      if (/^[\da-f-]+\.pdf$/.test(name))
        files['files/' + name] = new Uint8Array(readFileSync(path.join(dataDir, 'files', name)));
    return zipSync(files, { level: 1 });
  }
  app.get('/api/backup', (_req, res) => {
    res.setHeader('Content-Disposition', `attachment; filename="cronograma-${dayKey()}.zip"`);
    res.type('application/zip').send(Buffer.from(archive()));
  });
  app.post('/api/restore', upload.single('file'), (req, res) => {
    if (req.body.confirm !== 'true') fail('Confirmação explícita necessária');
    if (!req.file) fail('Selecione um backup');
    let total = 0;
    const files = unzipSync(new Uint8Array(req.file!.buffer), {
      filter: (f) => {
        total += f.originalSize;
        if (total > 1024 * 1024 * 1024) fail('Backup excede o limite descompactado de 1 GB');
        if (
          !['manifest.json', 'studies.sqlite'].includes(f.name) &&
          !/^files\/[\da-f-]+\.pdf$/.test(f.name)
        )
          fail('Arquivo não permitido no backup');
        return true;
      },
    });
    if (!files['studies.sqlite'] || !files['manifest.json']) fail('Backup inválido');
    const manifest = JSON.parse(Buffer.from(files['manifest.json']).toString());
    if (manifest.app !== 'cronograma-de-estudos' || manifest.version !== 1)
      fail('Versão de backup incompatível');
    const candidate = new store.SQL.Database(files['studies.sqlite']);
    try {
      candidate.run('PRAGMA foreign_keys=ON');
      if (
        candidate.exec('PRAGMA integrity_check')[0]?.values[0]?.[0] !== 'ok' ||
        candidate.exec('PRAGMA foreign_key_check').length
      )
        fail('Banco de backup inconsistente');
      const version = candidate.exec('SELECT MAX(version) FROM schema_migrations')[0]
        ?.values[0]?.[0];
      if (version !== 1) fail('Versão de banco incompatível');
      const docs = candidate.exec('SELECT filename FROM documents');
      for (const row of docs[0]?.values || [])
        if (!/^[\da-f-]+\.pdf$/.test(String(row[0])) || !files['files/' + row[0]])
          fail('PDF ausente no backup');
      for (const file of Object.keys(files))
        if (
          file.startsWith('files/') &&
          Buffer.from(files[file].subarray(0, 5)).toString() !== '%PDF-'
        )
          fail('PDF inválido no backup');
    } catch (e) {
      candidate.close();
      throw e;
    }
    const safety = path.join(dataDir, 'backups', `antes-restauracao-${Date.now()}.zip`);
    writeFileSync(safety, archive());
    const stage = path.join(dataDir, 'restore-' + id());
    mkdirSync(path.join(stage, 'files'), { recursive: true });
    try {
      for (const [name, bytes] of Object.entries(files))
        if (name.startsWith('files/')) writeFileSync(path.join(stage, name), bytes);
      writeFileSync(path.join(stage, 'studies.sqlite'), candidate.export());
      candidate.run('PRAGMA foreign_keys=ON');
    } catch (e) {
      candidate.close();
      rmSync(stage, { recursive: true, force: true });
      throw e;
    }
    const old = path.join(dataDir, 'old-files-' + id());
    renameSync(path.join(dataDir, 'files'), old);
    try {
      renameSync(path.join(stage, 'files'), path.join(dataDir, 'files'));
      renameSync(path.join(stage, 'studies.sqlite'), store.file);
    } catch (e) {
      rmSync(path.join(dataDir, 'files'), { recursive: true, force: true });
      renameSync(old, path.join(dataDir, 'files'));
      candidate.close();
      throw e;
    }
    store.db.close();
    store.db = candidate;
    rmSync(old, { recursive: true, force: true });
    rmSync(stage, { recursive: true, force: true });
    res.json({ ok: true });
  });
  app.get('/api/report/:contestId', (req, res) => {
    const contest = requireRow<Contest>(store, 'contests', String(req.params.contestId));
    const state = fullState(store);
    const csv = (row: unknown[]) =>
      row.map((v) => '"' + String(v ?? '').replaceAll('"', '""') + '"').join(';');
    const rows = [
      csv([
        'Nível',
        'Conteúdo',
        'Respondidas',
        'Acertos',
        'Erros',
        'Em branco',
        'Taxa de acertos',
        'Aproveitamento',
        'Pontuação líquida',
      ]),
      csv([
        'Concurso',
        contest.name,
        ...statValues(
          statistics(state.attempts, state.attempt_links, state.topics, { contestId: contest.id }),
        ),
      ]),
    ];
    for (const t of state.topics.filter((t) => t.contest_id === contest.id))
      rows.push(
        csv([
          t.kind,
          t.title,
          ...statValues(
            statistics(state.attempts, state.attempt_links, state.topics, {
              contestId: contest.id,
              topicId: t.id,
            }),
          ),
        ]),
      );
    res.setHeader('Content-Disposition', 'attachment; filename="desempenho.csv"');
    res.type('text/csv; charset=utf-8').send('\uFEFF' + rows.join('\r\n'));
  });
  function statValues(s: ReturnType<typeof statistics>) {
    return [
      s.answered,
      s.correct,
      s.wrong,
      s.blank,
      s.accuracy === null ? 'Sem dados' : s.accuracy.toFixed(2),
      s.yield === null ? 'Sem dados' : s.yield.toFixed(2),
      s.score,
    ];
  }
  if (frontendDir && existsSync(frontendDir)) {
    app.use((_req, res, next) => {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      );
      next();
    });
    app.use(express.static(frontendDir));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(frontendDir, 'index.html')));
  }
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError)
      return res
        .status(400)
        .json({ error: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
    if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
    if (/FOREIGN KEY/.test(err.message))
      return res.status(409).json({
        error: 'Este registro possui vínculos. Remova ou ajuste os vínculos antes de excluir.',
      });
    if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({
      error: 'Não foi possível concluir a operação. Os dados anteriores foram preservados.',
    });
  });
  return { app, store };
}
