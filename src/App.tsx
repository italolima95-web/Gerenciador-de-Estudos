import { useCallback, useEffect, useState } from 'react';
import {
  House,
  Trophy,
  ScanText,
  Repeat2,
  Layers3,
  LibraryBig,
  Timer,
  ChartNoAxesCombined,
  ClipboardCheck,
  CalendarCheck,
  ShieldCheck,
  CalendarDays,
  Settings,
  ChartPie,
  GraduationCap,
  Sun,
  Moon,
  ChevronDown,
  PanelLeftClose,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { Context, type Page } from './lib/context';
import { api, send } from './lib/api';
import type { State, Timer as TimerState } from '../shared/types';
import { dayKey } from '../shared/domain';
import { Button } from './components/UI';
import Dashboard from './components/Dashboard';
import Contests from './components/Contests';
import Curriculum from './components/Curriculum';
import { Library, NoticeAnalysis, Reader } from './components/Documents';
import { Practice, Mocks } from './components/Practice';
import { Cycle, Pomodoro, Reviews } from './components/Study';
import { Habits, Readiness, Statistics, Preferences } from './components/Insights';
const menu: { page: Page; icon: typeof House; group: string }[] = [
  { page: 'Início', icon: House, group: 'SEU ESPAÇO' },
  { page: 'Meus Concursos', icon: Trophy, group: '' },
  { page: 'Analisar Edital', icon: ScanText, group: '' },
  { page: 'Meu Ciclo', icon: Repeat2, group: 'ESTUDAR' },
  { page: 'Disciplinas', icon: Layers3, group: '' },
  { page: 'Biblioteca de PDFs', icon: LibraryBig, group: '' },
  { page: 'Pomodoro', icon: Timer, group: '' },
  { page: 'Questões e Desempenho', icon: ChartNoAxesCombined, group: 'ACOMPANHAR' },
  { page: 'Simulados', icon: ClipboardCheck, group: '' },
  { page: 'Revisões', icon: CalendarCheck, group: '' },
  { page: 'Prontidão para a Prova', icon: ShieldCheck, group: '' },
  { page: 'Meus Hábitos', icon: CalendarDays, group: '' },
  { page: 'Estatísticas', icon: ChartPie, group: '' },
  { page: 'Configurações', icon: Settings, group: 'PREFERÊNCIAS' },
];
export default function App() {
  const [state, setState] = useState<State>(),
    [selected, setSelected] = useState(''),
    [page, setPage] = useState<Page>('Início'),
    [error, setError] = useState(''),
    [toast, setToast] = useState<{ text: string; error: boolean }>(),
    [collapsed, setCollapsed] = useState(false),
    [reader, setReader] = useState<{ id: string; page?: number; excerpt?: string }>();
  const refresh = useCallback(async () => {
    const data = await api<State>('/state');
    setState(data);
    setSelected((prev) =>
      data.contests.some((c) => c.id === prev)
        ? prev
        : data.contests.find((c) => c.main)?.id || data.contests[0]?.id || '',
    );
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page, selected]);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(undefined), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    document.documentElement.dataset.theme = String(state?.preferences.theme || 'light');
  }, [state?.preferences.theme]);
  const notify = useCallback((text: string, error = false) => setToast({ text, error }), []);
  const timerState = state?.preferences.timer as TimerState | undefined;
  useEffect(() => {
    if (!timerState?.running || !timerState.deadline) return;
    let finishing = false;
    const interval = setInterval(async () => {
      if (finishing || Date.now() < timerState.deadline!) return;
      finishing = true;
      try {
        await send('/timer/finish', {
          interrupted: false,
          expected_revision: timerState.revision,
          expected_mode: timerState.mode,
          expected_deadline: timerState.deadline,
        });
        await refresh();
        const message =
          timerState.mode === 'focus'
            ? 'Sessão de foco concluída. Tempo salvo!'
            : 'Pausa concluída. Pronto para continuar?';
        notify(message);
        if (
          state?.preferences.notifications &&
          'Notification' in window &&
          Notification.permission === 'granted'
        )
          new Notification('Cronograma de Estudos', { body: message });
        try {
          const audio = new AudioContext();
          const osc = audio.createOscillator(),
            gain = audio.createGain();
          gain.gain.value = 0.07;
          osc.frequency.value = 660;
          osc.connect(gain);
          gain.connect(audio.destination);
          osc.start();
          osc.stop(audio.currentTime + 0.25);
          osc.onended = () => audio.close();
        } catch {}
      } catch (e) {
        await refresh().catch(() => {});
        notify((e as Error).message, true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [timerState, refresh, notify, state?.preferences.notifications]);
  const mutate = useCallback(
    async <T,>(fn: () => Promise<T>, success = 'Salvo automaticamente') => {
      try {
        const result = await fn();
        await refresh();
        if (success) notify(success);
        return result;
      } catch (e) {
        notify((e as Error).message, true);
        return undefined;
      }
    },
    [refresh, notify],
  );
  if (!state)
    return (
      <div className="loading-screen">
        <GraduationCap size={44} />
        <h2>Cronograma de Estudos</h2>
        <p>{error || 'Abrindo seu espaço de estudos…'}</p>
        {error && (
          <Button
            onClick={() => {
              setError('');
              refresh().catch((e) => setError(e.message));
            }}
          >
            Tentar novamente
          </Button>
        )}
      </div>
    );
  const contest = state.contests.find((c) => c.id === selected);
  const due = state.reviews.filter(
    (r) => r.contest_id === selected && !r.completed_at && r.due_date <= dayKey(),
  ).length;
  const screens: Record<Page, React.ReactNode> = {
    Início: <Dashboard />,
    'Meus Concursos': <Contests />,
    'Analisar Edital': <NoticeAnalysis />,
    'Meu Ciclo': <Cycle />,
    Disciplinas: <Curriculum />,
    'Biblioteca de PDFs': <Library />,
    Pomodoro: <Pomodoro />,
    'Questões e Desempenho': <Practice />,
    Simulados: <Mocks />,
    Revisões: <Reviews />,
    'Prontidão para a Prova': <Readiness />,
    'Meus Hábitos': <Habits />,
    Estatísticas: <Statistics />,
    Configurações: <Preferences />,
  };
  return (
    <Context.Provider
      value={{
        state,
        contest,
        selected,
        select: setSelected,
        refresh,
        mutate,
        notify,
        navigate: setPage,
        openDocument: (id, page, excerpt) => setReader({ id, page, excerpt }),
      }}
    >
      <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <aside className="sidebar">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setPage('Início');
            }}
          >
            <div className="brand-mark">
              <GraduationCap size={25} />
            </div>
            <span>
              Cronograma<span>DE ESTUDOS</span>
            </span>
          </a>
          <div className="workspace-label">
            <span className="status-dot" />
            Seu espaço de preparação
          </div>
          <nav aria-label="Menu principal">
            {menu.map(({ page: p, icon: Icon, group }) => (
              <div key={p}>
                {group && <div className="nav-group">{group}</div>}
                <button
                  className={`nav-item ${page === p ? 'active' : ''}`}
                  title={p}
                  onClick={() => setPage(p)}
                >
                  <Icon size={19} />
                  <span>{p}</span>
                  {p === 'Revisões' && due > 0 && <b>{due}</b>}
                </button>
              </div>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="local-note">
              <ShieldCheck size={17} />
              <div>
                Seus dados, com você.<small>Armazenamento local · Offline</small>
              </div>
            </div>
            <button
              className="collapse-btn"
              onClick={() => setCollapsed(!collapsed)}
              aria-label="Alternar menu"
            >
              <PanelLeftClose size={18} />
              <span>Recolher menu</span>
            </button>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              Meu espaço <span>/</span>
              <strong>{page}</strong>
            </div>
            <div className="topbar-right">
              <div className="contest-picker">
                <Trophy size={16} />
                <select
                  aria-label="Concurso selecionado"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {state.contests.length ? (
                    state.contests.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))
                  ) : (
                    <option value="">Nenhum concurso</option>
                  )}
                </select>
                <ChevronDown size={14} />
              </div>
              <Button
                variant="ghost"
                aria-label="Alternar tema"
                onClick={() =>
                  mutate(
                    () =>
                      send(
                        '/preferences/theme',
                        { value: state.preferences.theme === 'dark' ? 'light' : 'dark' },
                        'PUT',
                      ),
                    'Tema atualizado',
                  )
                }
              >
                {state.preferences.theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
              </Button>
              <div className="avatar">EU</div>
            </div>
          </header>
          <main key={`${page}:${selected}`} className="page-content">
            {screens[page]}
          </main>
          <footer className="page-footer">
            <span>
              <span className="status-dot" />
              Dados salvos neste computador
            </span>
            <span>Um passo de cada vez. Todos os dias.</span>
          </footer>
        </div>
      </div>
      {reader && <Reader {...reader} onClose={() => setReader(undefined)} />}{' '}
      {toast && (
        <div
          className={`toast ${toast.error ? 'error' : ''}`}
          role={toast.error ? 'alert' : 'status'}
        >
          {toast.error ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}
          <span>{toast.text}</span>
          <button aria-label="Dispensar" onClick={() => setToast(undefined)}>
            <X size={16} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
