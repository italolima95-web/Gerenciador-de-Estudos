import { useRef, useState } from 'react';
import {
  ShieldCheck,
  BookOpen,
  Target,
  CalendarCheck,
  CalendarDays,
  Flame,
  Clock,
  Download,
  Upload,
  HardDrive,
  Sun,
  Moon,
  Check,
  FileText,
  Trash2,
  RotateCcw,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Link2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { useApp } from '../lib/context';
import { api, send, pct, duration, formatDate, download } from '../lib/api';
import {
  ancestry,
  coverage,
  statistics,
  reviewStats,
  dayKey,
  addDays,
  planning,
  habitStats,
  readPages,
  descendants,
  contestSessions,
} from '../../shared/domain';
import type { StudySession, Topic } from '../../shared/types';
import { StudyEntry } from './Study';
import { Recommendations } from './Dashboard';
import { topicOptions } from './Curriculum';
import { Button, Card, PageTitle, Empty, Editor, Metric, Badge, Progress, Modal } from './UI';
export function Readiness() {
  const { state, contest, navigate } = useApp();
  const [topicId, setTopicId] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  if (!contest)
    return (
      <Empty
        title="Seu plano precisa de um objetivo"
        description="Selecione ou cadastre um concurso para acompanhar sua preparação."
        action={<Button onClick={() => navigate('Meus Concursos')}>Cadastrar concurso</Button>}
      />
    );
  const topics = state.topics.filter((t) => t.contest_id === contest.id),
    ids = topicId ? descendants(topics, topicId) : new Set(topics.map((t) => t.id)),
    cov = coverage(topics, state.mappings, state.readings, topicId || undefined),
    stats = statistics(state.attempts, state.attempt_links, topics, {
      contestId: contest.id,
      topicId: topicId || undefined,
      from,
      to,
    }),
    reviews = reviewStats(
      state.reviews.filter((r) => r.contest_id === contest.id && (!topicId || ids.has(r.topic_id))),
      dayKey(),
      from,
      to,
    );
  const plan = planning(contest, topics, state.mappings, state.readings);
  return (
    <>
      <PageTitle
        eyebrow="CLAREZA PARA SEGUIR"
        title="Prontidão para a prova"
        description="Conteúdo estudado, revisões cumpridas e desempenho observado: cada indicador conta uma parte da história."
      />
      <div className="filters">
        <label>
          Escopo
          <select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">Concurso completo</option>
            {topicOptions(topics, contest.id, false).map((o) => (
              <option value={o.value} key={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Período das questões e revisões · de
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Até
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <div className="readiness-grid">
        {[
          {
            label: 'Cobertura do edital',
            value: cov.percent,
            icon: BookOpen,
            detail: `${cov.studied} tópicos concluídos de ${cov.total}`,
            text: `${cov.partial} parcialmente estudados · ${cov.pending} pendentes · ${cov.missing} sem material validado`,
            color: 'green',
          },
          {
            label: 'Revisões realizadas',
            value: reviews.percent,
            icon: CalendarCheck,
            detail: `${reviews.done} concluídas de ${reviews.total}`,
            text: `${reviews.pending} pendentes · ${reviews.overdue} vencidas`,
            color: 'blue',
          },
          {
            label: 'Taxa de acertos',
            value: stats.accuracy,
            icon: Target,
            detail: `${stats.correct} acertos em ${stats.answered} respondidas`,
            text: `${stats.wrong} erros · ${stats.blank} em branco · meta de ${contest.target}%`,
            color: 'amber',
          },
        ].map(({ label, value, icon: Icon, detail, text, color }) => (
          <Card key={label} className={`readiness-card ${color}`}>
            <div className="readiness-icon">
              <Icon size={24} />
            </div>
            <h2>{label}</h2>
            <strong>{pct(value)}</strong>
            <Progress value={value} />
            <p>{detail}</p>
            <small>{text}</small>
          </Card>
        ))}
      </div>
      <p className="notice-callout">
        <ShieldCheck size={22} />
        <span>
          Estes indicadores medem dimensões diferentes. Eles não representam uma probabilidade de
          aprovação. A cobertura é acumulada; o período filtra questões e revisões pela data
          prevista.
        </span>
      </p>
      <div className="two-columns">
        <Card title="Próximas prioridades">
          <Recommendations />
        </Card>
        <Card title="Planejamento até a prova">
          {plan ? (
            <>
              <div className="planning-days">
                <strong>{plan.days}</strong>
                <span>dias até {formatDate(contest.exam_date)}</span>
              </div>
              <div className="detail-list">
                <div>
                  <span>Dias planejados de estudo</span>
                  <strong>{plan.planned}</strong>
                </div>
                <div>
                  <span>Horas disponíveis</span>
                  <strong>{plan.hours.toFixed(1)} h</strong>
                </div>
                <div>
                  <span>Tópicos pendentes</span>
                  <strong>{plan.remaining}</strong>
                </div>
                <div>
                  <span>Estimativa de teoria pendente</span>
                  <strong>{plan.estimatedHours.toFixed(1)} h</strong>
                </div>
                <div>
                  <span>Revisões programadas</span>
                  <strong>
                    {
                      state.reviews.filter(
                        (r) =>
                          r.contest_id === contest.id &&
                          !r.completed_at &&
                          r.due_date <= contest.exam_date,
                      ).length
                    }
                  </strong>
                </div>
                <div>
                  <span>Simulados previstos</span>
                  <strong>
                    {
                      state.mocks.filter(
                        (m) =>
                          m.contest_id === contest.id &&
                          m.date >= dayKey() &&
                          m.date <= contest.exam_date,
                      ).length
                    }
                  </strong>
                </div>
                <div>
                  <span>Meta de questões no período</span>
                  <strong>{plan.questionGoal}</strong>
                </div>
              </div>
              <p className="footnote">
                Premissas: {contest.daily_minutes} min por dia planejado, {contest.topic_minutes}{' '}
                min por tópico pendente e {contest.question_goal} questões/dia. Dias de descanso são
                excluídos. A estimativa de teoria não inclui revisões e simulados.
              </p>
              {plan.estimatedHours > plan.hours && (
                <p className="warning-text">
                  A teoria estimada excede as horas disponíveis. Considere ajustar suas prioridades
                  ou disponibilidade.
                </p>
              )}
            </>
          ) : (
            <Empty
              title="Quando será a prova?"
              description="Informe a data no cadastro do concurso para calcular dias e horas disponíveis."
              action={
                <Button variant="secondary" onClick={() => navigate('Meus Concursos')}>
                  Editar concurso
                </Button>
              }
            />
          )}
        </Card>
      </div>
    </>
  );
}
export function Habits() {
  const { state, contest, mutate, refresh, notify } = useApp();
  const [year, setYear] = useState(new Date().getFullYear()),
    [selected, setSelected] = useState(dayKey()),
    [editing, setEditing] = useState<StudySession>(),
    [reuse, setReuse] = useState<StudySession>();
  const sessions = state.sessions;
  const rest = contest ? JSON.parse(contest.rest_days) : [];
  const hs = habitStats(sessions, rest);
  const yearStart = `${year}-01-01`,
    yearEnd = `${year}-12-31`;
  const days: string[] = [];
  for (let date = yearStart; date <= yearEnd; date = addDays(date, 1)) days.push(date);
  const offset = new Date(yearStart + 'T12:00:00').getDay();
  const minutesOn = (day: string) =>
    sessions.filter((s) => s.date === day).reduce((a, s) => a + s.minutes, 0);
  const selectedSessions = sessions.filter((s) => s.date === selected),
    daily = sessions.filter((s) => s.date === selected).reduce((s, x) => s + x.minutes, 0),
    reading = state.readings.filter((r) => r.date === selected && r.completed),
    attempts = state.attempts.filter((a) => a.date === selected && a.include_stats),
    correct = attempts.reduce((s, a) => s + a.correct, 0),
    answered = attempts.reduce((s, a) => s + a.correct + a.wrong, 0);
  const annual = sessions
      .filter((s) => s.date.startsWith(String(year)))
      .reduce((s, a) => s + a.minutes, 0),
    monthly = sessions
      .filter((s) => s.date.startsWith(dayKey().slice(0, 7)))
      .reduce((s, a) => s + a.minutes, 0),
    weekly = sessions
      .filter((s) => s.date >= addDays(dayKey(), -6) && s.date <= dayKey())
      .reduce((s, a) => s + a.minutes, 0);
  const plannedToDate = days.filter(
    (d) => d <= dayKey() && !rest.includes(new Date(d + 'T12:00:00').getDay()),
  );
  const donePlanned = plannedToDate.filter((d) => minutesOn(d) > 0);
  return (
    <>
      <PageTitle
        eyebrow="SEU ESFORÇO DEIXA MARCAS"
        title="Meus hábitos"
        description="Pequenos compromissos, repetidos. Veja a constância que você está construindo em todos os concursos."
      />
      <div className="metrics-grid">
        <Metric
          label="Sequência atual"
          value={`${hs.current} dias`}
          description="Dias de descanso são respeitados"
          icon={<Flame size={19} />}
        />
        <Metric
          label="Maior sequência"
          value={`${hs.best} dias`}
          description={`${hs.days} dias com estudos registrados`}
          icon={<CalendarDays size={19} />}
          color="amber"
        />
        <Metric
          label="Tempo nesta semana"
          value={duration(weekly)}
          description={`Mês atual: ${duration(monthly)}`}
          icon={<Clock size={19} />}
          color="blue"
        />
        <Metric
          label={`Estudo em ${year}`}
          value={duration(annual)}
          description={`Média por dia estudado: ${duration(hs.days ? hs.minutes / hs.days : 0)}`}
          icon={<BookOpen size={19} />}
        />
      </div>
      <Card
        title="Seu ano de dedicação"
        action={
          <div className="row-actions">
            <Button variant="ghost" aria-label="Ano anterior" onClick={() => setYear((y) => y - 1)}>
              <ChevronLeft size={17} />
            </Button>
            <strong>{year}</strong>
            <Button variant="ghost" aria-label="Próximo ano" onClick={() => setYear((y) => y + 1)}>
              <ChevronRight size={17} />
            </Button>
          </div>
        }
      >
        <div className="heatmap-months">
          {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map(
            (m) => (
              <span key={m}>{m}</span>
            ),
          )}
        </div>
        <div className="heatmap-scroll">
          <div
            className="heatmap"
            style={{ gridTemplateColumns: `repeat(${Math.ceil((days.length + offset) / 7)}, 1fr)` }}
          >
            {Array.from({ length: offset }, (_, i) => (
              <span className="heat-cell blank" key={`blank${i}`} />
            ))}
            {days.map((d) => {
              const min = minutesOn(d),
                level = min === 0 ? 0 : min < 30 ? 1 : min < 60 ? 2 : min < 120 ? 3 : 4;
              return (
                <button
                  className={`heat-cell l${level} ${selected === d ? 'selected' : ''}`}
                  key={d}
                  title={`${formatDate(d)} · ${duration(min)}`}
                  aria-label={`${formatDate(d)}: ${duration(min)}`}
                  onClick={() => setSelected(d)}
                />
              );
            })}
          </div>
        </div>
        <div className="heatmap-footer">
          <span>
            {plannedToDate.length
              ? `${pct((donePlanned.length / plannedToDate.length) * 100)} de consistência nos dias planejados`
              : 'Sem dias planejados no período'}
          </span>
          <div>
            Menos{' '}
            {[0, 1, 2, 3, 4].map((v) => (
              <span className={`heat-cell l${v}`} key={v} />
            ))}
            Mais
          </div>
        </div>
      </Card>
      <div className="section-heading">
        <div>
          <h2>{formatDate(selected)}</h2>
          <p>O que você construiu nesse dia.</p>
        </div>
      </div>
      <div className="two-columns">
        <Card title="Resumo do dia">
          <div className="detail-list">
            <div>
              <span>Tempo de foco</span>
              <strong>{duration(daily)}</strong>
            </div>
            <div>
              <span>Pomodoros registrados</span>
              <strong>{selectedSessions.filter((s) => s.kind === 'pomodoro').length}</strong>
            </div>
            <div>
              <span>Páginas concluídas (sem sobreposição no dia)</span>
              <strong>
                {[...new Set(reading.map((r) => r.document_id))].reduce(
                  (s, id) => s + readPages(reading, id),
                  0,
                )}
              </strong>
            </div>
            <div>
              <span>Questões respondidas</span>
              <strong>{answered}</strong>
            </div>
            <div>
              <span>Taxa de acertos</span>
              <strong>{pct(answered ? (correct / answered) * 100 : null)}</strong>
            </div>
            <div>
              <span>Revisões concluídas</span>
              <strong>{state.reviews.filter((r) => r.completed_at === selected).length}</strong>
            </div>
            <div>
              <span>Simulados</span>
              <strong>{state.mocks.filter((m) => m.date === selected).length}</strong>
            </div>
            <div>
              <span>Meta diária do concurso selecionado</span>
              <strong>
                {contest
                  ? pct(
                      Math.min(
                        100,
                        (selectedSessions
                          .filter((s) => s.contest_id === contest.id)
                          .reduce((a, s) => a + s.minutes, 0) /
                          contest.daily_minutes) *
                          100,
                      ),
                    )
                  : 'Sem meta'}
              </strong>
            </div>
          </div>
        </Card>
        <Card title="Sessões de estudo">
          <div className="activity-list">
            {selectedSessions.map((s) => (
              <div key={s.id}>
                <BookOpen size={18} />
                <span>
                  <strong>
                    {state.topics.find((t) => t.id === s.topic_id)?.title ||
                      state.contests.find((c) => c.id === s.contest_id)?.name}
                  </strong>
                  <small>
                    {s.kind} · {duration(s.minutes)}
                    {s.interrupted ? ' · Interrompido' : ''}
                  </small>
                </span>
                <Button variant="ghost" title="Editar sessão" onClick={() => setEditing(s)}>
                  <Pencil size={15} />
                </Button>
                <Button
                  variant="ghost"
                  title="Reutilizar estudo em outro concurso"
                  onClick={() => setReuse(s)}
                >
                  <Link2 size={15} />
                </Button>
                <Button
                  variant="ghost"
                  title="Excluir sessão"
                  onClick={() => {
                    if (confirm('Excluir este registro de tempo?'))
                      mutate(() => send(`/sessions/${s.id}`, { confirm: true }, 'DELETE'));
                  }}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
          </div>
          {!selectedSessions.length && (
            <p className="muted">Nenhuma sessão registrada neste dia.</p>
          )}
        </Card>
      </div>
      {editing && <StudyEntry session={editing} onClose={() => setEditing(undefined)} />}{' '}
      {reuse && (
        <Editor
          title="Reutilizar estudo"
          description="Vincule o mesmo estudo a outro concurso após conferir o conteúdo. O tempo global continua sendo contado uma única vez."
          fields={[
            {
              key: 'contest_id',
              label: 'Concurso de destino',
              required: true,
              type: 'select',
              options: [
                { value: '', label: 'Selecionar' },
                ...state.contests
                  .filter((c) => c.id !== reuse.contest_id)
                  .map((c) => ({ value: c.id, label: c.name })),
              ],
            },
            {
              key: 'topic_id',
              label: 'Tópico equivalente',
              type: 'select',
              options: (v) => topicOptions(state.topics, String(v.contest_id || '')),
            },
            {
              key: 'confirmed',
              label: 'Conferi a correspondência dos conteúdos',
              type: 'checkbox',
              required: true,
            },
          ]}
          onClose={() => setReuse(undefined)}
          onSave={async (v) => {
            await send(`/sessions/${reuse.id}/reuse`, { ...v, topic_id: v.topic_id || null });
            await refresh();
            notify('Estudo vinculado sem duplicar o tempo global');
          }}
        />
      )}
    </>
  );
}
export function Statistics() {
  const { state, contest, navigate } = useApp();
  if (!contest)
    return (
      <Empty
        title="Suas estatísticas começam com um objetivo"
        description="Cadastre um concurso e registre suas atividades."
        action={<Button onClick={() => navigate('Meus Concursos')}>Meus concursos</Button>}
      />
    );
  const topics = state.topics.filter((t) => t.contest_id === contest.id),
    disciplines = topics.filter((t) => t.kind === 'discipline');
  const chart = disciplines.map((t) => ({
    name: t.title,
    acertos: statistics(state.attempts, state.attempt_links, topics, {
      contestId: contest.id,
      topicId: t.id,
    }).accuracy,
    cobertura: coverage(topics, state.mappings, state.readings, t.id).percent,
  }));
  const sessions = contestSessions(state, contest.id);
  const time = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(dayKey(), i - 6);
    return {
      date: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }),
      minutos: sessions.filter((s) => s.date === date).reduce((r, s) => r + s.minutes, 0),
    };
  });
  return (
    <>
      <PageTitle
        eyebrow="ENTENDA SUA TRAJETÓRIA"
        title="Estatísticas"
        description="Compare dimensões sem misturá-las e acompanhe a evolução dos seus esforços."
      />
      <div className="two-columns">
        <Card title="Cobertura e acertos por disciplina">
          {chart.length ? (
            <ResponsiveContainer width="100%" height={330}>
              <BarChart data={chart} margin={{ bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  tick={{ fontSize: 10 }}
                />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip formatter={(v) => pct(Number(v))} />
                <Bar name="Cobertura" dataKey="cobertura" fill="#388869" radius={[4, 4, 0, 0]} />
                <Bar name="Acertos" dataKey="acertos" fill="#c69a50" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty
              title="Ainda sem disciplinas"
              description="Cadastre ou extraia conteúdos do edital para comparar os indicadores."
            />
          )}
          <div className="legend">
            <span className="green-text">● Cobertura</span>
            <span className="amber-text">● Acertos</span>
          </div>
        </Card>
        <Card title="Tempo de foco · últimos 7 dias">
          <ResponsiveContainer width="100%" height={330}>
            <BarChart data={time}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" />
              <YAxis unit="m" />
              <Tooltip formatter={(v) => duration(Number(v))} />
              <Bar dataKey="minutos" name="Foco" fill="#388869" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card className="section-gap" title="Leitura e cobertura são métricas distintas">
        <p className="muted">
          Páginas concluídas não comprovam domínio. O desempenho vem das tentativas registradas; a
          cobertura depende de tópicos estudados ou de associações confirmadas.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Disciplina</th>
                <th>Cobertura</th>
                <th>Revisões</th>
                <th>Questões</th>
                <th>Acertos</th>
              </tr>
            </thead>
            <tbody>
              {disciplines.map((t) => {
                const ids = descendants(topics, t.id),
                  s = statistics(state.attempts, state.attempt_links, topics, {
                    contestId: contest.id,
                    topicId: t.id,
                  });
                return (
                  <tr key={t.id}>
                    <td>{t.title}</td>
                    <td>{pct(coverage(topics, state.mappings, state.readings, t.id).percent)}</td>
                    <td>
                      {pct(reviewStats(state.reviews.filter((r) => ids.has(r.topic_id))).percent)}
                    </td>
                    <td>{s.answered}</td>
                    <td>{pct(s.accuracy)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
export function Preferences() {
  const { state, contest, mutate, refresh, notify } = useApp();
  const [intervals, setIntervals] = useState(false),
    [restore, setRestore] = useState(false),
    [rest, setRest] = useState(false),
    [audit, setAudit] = useState<string>(),
    [file, setFile] = useState<File>(),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <PageTitle
        eyebrow="DO SEU JEITO"
        title="Configurações"
        description="Ajuste seu ritmo, proteja seus registros e mantenha o controle dos seus dados."
      />
      <div className="two-columns">
        <div>
          <Card title="Seu ambiente">
            <div className="setting-row">
              <span>
                <strong>Aparência</strong>
                <small>Uma interface confortável para estudar.</small>
              </span>
              <Button
                variant="secondary"
                onClick={() =>
                  mutate(() =>
                    send(
                      '/preferences/theme',
                      { value: state.preferences.theme === 'dark' ? 'light' : 'dark' },
                      'PUT',
                    ),
                  )
                }
              >
                {state.preferences.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}{' '}
                {state.preferences.theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
              </Button>
            </div>
            <div className="setting-row">
              <span>
                <strong>Revisões espaçadas</strong>
                <small>
                  {((state.preferences.review_intervals as number[]) || [1, 7, 30]).join(', ')} dias
                  após o estudo
                </small>
              </span>
              <Button variant="secondary" onClick={() => setIntervals(true)}>
                Configurar
              </Button>
            </div>
            <div className="setting-row">
              <span>
                <strong>Dias de descanso</strong>
                <small>Respeitados no planejamento e na sequência de hábitos.</small>
              </span>
              <Button variant="secondary" disabled={!contest} onClick={() => setRest(true)}>
                Definir
              </Button>
            </div>
            <div className="setting-row">
              <span>
                <strong>Notificações do Pomodoro</strong>
                <small>Alertas locais ao concluir uma sessão.</small>
              </span>
              <Button
                variant="secondary"
                onClick={async () => {
                  if (!('Notification' in window)) {
                    notify('Notificações indisponíveis neste sistema', true);
                    return;
                  }
                  const p = await Notification.requestPermission();
                  await mutate(
                    () => send('/preferences/notifications', { value: p === 'granted' }, 'PUT'),
                    p === 'granted'
                      ? 'Notificações ativadas'
                      : 'Permissão de notificação não concedida',
                  );
                }}
              >
                <Bell size={16} />
                Ativar
              </Button>
            </div>
            <div className="setting-row">
              <span>
                <strong>Recomendações ignoradas</strong>
                <small>
                  {((state.preferences.ignored_recommendations as string[]) || []).length} tópicos
                  ocultados
                </small>
              </span>
              <Button
                variant="secondary"
                onClick={() =>
                  mutate(
                    () => send('/preferences/ignored_recommendations', { value: [] }, 'PUT'),
                    'Recomendações restauradas',
                  )
                }
              >
                <RotateCcw size={15} />
                Restaurar
              </Button>
            </div>
          </Card>
          <Card title="Privacidade por padrão" className="section-gap">
            <div className="privacy-note">
              <ShieldCheck size={31} />
              <div>
                <strong>Seus documentos permanecem com você.</strong>
                <p>
                  PDFs, editais, histórico e banco SQLite ficam no computador. Extração, OCR e
                  cálculos não usam serviços externos. O programa funciona offline após a
                  instalação.
                </p>
              </div>
            </div>
          </Card>
        </div>
        <div>
          <Card title="Backup e restauração">
            <div className="backup-illustration">
              <HardDrive size={37} />
              <ShieldCheck size={20} />
            </div>
            <h3>Proteja cada passo da sua preparação.</h3>
            <p className="muted">
              O backup completo inclui o banco de dados, seus PDFs e editais. Guarde uma cópia fora
              deste computador.
            </p>
            <div className="backup-buttons">
              <Button
                onClick={() =>
                  mutate(
                    () => download('/backup', `cronograma-${dayKey()}.zip`),
                    'Backup completo exportado',
                  )
                }
              >
                <Download size={17} />
                Exportar backup completo
              </Button>
              <Button variant="secondary" onClick={() => setRestore(true)}>
                <Upload size={17} />
                Restaurar backup
              </Button>
            </div>
            <p className="footnote">
              O banco é salvo automaticamente em cada alteração. Cópias diárias do banco são
              mantidas por 7 dias; PDFs permanecem no diretório local. Antes de uma restauração, é
              criado um backup completo de segurança.
            </p>
          </Card>
          <Card title="Relatórios" className="section-gap">
            <p className="muted">
              Exporte as estatísticas do concurso selecionado, com resultados por disciplina,
              assunto e subassunto.
            </p>
            <Button
              variant="secondary"
              disabled={!contest}
              onClick={() =>
                contest &&
                mutate(
                  () => download(`/report/${contest.id}`, 'desempenho.csv'),
                  'Relatório exportado',
                )
              }
            >
              <FileText size={17} />
              Exportar CSV
            </Button>
          </Card>
        </div>
      </div>
      <Card title="Histórico de alterações" className="section-gap">
        <p className="muted">
          Últimas 250 operações. Retificações, confirmações e marcações manuais deixam um registro.
        </p>
        <div className="audit-list">
          {state.events.slice(0, 30).map((e) => (
            <button key={e.id} onClick={() => setAudit(e.id)}>
              <span>
                {e.entity} · {e.action}
              </span>
              <small>{new Date(e.created_at).toLocaleString('pt-BR')}</small>
              <ChevronRight size={15} />
            </button>
          ))}
          {!state.events.length && <p className="muted">Nenhuma alteração registrada.</p>}
        </div>
      </Card>
      {intervals && (
        <Editor
          title="Intervalos de revisão"
          fields={[
            {
              key: 'intervals',
              label: 'Dias após o estudo, separados por vírgula',
              required: true,
            },
          ]}
          initial={{
            intervals: ((state.preferences.review_intervals as number[]) || [1, 7, 30]).join(', '),
          }}
          onClose={() => setIntervals(false)}
          onSave={async (v) => {
            await send(
              '/preferences/review_intervals',
              { value: String(v.intervals).split(',').map(Number) },
              'PUT',
            );
            await refresh();
            notify('Intervalos atualizados');
          }}
        />
      )}
      {rest && contest && (
        <Editor
          title="Dias de descanso"
          description="Marque os dias sem estudo planejado. Metas diárias e estimativa de tempo são editadas no cadastro do concurso."
          fields={['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map(
            (label, i) => ({ key: String(i), label, type: 'checkbox' }),
          )}
          initial={Object.fromEntries(
            (JSON.parse(contest.rest_days) as number[]).map((i) => [String(i), true]),
          )}
          onClose={() => setRest(false)}
          onSave={async (v) => {
            await send(
              `/contests/${contest.id}`,
              {
                ...contest,
                rest_days: JSON.stringify(
                  Object.keys(v)
                    .filter((k) => v[k])
                    .map(Number),
                ),
              },
              'PUT',
            );
            await refresh();
            notify('Dias de descanso salvos');
          }}
        />
      )}
      {restore && (
        <Modal
          title="Restaurar backup completo"
          onClose={() => {
            if (!busy) setRestore(false);
          }}
        >
          <p className="warning-text">
            A restauração substitui os registros e arquivos atuais pelo conteúdo do backup. Uma
            cópia completa do estado atual será guardada antes da troca.
          </p>
          <label className="dropzone">
            <Upload size={27} />
            <strong>{file?.name || 'Selecione o backup .zip'}</strong>
            <input
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => setFile(e.target.files?.[0])}
            />
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Confirmo a substituição dos dados atuais.
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-footer">
            <Button variant="secondary" disabled={busy} onClick={() => setRestore(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={!file || !confirmed || busy}
              onClick={async () => {
                if (!file) return;
                setBusy(true);
                try {
                  const form = new FormData();
                  form.append('file', file);
                  form.append('confirm', 'true');
                  await api('/restore', { method: 'POST', body: form });
                  await refresh();
                  notify('Backup restaurado com sucesso');
                  setRestore(false);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Restaurando…' : 'Restaurar e substituir'}
            </Button>
          </div>
        </Modal>
      )}{' '}
      {audit && (
        <Modal title="Detalhes da alteração" onClose={() => setAudit(undefined)}>
          <h3>Antes</h3>
          <pre className="json-view">
            {JSON.stringify(
              JSON.parse(state.events.find((e) => e.id === audit)?.before_json || 'null'),
              null,
              2,
            )}
          </pre>
          <h3>Depois</h3>
          <pre className="json-view">
            {JSON.stringify(
              JSON.parse(state.events.find((e) => e.id === audit)?.after_json || 'null'),
              null,
              2,
            )}
          </pre>
        </Modal>
      )}
    </>
  );
}
