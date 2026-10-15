import { useState } from 'react';
import {
  Plus,
  Target,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronRight,
  ArrowLeft,
  Pencil,
  Trash2,
  Download,
  Link2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useApp } from '../lib/context';
import { api, send, pct, duration, formatDate, download } from '../lib/api';
import { dayKey, statistics, ancestry } from '../../shared/domain';
import type { Attempt, Mock } from '../../shared/types';
import { topicOptions } from './Curriculum';
import {
  Button,
  Card,
  PageTitle,
  Empty,
  Editor,
  Metric,
  Badge,
  Modal,
  type Values,
  type Field,
} from './UI';
export function AttemptEditor({
  initialTopicId = '',
  attempt,
  mock,
  onClose,
}: {
  initialTopicId?: string;
  attempt?: Attempt;
  mock?: Mock;
  onClose: () => void;
}) {
  const { state, contest, refresh, notify } = useApp();
  if (!contest) return null;
  const link =
    attempt &&
    state.attempt_links.find((l) => l.attempt_id === attempt.id && l.contest_id === contest.id);
  const fields: Field[] = [
    { key: 'date', label: 'Data', type: 'date', required: true },
    {
      key: 'topic_id',
      label: 'Classificação principal',
      type: 'select',
      options: topicOptions(state.topics, contest.id),
    },
    { key: 'board', label: 'Banca' },
    { key: 'origin', label: 'Origem das questões' },
    { key: 'correct', label: 'Acertos', type: 'number', min: 0, required: true },
    { key: 'wrong', label: 'Erros', type: 'number', min: 0, required: true },
    { key: 'blank', label: 'Em branco', type: 'number', min: 0, required: true },
    {
      key: 'minutes',
      label: 'Tempo gasto (min)',
      type: 'number',
      min: 0,
      step: 0.1,
      required: true,
    },
    {
      key: 'question_type',
      label: 'Modalidade',
      type: 'select',
      options: [
        { value: 'multiple', label: 'Múltipla escolha' },
        { value: 'true_false', label: 'Certo / errado' },
        { value: 'essay', label: 'Discursiva' },
      ],
    },
    {
      key: 'weight',
      label: 'Pontos por acerto',
      type: 'number',
      min: 0,
      step: 0.1,
      required: true,
    },
    {
      key: 'penalty',
      label: 'Desconto por erro',
      type: 'number',
      min: 0,
      step: 0.1,
      required: true,
    },
    {
      key: 'tags',
      label: 'Etiquetas secundárias (separadas por vírgula)',
      hint: 'Etiquetas não multiplicam tentativas nas estatísticas.',
    },
    { key: 'notes', label: 'Observações', type: 'textarea' },
  ];
  return (
    <Editor
      title={attempt ? 'Editar registro de questões' : 'Registrar questões'}
      description="Use um tópico principal por registro. Selecione apenas a disciplina se não souber o assunto. Para uma questão individual, informe 1 em acertos, erros ou em branco."
      fields={fields}
      initial={
        attempt
          ? {
              ...attempt,
              tags: attempt.tags.join(', '),
              mock_id: attempt.mock_id || '',
              topic_id: link?.topic_id || '',
            }
          : {
              date: dayKey(),
              correct: 0,
              wrong: 0,
              blank: 0,
              minutes: 0,
              weight: 1,
              penalty: 0,
              question_type: 'multiple',
              board: mock?.board || contest.board,
              topic_id: initialTopicId,
            }
      }
      onClose={onClose}
      onSave={async (v) => {
        await send(
          attempt ? `/attempts/${attempt.id}` : '/attempts',
          {
            ...v,
            tags: String(v.tags || '')
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean),
            links: attempt
              ? [
                  ...state.attempt_links
                    .filter((l) => l.attempt_id === attempt.id && l.contest_id !== contest.id)
                    .map(({ contest_id, topic_id }) => ({ contest_id, topic_id })),
                  { contest_id: contest.id, topic_id: v.topic_id || null },
                ]
              : [{ contest_id: contest.id, topic_id: v.topic_id || null }],
            mock_id: attempt?.mock_id || mock?.id || null,
            include_stats: attempt?.include_stats ?? mock?.include_stats ?? 1,
          },
          attempt ? 'PUT' : 'POST',
        );
        await refresh();
        notify('Questões registradas; estatísticas recalculadas');
      }}
    />
  );
}
export function MixedSession({
  mock,
  onClose,
  initialTopicIds = [],
}: {
  mock?: Mock;
  onClose: () => void;
  initialTopicIds?: string[];
}) {
  const { state, contest, refresh, notify } = useApp();
  const [rows, setRows] = useState(
      (initialTopicIds.length ? initialTopicIds : ['']).map((topic_id) => ({
        topic_id,
        correct: 0,
        wrong: 0,
        blank: 0,
        minutes: 0,
      })),
    ),
    [date, setDate] = useState(dayKey()),
    [origin, setOrigin] = useState(''),
    [board, setBoard] = useState(mock?.board || contest?.board || ''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  if (!contest) return null;
  return (
    <Modal wide title="Sessão com várias disciplinas / assuntos" onClose={onClose}>
      <p className="muted">
        Distribua os resultados por classificação principal. Cada linha é contada uma vez; o
        salvamento de todas as linhas é feito em uma única transação.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await send('/attempts/batch', {
              rows: rows.map((r) => ({
                ...r,
                date,
                origin,
                board,
                links: [{ contest_id: contest.id, topic_id: r.topic_id || null }],
                mock_id: mock?.id || null,
                include_stats: mock?.include_stats ?? 1,
              })),
            });
            await refresh();
            notify('Sessão distribuída salva');
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label className="field">
            Data
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            Banca
            <input value={board} onChange={(e) => setBoard(e.target.value)} />
          </label>
          <label className="field full">
            Origem
            <input value={origin} onChange={(e) => setOrigin(e.target.value)} />
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Classificação principal</th>
                <th>Acertos</th>
                <th>Erros</th>
                <th>Em branco</th>
                <th>Minutos</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    <select
                      aria-label={`Tópico da linha ${i + 1}`}
                      value={r.topic_id}
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((v, j) => (i === j ? { ...v, topic_id: e.target.value } : v)),
                        )
                      }
                    >
                      {topicOptions(state.topics, contest.id).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  {(['correct', 'wrong', 'blank', 'minutes'] as const).map((k) => (
                    <td key={k}>
                      <input
                        aria-label={`${k} linha ${i + 1}`}
                        className="small-number"
                        type="number"
                        min={0}
                        required
                        value={r[k]}
                        onChange={(e) =>
                          setRows((rs) =>
                            rs.map((v, j) => (i === j ? { ...v, [k]: Number(e.target.value) } : v)),
                          )
                        }
                      />
                    </td>
                  ))}
                  <td>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={rows.length === 1}
                      onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button
          variant="secondary"
          type="button"
          onClick={() =>
            setRows((rs) => [...rs, { topic_id: '', correct: 0, wrong: 0, blank: 0, minutes: 0 }])
          }
        >
          <Plus size={16} />
          Adicionar distribuição
        </Button>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-footer">
          <Button disabled={busy} type="submit">
            Salvar sessão completa
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function Practice({ mock }: { mock?: Mock }) {
  const { state, contest, navigate, mutate } = useApp();
  const [editing, setEditing] = useState<Attempt | 'new'>(),
    [mixed, setMixed] = useState(false),
    [topicId, setTopicId] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [board, setBoard] = useState(''),
    [origin, setOrigin] = useState(''),
    [questionType, setQuestionType] = useState(''),
    [reuse, setReuse] = useState<Attempt>();
  if (!contest)
    return (
      <Empty
        title="Selecione um concurso"
        description="Registre sessões de exercícios para acompanhar seu desempenho real."
        action={<Button onClick={() => navigate('Meus Concursos')}>Meus concursos</Button>}
      />
    );
  const attempts = mock
    ? state.attempts.filter((a) => a.mock_id === mock.id).map((a) => ({ ...a, include_stats: 1 }))
    : state.attempts;
  const filter = {
    contestId: contest.id,
    topicId: topicId || undefined,
    from,
    to,
    board,
    origin,
    questionType,
  };
  const stats = statistics(attempts, state.attempt_links, state.topics, filter);
  const current = state.topics.find((t) => t.id === topicId);
  const children = state.topics.filter(
    (t) => t.contest_id === contest.id && t.parent_id === (topicId || null),
  );
  const ids = new Set(
    state.attempt_links.filter((l) => l.contest_id === contest.id).map((l) => l.attempt_id),
  );
  const history = attempts
    .filter(
      (a) =>
        ids.has(a.id) &&
        (!topicId || statistics([a], state.attempt_links, state.topics, filter).count > 0) &&
        (!from || a.date >= from) &&
        (!to || a.date <= to) &&
        (!board || a.board === board) &&
        (!origin || a.origin === origin) &&
        (!questionType || a.question_type === questionType),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const dates = [...new Set(history.filter((a) => a.include_stats).map((a) => a.date))].sort();
  const evolution = dates.map((date) => ({
    date: formatDate(date),
    taxa: statistics(attempts, state.attempt_links, state.topics, {
      ...filter,
      from: date,
      to: date,
    }).accuracy,
  }));
  const linkedTopic = (a: Attempt) => {
    const link = state.attempt_links.find(
      (l) => l.attempt_id === a.id && l.contest_id === contest.id,
    );
    return link?.topic_id
      ? ancestry(state.topics, link.topic_id)
          .map((t) => t.title)
          .join(' › ')
      : 'Disciplina não classificada';
  };
  return (
    <>
      <PageTitle
        eyebrow={mock ? 'RESULTADOS DO SIMULADO' : 'DADOS QUE ORIENTAM'}
        title={mock ? mock.title : 'Questões e desempenho'}
        description="Veja onde está avançando e quais assuntos precisam de atenção."
        action={
          <div className="row-actions">
            <Button variant="secondary" onClick={() => setMixed(true)}>
              <Plus size={16} />
              Sessão distribuída
            </Button>
            <Button onClick={() => setEditing('new')}>
              <Plus size={17} />
              Registrar questões
            </Button>
          </div>
        }
      />
      <div className="filters">
        <label>
          De
          <input
            aria-label="Período inicial"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Até
          <input
            aria-label="Período final"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          Banca
          <select value={board} onChange={(e) => setBoard(e.target.value)}>
            <option value="">Todas</option>
            {[...new Set(attempts.map((a) => a.board).filter(Boolean))].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Origem
          <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
            <option value="">Todas</option>
            {[...new Set(attempts.map((a) => a.origin).filter(Boolean))].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Tipo
          <select value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
            <option value="">Todos</option>
            <option value="multiple">Múltipla escolha</option>
            <option value="true_false">Certo / errado</option>
            <option value="essay">Discursiva</option>
          </select>
        </label>
      </div>
      <div className="scope-breadcrumb">
        <button onClick={() => setTopicId('')}>{contest.name}</button>
        {topicId &&
          ancestry(state.topics, topicId).map((t) => (
            <span key={t.id}>
              <ChevronRight size={14} />
              <button onClick={() => setTopicId(t.id)}>{t.title}</button>
            </span>
          ))}
      </div>
      <div className="metrics-grid">
        <Metric
          label="Taxa de acertos"
          value={pct(stats.accuracy)}
          description={`${stats.answered} questões respondidas`}
          icon={<Target size={19} />}
        />
        <Metric
          label="Acertos"
          value={stats.correct}
          description={`Meta de ${contest.target}% de acertos`}
          icon={<CheckCircle2 size={19} />}
        />
        <Metric
          label="Erros"
          value={stats.wrong}
          description={`Pontuação líquida: ${stats.score.toFixed(1)}`}
          icon={<XCircle size={19} />}
          color="amber"
        />
        <Metric
          label="Em branco"
          value={stats.blank}
          description={`${pct(stats.yield)} sobre ${stats.presented} apresentadas`}
          icon={<HelpCircle size={19} />}
          color="blue"
        />
      </div>
      {stats.answered > 0 && stats.answered < contest.min_sample && (
        <p className="warning-text">
          Amostra pequena: {stats.answered} questões. O mínimo configurado para alertas é{' '}
          {contest.min_sample}.
        </p>
      )}
      <div className="two-columns">
        <Card title="Evolução dos acertos">
          <p className="muted">Taxa por dia · passe o cursor para consultar</p>
          {evolution.length ? (
            <div className="chart">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={evolution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v) => pct(Number(v))} />
                  <Line
                    type="monotone"
                    dataKey="taxa"
                    name="Acertos"
                    stroke="#32846a"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty
              title="Seu histórico começa com uma questão"
              description="Registre resultados para acompanhar sua evolução."
            />
          )}
        </Card>
        <Card title={current ? `Conteúdos de ${current.title}` : 'Desempenho por disciplina'}>
          <div className="performance-list">
            {children.map((t) => {
              const s = statistics(attempts, state.attempt_links, state.topics, {
                ...filter,
                topicId: t.id,
              });
              return (
                <button key={t.id} onClick={() => setTopicId(t.id)}>
                  <div>
                    <strong>{t.title}</strong>
                    <small>
                      {s.answered} respondidas · {s.correct} acertos
                    </small>
                  </div>
                  <span
                    className={
                      s.accuracy !== null &&
                      s.answered >= contest.min_sample &&
                      s.accuracy < contest.target
                        ? 'warning-text'
                        : ''
                    }
                  >
                    {pct(s.accuracy)}
                  </span>
                  <ChevronRight size={17} />
                </button>
              );
            })}
            {!children.length && <p className="muted">Nenhum nível inferior cadastrado.</p>}
          </div>
          <p className="footnote">
            Registros sem assunto permanecem no total da disciplina. Sem disciplina, permanecem no
            total do concurso.
          </p>
        </Card>
      </div>
      <Card
        title={`Histórico de sessões · ${history.length}`}
        className="section-gap"
        action={
          <Button
            variant="ghost"
            onClick={() =>
              mutate(
                () => download(`/report/${contest.id}`, 'desempenho.csv'),
                'Relatório exportado',
              )
            }
          >
            <Download size={16} />
            Exportar CSV
          </Button>
        }
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Data / origem</th>
                <th>Classificação</th>
                <th>Respondidas</th>
                <th>Acertos</th>
                <th>Erros / branco</th>
                <th>Taxa</th>
                <th>Tempo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {history.map((a) => (
                <tr key={a.id}>
                  <td>
                    {formatDate(a.date)}
                    <small className="table-sub">
                      {a.origin || 'Origem não informada'}
                      {a.mock_id ? ' · Simulado' : ''}
                      {!a.include_stats ? ' · Fora das estatísticas' : ''}
                    </small>
                  </td>
                  <td>{linkedTopic(a)}</td>
                  <td>{a.correct + a.wrong}</td>
                  <td>{a.correct}</td>
                  <td>
                    {a.wrong} / {a.blank}
                  </td>
                  <td>
                    {pct(a.correct + a.wrong ? (a.correct / (a.correct + a.wrong)) * 100 : null)}
                  </td>
                  <td>{duration(a.minutes)}</td>
                  <td>
                    <div className="row-actions">
                      <Button variant="ghost" title="Editar questões" onClick={() => setEditing(a)}>
                        <Pencil size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        title="Reutilizar em outro concurso"
                        onClick={() => setReuse(a)}
                      >
                        <Link2 size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        title="Excluir registro"
                        onClick={() => {
                          if (confirm('Excluir este registro de questões e seus vínculos?'))
                            mutate(
                              () => send(`/attempts/${a.id}`, { confirm: true }, 'DELETE'),
                              'Registro excluído',
                            );
                        }}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!history.length && (
            <p className="table-empty">Nenhum registro neste período e classificação.</p>
          )}
        </div>
      </Card>
      {editing && (
        <AttemptEditor
          attempt={editing === 'new' ? undefined : editing}
          mock={mock}
          onClose={() => setEditing(undefined)}
        />
      )}{' '}
      {mixed && <MixedSession mock={mock} onClose={() => setMixed(false)} />}{' '}
      {reuse && (
        <Editor
          title="Reutilizar tentativa em outro concurso"
          description="Confirme a correspondência entre os conteúdos. A tentativa será a mesma e não será duplicada em cada concurso."
          fields={[
            {
              key: 'contest_id',
              label: 'Concurso de destino',
              type: 'select',
              required: true,
              options: [
                { value: '', label: 'Selecionar' },
                ...state.contests
                  .filter((c) => c.id !== contest.id)
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
              label: 'Conferi a equivalência dos conteúdos',
              type: 'checkbox',
              required: true,
            },
          ]}
          onClose={() => setReuse(undefined)}
          onSave={async (v) => {
            const links = state.attempt_links
              .filter((l) => l.attempt_id === reuse.id && l.contest_id !== v.contest_id)
              .map(({ contest_id, topic_id }) => ({ contest_id, topic_id }));
            await send(
              `/attempts/${reuse.id}`,
              {
                ...reuse,
                links: [...links, { contest_id: v.contest_id, topic_id: v.topic_id || null }],
              },
              'PUT',
            );
            await mutate(async () => true, 'Tentativa reutilizada sem duplicação');
          }}
        />
      )}
    </>
  );
}
export function Mocks() {
  const { state, contest, navigate, refresh, notify, mutate } = useApp();
  const [editing, setEditing] = useState<Mock | 'new'>(),
    [selected, setSelected] = useState<string>();
  if (!contest)
    return (
      <Empty
        title="Selecione um concurso"
        description="Simule a prova e acompanhe os resultados."
        action={<Button onClick={() => navigate('Meus Concursos')}>Meus concursos</Button>}
      />
    );
  const mocks = state.mocks
    .filter((m) => m.contest_id === contest.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const mock = mocks.find((m) => m.id === selected);
  return (
    <>
      {mock ? (
        <>
          <Button variant="ghost" onClick={() => setSelected(undefined)}>
            <ArrowLeft size={17} />
            Todos os simulados
          </Button>
          <Practice key={mock.id} mock={mock} />
        </>
      ) : (
        <>
          <PageTitle
            eyebrow="TREINE PARA O GRANDE DIA"
            title="Simulados"
            description="Registre provas completas e distribua os resultados por disciplina e assunto."
            action={
              <Button onClick={() => setEditing('new')}>
                <Plus size={17} />
                Novo simulado
              </Button>
            }
          />
          {mocks.length ? (
            <div className="contest-grid">
              {mocks.map((m) => {
                const rows = state.attempts.filter((a) => a.mock_id === m.id);
                const correct = rows.reduce((s, a) => s + a.correct, 0),
                  answered = rows.reduce((s, a) => s + a.correct + a.wrong, 0);
                return (
                  <Card key={m.id}>
                    <div className="between">
                      <Badge tone="blue">{formatDate(m.date)}</Badge>
                      <Button variant="ghost" title="Editar simulado" onClick={() => setEditing(m)}>
                        <Pencil size={15} />
                      </Button>
                    </div>
                    <h2>{m.title}</h2>
                    <p>
                      {m.board || 'Banca não informada'} · {duration(m.minutes)}
                    </p>
                    <div className="mock-result">
                      {pct(answered ? (correct / answered) * 100 : null)}
                      <small>{answered} questões respondidas</small>
                    </div>
                    <p className="footnote">
                      {m.include_stats
                        ? 'Resultados integrados às estatísticas gerais'
                        : 'Resultados separados das estatísticas gerais'}
                    </p>
                    <div className="between">
                      <Button variant="secondary" onClick={() => setSelected(m.id)}>
                        Ver / registrar resultados
                        <ChevronRight size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        title="Excluir simulado"
                        onClick={() => {
                          if (confirm('Excluir o simulado e suas tentativas de questões?'))
                            mutate(() => send(`/mocks/${m.id}`, { confirm: true }, 'DELETE'));
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Empty
              title="Prepare-se em condições reais"
              description="Crie seu primeiro simulado e registre o desempenho por disciplina."
              action={<Button onClick={() => setEditing('new')}>Cadastrar simulado</Button>}
            />
          )}
        </>
      )}
      {editing && (
        <Editor
          title={editing === 'new' ? 'Novo simulado' : 'Editar simulado'}
          fields={[
            { key: 'title', label: 'Nome do simulado', required: true },
            { key: 'board', label: 'Banca' },
            { key: 'date', label: 'Data', type: 'date', required: true },
            { key: 'minutes', label: 'Duração (min)', type: 'number', min: 0, required: true },
            {
              key: 'include_stats',
              label: 'Integrar tentativas às estatísticas do concurso',
              type: 'checkbox',
            },
          ]}
          initial={
            editing === 'new'
              ? { date: dayKey(), minutes: 120, board: contest.board, include_stats: true }
              : { ...editing, include_stats: !!editing.include_stats }
          }
          onClose={() => setEditing(undefined)}
          onSave={async (v) => {
            await send(
              editing === 'new' ? '/mocks' : `/mocks/${editing.id}`,
              { ...v, contest_id: contest.id, include_stats: v.include_stats ? 1 : 0 },
              editing === 'new' ? 'POST' : 'PUT',
            );
            await refresh();
            notify('Simulado salvo');
          }}
        />
      )}
    </>
  );
}
