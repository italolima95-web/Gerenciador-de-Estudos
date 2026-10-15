import { syllabusComparison } from './comparison.js';
import type {
  Attempt,
  AttemptLink,
  Mapping,
  Reading,
  Review,
  State,
  Stats,
  Topic,
  Contest,
} from './types.js';
export const dayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function addDays(date: string, days: number) {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return dayKey(d);
}
export function descendants(topics: Topic[], id: string): Set<string> {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of topics)
      if (t.parent_id && ids.has(t.parent_id) && !ids.has(t.id)) {
        ids.add(t.id);
        changed = true;
      }
  }
  return ids;
}
export function ancestry(topics: Topic[], id: string | null): Topic[] {
  const result: Topic[] = [];
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const t = topics.find((x) => x.id === id);
    if (!t) break;
    result.unshift(t);
    id = t.parent_id;
  }
  return result;
}
export function leafTopics(topics: Topic[], root?: string) {
  const pool = root ? topics.filter((t) => descendants(topics, root).has(t.id)) : topics;
  return pool.filter((t) => t.kind !== 'discipline' && !pool.some((c) => c.parent_id === t.id));
}
export type StatsFilter = {
  contestId: string;
  topicId?: string;
  from?: string;
  to?: string;
  board?: string;
  origin?: string;
  questionType?: string;
  includeMocks?: boolean;
};
export function statistics(
  attempts: Attempt[],
  links: AttemptLink[],
  topics: Topic[],
  filter: StatsFilter,
): Stats {
  const tree = filter.topicId ? descendants(topics, filter.topicId) : null;
  const valid = new Set(
    links
      .filter(
        (l) => l.contest_id === filter.contestId && (!tree || (l.topic_id && tree.has(l.topic_id))),
      )
      .map((l) => l.attempt_id),
  );
  const rows = attempts.filter(
    (a) =>
      valid.has(a.id) &&
      a.include_stats !== 0 &&
      (!filter.from || a.date >= filter.from) &&
      (!filter.to || a.date <= filter.to) &&
      (!filter.board || a.board === filter.board) &&
      (!filter.origin || a.origin === filter.origin) &&
      (!filter.questionType || a.question_type === filter.questionType),
  );
  // IDs, never secondary tags, establish membership. A reused attempt is counted once.
  const unique = [...new Map(rows.map((a) => [a.id, a])).values()];
  const s = unique.reduce(
    (r, a) => ({
      correct: r.correct + a.correct,
      wrong: r.wrong + a.wrong,
      blank: r.blank + a.blank,
      minutes: r.minutes + a.minutes,
      score: r.score + a.correct * a.weight - a.wrong * a.penalty,
    }),
    { correct: 0, wrong: 0, blank: 0, minutes: 0, score: 0 },
  );
  const answered = s.correct + s.wrong,
    presented = answered + s.blank;
  return {
    ...s,
    answered,
    presented,
    accuracy: answered ? (s.correct / answered) * 100 : null,
    yield: presented ? (s.correct / presented) * 100 : null,
    count: unique.length,
  };
}
export function mergeIntervals(intervals: [number, number][]): [number, number][] {
  const result: [number, number][] = [];
  for (const [start, end] of [...intervals].sort((a, b) => a[0] - b[0])) {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start)
      throw Error('Intervalo de páginas inválido');
    const last = result.at(-1);
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
    else result.push([start, end]);
  }
  return result;
}
export function readPages(readings: Reading[], documentId: string, start = 1, end = Infinity) {
  return mergeIntervals(
    readings
      .filter((r) => r.document_id === documentId && r.completed)
      .map((r) => [Math.max(start, r.start_page), Math.min(end, r.end_page)] as [number, number])
      .filter(([a, b]) => b >= a),
  ).reduce((s, [a, b]) => s + b - a + 1, 0);
}
export function effectiveCoverage(
  topic: Topic,
  mappings: Mapping[],
  readings: Reading[],
): Topic['coverage'] {
  if (topic.coverage === 'studied') return 'studied';
  const matches = mappings.filter((m) => m.topic_id === topic.id && m.confirmed);
  if (!matches.length) return topic.coverage;
  // Merge page ranges per document so overlapping material cannot inflate coverage.
  const ranges = new Map<string, [number, number][]>();
  for (const m of matches)
    ranges.set(m.document_id, [...(ranges.get(m.document_id) || []), [m.start_page, m.end_page]]);
  let total = 0,
    done = 0;
  for (const [doc, rs] of ranges)
    for (const [a, b] of mergeIntervals(rs)) {
      total += b - a + 1;
      done += readPages(readings, doc, a, b);
    }
  if (done === total && total > 0) return 'studied';
  if (done > 0) return 'partial';
  return topic.coverage;
}
export function coverage(topics: Topic[], mappings: Mapping[], readings: Reading[], root?: string) {
  const leaves = leafTopics(topics, root);
  const states = leaves.map((t) => ({ t, state: effectiveCoverage(t, mappings, readings) }));
  const weight = states.reduce((s, { t }) => s + t.weight, 0);
  return {
    percent: weight
      ? (states.reduce((s, { t, state }) => s + (state === 'studied' ? t.weight : 0), 0) / weight) *
        100
      : null,
    total: leaves.length,
    studied: states.filter((s) => s.state === 'studied').length,
    partial: states.filter((s) => s.state === 'partial').length,
    pending: states.filter((s) => s.state !== 'studied').length,
    missing: leaves.filter((t) => !mappings.some((m) => m.topic_id === t.id && m.confirmed)).length,
    unverified: mappings.filter((m) => leaves.some((t) => t.id === m.topic_id) && !m.confirmed)
      .length,
  };
}
export function reviewStats(reviews: Review[], today = dayKey(), from?: string, to?: string) {
  const rows = reviews.filter((r) => (!from || r.due_date >= from) && (!to || r.due_date <= to));
  const done = rows.filter((r) => r.completed_at).length;
  return {
    total: rows.length,
    done,
    pending: rows.length - done,
    overdue: rows.filter((r) => !r.completed_at && r.due_date < today).length,
    percent: rows.length ? (done / rows.length) * 100 : null,
  };
}
export function recommendations(state: State, contest: Contest, _today = dayKey()) {
  return syllabusComparison(state, contest.id)
    .filter((r) => r.topic && r.status !== 'studied')
    .map((r) => ({
      topic: r.topic!,
      stats: statistics(state.attempts, state.attempt_links, state.topics, {
        contestId: contest.id,
        topicId: r.topic!.id,
      }),
      reasons: [
        r.path.join(' › '),
        r.status === 'partial'
          ? 'Conteúdo do edital parcialmente estudado'
          : 'Conteúdo do edital sem conclusão registrada',
        `Edital · página ${r.item.page}`,
      ],
      score: r.status === 'partial' ? 1 : 2,
      action: r.status === 'partial' ? 'Concluir conteúdo' : 'Estudar conteúdo',
      source: r.item,
    }))
    .filter(
      (r) => !((state.preferences.ignored_recommendations as string[]) || []).includes(r.topic.id),
    )
    .sort((a, b) => b.score - a.score);
}
export function planning(
  contest: Contest,
  topics: Topic[],
  mappings: Mapping[],
  readings: Reading[],
  today = dayKey(),
) {
  if (!contest.exam_date) return null;
  let days = 0,
    planned = 0;
  const rest = JSON.parse(contest.rest_days) as number[];
  let cursor = today;
  while (cursor <= contest.exam_date && days < 36600) {
    if (!rest.includes(new Date(cursor + 'T12:00:00').getDay())) planned++;
    days++;
    cursor = addDays(cursor, 1);
  }
  const remaining = coverage(topics, mappings, readings).pending;
  return {
    days: Math.max(0, days - 1),
    planned,
    hours: (planned * contest.daily_minutes) / 60,
    estimatedHours: (remaining * contest.topic_minutes) / 60,
    remaining,
    questionGoal: planned * contest.question_goal,
  };
}
export function habitStats(sessions: State['sessions'], restDays: number[] = [], today = dayKey()) {
  const dates = [...new Set(sessions.filter((s) => s.minutes > 0).map((s) => s.date))].sort();
  let best = 0,
    run = 0,
    prev = '';
  for (const d of dates) {
    let next = prev ? addDays(prev, 1) : '';
    while (next && next < d && restDays.includes(new Date(next + 'T12:00:00').getDay()))
      next = addDays(next, 1);
    run = next === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  let cursor = today,
    current = 0;
  if (!dates.includes(cursor)) cursor = addDays(cursor, -1);
  for (let i = 0; i < 36600; i++) {
    if (dates.includes(cursor)) {
      current++;
      cursor = addDays(cursor, -1);
    } else if (restDays.includes(new Date(cursor + 'T12:00:00').getDay()))
      cursor = addDays(cursor, -1);
    else break;
  }
  return {
    days: dates.length,
    best,
    current,
    minutes: sessions.reduce((s, x) => s + x.minutes, 0),
  };
}

export function contestSessions(state: State, contestId: string) {
  return state.sessions
    .filter(
      (s) =>
        s.contest_id === contestId ||
        state.session_links?.some((l) => l.session_id === s.id && l.contest_id === contestId),
    )
    .map((s) => {
      const link = state.session_links?.find(
        (l) => l.session_id === s.id && l.contest_id === contestId,
      );
      return link ? { ...s, contest_id: contestId, topic_id: link.topic_id } : s;
    });
}

/** Reading counts pages, independently from syllabus coverage or question accuracy. */
export function libraryProgress(state: State, contestId?: string, topicId?: string) {
  const ids = topicId ? descendants(state.topics, topicId) : null;
  const documents = state.documents.filter(
    (d) => d.kind === 'material' && (!contestId || !d.contest_id || d.contest_id === contestId),
  );
  let total = 0,
    done = 0;
  const documentIds: string[] = [];
  for (const doc of documents) {
    let ranges: [number, number][] = [];
    if (!ids || (doc.topic_id && ids.has(doc.topic_id))) ranges = [[1, doc.pages]];
    else
      ranges = state.mappings
        .filter((m) => m.document_id === doc.id && m.confirmed && ids.has(m.topic_id))
        .map((m) => [m.start_page, m.end_page]);
    if (!ranges.length) continue;
    documentIds.push(doc.id);
    for (const [a, b] of mergeIntervals(ranges)) {
      total += b - a + 1;
      done += readPages(state.readings, doc.id, a, b);
    }
  }
  return {
    total,
    done,
    pending: total - done,
    percent: total ? (done / total) * 100 : null,
    documentIds,
  };
}
