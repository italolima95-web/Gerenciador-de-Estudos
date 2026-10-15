import { NoticeSummary, type SummaryFact } from './NoticeSummary';
import { disciplineKey } from '../../shared/catalog';
import { syllabusComparison } from '../../shared/comparison';
import { coverageLabels } from './Curriculum';
import { useEffect, useRef, useState } from 'react';
import {
  Upload,
  BookOpen,
  FileText,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  BookmarkPlus,
  ScanText,
  Check,
  ExternalLink,
  AlertTriangle,
  Download,
  X,
  Link2,
} from 'lucide-react';
import { useApp } from '../lib/context';
import { api, send, pct, formatDate } from '../lib/api';
import { extractPdf, ocrCanvas, pdfjs, textFromContent, pdfOptions } from '../lib/pdf';
import { factLabels, type ExtractedFact, type ExtractedTopic } from '../../shared/analyzer';
import { dayKey, readPages, libraryProgress } from '../../shared/domain';
import type { Document, Fact, SyllabusItem } from '../../shared/types';
import { topicOptions } from './Curriculum';
import { Button, Card, PageTitle, Empty, Modal, Editor, Badge, Progress } from './UI';
export function ImportPdf({
  onClose,
  initialKind = 'material',
  onImported,
}: {
  onClose: () => void;
  initialKind?: string;
  onImported?: (id: string) => void;
}) {
  const { contest, state, refresh, notify } = useApp();
  const [file, setFile] = useState<File>(),
    [kind, setKind] = useState(initialKind),
    [contestId, setContestId] = useState(contest?.id || ''),
    [topicId, setTopicId] = useState(''),
    [ocr, setOcr] = useState(false),
    [progress, setProgress] = useState(''),
    [error, setError] = useState('');
  return (
    <Modal
      title="Importar PDF"
      onClose={() => {
        if (!progress) onClose();
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!file) return;
          setError('');
          setProgress('Abrindo documento…');
          try {
            const result = await extractPdf(file, ocr, setProgress);
            const form = new FormData();
            form.append('file', file);
            form.append('name', file.name.replace(/\.pdf$/i, ''));
            form.append('kind', kind);
            form.append('contest_id', contestId);
            form.append('topic_id', topicId);
            form.append('pages', String(result.pages.length));
            form.append('text_pages', JSON.stringify(result.pages));
            form.append('outline', JSON.stringify(result.outline));
            setProgress('Salvando arquivo e texto no computador…');
            const saved = await api<{ id: string }>('/documents', { method: 'POST', body: form });
            await refresh();
            notify('PDF importado. O arquivo original foi preservado.');
            onImported?.(saved.id);
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setProgress('');
          }
        }}
      >
        <label className="dropzone">
          <Upload size={30} />
          <strong>{file ? file.name : 'Escolha um arquivo PDF'}</strong>
          <span>Arquivo local · até 200 MB · não é enviado à internet</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            required
            disabled={!!progress}
            onChange={(e) => setFile(e.target.files?.[0])}
          />
        </label>
        <div className="form-grid">
          <label className="field">
            Tipo de documento
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="material">Material de estudo</option>
              <option value="notice">Edital de abertura</option>
              <option value="amendment">Retificação</option>
              <option value="annex">Anexo / complemento</option>
              <option value="schedule">Cronograma / quadro de provas</option>
            </select>
          </label>
          <label className="field">
            Plano / concurso
            <select
              required={kind !== 'material'}
              value={contestId}
              onChange={(e) => {
                setContestId(e.target.value);
                setTopicId('');
              }}
            >
              <option value="">Sem concurso</option>
              {state.contests.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {kind === 'material' && (
            <label className="field full">
              Disciplina ou tópico associado
              <select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                {topicOptions(state.topics, contestId).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <label className="check-row">
          <input type="checkbox" checked={ocr} onChange={(e) => setOcr(e.target.checked)} />
          Aplicar OCR local às páginas sem texto
        </label>
        <p className="footnote">
          O OCR em português funciona offline e pode levar alguns minutos em documentos longos.
        </p>
        {progress && (
          <p className="processing" role="status">
            <span className="status-dot" />
            {progress}
          </p>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <Button variant="secondary" type="button" disabled={!!progress} onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!!progress || !file} type="submit">
            <Upload size={17} />
            {progress ? 'Importando…' : 'Importar e extrair texto'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function Library() {
  const { state, contest, openDocument, mutate, navigate } = useApp();
  const [importing, setImporting] = useState(false),
    [search, setSearch] = useState(''),
    [discipline, setDiscipline] = useState('');
  const progress = libraryProgress(state, contest?.id, discipline || undefined);
  const docs = state.documents.filter(
    (d) =>
      (!contest || !d.contest_id || d.contest_id === contest.id) &&
      d.name.toLowerCase().includes(search.toLowerCase()) &&
      (!discipline || progress.documentIds.includes(d.id)),
  );
  return (
    <>
      <PageTitle
        eyebrow="SEUS MATERIAIS"
        title="Biblioteca de PDFs"
        description="Cada página conta. Retome exatamente de onde parou."
        action={
          <Button onClick={() => setImporting(true)}>
            <Upload size={17} />
            Importar PDF
          </Button>
        }
      />
      <Card className="coverage-summary">
        <div>
          <span className="eyebrow">LEITURA DE MATERIAIS</span>
          <strong>{pct(progress.percent)}</strong>
          <p>
            {progress.done} páginas concluídas · {progress.pending} pendentes de {progress.total}
          </p>
        </div>
        <div className="coverage-summary-bar">
          <Progress value={progress.percent} />
          <p className="footnote">
            Métrica de páginas, separada da cobertura do edital e da taxa de acertos.
          </p>
        </div>
      </Card>
      <div className="toolbar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Pesquisar biblioteca"
            placeholder="Buscar em seus documentos…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Leitura por disciplina"
          value={discipline}
          onChange={(e) => setDiscipline(e.target.value)}
        >
          <option value="">Todos os materiais</option>
          {state.topics
            .filter((t) => t.contest_id === contest?.id && t.kind === 'discipline')
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
        </select>
        <span className="muted">{docs.length} documentos · armazenados localmente</span>
      </div>
      {docs.length ? (
        <div className="document-grid">
          {docs.map((d) => {
            const done = readPages(state.readings, d.id);
            return (
              <Card key={d.id} className="document-card">
                <div className={`document-cover ${d.kind === 'material' ? '' : 'notice'}`}>
                  <div className="document-cover-top">
                    {d.kind === 'material' ? 'MATERIAL DE ESTUDO' : 'DOCUMENTO DO CONCURSO'}
                    <FileText size={18} />
                  </div>
                  <h3>{d.name}</h3>
                  <span>PDF · {d.pages} páginas</span>
                  <div className="paper-lines">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                <div className="document-card-body">
                  <div className="between">
                    <strong>{pct((done / d.pages) * 100)} concluído</strong>
                    <small>
                      {done}/{d.pages} páginas
                    </small>
                  </div>
                  <Progress value={(done / d.pages) * 100} />
                  <p className="muted">Retomar na página {d.resume_page}</p>
                  <div className="between">
                    <Button variant="secondary" onClick={() => openDocument(d.id, d.resume_page)}>
                      <BookOpen size={16} />
                      Continuar leitura
                    </Button>
                    {d.kind === 'material' && contest && (
                      <Button
                        variant="ghost"
                        title="Sugerir associações com o edital"
                        onClick={() =>
                          mutate(
                            () => send(`/documents/${d.id}/match`, { contest_id: contest.id }),
                            'Sugestões geradas. Confira as associações em Disciplinas.',
                          )
                        }
                      >
                        <Link2 size={17} />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Empty
          title="Uma biblioteca para chamar de sua"
          description="Importe apostilas, livros e editais. Sua leitura e suas anotações serão salvas neste computador."
          action={
            <Button onClick={() => setImporting(true)}>
              <Upload size={17} />
              Adicionar primeiro PDF
            </Button>
          }
        />
      )}{' '}
      {importing && <ImportPdf onClose={() => setImporting(false)} />}
    </>
  );
}
export function NoticeAnalysis() {
  const { state, contest, mutate, refresh, notify, openDocument, navigate } = useApp();
  const [importing, setImporting] = useState(false),
    [selected, setSelected] = useState(''),
    [role, setRole] = useState(''),
    [tab, setTab] = useState<'summary' | 'subjects'>('summary'),
    [analysis, setAnalysis] = useState<{
      facts: ExtractedFact[];
      topics: ExtractedTopic[];
      roles: string[];
      warning: string;
    }>(),
    [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set()),
    [busy, setBusy] = useState(false),
    [editFact, setEditFact] = useState<Fact>();
  if (!contest)
    return (
      <Empty
        title="Comece pelas suas disciplinas"
        description="Cadastre suas disciplinas. O edital pode ser adicionado depois."
        action={<Button onClick={() => navigate('Disciplinas')}>Cadastrar disciplinas</Button>}
      />
    );
  const docs = state.documents
    .filter((d) => d.contest_id === contest.id && d.kind !== 'material')
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const currentId = selected || docs[0]?.id || '',
    document = docs.find((d) => d.id === currentId);
  const saved = state.facts
    .filter((f) => f.contest_id === contest.id)
    .sort(
      (a, b) =>
        Number(b.document_id === currentId) - Number(a.document_id === currentId) ||
        (state.documents.find((d) => d.id === b.document_id)?.created_at || '').localeCompare(
          state.documents.find((d) => d.id === a.document_id)?.created_at || '',
        ),
    );
  const facts: SummaryFact[] = analysis ? analysis.facts : saved;
  const requirements = (state.syllabus_items || []).filter(
    (i) => i.contest_id === contest.id && i.active,
  );
  const roots = analysis ? analysis.topics.filter((t) => t.kind === 'discipline') : [];
  const grouped = new Map<string, ExtractedTopic[]>(),
    rootFor = new Map<string, string>();
  for (const t of analysis?.topics || []) {
    const root = t.kind === 'discipline' ? t.key : rootFor.get(t.parentKey || '');
    if (root) {
      rootFor.set(t.key, root);
      if (t.kind !== 'discipline') {
        const list = grouped.get(root) || [];
        list.push(t);
        grouped.set(root, list);
      }
    }
  }
  const savedRoots = [
    ...new Map(
      requirements.filter((i) => i.kind === 'discipline').map((i) => [disciplineKey(i.title), i]),
    ).values(),
  ];
  const comparison = syllabusComparison(state, contest.id);
  const analyze = async () => {
    if (!currentId) return;
    setBusy(true);
    try {
      const a = await send<NonNullable<typeof analysis>>(`/documents/${currentId}/analyze`, {
        role,
      });
      setAnalysis(a);
      setSelectedKeys(new Set(a.topics.map((t) => t.key)));
      setTab('summary');
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const toggle = (t: ExtractedTopic, checked: boolean) =>
    setSelectedKeys((old) => {
      const n = new Set(old);
      const visit = (key: string) => {
        checked ? n.add(key) : n.delete(key);
        for (const child of analysis?.topics.filter((x) => x.parentKey === key) || [])
          visit(child.key);
      };
      visit(t.key);
      if (checked) {
        let p = analysis?.topics.find((x) => x.key === t.parentKey);
        while (p) {
          n.add(p.key);
          p = analysis?.topics.find((x) => x.key === p?.parentKey);
        }
      }
      return n;
    });
  const save = async () => {
    if (!analysis) return;
    const result = await mutate(
      () =>
        send(`/documents/${currentId}/apply-analysis`, {
          role,
          fields: analysis.facts.map((f) => f.field),
          topicKeys: [...selectedKeys],
        }),
      'Análise salva. Confira os dados e escolha suas disciplinas no ciclo.',
    );
    if (result) setAnalysis(undefined);
  };
  return (
    <>
      <PageTitle
        eyebrow="EDITAL EM RESUMO"
        title="Analisar edital"
        description="Veja os dados essenciais do concurso e consulte o conteúdo por disciplina."
        action={
          <Button onClick={() => setImporting(true)}>
            <Upload size={17} />
            Importar edital ou retificação
          </Button>
        }
      />
      <Card>
        <div className="toolbar no-margin">
          <select
            aria-label="Documento para análise"
            value={currentId}
            onChange={(e) => {
              setSelected(e.target.value);
              setAnalysis(undefined);
              setRole('');
            }}
          >
            <option value="">Selecione um documento</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <Button disabled={!currentId || busy} onClick={analyze}>
            <ScanText size={17} />
            {busy ? 'Analisando…' : 'Analisar documento'}
          </Button>
          {document && (
            <Button variant="secondary" onClick={() => openDocument(document.id)}>
              Abrir edital original
            </Button>
          )}
        </div>
        {analysis && analysis.roles.length > 1 && (
          <div className="toolbar">
            <label className="field">
              Cargo de interesse
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">Todos os cargos</option>
                {analysis.roles.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <Button variant="secondary" onClick={analyze}>
              Filtrar por cargo
            </Button>
          </div>
        )}
        {analysis && (
          <div className="notice-save-bar">
            <p>
              {roots.length} disciplinas identificadas · os tópicos ficam organizados dentro de cada
              matéria.
            </p>
            <Button onClick={save}>Salvar análise</Button>
          </div>
        )}
      </Card>
      {!docs.length ? (
        <Empty
          title="Importe seu edital"
          description="O resumo aparecerá aqui. Seus estudos manuais continuam disponíveis sem edital."
          action={<Button onClick={() => setImporting(true)}>Importar documento</Button>}
        />
      ) : (
        <>
          <div role="tablist" aria-label="Resultado da análise" className="notice-tabs">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'summary'}
              aria-controls="notice-summary"
              id="notice-summary-tab"
              onClick={() => setTab('summary')}
            >
              Resumo do concurso
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'subjects'}
              aria-controls="notice-subjects"
              id="notice-subjects-tab"
              onClick={() => setTab('subjects')}
            >
              Matérias do edital <span>{analysis ? roots.length : savedRoots.length}</span>
            </button>
          </div>
          {tab === 'summary' ? (
            <div role="tabpanel" aria-labelledby="notice-summary-tab" id="notice-summary">
              <NoticeSummary
                facts={facts}
                documentId={currentId}
                disciplines={analysis ? roots.map((r) => r.title) : savedRoots.map((r) => r.title)}
                onCorrect={setEditFact}
              />
            </div>
          ) : (
            <div role="tabpanel" aria-labelledby="notice-subjects-tab" id="notice-subjects">
              <Card title="Matérias do edital">
                <p className="muted">
                  Abra apenas a disciplina que deseja conferir. Estes conteúdos não entram
                  automaticamente no ciclo; você escolhe as disciplinas depois.
                </p>
                {analysis ? (
                  roots.length ? (
                    roots.map((root) => {
                      const children = grouped.get(root.key) || [];
                      return (
                        <NoticeFold key={root.key}>
                          <summary>
                            <span>{root.title}</span>
                            <small>{children.length} tópicos</small>
                          </summary>
                          <div className="notice-discipline-tools">
                            <label className="check-row">
                              <input
                                type="checkbox"
                                checked={selectedKeys.has(root.key)}
                                onChange={(e) => toggle(root, e.target.checked)}
                              />
                              Incluir esta disciplina na minha lista de estudos
                            </label>
                            <Button
                              variant="ghost"
                              onClick={() => openDocument(currentId, root.page, root.excerpt)}
                            >
                              Ver disciplina no edital
                            </Button>
                          </div>
                          <div className="notice-scroll extraction-list">
                            {children.map((t) => (
                              <label
                                key={t.key}
                                style={{ paddingLeft: t.kind === 'subtopic' ? 32 : 12 }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedKeys.has(t.key)}
                                  onChange={(e) => toggle(t, e.target.checked)}
                                />
                                <span>{t.title}</span>
                                <button
                                  type="button"
                                  className="text-link"
                                  onClick={() => openDocument(currentId, t.page, t.excerpt)}
                                >
                                  p. {t.page}
                                </button>
                              </label>
                            ))}
                          </div>
                        </NoticeFold>
                      );
                    })
                  ) : (
                    <p className="muted">
                      Nenhuma disciplina reconhecida no conteúdo programático. Confira o original.
                    </p>
                  )
                ) : savedRoots.length ? (
                  savedRoots.map((root) => {
                    const rows = comparison.filter(
                      (r) => disciplineKey(r.path[0]) === disciplineKey(root.title),
                    );
                    const studied = rows.filter((r) => r.status === 'studied').length;
                    return (
                      <NoticeFold key={root.id}>
                        <summary>
                          <span>{root.title}</span>
                          <small>
                            {studied}/{rows.length} tópicos estudados
                          </small>
                        </summary>
                        <div className="notice-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Conteúdo programático</th>
                                <th>Meus estudos</th>
                                <th>Origem</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row) => (
                                <tr key={row.item.id}>
                                  <td>
                                    {row.path.slice(1).join(' › ') || row.item.title}
                                    <SyllabusMatch item={row.item} />
                                  </td>
                                  <td>
                                    {coverageLabels[row.status as keyof typeof coverageLabels]}
                                  </td>
                                  <td>
                                    <button
                                      className="text-link"
                                      onClick={() =>
                                        openDocument(
                                          row.item.document_id,
                                          row.item.page,
                                          row.item.excerpt,
                                        )
                                      }
                                    >
                                      p. {row.item.page}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </NoticeFold>
                    );
                  })
                ) : (
                  <p className="muted">
                    Analise o documento para identificar as disciplinas do conteúdo programático.
                  </p>
                )}
              </Card>
            </div>
          )}
        </>
      )}
      {importing && (
        <ImportPdf
          initialKind="notice"
          onClose={() => setImporting(false)}
          onImported={(id) => {
            setSelected(id);
            setAnalysis(undefined);
            setTab('summary');
          }}
        />
      )}
      {editFact && (
        <Editor
          title={`Corrigir ${factLabels[editFact.field] || editFact.field}`}
          description={`Fonte: página ${editFact.page}. ${editFact.field === 'question_distribution' ? 'Use uma matéria ou grupo por linha: Direito Civil: 20 questões.' : ''}`}
          fields={[
            {
              key: 'value',
              label: 'Valor correto',
              required: true,
              type: ['schedule', 'question_distribution'].includes(editFact.field)
                ? 'textarea'
                : 'text',
            },
          ]}
          initial={{ value: editFact.value }}
          onClose={() => setEditFact(undefined)}
          onSave={async (v) => {
            await send(`/facts/${editFact.id}`, { value: v.value, status: 'corrected' }, 'PUT');
            await refresh();
            notify('Correção salva com histórico');
          }}
        />
      )}
    </>
  );
}
export function Reader({
  id,
  page: initialPage,
  excerpt,
  onClose,
}: {
  id: string;
  page?: number;
  excerpt?: string;
  onClose: () => void;
}) {
  const { state, refresh, notify, mutate, contest } = useApp();
  const [doc, setDoc] = useState<Document>(),
    [pdf, setPdf] = useState<pdfjs.PDFDocumentProxy>(),
    [page, setPage] = useState(initialPage || 1),
    [zoom, setZoom] = useState(1.1),
    [search, setSearch] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [ocrProgress, setOcrProgress] = useState(''),
    [log, setLog] = useState(false),
    [bookmark, setBookmark] = useState(false),
    [text, setText] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let canceled = false,
      loaded: pdfjs.PDFDocumentProxy | undefined;
    const task = pdfjs.getDocument({
      ...pdfOptions,
      url: `/api/documents/${id}/file`,
      httpHeaders: { 'X-Study-Client': 'cronograma' },
    });
    Promise.all([api<Document>(`/documents/${id}`), task.promise])
      .then(([d, p]) => {
        loaded = p;
        if (canceled) {
          task.destroy();
          return;
        }
        setDoc(d);
        setPdf(p);
        setPage(initialPage || d.resume_page);
      })
      .catch((e) => {
        if (!canceled) setError(e.message);
      });
    return () => {
      canceled = true;
      task.destroy();
    };
  }, [id, initialPage]);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let canceled = false;
    let task: pdfjs.RenderTask | undefined;
    setLoading(true);
    setError('');
    (async () => {
      const p = await pdf.getPage(page);
      if (canceled || !canvas.current) return;
      const viewport = p.getViewport({ scale: zoom });
      const c = canvas.current;
      c.width = viewport.width;
      c.height = viewport.height;
      task = p.render({ canvas: c, viewport });
      await task.promise;
      const content = await p.getTextContent();
      if (canceled) return;
      setText(textFromContent(content.items));
      const needle = (search || excerpt || '').toLocaleLowerCase();
      if (needle.length > 2) {
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = 'rgba(245,199,66,0.30)';
        for (const item of content.items) {
          if (!('str' in item) || item.str.trim().length < 3) continue;
          if (
            item.str.toLowerCase().includes(needle) ||
            needle.includes(item.str.trim().toLowerCase())
          ) {
            const tx = pdfjs.Util.transform(viewport.transform, item.transform);
            const h = Math.hypot(tx[2], tx[3]);
            ctx.fillRect(tx[4], tx[5] - h, item.width * zoom, h * 1.2);
          }
        }
      }
      setLoading(false);
    })().catch((e) => {
      if (!canceled) {
        setError(e.message);
        setLoading(false);
      }
    });
    return () => {
      canceled = true;
      task?.cancel();
    };
  }, [pdf, page, zoom, search, excerpt]);
  useEffect(() => {
    if (!doc) return;
    const timeout = setTimeout(
      () =>
        send(`/documents/${id}/position`, { page }, 'PUT').catch((e) => notify(e.message, true)),
      400,
    );
    return () => clearTimeout(timeout);
  }, [page, doc?.id, id, notify]);
  const close = () => {
    send(`/documents/${id}/position`, { page }, 'PUT')
      .then(() => refresh())
      .catch((e) => notify(e.message, true));
    onClose();
  };
  const results =
    search.length > 2
      ? doc?.text_pages.flatMap((p, i) =>
          p.toLocaleLowerCase().includes(search.toLocaleLowerCase()) ? [i + 1] : [],
        )
      : [];
  const bookmarks = state.bookmarks.filter((b) => b.document_id === id);
  const done = doc ? readPages(state.readings, id) : 0;
  return (
    <div className="reader-overlay" role="dialog" aria-modal="true" aria-label="Leitor de PDF">
      <header className="reader-header">
        <div>
          <FileText size={19} />
          <strong>{doc?.name || 'Abrindo documento…'}</strong>
        </div>
        <div className="row-actions">
          <Button
            variant="ghost"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
            aria-label="Diminuir zoom"
          >
            <ZoomOut size={18} />
          </Button>
          <span>{Math.round(zoom * 100)}%</span>
          <Button
            variant="ghost"
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
            aria-label="Aumentar zoom"
          >
            <ZoomIn size={18} />
          </Button>
          <Button variant="ghost" onClick={close} aria-label="Fechar leitor">
            <X size={21} />
          </Button>
        </div>
      </header>
      <div className="reader-body">
        <aside className="reader-sidebar">
          <div className="eyebrow">SUA LEITURA</div>
          <strong>
            {done} / {doc?.pages || '—'} páginas
          </strong>
          <Progress value={doc ? (done / doc.pages) * 100 : null} />
          <small>A página visualizada não é marcada como lida.</small>
          <Button onClick={() => setLog(true)} disabled={!doc}>
            <Check size={16} />
            Registrar leitura
          </Button>
          <Button variant="secondary" onClick={() => setBookmark(true)} disabled={!doc}>
            <BookmarkPlus size={16} />
            Anotar / marcar
          </Button>
          <label className="field">
            Pesquisar no documento
            <input
              value={search}
              placeholder="Digite pelo menos 3 letras"
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {results && results.length > 0 && (
            <div className="search-results">
              {results.map((p) => (
                <button key={p} onClick={() => setPage(p)}>
                  Página {p}
                </button>
              ))}
            </div>
          )}
          {search.length > 2 && !results?.length && (
            <small>Nenhuma ocorrência no texto extraído.</small>
          )}
          <h3>Marcadores e anotações</h3>
          {bookmarks.length ? (
            bookmarks.map((b) => (
              <button key={b.id} className="bookmark" onClick={() => setPage(b.page)}>
                <strong>Página {b.page}</strong>
                <span>{b.note || 'Marcador'}</span>
              </button>
            ))
          ) : (
            <p className="muted">Seus marcadores aparecerão aqui.</p>
          )}
          <h3>Sumário do PDF</h3>
          {doc?.outline?.length ? (
            <div className="outline-list">
              {(doc.outline as { title: string }[]).map((o, i) => (
                <div key={i}>{o.title}</div>
              ))}
            </div>
          ) : (
            <small>Sem marcadores de sumário no arquivo.</small>
          )}
          <Button
            variant="ghost"
            disabled={!!ocrProgress || loading}
            onClick={async () => {
              if (!canvas.current || !doc) return;
              try {
                setOcrProgress('Iniciando OCR…');
                const text = await ocrCanvas(canvas.current, (p) =>
                  setOcrProgress(`OCR local: ${Math.round(p * 100)}%`),
                );
                await send(`/documents/${id}/text`, { page, text }, 'PUT');
                setDoc({
                  ...doc,
                  text_pages: doc.text_pages.map((v, i) => (i === page - 1 ? text : v)),
                });
                setText(text);
                notify('Texto reconhecido e salvo');
              } catch (e) {
                notify((e as Error).message, true);
              } finally {
                setOcrProgress('');
              }
            }}
          >
            <ScanText size={16} />
            {ocrProgress || 'OCR desta página'}
          </Button>
        </aside>
        <section className="reader-stage">
          {excerpt && (
            <div className="source-excerpt">
              <strong>Conferir com o Edital Original</strong>
              <span>{excerpt}</span>
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}{' '}
          {loading && <div className="reader-loading">Renderizando página…</div>}
          <canvas ref={canvas} aria-label={`Página ${page} do documento`} />
          <details className="page-text">
            <summary>Texto da página (extração / OCR)</summary>
            <pre>{text || 'Página sem texto. Use o OCR local.'}</pre>
          </details>
        </section>
      </div>
      <footer className="reader-footer">
        <span>Posição salva automaticamente</span>
        <div className="row-actions">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft size={18} />
          </Button>
          <label>
            Página{' '}
            <input
              aria-label="Página atual"
              type="number"
              min={1}
              max={doc?.pages || 1}
              value={page}
              onChange={(e) => {
                const p = Number(e.target.value);
                if (p >= 1 && p <= (doc?.pages || 1)) setPage(p);
              }}
            />{' '}
            de {doc?.pages || '—'}
          </label>
          <Button
            variant="secondary"
            disabled={page >= (doc?.pages || 1)}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Próxima página"
          >
            <ChevronRight size={18} />
          </Button>
        </div>
        <span>Arquivo original preservado</span>
      </footer>
      {log && doc && (
        <Editor
          title="Registrar páginas estudadas"
          description="Intervalos sobrepostos são unidos. Uma leitura interrompida salva a posição e não conclui o intervalo."
          fields={[
            {
              key: 'start_page',
              label: 'Página inicial',
              type: 'number',
              min: 1,
              max: doc.pages,
              required: true,
            },
            {
              key: 'end_page',
              label: 'Página final',
              type: 'number',
              min: 1,
              max: doc.pages,
              required: true,
            },
            {
              key: 'resume_page',
              label: 'Página exata para retomar',
              type: 'number',
              min: 1,
              max: doc.pages,
              required: true,
            },
            {
              key: 'topic_id',
              label: 'Tópico relacionado',
              type: 'select',
              options: topicOptions(state.topics, doc.contest_id || contest?.id || ''),
            },
            { key: 'date', label: 'Data do estudo', type: 'date', required: true },
            { key: 'completed', label: 'Concluí o intervalo informado', type: 'checkbox' },
            { key: 'notes', label: 'Observações', type: 'textarea' },
          ]}
          initial={{
            start_page: page,
            end_page: page,
            resume_page: Math.min(page + 1, doc.pages),
            date: dayKey(),
            completed: true,
            topic_id: doc.topic_id || '',
          }}
          onClose={() => setLog(false)}
          onSave={async (v) => {
            await send('/readings', {
              ...v,
              document_id: id,
              topic_id: v.topic_id || null,
              completed: v.completed ? 1 : 0,
            });
            await refresh();
            notify('Leitura registrada');
          }}
        />
      )}
      {bookmark && (
        <Editor
          title="Anotação e marcador"
          fields={[{ key: 'note', label: `Anotação na página ${page}`, type: 'textarea' }]}
          onClose={() => setBookmark(false)}
          onSave={async (v) => {
            await send('/bookmarks', { document_id: id, page, note: v.note || '' });
            await refresh();
            notify('Marcador salvo');
          }}
        />
      )}
    </div>
  );
}

function SyllabusMatch({ item }: { item: SyllabusItem }) {
  const { state, mutate } = useApp();
  const [editing, setEditing] = useState(false),
    [topicId, setTopicId] = useState(item.topic_id || '');
  const matchingOptions = new Map(
    topicOptions(state.topics, item.contest_id, false).map((o) => [o.value, o.label]),
  );
  if (!editing)
    return (
      <div>
        <Button variant="ghost" onClick={() => setEditing(true)}>
          Associar a um tópico dos meus estudos
        </Button>
      </div>
    );
  return (
    <div className="row-actions">
      <select
        aria-label={`Associar ${item.title}`}
        value={topicId}
        onChange={(e) => setTopicId(e.target.value)}
      >
        <option value="">Selecione um conteúdo equivalente</option>
        {state.topics
          .filter(
            (t) =>
              t.contest_id === item.contest_id &&
              (t.kind === 'discipline') === (item.kind === 'discipline'),
          )
          .map((t) => (
            <option key={t.id} value={t.id}>
              {matchingOptions.get(t.id)}
            </option>
          ))}
      </select>
      <Button
        disabled={!topicId}
        onClick={async () => {
          const saved = await mutate(
            () => send(`/syllabus/${item.id}`, { topic_id: topicId }, 'PUT'),
            'Correspondência confirmada',
          );
          if (saved) setEditing(false);
        }}
      >
        Confirmar associação
      </Button>
      <Button variant="ghost" onClick={() => setEditing(false)}>
        Cancelar
      </Button>
    </div>
  );
}

function NoticeFold({ children }: { children: React.ReactNode[] }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="notice-fold" onToggle={(e) => setOpen(e.currentTarget.open)}>
      {children[0]}
      {open && children.slice(1)}
    </details>
  );
}
