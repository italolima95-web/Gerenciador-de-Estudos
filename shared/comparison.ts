import type { State, SyllabusItem } from './types.js';
import { effectiveCoverage, ancestry, descendants } from './domain.js';
import { normalizeTitle } from './catalog.js';

const activity = (s: State['sessions'][number]) =>
  s.kind === 'pomodoro' ? s.cycle_kind || 'theory' : s.kind;

export function syllabusComparison(state: State, contestId: string) {
  const requirements = (state.syllabus_items || []).filter(
    (s) => s.contest_id === contestId && s.active,
  );
  const path = (item: SyllabusItem) => {
    const list = [item];
    const seen = new Set([item.id]);
    let p = requirements.find((s) => s.id === item.parent_id);
    while (p && !seen.has(p.id)) {
      list.unshift(p);
      seen.add(p.id);
      p = requirements.find((s) => s.id === p!.parent_id);
    }
    return list.map((s) => s.title);
  };
  const seen = new Set<string>();
  return requirements
    .filter((s) => !requirements.some((c) => c.parent_id === s.id))
    .flatMap((item) => {
      const titles = path(item),
        key = normalizeTitle(titles.join(' > '));
      if (seen.has(key)) return [];
      seen.add(key);
      const topic = state.topics.find((t) => t.id === item.topic_id);
      let status = topic ? effectiveCoverage(topic, state.mappings, state.readings) : 'unread';
      if (status === 'unverified') status = 'unread';
      if (
        status !== 'studied' &&
        topic &&
        state.sessions.some(
          (s) =>
            s.contest_id === contestId &&
            s.topic_id === topic.id &&
            s.minutes > 0 &&
            !['questions', 'cycle_questions', 'mock'].includes(activity(s)),
        )
      )
        status = 'partial';
      return [{ item, topic, path: titles, status }];
    });
}
export function syllabusCoverage(state: State, contestId: string, topicId?: string) {
  const ids = topicId ? descendants(state.topics, topicId) : null;
  const rows = syllabusComparison(state, contestId).filter(
    (r) => !ids || (!!r.topic && ids.has(r.topic.id)),
  );
  const studied = rows.filter((r) => r.status === 'studied').length;
  return {
    missing: rows.filter(
      (r) => !state.mappings.some((m) => m.topic_id === r.item.topic_id && m.confirmed),
    ).length,
    unverified: rows.filter((r) => !r.topic?.verified).length,
    total: rows.length,
    studied,
    partial: rows.filter((r) => r.status === 'partial').length,
    pending: rows.length - studied,
    percent: rows.length ? (studied / rows.length) * 100 : null,
  };
}
export function cycleExerciseScope(state: State, contestId: string, lap: number) {
  const evidence = new Map<
    string,
    { topicId: string | null; path: string[]; minutes: number; completed: boolean }
  >();
  const add = (topicId: string | null, path: string[], minutes: number, completed: boolean) => {
    if (!path.length) return;
    const key = topicId || path.join(' > '),
      old = evidence.get(key);
    evidence.set(key, {
      topicId,
      path,
      minutes: (old?.minutes || 0) + minutes,
      completed: completed || !!old?.completed,
    });
  };
  for (const s of state.sessions) {
    if (
      s.contest_id !== contestId ||
      s.cycle_lap !== lap ||
      (!s.block_id && !s.cycle_kind) ||
      s.minutes <= 0 ||
      !['theory', 'review', 'pomodoro'].includes(activity(s))
    )
      continue;
    add(
      s.topic_id,
      s.topic_id ? ancestry(state.topics, s.topic_id).map((t) => t.title) : [],
      s.minutes,
      false,
    );
  }
  for (const c of state.cycle_completions || []) {
    if (c.contest_id === contestId && c.lap === lap && ['theory', 'review'].includes(c.kind))
      add(c.topic_id, c.topic_path, 0, true);
  }
  return [...evidence.values()];
}
