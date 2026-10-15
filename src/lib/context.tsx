import { createContext, useContext } from 'react';
import type { Contest, State } from '../../shared/types';
export type Page =
  | 'Início'
  | 'Meus Concursos'
  | 'Analisar Edital'
  | 'Meu Ciclo'
  | 'Disciplinas'
  | 'Biblioteca de PDFs'
  | 'Pomodoro'
  | 'Questões e Desempenho'
  | 'Simulados'
  | 'Revisões'
  | 'Prontidão para a Prova'
  | 'Meus Hábitos'
  | 'Estatísticas'
  | 'Configurações';
export type AppContext = {
  state: State;
  contest: Contest | undefined;
  selected: string;
  select: (id: string) => void;
  refresh: () => Promise<void>;
  mutate: <T = unknown>(fn: () => Promise<T>, success?: string) => Promise<T | undefined>;
  notify: (message: string, error?: boolean) => void;
  navigate: (page: Page) => void;
  openDocument: (id: string, page?: number, excerpt?: string) => void;
};
export const Context = createContext<AppContext>(null!);
export const useApp = () => useContext(Context);
