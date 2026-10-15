import { useState } from 'react';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  FileSearch,
  Check,
  Link2,
  Pencil,
  Trash2,
  BookOpen,
  AlertCircle,
  Search,
} from 'lucide-react';
import { useApp } from '../lib/context';
import { send, pct } from '../lib/api';
import { ancestry, coverage, effectiveCoverage, statistics } from '../../shared/domain';
import type { Topic } from '../../shared/types';
import {
  Button,
  Card,
  PageTitle,
  Empty,
  Editor,
  Badge,
  Progress,
  type Field,
  type Values,
} from './UI';
export const coverageLabels = {
  unverified: 'Não verificado',
  unread: 'Não estudado',
  partial: 'Parcialmente estudado',
  studied: 'Estudado',
};
export function topicOptions(topics: Topic[], contestId: string, includeEmpty = true) {
  return [
    ...(includeEmpty ? [{ value: '', label: 'Sem classificação' }] : []),
    ...topics
      .filter((t) => t.contest_id === contestId)
      .map((t) => ({
        value: t.id,
        label: ancestry(topics, t.id)
          .map((p) => p.title)
          .join(' › '),
      })),
  ];
}
export default function Curriculum() {
  const { state, contest, mutate, refresh, notify, openDocument, navigate } = useApp();
  const [editing, setEditing] = useState<Topic | 'new'>(),
    [parent, setParent] = useState<Topic>(),
    [expanded, setExpanded] = useState<Set<string>>(new Set()),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [mapTopic, setMapTopic] = useState<Topic>();
  if (!contest)
    return (
      <Empty
        title="Selecione um concurso"
        description="O conteúdo programático será organizado por concurso e cargo."
        action={<Button onClick={() => navigate('Meus Concursos')}>Cadastrar concurso</Button>}
      />
    );
  const topics = state.topics.filter((t) => t.contest_id === contest.id),
    cov = coverage(topics, state.mappings, state.readings);
  const filtered = (t: Topic): boolean => {
    const own =
      t.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
      (filter === 'all' ||
        (filter === 'missing' && !state.mappings.some((m) => m.topic_id === t.id && m.confirmed)) ||
        effectiveCoverage(t, state.mappings, state.readings) === filter);
    return own || topics.some((c) => c.parent_id === t.id && filtered(c));
  };
  const toggle = (id: string) =>
    setExpanded((old) => {
      const n = new Set(old);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const fields: Field[] = [
    { key: 'title', label: 'Título original', required: true },
    {
      key: 'weight',
      label: 'Peso na cobertura / prioridade',
      type: 'number',
      min: 0.01,
      max: 100,
      step: 0.1,
      required: true,
    },
    {
      key: 'coverage',
      label: 'Cobertura teórica',
      type: 'select',
      options: Object.entries(coverageLabels).map(([value, label]) => ({ value, label })),
    },
    {
      key: 'review_state',
      label: 'Estado de revisão',
      type: 'select',
      options: [
        { value: 'not_reviewed', label: 'Não revisado' },
        { value: 'pending', label: 'Revisão pendente' },
        { value: 'reviewed', label: 'Revisado' },
        { value: 'again', label: 'Precisa de nova revisão' },
      ],
    },
    { key: 'verified', label: 'Informação conferida com o edital', type: 'checkbox' },
  ];
  const render = (t: Topic, level = 0) => {
    const children = topics.filter((c) => c.parent_id === t.id && filtered(c)),
      isOpen = expanded.has(t.id) || !!search || filter !== 'all',
      status = effectiveCoverage(t, state.mappings, state.readings),
      stats = statistics(state.attempts, state.attempt_links, topics, {
        contestId: contest.id,
        topicId: t.id,
      });
    const maps = state.mappings.filter((m) => m.topic_id === t.id);
    const c = coverage(topics, state.mappings, state.readings, t.id);
    return (
      <div key={t.id}>
        <div className={`topic-row level-${level}`} style={{ paddingLeft: 16 + level * 27 }}>
          <button
            className="topic-toggle"
            aria-label={`Expandir ${t.title}`}
            onClick={() => toggle(t.id)}
          >
            {children.length ? (
              isOpen ? (
                <ChevronDown size={17} />
              ) : (
                <ChevronRight size={17} />
              )
            ) : (
              <span className="topic-dot" />
            )}
          </button>
          <div className="topic-title">
            <strong>{t.title}</strong>
            <small>
              {t.kind === 'discipline'
                ? `${c.total} tópicos finais · ${pct(c.percent)} de cobertura`
                : coverageLabels[status]}
              {!t.verified && <span className="warning-inline"> · Não confirmado</span>}
            </small>
          </div>
          <div className="topic-stats">
            <span>
              {pct(stats.accuracy)}
              <small>{stats.answered} questões</small>
            </span>
            {t.kind !== 'discipline' && (
              <Badge
                tone={status === 'studied' ? 'green' : status === 'partial' ? 'amber' : 'neutral'}
              >
                {coverageLabels[status]}
              </Badge>
            )}
          </div>
          <div className="row-actions">
            {t.source_document_id && (
              <Button
                variant="ghost"
                title="Conferir com o Edital Original"
                onClick={() =>
                  openDocument(t.source_document_id!, t.source_page || 1, t.source_excerpt)
                }
              >
                <FileSearch size={16} />
              </Button>
            )}
            <Button variant="ghost" title="Editar e confirmar tópico" onClick={() => setEditing(t)}>
              <Pencil size={15} />
            </Button>
            {t.kind !== 'subtopic' && (
              <Button
                variant="ghost"
                title={t.kind === 'discipline' ? 'Adicionar assunto' : 'Adicionar subassunto'}
                onClick={() => {
                  setParent(t);
                  setEditing('new');
                }}
              >
                <Plus size={16} />
              </Button>
            )}
            {t.kind !== 'discipline' && (
              <Button
                variant="ghost"
                title="Associar páginas de um material"
                onClick={() => setMapTopic(t)}
              >
                <Link2 size={16} />
              </Button>
            )}
            <Button
              variant="ghost"
              title="Excluir tópico"
              onClick={() => {
                if (confirm('Excluir tópico? Registros com vínculos serão preservados.'))
                  mutate(
                    () => send(`/topics/${t.id}`, { confirm: true }, 'DELETE'),
                    'Tópico excluído',
                  );
              }}
            >
              <Trash2 size={15} />
            </Button>
          </div>
        </div>
        {isOpen && maps.length > 0 && (
          <div className="topic-mappings" style={{ marginLeft: 55 + level * 27 }}>
            {maps.map((m) => (
              <div key={m.id}>
                <BookOpen size={14} />
                <button
                  className="text-link"
                  onClick={() => openDocument(m.document_id, m.start_page)}
                >
                  {state.documents.find((d) => d.id === m.document_id)?.name} · p. {m.start_page}–
                  {m.end_page}
                </button>
                <Badge tone={m.confirmed ? 'green' : 'amber'}>
                  {m.confirmed ? 'Validado' : 'Associação sugerida'}
                </Badge>
                {!m.confirmed && (
                  <Button
                    variant="ghost"
                    title="Confirmar correspondência após conferir o material"
                    onClick={() =>
                      mutate(() => send(`/mappings/${m.id}`, { ...m, confirmed: 1 }, 'PUT'))
                    }
                  >
                    <Check size={15} />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  title="Remover associação"
                  onClick={() => {
                    if (confirm('Remover esta associação?'))
                      mutate(() => send(`/mappings/${m.id}`, { confirm: true }, 'DELETE'));
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
        {isOpen && children.map((c) => render(c, level + 1))}
      </div>
    );
  };
  return (
    <>
      <PageTitle
        eyebrow="CONTEÚDO PROGRAMÁTICO"
        title="Do edital ao domínio"
        description="Acompanhe teoria, revisão e questões sem confundir leitura com aprendizado."
        action={
          <Button
            onClick={() => {
              setParent(undefined);
              setEditing('new');
            }}
          >
            <Plus size={17} />
            Nova disciplina
          </Button>
        }
      />
      <Card className="coverage-summary">
        <div>
          <span className="eyebrow">COBERTURA DO EDITAL</span>
          <strong>{pct(cov.percent)}</strong>
          <p>
            {cov.studied} de {cov.total} tópicos finais concluídos
          </p>
        </div>
        <div className="coverage-summary-bar">
          <Progress value={cov.percent} />
          <div className="legend">
            <span>{cov.partial} parciais</span>
            <span>{cov.pending} pendentes</span>
            <span>{cov.missing} sem material validado</span>
          </div>
        </div>
      </Card>
      <div className="toolbar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Pesquisar tópicos"
            placeholder="Buscar disciplina, assunto ou subassunto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Filtrar cobertura"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Todos os conteúdos</option>
          {Object.entries(coverageLabels).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
          <option value="missing">Sem material identificado</option>
        </select>
        <Button variant="secondary" onClick={() => navigate('Analisar Edital')}>
          <FileSearch size={17} />
          Importar do edital
        </Button>
      </div>
      {topics.length ? (
        <Card className="topic-tree">
          {topics.filter((t) => !t.parent_id && filtered(t)).map((t) => render(t))}
        </Card>
      ) : (
        <Empty
          title="Construa seu mapa de estudos"
          description="Importe o conteúdo de um edital ou cadastre disciplinas, assuntos e subassuntos manualmente."
          action={
            <Button onClick={() => navigate('Analisar Edital')}>
              Analisar edital
              <ArrowIcon />
            </Button>
          }
        />
      )}
      <p className="footnote">
        <AlertCircle size={14} />A cobertura usa os tópicos finais da hierarquia. Leitura parcial
        permanece parcial; apenas associações confirmadas aproveitam páginas já estudadas.
      </p>
      {editing && (
        <Editor
          title={
            editing === 'new'
              ? parent
                ? `Novo ${parent.kind === 'discipline' ? 'assunto' : 'subassunto'}`
                : 'Nova disciplina'
              : 'Editar e conferir conteúdo'
          }
          description={
            editing !== 'new' && editing.source_excerpt
              ? `Origem: página ${editing.source_page} · ${editing.source_excerpt}`
              : undefined
          }
          fields={fields}
          initial={
            editing === 'new'
              ? { weight: 1, coverage: 'unread', review_state: 'not_reviewed', verified: true }
              : { ...editing, verified: !!editing.verified }
          }
          onClose={() => setEditing(undefined)}
          onSave={async (v) => {
            const existing = editing === 'new' ? undefined : editing;
            await send(
              existing ? `/topics/${existing.id}` : '/topics',
              {
                ...v,
                verified: v.verified ? 1 : 0,
                contest_id: contest.id,
                parent_id: existing?.parent_id || parent?.id || null,
                kind:
                  existing?.kind ||
                  (parent ? (parent.kind === 'discipline' ? 'subject' : 'subtopic') : 'discipline'),
                position: existing?.position || topics.length,
              },
              existing ? 'PUT' : 'POST',
            );
            await refresh();
            notify('Conteúdo salvo');
          }}
        />
      )}
      {mapTopic && (
        <Editor
          title={`Material para ${mapTopic.title}`}
          description="Confira se o intervalo cobre o tópico antes de validar a associação."
          fields={[
            {
              key: 'document_id',
              label: 'Material em PDF',
              type: 'select',
              required: true,
              options: [
                { value: '', label: 'Selecionar material' },
                ...state.documents
                  .filter(
                    (d) => d.kind === 'material' && (!d.contest_id || d.contest_id === contest.id),
                  )
                  .map((d) => ({ value: d.id, label: d.name })),
              ],
            },
            { key: 'start_page', label: 'Página inicial', type: 'number', min: 1, required: true },
            { key: 'end_page', label: 'Página final', type: 'number', min: 1, required: true },
            { key: 'confirmed', label: 'Conferi e confirmo a correspondência', type: 'checkbox' },
          ]}
          initial={{ start_page: 1, end_page: 1, confirmed: false }}
          onClose={() => setMapTopic(undefined)}
          onSave={async (v) => {
            await send('/mappings', {
              ...v,
              topic_id: mapTopic.id,
              confirmed: v.confirmed ? 1 : 0,
              confidence: 1,
            });
            await refresh();
            notify('Correspondência salva');
          }}
        />
      )}
    </>
  );
}
function ArrowIcon() {
  return <ChevronRight size={16} />;
}
