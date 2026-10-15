import { syllabusCoverage } from '../../shared/comparison';
import { useState } from 'react';
import {
  ArrowUpRight,
  Play,
  Plus,
  Target,
  BookOpen,
  CalendarCheck,
  Clock,
  Check,
  ArrowRight,
  Repeat2,
  Flame,
  FileText,
  GraduationCap,
  ChevronRight,
  CalendarDays,
  Layers3,
  Timer,
} from 'lucide-react';
import { useApp } from '../lib/context';
import { pct, duration, formatDate, send } from '../lib/api';
import {
  coverage,
  statistics,
  reviewStats,
  recommendations,
  dayKey,
  planning,
  contestSessions,
} from '../../shared/domain';
import { StudyEntry } from './Study';
import { ContestEditor } from './Contests';
import { AttemptEditor } from './Practice';
import { Button, Card, PageTitle, Metric, Progress, Badge, TextLink, Empty, Editor } from './UI';
export function Recommendations({ limit = 5 }: { limit?: number }) {
  const { state, contest, mutate, navigate, openDocument } = useApp();
  if (!contest) return null;
  const items = recommendations(state, contest).slice(0, limit);
  return (
    <div className="recommendations">
      {items.length ? (
        items.map((r, i) => {
          const mapping = state.mappings.find((m) => m.topic_id === r.topic.id && m.confirmed);
          return (
            <div className="recommendation" key={r.topic.id}>
              <div className="recommendation-index">{String(i + 1).padStart(2, '0')}</div>
              <div className="recommendation-main">
                <h3>{r.topic.title}</h3>
                <p>{r.action}</p>
                <div className="recommendation-reasons">
                  {r.reasons.map((reason) => (
                    <span key={reason}>{reason}</span>
                  ))}
                </div>
                <div className="recommendation-actions">
                  <Button
                    variant="ghost"
                    onClick={() =>
                      openDocument(r.source.document_id, r.source.page, r.source.excerpt)
                    }
                  >
                    Ver exigência no edital
                  </Button>
                  <Button variant="ghost" onClick={() => navigate('Revisões')}>
                    Revisar
                  </Button>
                  <Button variant="ghost" onClick={() => navigate('Questões e Desempenho')}>
                    Resolver questões
                  </Button>
                  {mapping && (
                    <Button
                      variant="ghost"
                      onClick={() => openDocument(mapping.document_id, mapping.start_page)}
                    >
                      Abrir material
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() =>
                      mutate(
                        () =>
                          send('/blocks', {
                            contest_id: contest.id,
                            topic_id: r.topic.id,
                            title: r.topic.title,
                            minutes: 25,
                            kind: r.action.startsWith('Revisar') ? 'review' : 'theory',
                            position: state.blocks.filter((b) => b.contest_id === contest.id)
                              .length,
                          }),
                        'Bloco adicionado ao ciclo por sua escolha',
                      )
                    }
                  >
                    <Plus size={13} />
                    Ciclo
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      mutate(
                        () =>
                          send(
                            '/preferences/ignored_recommendations',
                            {
                              value: [
                                ...((state.preferences.ignored_recommendations as string[]) || []),
                                r.topic.id,
                              ],
                            },
                            'PUT',
                          ),
                        'Recomendação ignorada',
                      )
                    }
                  >
                    Ignorar
                  </Button>
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <div className="subtle-empty">
          <Target size={23} />
          <p>
            Sem lacunas identificadas. Se ainda não adicionou um edital, cadastre suas disciplinas e
            estude normalmente; a comparação será habilitada após a análise do conteúdo
            programático.
          </p>
        </div>
      )}
      <p className="footnote">
        Comparação exclusiva entre os tópicos do conteúdo programático do edital e os estudos
        registrados. Nenhuma recomendação altera seu ciclo automaticamente.
      </p>
    </div>
  );
}
export default function Dashboard() {
  const { state, contest, navigate, mutate, openDocument } = useApp();
  const [logging, setLogging] = useState(false),
    [newContest, setNewContest] = useState(false),
    [questions, setQuestions] = useState(false);
  const today = dayKey();
  const topics = state.topics.filter((t) => t.contest_id === contest?.id),
    cov = syllabusCoverage(state, contest?.id || '');
  const stats = statistics(state.attempts, state.attempt_links, state.topics, {
    contestId: contest?.id || '',
  });
  const reviews = state.reviews.filter((r) => r.contest_id === contest?.id),
    rs = reviewStats(reviews);
  const blocks = state.blocks
      .filter((b) => b.contest_id === contest?.id)
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)),
    cycle = state.cycles.find((c) => c.contest_id === contest?.id),
    block = blocks.find((b) => b.id === cycle?.block_id) || blocks[0];
  const sessions = contestSessions(state, contest?.id || ''),
    todayMinutes = sessions.filter((s) => s.date === today).reduce((s, x) => s + x.minutes, 0);
  const rec = contest ? recommendations(state, contest)[0] : null;
  const plan = contest ? planning(contest, topics, state.mappings, state.readings) : null;
  const docs = state.documents.filter(
    (d) => d.kind === 'material' && (!d.contest_id || d.contest_id === contest?.id),
  );
  const latestReading = state.readings
    .filter((r) => docs.some((d) => d.id === r.document_id))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const lastDoc = docs.find((d) => d.id === latestReading?.document_id) || docs[0];
  const due = reviews
    .filter((r) => !r.completed_at && r.due_date <= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  return (
    <>
      <PageTitle
        eyebrow={new Date()
          .toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
          .toUpperCase()}
        title="Um novo dia para avançar."
        description="Seu próximo objetivo fica mais perto a cada sessão de estudo."
        action={
          <Button
            variant="secondary"
            onClick={() => (contest ? setLogging(true) : setNewContest(true))}
          >
            <Plus size={17} />
            {contest ? 'Registrar estudo' : 'Novo concurso'}
          </Button>
        }
      />
      <section className="study-hero">
        <div className="hero-content">
          <div className="hero-eyebrow">
            <span className="hero-dot" />
            {contest ? 'SEU PRÓXIMO PASSO' : 'SEU FUTURO COMEÇA NO PRESENTE'}
          </div>
          <h2>
            {contest
              ? block?.title || rec?.topic.title || 'Vamos construir seu plano?'
              : 'Grandes conquistas.\nPequenos passos diários.'}
          </h2>
          <p>
            {contest
              ? block
                ? `${state.topics.find((t) => t.id === block.topic_id)?.title || contest.name} · ${duration(block.minutes)} de ${block.kind === 'theory' ? 'teoria' : block.kind === 'questions' ? 'questões' : 'estudo'}`
                : rec
                  ? 'Uma prioridade sugerida com base nos seus registros.'
                  : 'Cadastre as disciplinas que você estuda e monte seu ciclo. O edital é opcional.'
              : 'Comece pelas suas disciplinas, monte um ciclo e registre seus estudos. Depois, se desejar, adicione um edital para comparar o conteúdo.'}
          </p>
          <div className="hero-actions">
            <button
              className="hero-button"
              onClick={() => {
                if (!contest) navigate('Disciplinas');
                else navigate(block ? 'Meu Ciclo' : 'Disciplinas');
              }}
            >
              {contest ? <Play size={16} /> : <Plus size={16} />}{' '}
              {contest
                ? block
                  ? 'Iniciar estudo'
                  : 'Organizar meus estudos'
                : 'Cadastrar minhas disciplinas'}
              <ArrowUpRight size={17} />
            </button>
            {!contest && (
              <button className="hero-secondary" onClick={() => setNewContest(true)}>
                Cadastrar meu primeiro concurso
              </button>
            )}
            {lastDoc && (
              <button
                className="hero-secondary"
                onClick={() => openDocument(lastDoc.id, lastDoc.resume_page)}
              >
                <BookOpen size={16} />
                Retomar leitura
              </button>
            )}
          </div>
          {contest && (
            <div className="hero-meta">
              <TrophySmall />
              {contest.name}
              <span>·</span>
              {plan ? `${plan.days} dias até a prova` : 'Data da prova não informada'}
            </div>
          )}
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-dot one" />
          <div className="art-dot two" />
          <div className="art-book">
            <div className="book-spine" />
            <div className="book-label">
              <GraduationCap size={32} />
              <span>
                UM PASSO
                <br />
                DE CADA VEZ.
              </span>
              <div className="book-rule" />
            </div>
          </div>
          <div className="art-sticker">
            <Check size={19} />
            <span>
              Constância
              <br />
              <strong>transforma.</strong>
            </span>
          </div>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <h2>Sua preparação, em perspectiva</h2>
          <p>Três dimensões independentes do seu progresso.</p>
        </div>
        <TextLink onClick={() => navigate('Prontidão para a Prova')}>Ver prontidão</TextLink>
      </div>
      <div className="metrics-grid dashboard-metrics">
        <Metric
          label="Cobertura do edital"
          value={pct(cov.percent)}
          description={`${cov.studied} de ${cov.total} tópicos concluídos`}
          icon={<BookOpen size={20} />}
        />
        <Metric
          label="Revisões realizadas"
          value={pct(rs.percent)}
          description={`${rs.done} concluídas · ${rs.pending} pendentes`}
          icon={<CalendarCheck size={20} />}
          color="blue"
        />
        <Metric
          label="Taxa de acertos"
          value={pct(stats.accuracy)}
          description={`${stats.correct} acertos em ${stats.answered} respondidas`}
          icon={<Target size={20} />}
          color="amber"
        />
        <Metric
          label="Estudo de hoje"
          value={duration(todayMinutes)}
          description={
            contest
              ? `Meta diária: ${duration(contest.daily_minutes)}`
              : 'Seu tempo de foco aparece aqui'
          }
          icon={<Clock size={20} />}
        />
      </div>
      <div className="dashboard-columns">
        <div>
          <Card
            title="Seu plano, agora"
            action={<TextLink onClick={() => navigate('Meu Ciclo')}>Meu ciclo</TextLink>}
          >
            {blocks.length ? (
              <div className="today-blocks">
                {blocks.slice(0, 4).map((b, i) => (
                  <div key={b.id} className={b.id === block?.id ? 'selected' : ''}>
                    <div className="plan-node">
                      {b.id === block?.id ? <Play size={15} /> : String(i + 1).padStart(2, '0')}
                    </div>
                    <div>
                      <strong>{b.title}</strong>
                      <small>
                        {b.kind === 'theory'
                          ? 'Teoria'
                          : b.kind === 'questions'
                            ? 'Questões'
                            : b.kind === 'cycle_questions'
                              ? 'Exercícios do Ciclo'
                              : b.kind === 'review'
                                ? 'Revisão'
                                : 'Simulado'}{' '}
                        · {duration(b.minutes)}
                      </small>
                    </div>
                    {b.id === block?.id ? (
                      <Badge tone="green">Próximo</Badge>
                    ) : (
                      <span className="muted">No ciclo</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="setup-steps">
                {[
                  {
                    n: '01',
                    title: 'Escolha suas disciplinas',
                    text: 'Cadastre o que você já está estudando.',
                    done: topics.length > 0,
                    action: () => navigate('Disciplinas'),
                  },
                  {
                    n: '02',
                    title: 'Compare com um edital, se desejar',
                    text: 'Etapa opcional: confira o conteúdo exigido.',
                    done: !!state.syllabus_items?.some(
                      (i) => i.contest_id === contest?.id && i.active,
                    ),
                    action: () => navigate('Analisar Edital'),
                  },
                  {
                    n: '03',
                    title: 'Encontre seu ritmo',
                    text: 'Monte um ciclo e comece a estudar.',
                    done: blocks.length > 0,
                    action: () => navigate('Meu Ciclo'),
                  },
                ].map((s) => (
                  <button key={s.n} onClick={s.action}>
                    <span className={`setup-number ${s.done ? 'done' : ''}`}>
                      {s.done ? <Check size={17} /> : s.n}
                    </span>
                    <div>
                      <strong>{s.title}</strong>
                      <small>{s.text}</small>
                    </div>
                    <ChevronRight size={17} />
                  </button>
                ))}
              </div>
            )}
            <div className="card-bottom">
              <span>
                <Repeat2 size={15} />
                {cycle?.lap || 0} voltas no ciclo
              </span>
              <Button variant="ghost" onClick={() => navigate('Meu Ciclo')}>
                Organizar ciclo
                <ArrowRight size={15} />
              </Button>
            </div>
          </Card>
          <Card
            title="Pontos que precisam de atenção"
            className="section-gap"
            action={
              <span className="small-icon">
                <Target size={18} />
              </span>
            }
          >
            <Recommendations limit={3} />
          </Card>
        </div>
        <div>
          <Card title="Meta de hoje" className="goal-card">
            <div className="goal-value">
              <strong>{duration(todayMinutes)}</strong>
              <span>de {duration(contest?.daily_minutes || 0)}</span>
            </div>
            <Progress
              value={contest ? Math.min(100, (todayMinutes / contest.daily_minutes) * 100) : null}
            />
            <p>
              {todayMinutes > 0
                ? 'Você já deu um passo hoje. Continue no seu ritmo.'
                : 'Reserve um momento para o seu futuro.'}
            </p>
            <Button variant="secondary" onClick={() => navigate('Pomodoro')}>
              <Timer size={16} />
              Abrir Pomodoro
            </Button>
          </Card>
          <Card
            title="Hora de revisar"
            className="section-gap"
            action={<Badge tone={due.length ? 'amber' : 'neutral'}>{due.length} pendentes</Badge>}
          >
            {due.length ? (
              <div className="compact-reviews">
                {due.slice(0, 3).map((r) => (
                  <button key={r.id} onClick={() => navigate('Revisões')}>
                    <CalendarCheck size={18} />
                    <span>
                      <strong>{state.topics.find((t) => t.id === r.topic_id)?.title}</strong>
                      <small>
                        {r.due_date < today ? 'Vencida · ' : ''}
                        {formatDate(r.due_date)}
                      </small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="subtle-empty">
                <CalendarCheck size={25} />
                <p>Nenhuma revisão pendente para hoje.</p>
              </div>
            )}
            <TextLink onClick={() => navigate('Revisões')}>Ver todas as revisões</TextLink>
          </Card>
          <Card title="Pratique para evoluir" className="practice-prompt section-gap">
            <p>Uma sessão de questões mostra o que você aprendeu e o que merece outra visita.</p>
            <Button
              variant="secondary"
              onClick={() => (contest ? setQuestions(true) : setNewContest(true))}
            >
              <Plus size={16} />
              Registrar questões
            </Button>
          </Card>
        </div>
      </div>
      <div className="motivation-note">
        <Flame size={18} />
        <span>Progresso é o resultado dos pequenos esforços que você repete.</span>
      </div>
      {logging && <StudyEntry block={block} onClose={() => setLogging(false)} />}{' '}
      {newContest && <ContestEditor onClose={() => setNewContest(false)} />}{' '}
      {questions && <AttemptEditor onClose={() => setQuestions(false)} />}
    </>
  );
}
function TrophySmall() {
  return <GraduationCap size={16} />;
}
