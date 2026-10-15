import { useState } from 'react';
import { Check, ExternalLink } from 'lucide-react';
import { useApp } from '../lib/context';
import { send, formatDate } from '../lib/api';
import { overviewFields, parseQuestionDistribution } from '../../shared/notice-overview';
import { disciplineKey } from '../../shared/catalog';
import type { ExtractedFact } from '../../shared/analyzer';
import type { Fact } from '../../shared/types';
import { Button, Card, Badge, Modal } from './UI';
export type SummaryFact = ExtractedFact & {
  id?: string;
  document_id?: string;
  status?: Fact['status'];
};
function shortValue(field: string, value: string) {
  if (field === 'exam_date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  if (field === 'fee') return value.match(/R\$\s*[\d.,]+/)?.[0] || value;
  if (field === 'questions')
    return value.match(/(\d+)\s*(?:\([^)]*\)\s*)?quest[oõ]es/i)?.[1] || value;
  if (field === 'vacancies') return value.match(/(\d+)\s*(?:\([^)]*\)\s*)?vagas?/i)?.[1] || value;
  return value;
}
function safeUrl(value: string) {
  try {
    const u = new URL(value);
    return ['https:', 'http:'].includes(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
}
export function NoticeSummary({
  facts,
  documentId,
  disciplines,
  onCorrect,
}: {
  facts: SummaryFact[];
  documentId: string;
  disciplines: string[];
  onCorrect: (f: Fact) => void;
}) {
  const { openDocument, mutate } = useApp();
  const [inspecting, setInspecting] = useState<string>();
  const rows = (field: string) => facts.filter((f) => f.field === field && f.status !== 'rejected');
  const primary = (field: string) => {
    const list = rows(field),
      currentDocument = list[0]?.document_id;
    const priority = (f: SummaryFact) =>
      f.status === 'corrected' ? 3 : f.status === 'confirmed' ? 2 : 0;
    return list
      .filter((f) => f.document_id === currentDocument)
      .sort((a, b) => priority(b) - priority(a) || b.confidence - a.confidence)[0];
  };
  const distribution = rows('question_distribution').flatMap((f) =>
    parseQuestionDistribution(f.value).map((r) => ({ ...r, source: f })),
  );
  const subjects = distribution.filter(
    (r, i, all) =>
      all.findIndex((other) => disciplineKey(other.subject) === disciplineKey(r.subject)) === i,
  );
  const missing = disciplines.filter(
    (d) => !subjects.some((r) => disciplineKey(r.subject) === disciplineKey(d)),
  );
  return (
    <>
      <Card className="section-gap notice-summary-card">
        <p className="muted">
          Os dados essenciais para sua inscrição e preparação. Abra “Conferir” para consultar a
          fonte ou corrigir um valor.
        </p>
        <div className="notice-facts-grid">
          {Object.entries(overviewFields).map(([field, label]) => {
            const f = primary(field),
              url = field === 'registration_url' && f ? safeUrl(f.value) : undefined;
            return (
              <article className="notice-fact" key={field} aria-label={label}>
                <span className="eyebrow">{label}</span>
                <strong className="notice-fact-value">
                  {f ? (
                    url ? (
                      <a href={url} target="_blank" rel="noreferrer">
                        Acessar página de inscrição <ExternalLink size={14} />
                      </a>
                    ) : (
                      shortValue(field, f.value)
                    )
                  ) : field === 'exam_date' && rows('schedule').length ? (
                    'Consulte o cronograma abaixo'
                  ) : (
                    'Não identificado no documento'
                  )}
                </strong>
                {f && (
                  <div className="row-actions">
                    <Badge
                      tone={
                        f.status === 'confirmed' || f.status === 'corrected' ? 'green' : 'amber'
                      }
                    >
                      {f.status === 'confirmed' || f.status === 'corrected'
                        ? 'Conferido'
                        : 'A conferir'}
                    </Badge>
                    <Button variant="ghost" onClick={() => setInspecting(field)}>
                      Conferir {label.toLocaleLowerCase('pt-BR')}
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
        {!!rows('schedule').length && (
          <details className="notice-fold">
            <summary>
              Cronograma · {rows('schedule').reduce((n, f) => n + f.value.split('\n').length, 0)}{' '}
              {rows('schedule').reduce((n, f) => n + f.value.split('\n').length, 0) === 1
                ? 'evento'
                : 'eventos'}
            </summary>
            <div className="notice-scroll">
              <ul>
                {rows('schedule').flatMap((f, i) =>
                  f.value.split('\n').map((line, j) => <li key={`${i}:${j}`}>{line}</li>),
                )}
              </ul>
            </div>
            <Button variant="ghost" onClick={() => setInspecting('schedule')}>
              Conferir cronograma
            </Button>
          </details>
        )}
        <div className="notice-subject-summary">
          <div className="section-heading">
            <h3>Matérias e quantidade de questões</h3>
            {!!distribution.length && (
              <Button variant="ghost" onClick={() => setInspecting('question_distribution')}>
                Conferir distribuição
              </Button>
            )}
          </div>
          {subjects.length || missing.length ? (
            <>
              <div className="notice-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Matéria / grupo previsto no edital</th>
                      <th>Questões</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((r) => (
                      <tr key={disciplineKey(r.subject)}>
                        <td>{r.subject}</td>
                        <td>
                          <strong>{r.questions}</strong>
                        </td>
                      </tr>
                    ))}
                    {missing.map((title) => (
                      <tr key={title}>
                        <td>{title}</td>
                        <td className="muted">Não identificada por matéria</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {subjects.some((r) => /bloco|grupo|;|\s[eE]\s/.test(r.subject)) && (
                <p className="footnote">
                  Quantidades atribuídas a um bloco de matérias são mostradas como grupo, sem
                  repartir questões por estimativa.
                </p>
              )}
            </>
          ) : (
            <p className="muted">
              A distribuição de questões ainda não foi identificada. Consulte o quadro de provas do
              edital.
            </p>
          )}
        </div>
      </Card>
      {inspecting && (
        <Modal
          title={`Conferir ${overviewFields[inspecting as keyof typeof overviewFields] || (inspecting === 'schedule' ? 'cronograma' : 'distribuição de questões')}`}
          onClose={() => setInspecting(undefined)}
        >
          {rows(inspecting).length > 1 && (
            <p className="warning-text">
              Há mais de um registro. Confira as fontes antes de confirmar o valor aplicável ao seu
              cargo.
            </p>
          )}
          <div className="notice-source-list">
            {rows(inspecting).map((f, i) => (
              <article key={f.id || i}>
                <p className="notice-original-value">{f.value}</p>
                <Button
                  variant="ghost"
                  onClick={() => openDocument(f.document_id || documentId, f.page, f.excerpt)}
                >
                  Ver página {f.page} no edital
                </Button>
                <details>
                  <summary>Trecho original e histórico</summary>
                  <p className="notice-original-value">{f.excerpt}</p>
                  {'previous_value' in f && !!f.previous_value && (
                    <p>Anterior: {String(f.previous_value)}</p>
                  )}
                </details>
                {f.id ? (
                  <div className="row-actions">
                    {f.status === 'pending' && (
                      <Button
                        onClick={() =>
                          mutate(
                            () =>
                              send(
                                `/facts/${f.id}`,
                                { value: f.value, status: 'confirmed' },
                                'PUT',
                              ),
                            'Informação confirmada',
                          )
                        }
                      >
                        <Check size={14} />
                        Confirmar
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() => {
                        onCorrect(f as Fact);
                        setInspecting(undefined);
                      }}
                    >
                      Corrigir
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        mutate(
                          () =>
                            send(`/facts/${f.id}`, { value: f.value, status: 'rejected' }, 'PUT'),
                          'Sugestão descartada',
                        )
                      }
                    >
                      Descartar
                    </Button>
                  </div>
                ) : (
                  <p className="footnote">Salve a análise para confirmar ou corrigir este dado.</p>
                )}
              </article>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
