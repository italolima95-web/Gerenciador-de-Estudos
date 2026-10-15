import { cycleExerciseScope } from '../../shared/comparison';
import { AttemptEditor, MixedSession } from './Practice';
import { useEffect, useState } from 'react';
import {
  Plus,
  Play,
  Pause,
  RotateCcw,
  Check,
  SkipForward,
  ArrowUp,
  ArrowDown,
  Trash2,
  Pencil,
  Repeat2,
  BookOpen,
  Timer as TimerIcon,
  CalendarCheck,
  Clock,
  CheckCircle2,
  Bell,
  Link2,
} from 'lucide-react';
import { useApp } from '../lib/context';
import { api, send, duration, formatDate } from '../lib/api';
import { dayKey, ancestry } from '../../shared/domain';
import type { Block, Review, Timer, StudySession } from '../../shared/types';
import { topicOptions } from './Curriculum';
import { Button, Card, PageTitle, Empty, Editor, Badge, type Field } from './UI';
export const kindLabels: Record<string, string> = {
  theory: 'Teoria',
  review: 'Revisão',
  questions: 'Questões',
  cycle_questions: 'Exercícios do Ciclo',
  mock: 'SIMULADO',
  pomodoro: 'Pomodoro',
};
export function StudyEntry({
  onClose,
  topicId = '',
  block,
  session,
}: {
  onClose: () => void;
  topicId?: string;
  block?: Block;
  session?: StudySession;
}) {
  const { state, contest: activeContest, refresh, notify } = useApp();
  const contest = session ? state.contests.find((c) => c.id === session.contest_id) : activeContest;
  if (!contest) return null;
  return (
    <Editor
      title={session ? 'Editar sessão de estudo' : 'Registrar sessão de estudo'}
      description="Registre apenas o tempo de foco. Sessões do Pomodoro são registradas automaticamente e não precisam ser lançadas novamente."
      fields={[
        {
          key: 'topic_id',
          label: 'Disciplina / assunto',
          type: 'select',
          options: topicOptions(state.topics, contest.id),
        },
        { key: 'date', label: 'Data', type: 'date', required: true },
        {
          key: 'minutes',
          label: 'Minutos efetivamente estudados',
          type: 'number',
          min: 0.1,
          max: 1440,
          step: 0.1,
          required: true,
        },
        {
          key: 'kind',
          label: 'Atividade',
          type: 'select',
          options: Object.entries(kindLabels).map(([value, label]) => ({ value, label })),
        },
        { key: 'interrupted', label: 'Sessão interrompida', type: 'checkbox' },
        { key: 'notes', label: 'Observações', type: 'textarea' },
      ]}
      initial={
        session
          ? { ...session, topic_id: session.topic_id || '', interrupted: !!session.interrupted }
          : {
              topic_id: topicId || block?.topic_id || '',
              date: dayKey(),
              minutes: block?.minutes || 25,
              kind: block?.kind || 'theory',
              interrupted: false,
            }
      }
      onClose={onClose}
      onSave={async (v) => {
        await send(
          session ? `/sessions/${session.id}` : '/sessions',
          {
            ...v,
            contest_id: contest.id,
            block_id: session?.block_id || block?.id || null,
            cycle_lap:
              session?.cycle_lap ??
              (block ? state.cycles.find((c) => c.contest_id === contest.id)?.lap || 0 : null),
            cycle_kind: session?.cycle_kind || block?.kind || null,
            topic_id: v.topic_id || null,
            interrupted: v.interrupted ? 1 : 0,
          },
          session ? 'PUT' : 'POST',
        );
        await refresh();
        notify('Tempo de estudo registrado');
      }}
    />
  );
}
export function Cycle() {
  const { state, contest, mutate, refresh, notify, navigate } = useApp();
  const [editing, setEditing] = useState<Block | 'new'>(),
    [logging, setLogging] = useState<Block>(),
    [history, setHistory] = useState(false);
  if (!contest)
    return (
      <Empty
        title="Comece pelas suas disciplinas"
        description="O ciclo continua de onde você parou, independentemente dos dias da semana."
        action={<Button onClick={() => navigate('Disciplinas')}>Cadastrar disciplinas</Button>}
      />
    );
  const blocks = state.blocks
    .filter((b) => b.contest_id === contest.id)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const cycle = state.cycles.find((c) => c.contest_id === contest.id),
    current = blocks.find((b) => b.id === cycle?.block_id) || blocks[0];
  const reorder = (i: number, offset: number) => {
    const ids = blocks.map((b) => b.id);
    [ids[i], ids[i + offset]] = [ids[i + offset], ids[i]];
    mutate(
      () => send('/blocks/reorder', { contest_id: contest.id, ids }),
      'Ordem do ciclo atualizada',
    );
  };
  return (
    <>
      <PageTitle
        eyebrow="CONSTÂNCIA, NO SEU RITMO"
        title="Meu ciclo de estudos"
        description="Uma sequência contínua que se adapta à sua rotina. Termine um bloco e siga em frente."
        action={
          <div className="row-actions">
            <Button
              variant="secondary"
              onClick={() =>
                mutate(
                  () =>
                    send('/blocks', {
                      contest_id: contest.id,
                      topic_id: null,
                      title: 'Exercícios do Ciclo',
                      minutes: 30,
                      kind: 'cycle_questions',
                      position: blocks.length,
                    }),
                  'Exercícios do Ciclo adicionados',
                )
              }
            >
              Exercícios do Ciclo
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                mutate(
                  () =>
                    send('/blocks', {
                      contest_id: contest.id,
                      topic_id: null,
                      title: 'SIMULADO',
                      minutes: 120,
                      kind: 'mock',
                      position: blocks.length,
                    }),
                  'Simulado adicionado',
                )
              }
            >
              SIMULADO
            </Button>
            <Button onClick={() => setEditing('new')}>
              <Plus size={17} />
              Adicionar bloco
            </Button>
          </div>
        }
      />
      <div className="cycle-summary">
        <div>
          <Repeat2 size={24} />
          <span>
            <strong>{cycle?.lap || 0}</strong> voltas concluídas
          </span>
        </div>
        <div>
          <Clock size={23} />
          <span>
            <strong>{duration(blocks.reduce((s, b) => s + b.minutes, 0))}</strong> por volta
          </span>
        </div>
        <div>
          <BookOpen size={23} />
          <span>
            <strong>{blocks.length}</strong> blocos no ciclo
          </span>
        </div>
        <Button variant="ghost" onClick={() => setHistory(!history)}>
          Ver histórico
        </Button>
      </div>
      {blocks.some((b) => b.kind === 'cycle_questions') && <CycleExercises lap={cycle?.lap || 0} />}
      {blocks.length ? (
        <div className="cycle-list">
          {blocks.map((b, i) => (
            <Card key={b.id} className={`cycle-block ${b.id === current?.id ? 'current' : ''}`}>
              <div className="cycle-number">{String(i + 1).padStart(2, '0')}</div>
              <div className="cycle-block-content">
                <div className="row-actions">
                  <h2>{b.title}</h2>
                  {b.id === current?.id && <Badge tone="green">Você está aqui</Badge>}
                </div>
                <p>
                  {b.topic_id
                    ? ancestry(state.topics, b.topic_id)
                        .map((t) => t.title)
                        .join(' › ')
                    : b.kind === 'cycle_questions'
                      ? 'Disciplinas e tópicos estudados na volta selecionada, listados acima'
                      : 'Sem tópico associado'}
                </p>
                <span>
                  {kindLabels[b.kind]} · {duration(b.minutes)}
                </span>
              </div>
              <div className="row-actions">
                {b.id === current?.id && (
                  <>
                    <Button
                      onClick={async () => {
                        const old = state.preferences.timer as Timer | undefined;
                        if (old?.running || (old && old.elapsed > 0)) {
                          notify(
                            'Finalize ou reinicie a sessão atual antes de iniciar outro bloco.',
                            true,
                          );
                          navigate('Pomodoro');
                          return;
                        }
                        const settings = (state.preferences.timer_settings || {
                          focus: 25,
                          short: 5,
                          long: 15,
                        }) as { focus: number; short: number; long: number };
                        const timer: Timer = {
                          revision: old?.revision || 0,
                          contest_id: contest.id,
                          topic_id: b.topic_id,
                          mode: 'focus',
                          remaining: b.minutes * 60,
                          deadline: Date.now() + b.minutes * 60000,
                          elapsed: 0,
                          focus_count: old?.focus_count || 0,
                          running: true,
                          block_id: b.id,
                          cycle_lap: cycle?.lap || 0,
                          focus_minutes: b.minutes,
                          short_minutes: settings.short,
                          long_minutes: settings.long,
                        };
                        const result = await mutate(
                          () => send('/timer', timer, 'PUT'),
                          'Bloco iniciado',
                        );
                        if (result) navigate('Pomodoro');
                      }}
                    >
                      <Play size={16} />
                      Estudar
                    </Button>
                    <Button
                      variant="secondary"
                      title="Avança o ciclo sem registrar tempo novamente"
                      onClick={() =>
                        mutate(
                          () =>
                            send(`/cycles/${contest.id}/advance`, {
                              completed: true,
                              expected_block_id: cycle?.block_id || null,
                              expected_lap: cycle?.lap || 0,
                            }),
                          'Bloco concluído. Próximo bloco selecionado.',
                        )
                      }
                    >
                      <Check size={16} />
                      Concluir bloco
                    </Button>
                    <Button
                      variant="ghost"
                      title="Adiar bloco"
                      onClick={() =>
                        mutate(
                          () =>
                            send(`/cycles/${contest.id}/advance`, {
                              completed: false,
                              expected_block_id: cycle?.block_id || null,
                              expected_lap: cycle?.lap || 0,
                            }),
                          'Bloco adiado',
                        )
                      }
                    >
                      <SkipForward size={17} />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  title="Registrar tempo manualmente"
                  onClick={() => setLogging(b)}
                >
                  <Clock size={16} />
                </Button>
                <Button
                  variant="ghost"
                  title="Mover bloco para cima"
                  disabled={i === 0}
                  onClick={() => reorder(i, -1)}
                >
                  <ArrowUp size={16} />
                </Button>
                <Button
                  variant="ghost"
                  title="Mover bloco para baixo"
                  disabled={i === blocks.length - 1}
                  onClick={() => reorder(i, 1)}
                >
                  <ArrowDown size={16} />
                </Button>
                <Button variant="ghost" title="Editar bloco" onClick={() => setEditing(b)}>
                  <Pencil size={16} />
                </Button>
                <Button
                  variant="ghost"
                  title="Excluir bloco"
                  onClick={() => {
                    if (confirm('Excluir este bloco do ciclo?'))
                      mutate(() => send(`/blocks/${b.id}`, { confirm: true }, 'DELETE'));
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Empty
          icon={<Repeat2 size={30} />}
          title="Seu ciclo começa com um bloco"
          description="Combine teoria, questões, revisões e simulados. As recomendações só entram no ciclo quando você escolhe."
          action={<Button onClick={() => setEditing('new')}>Criar primeiro bloco</Button>}
        />
      )}
      <p className="footnote">
        Concluir um bloco avança a sequência. O tempo é registrado pelo Pomodoro ou pelo botão de
        registro manual; não é somado de novo ao concluir.
      </p>
      {history && (
        <Card title="Histórico do ciclo">
          <div className="activity-list">
            {state.events
              .filter((e) => e.entity === 'cycles' && e.entity_id === contest.id)
              .map((e) => (
                <div key={e.id}>
                  <Repeat2 size={16} />
                  <span>{e.action === 'completed' ? 'Bloco concluído' : 'Bloco adiado'}</span>
                  <small>{new Date(e.created_at).toLocaleString('pt-BR')}</small>
                </div>
              ))}
          </div>
        </Card>
      )}
      {editing && (
        <Editor
          title={editing === 'new' ? 'Novo bloco de estudo' : 'Editar bloco'}
          fields={[
            { key: 'title', label: 'Nome do bloco', required: true },
            {
              key: 'topic_id',
              label: 'Disciplina ou tópico',
              type: 'select',
              options: topicOptions(state.topics, contest.id),
            },
            {
              key: 'minutes',
              label: 'Duração (min)',
              type: 'number',
              min: 1,
              max: 180,
              required: true,
            },
            {
              key: 'kind',
              label: 'Atividade',
              type: 'select',
              options: Object.entries(kindLabels)
                .filter(([k]) => k !== 'pomodoro')
                .map(([value, label]) => ({ value, label })),
            },
          ]}
          initial={
            editing === 'new'
              ? { minutes: 25, kind: 'theory', topic_id: '' }
              : { ...editing, topic_id: editing.topic_id || '' }
          }
          onClose={() => setEditing(undefined)}
          onSave={async (v) => {
            await send(
              editing === 'new' ? '/blocks' : `/blocks/${editing.id}`,
              {
                ...v,
                title:
                  v.kind === 'cycle_questions'
                    ? 'Exercícios do Ciclo'
                    : v.kind === 'mock'
                      ? 'SIMULADO'
                      : v.title,
                contest_id: contest.id,
                topic_id: v.kind === 'cycle_questions' ? null : v.topic_id || null,
                position: editing === 'new' ? blocks.length : editing.position,
              },
              editing === 'new' ? 'POST' : 'PUT',
            );
            await refresh();
            notify('Bloco salvo');
          }}
        />
      )}
      {logging && <StudyEntry block={logging} onClose={() => setLogging(undefined)} />}
    </>
  );
}
export function CycleExercises({ lap }: { lap: number }) {
  const { state, contest } = useApp();
  const [selectedLap, setSelectedLap] = useState<number | null>(null),
    [recording, setRecording] = useState<string>(),
    [mixed, setMixed] = useState(false);
  if (!contest) return null;
  const currentLap = selectedLap ?? lap;
  const scope = cycleExerciseScope(state, contest.id, currentLap);
  const laps = [
    ...new Set([
      lap,
      ...(state.cycle_completions || [])
        .filter((c) => c.contest_id === contest.id)
        .map((c) => c.lap),
      ...state.sessions
        .filter((s) => s.contest_id === contest.id && s.cycle_lap != null)
        .map((s) => s.cycle_lap!),
    ]),
  ].sort((a, b) => b - a);
  const groups = [...new Set(scope.map((r) => r.path[0]))];
  return (
    <Card title="Exercícios do Ciclo — o que estudar nas questões" className="exercise-scope">
      <label className="field">
        Volta de referência
        <select value={currentLap} onChange={(e) => setSelectedLap(Number(e.target.value))}>
          {laps.map((n) => (
            <option key={n} value={n}>
              Volta {n + 1}
              {n === lap ? ' · atual' : ' · anterior'}
            </option>
          ))}
        </select>
      </label>
      <p>
        Resolva questões sobre os conteúdos abaixo, registrados em sessões de teoria/revisão ou
        blocos concluídos nesta volta. Blocos apenas planejados ou adiados não entram na lista.
      </p>
      {scope.length ? (
        <>
          {groups.map((discipline) => (
            <div key={discipline}>
              <h3>{discipline}</h3>
              <ul>
                {scope
                  .filter((r) => r.path[0] === discipline)
                  .map((r, i) => (
                    <li key={r.topicId || i}>
                      <strong>
                        {r.path.slice(1).join(' › ') ||
                          'Disciplina geral · tópico específico não informado'}
                      </strong>
                      <small>
                        {' '}
                        · {r.minutes > 0 ? duration(r.minutes) + ' registrados' : 'bloco concluído'}
                        {r.completed && r.minutes > 0 ? ' · concluído' : ''}
                      </small>
                      {r.topicId && (
                        <Button variant="ghost" onClick={() => setRecording(r.topicId!)}>
                          Registrar questões deste conteúdo
                        </Button>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
          <Button onClick={() => setMixed(true)}>Registrar questões de vários conteúdos</Button>
        </>
      ) : (
        <p className="muted">
          Ainda não há conteúdos estudados registrados nesta volta. Registre uma sessão no bloco ou
          conclua um bloco de teoria/revisão. Você também pode consultar uma volta anterior.
        </p>
      )}
      <p className="footnote">
        O conteúdo estudado em versões anteriores à 1.1 não tinha identificação da volta e permanece
        no histórico geral.
      </p>
      {recording && (
        <AttemptEditor initialTopicId={recording} onClose={() => setRecording(undefined)} />
      )}
      {mixed && (
        <MixedSession
          initialTopicIds={scope.flatMap((r) => (r.topicId ? [r.topicId] : []))}
          onClose={() => setMixed(false)}
        />
      )}
    </Card>
  );
}
export function Pomodoro() {
  const { state, contest, mutate, navigate } = useApp();
  const [now, setNow] = useState(Date.now()),
    [topicId, setTopicId] = useState(''),
    [settings, setSettings] = useState(false),
    [mode, setMode] = useState<'focus' | 'short' | 'long'>('focus');
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const timer = state.preferences.timer as Timer | undefined,
    config = (state.preferences.timer_settings || { focus: 25, short: 5, long: 15 }) as {
      focus: number;
      short: number;
      long: number;
    };
  if (!contest)
    return (
      <Empty
        title="Selecione um concurso"
        description="Vincule seu tempo de foco a um objetivo."
        action={<Button onClick={() => navigate('Meus Concursos')}>Meus concursos</Button>}
      />
    );
  const active = timer && timer.contest_id === contest.id ? timer : undefined;
  const other = timer && timer.contest_id !== contest.id && (timer.running || timer.elapsed > 0);
  const currentMode = active?.mode || mode;
  const defaultSeconds =
    (currentMode === 'focus'
      ? config.focus
      : currentMode === 'short'
        ? config.short
        : config.long) * 60;
  const remaining = active
    ? active.running && active.deadline
      ? Math.max(0, Math.ceil((active.deadline - now) / 1000))
      : active.remaining
    : defaultSeconds;
  const elapsed = active ? active.elapsed + Math.max(0, active.remaining - remaining) : 0;
  const save = (t: Timer) => mutate(() => send('/timer', t, 'PUT'), '');
  const start = () => {
    if (other) {
      mutate(async () => {
        throw Error(
          'Existe uma sessão em outro concurso. Selecione esse concurso para finalizá-la.',
        );
      });
      return;
    }
    const t: Timer = active || {
      revision: timer?.revision || 0,
      contest_id: contest.id,
      topic_id: topicId || null,
      mode,
      remaining: defaultSeconds,
      deadline: null,
      elapsed: 0,
      focus_count: 0,
      running: false,
      block_id: null,
      focus_minutes: config.focus,
      short_minutes: config.short,
      long_minutes: config.long,
    };
    save({ ...t, running: true, deadline: Date.now() + t.remaining * 1000 });
  };
  const pause = () => {
    if (!active) return;
    const left = active.deadline
      ? Math.max(0, Math.ceil((active.deadline - Date.now()) / 1000))
      : active.remaining;
    save({
      ...active,
      remaining: left,
      elapsed: active.elapsed + Math.max(0, active.remaining - left),
      deadline: null,
      running: false,
    });
  };
  const finish = (interrupted: boolean) =>
    active &&
    mutate(
      () =>
        send('/timer/finish', {
          interrupted,
          expected_revision: active.revision,
          expected_mode: active.mode,
          expected_deadline: active.deadline,
        }),
      active.mode === 'focus' ? 'Tempo de foco salvo' : 'Pausa finalizada',
    );
  const timerContest = active ? state.contests.find((c) => c.id === active.contest_id) : contest;
  return (
    <>
      <PageTitle
        eyebrow="UMA COISA DE CADA VEZ"
        title="Tempo de foco"
        description="Concentre-se no próximo passo. Seu tempo de estudo é salvo, mesmo se fechar o aplicativo."
        action={
          <Button variant="secondary" onClick={() => setSettings(true)}>
            Configurar tempos
          </Button>
        }
      />
      <div className="timer-layout">
        <Card className="timer-card">
          <div className="timer-tabs">
            {(['focus', 'short', 'long'] as const).map((m) => (
              <button
                key={m}
                className={currentMode === m ? 'active' : ''}
                disabled={!!active && (active.running || active.elapsed > 0)}
                onClick={() => {
                  setMode(m);
                  if (active)
                    save({
                      ...active,
                      mode: m,
                      remaining:
                        (m === 'focus'
                          ? config.focus
                          : m === 'short'
                            ? config.short
                            : config.long) * 60,
                      elapsed: 0,
                      deadline: null,
                      running: false,
                      focus_minutes: config.focus,
                      short_minutes: config.short,
                      long_minutes: config.long,
                    });
                }}
              >
                {m === 'focus' ? 'Foco' : m === 'short' ? 'Pausa curta' : 'Pausa longa'}
              </button>
            ))}
          </div>
          <div className={`timer-ring ${active?.running ? 'running' : ''}`}>
            <span>{currentMode === 'focus' ? 'CONCENTRAÇÃO' : 'RESPIRE UM POUCO'}</span>
            <strong aria-live="off">
              {String(Math.floor(remaining / 60)).padStart(2, '0')}
              <b>:</b>
              {String(remaining % 60).padStart(2, '0')}
            </strong>
            <small>
              {active?.running
                ? 'Você está no caminho. Continue.'
                : elapsed
                  ? 'Pausado. Retome quando puder.'
                  : 'Um bloco de foco faz a diferença.'}
            </small>
          </div>
          <div className="timer-actions">
            {active?.running ? (
              <Button onClick={pause}>
                <Pause size={19} />
                Pausar
              </Button>
            ) : (
              <Button onClick={start} disabled={!!other}>
                <Play size={19} />
                {elapsed ? 'Continuar' : 'Iniciar sessão'}
              </Button>
            )}
            <Button
              variant="secondary"
              disabled={!active}
              onClick={() => {
                if (
                  active &&
                  confirm(
                    'Reiniciar o cronômetro? O tempo desta sessão em andamento será descartado.',
                  )
                )
                  save({
                    ...active,
                    remaining:
                      (currentMode === 'focus'
                        ? active.focus_minutes
                        : currentMode === 'short'
                          ? active.short_minutes
                          : active.long_minutes) * 60,
                    elapsed: 0,
                    deadline: null,
                    running: false,
                  });
              }}
              title="Reiniciar cronômetro"
            >
              <RotateCcw size={18} />
            </Button>
            <Button variant="secondary" disabled={!active} onClick={() => finish(remaining > 0)}>
              <Check size={18} />
              Finalizar
            </Button>
          </div>
          <div className="pomodoro-count">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className={i < (active?.focus_count || 0) % 4 ? 'done' : ''} />
            ))}
            <small>{active?.focus_count || 0} sessões de foco registradas</small>
          </div>
        </Card>
        <div>
          <Card title="Seu foco agora">
            <p className="eyebrow">{timerContest?.name}</p>
            <label className="field">
              Disciplina / assunto
              <select
                disabled={!!active && (active.running || active.elapsed > 0)}
                value={active?.topic_id || topicId}
                onChange={(e) => {
                  setTopicId(e.target.value);
                  if (active) save({ ...active, topic_id: e.target.value || null });
                }}
              >
                {topicOptions(state.topics, contest.id).map((o) => (
                  <option value={o.value} key={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="soft-box">
              <Clock size={20} />
              <p>
                Pausas não contam como estudo. Ao finalizar, apenas os minutos de foco são
                registrados.
              </p>
            </div>
            {other && (
              <p className="warning-text">
                Há uma sessão em outro concurso. Selecione esse concurso para continuar.
              </p>
            )}
          </Card>
          <Card title="Sessões recentes" className="section-gap">
            <div className="activity-list">
              {state.sessions
                .filter((s) => s.contest_id === contest.id && s.kind === 'pomodoro')
                .slice(-6)
                .reverse()
                .map((s) => (
                  <div key={s.id}>
                    <TimerIcon size={17} />
                    <span>
                      {state.topics.find((t) => t.id === s.topic_id)?.title || 'Foco'}
                      <small>
                        {formatDate(s.date)}
                        {s.interrupted ? ' · Interrompido' : ''}
                      </small>
                    </span>
                    <strong>{duration(s.minutes)}</strong>
                  </div>
                ))}
            </div>
            <p className="footnote">
              Para registrar estudos fora do cronômetro, use Registrar estudo no início.
            </p>
          </Card>
        </div>
      </div>
      {settings && (
        <Editor
          title="Tempos do Pomodoro"
          description="Os novos tempos serão usados nas próximas sessões. Uma sessão em andamento mantém sua duração."
          fields={[
            { key: 'focus', label: 'Foco (min)', type: 'number', min: 1, max: 180, required: true },
            {
              key: 'short',
              label: 'Pausa curta (min)',
              type: 'number',
              min: 1,
              max: 60,
              required: true,
            },
            {
              key: 'long',
              label: 'Pausa longa (min)',
              type: 'number',
              min: 1,
              max: 120,
              required: true,
            },
          ]}
          initial={config}
          onClose={() => setSettings(false)}
          onSave={async (v) => {
            const result = await mutate(() =>
              send('/preferences/timer_settings', { value: v }, 'PUT'),
            );
            if (!result) throw Error('Não foi possível salvar');
          }}
        />
      )}
    </>
  );
}
export function Reviews() {
  const { state, contest, mutate, refresh, notify, navigate } = useApp();
  const [schedule, setSchedule] = useState(false),
    [editing, setEditing] = useState<Review>(),
    [filter, setFilter] = useState('pending');
  if (!contest)
    return (
      <Empty
        title="Selecione um concurso"
        description="Planeje revisões espaçadas para os conteúdos estudados."
        action={<Button onClick={() => navigate('Meus Concursos')}>Meus concursos</Button>}
      />
    );
  const today = dayKey(),
    reviews = state.reviews
      .filter(
        (r) =>
          r.contest_id === contest.id &&
          (filter === 'all' || filter === 'done'
            ? filter === 'all' || !!r.completed_at
            : !r.completed_at),
      )
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  return (
    <>
      <PageTitle
        eyebrow="APRENDER É REVISITAR"
        title="Revisões espaçadas"
        description="Retome os assuntos no momento certo e acompanhe o que foi realmente revisado."
        action={
          <Button onClick={() => setSchedule(true)}>
            <Plus size={17} />
            Programar revisões
          </Button>
        }
      />
      <div className="toolbar">
        <div className="segmented">
          {[
            ['pending', 'Pendentes'],
            ['done', 'Concluídas'],
            ['all', 'Todas'],
          ].map(([v, l]) => (
            <button className={filter === v ? 'active' : ''} key={v} onClick={() => setFilter(v)}>
              {l}
            </button>
          ))}
        </div>
        <span className="muted">
          Intervalos atuais:{' '}
          {((state.preferences.review_intervals as number[]) || [1, 7, 30]).join(', ')} dias
        </span>
      </div>
      {reviews.length ? (
        <Card>
          <div className="review-list">
            {reviews.map((r) => (
              <div className="review-item" key={r.id}>
                <div
                  className={`review-date ${r.due_date < today && !r.completed_at ? 'overdue' : ''}`}
                >
                  <span>
                    {new Date(r.due_date + 'T12:00:00').toLocaleDateString('pt-BR', {
                      month: 'short',
                    })}
                  </span>
                  <strong>{r.due_date.slice(-2)}</strong>
                </div>
                <div className="review-content">
                  <h3>{state.topics.find((t) => t.id === r.topic_id)?.title}</h3>
                  <p>
                    {ancestry(state.topics, r.topic_id)
                      .slice(0, -1)
                      .map((t) => t.title)
                      .join(' › ') || 'Revisão de conteúdo'}
                    {r.pages ? ` · Páginas ${r.pages}` : ''}
                  </p>
                  <Badge
                    tone={
                      r.completed_at
                        ? 'green'
                        : r.due_date < today
                          ? 'red'
                          : r.due_date === today
                            ? 'amber'
                            : 'neutral'
                    }
                  >
                    {r.completed_at
                      ? `Concluída em ${formatDate(r.completed_at)}`
                      : r.due_date < today
                        ? 'Vencida'
                        : r.due_date === today
                          ? 'Para hoje'
                          : 'Programada'}
                  </Badge>
                </div>
                <div className="row-actions">
                  {!r.completed_at && (
                    <Button variant="secondary" onClick={() => setEditing(r)}>
                      <Check size={16} />
                      Concluir
                    </Button>
                  )}
                  <Button variant="ghost" title="Editar revisão" onClick={() => setEditing(r)}>
                    <Pencil size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    title="Excluir revisão"
                    onClick={() => {
                      if (confirm('Excluir esta revisão programada?'))
                        mutate(() => send(`/reviews/${r.id}`, { confirm: true }, 'DELETE'));
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Empty
          icon={<CalendarCheck size={30} />}
          title="Dê ao conteúdo uma segunda visita"
          description="Programe revisões para 1, 7 e 30 dias após o estudo, ou use seus próprios intervalos."
          action={<Button onClick={() => setSchedule(true)}>Programar primeira revisão</Button>}
        />
      )}{' '}
      {schedule && (
        <Editor
          title="Programar revisões de um assunto"
          fields={[
            {
              key: 'topic_id',
              label: 'Assunto',
              type: 'select',
              required: true,
              options: topicOptions(state.topics, contest.id).filter(
                (o) => !state.topics.some((t) => t.id === o.value && t.kind === 'discipline'),
              ),
            },
            { key: 'date', label: 'Data do estudo original', type: 'date', required: true },
            {
              key: 'intervals',
              label: 'Intervalos em dias, separados por vírgula',
              required: true,
            },
            {
              key: 'document_id',
              label: 'PDF associado',
              type: 'select',
              options: [
                { value: '', label: 'Sem PDF' },
                ...state.documents
                  .filter((d) => !d.contest_id || d.contest_id === contest.id)
                  .map((d) => ({ value: d.id, label: d.name })),
              ],
            },
            { key: 'pages', label: 'Páginas a revisar' },
          ]}
          initial={{
            date: today,
            intervals: ((state.preferences.review_intervals as number[]) || [1, 7, 30]).join(', '),
            document_id: '',
          }}
          onClose={() => setSchedule(false)}
          onSave={async (v) => {
            await send('/reviews/schedule', {
              ...v,
              contest_id: contest.id,
              document_id: v.document_id || null,
              intervals: String(v.intervals).split(',').map(Number),
            });
            await refresh();
            notify('Revisões programadas');
          }}
        />
      )}{' '}
      {editing && (
        <Editor
          title="Registrar ou editar revisão"
          fields={[
            { key: 'due_date', label: 'Data prevista', type: 'date', required: true },
            { key: 'completed_at', label: 'Data de conclusão (vazio se pendente)', type: 'date' },
            {
              key: 'minutes',
              label: 'Tempo de revisão (min)',
              type: 'number',
              min: 0,
              step: 0.1,
              required: true,
            },
            {
              key: 'difficulty',
              label: 'Dificuldade',
              type: 'select',
              options: [
                { value: 'easy', label: 'Fácil' },
                { value: 'medium', label: 'Média' },
                { value: 'hard', label: 'Difícil' },
              ],
            },
          ]}
          initial={{
            due_date: editing.due_date,
            completed_at: editing.completed_at || today,
            minutes: editing.minutes || 15,
            difficulty: editing.difficulty,
          }}
          onClose={() => setEditing(undefined)}
          onSave={async (v) => {
            await send(
              `/reviews/${editing.id}`,
              { ...editing, ...v, completed_at: v.completed_at || null },
              'PUT',
            );
            await refresh();
            notify('Revisão atualizada. O tempo de revisão não é somado novamente ao Pomodoro.');
          }}
        />
      )}
    </>
  );
}
