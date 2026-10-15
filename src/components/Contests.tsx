import { useState } from 'react';
import {
  Plus,
  Trophy,
  CalendarDays,
  ArrowUpRight,
  Star,
  Pencil,
  Trash2,
  FileText,
} from 'lucide-react';
import { useApp } from '../lib/context';
import { send, formatDate } from '../lib/api';
import { factLabels } from '../../shared/analyzer';
import type { Contest } from '../../shared/types';
import { Button, Card, PageTitle, Empty, Editor, Badge, type Field, type Values } from './UI';
export const contestFields: Field[] = [
  {
    key: 'name',
    label: 'Nome do concurso',
    required: true,
    placeholder: 'Ex.: Tribunal Regional — Analista',
  },
  { key: 'role', label: 'Cargo / especialidade' },
  { key: 'board', label: 'Banca organizadora' },
  { key: 'exam_date', label: 'Data da prova', type: 'date' },
  { key: 'target', label: 'Meta de acertos (%)', type: 'number', min: 1, max: 100, required: true },
  {
    key: 'min_sample',
    label: 'Amostra mínima de questões',
    type: 'number',
    min: 1,
    required: true,
  },
  {
    key: 'daily_minutes',
    label: 'Minutos de estudo por dia',
    type: 'number',
    min: 1,
    max: 1440,
    required: true,
  },
  {
    key: 'topic_minutes',
    label: 'Estimativa de minutos por tópico',
    type: 'number',
    min: 1,
    required: true,
  },
  {
    key: 'question_goal',
    label: 'Meta diária de questões',
    type: 'number',
    min: 0,
    required: true,
  },
  { key: 'main', label: 'Definir como concurso principal', type: 'checkbox' },
];
export function ContestEditor({ value, onClose }: { value?: Contest; onClose: () => void }) {
  const { refresh, notify, select } = useApp();
  return (
    <Editor
      title={value ? 'Editar concurso' : 'Novo concurso'}
      fields={contestFields}
      initial={
        value
          ? { ...value, main: !!value.main, metadata: '' }
          : {
              target: 80,
              min_sample: 20,
              daily_minutes: 120,
              topic_minutes: 60,
              question_goal: 20,
              main: false,
            }
      }
      onClose={onClose}
      onSave={async (v) => {
        const result = await send<{ id: string }>(
          value ? `/contests/${value.id}` : '/contests',
          {
            ...v,
            main: v.main ? 1 : 0,
            metadata: value?.metadata || {},
            rest_days: value?.rest_days || '[0]',
          },
          value ? 'PUT' : 'POST',
        );
        await refresh();
        if (!value) select(result.id);
        notify('Concurso salvo');
      }}
    />
  );
}
export default function Contests() {
  const { state, contest, select, mutate, navigate } = useApp();
  const [editor, setEditor] = useState<Contest | 'new'>(),
    [details, setDetails] = useState<Contest>();
  return (
    <>
      <PageTitle
        eyebrow="SEUS OBJETIVOS"
        title="Meus concursos"
        description="Cada objetivo tem seu caminho. Organize todos em um só lugar."
        action={
          <Button onClick={() => setEditor('new')}>
            <Plus size={18} />
            Novo concurso
          </Button>
        }
      />
      {!state.contests.length ? (
        <Empty
          icon={<Trophy size={30} />}
          title="Seu próximo objetivo começa aqui"
          description="Cadastre um concurso para organizar o edital, os materiais e seu plano de estudos."
          action={
            <Button onClick={() => setEditor('new')}>
              Cadastrar primeiro concurso
              <ArrowUpRight size={17} />
            </Button>
          }
        />
      ) : (
        <div className="contest-grid">
          {state.contests.map((c) => (
            <Card key={c.id} className={`contest-card ${c.id === contest?.id ? 'selected' : ''}`}>
              <div className="contest-card-top">
                <div className="square-icon">
                  <Trophy size={22} />
                </div>
                {c.main ? (
                  <Badge tone="green">
                    <Star size={12} />
                    Principal
                  </Badge>
                ) : (
                  <Button
                    variant="ghost"
                    title="Definir como principal"
                    onClick={() =>
                      mutate(() => send(`/contests/${c.id}`, { ...c, main: 1 }, 'PUT'))
                    }
                  >
                    <Star size={17} />
                  </Button>
                )}
              </div>
              <h2>{c.name}</h2>
              <p>{c.role || 'Cargo não informado'}</p>
              <div className="contest-info">
                <span>
                  Banca<strong>{c.board || 'Não informado'}</strong>
                </span>
                <span>
                  <CalendarDays size={15} />
                  Prova<strong>{formatDate(c.exam_date)}</strong>
                </span>
              </div>
              <div className="contest-actions">
                <Button
                  variant={c.id === contest?.id ? 'secondary' : 'primary'}
                  onClick={() => {
                    select(c.id);
                    navigate('Início');
                  }}
                >
                  Acompanhar
                  <ArrowUpRight size={16} />
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Editar ${c.name}`}
                  onClick={() => setEditor(c)}
                >
                  <Pencil size={16} />
                </Button>
                <Button variant="ghost" title="Informações do edital" onClick={() => setDetails(c)}>
                  <FileText size={16} />
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Excluir ${c.name}`}
                  onClick={() => {
                    if (
                      confirm(
                        'Excluir este concurso? Concursos com registros vinculados são protegidos.',
                      )
                    )
                      mutate(
                        () => send(`/contests/${c.id}`, { confirm: true }, 'DELETE'),
                        'Concurso excluído',
                      );
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editor && (
        <ContestEditor
          value={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(undefined)}
        />
      )}{' '}
      {details && (
        <Editor
          title="Informações complementares"
          description="Informações ausentes permanecem como Não informado. Consulte o edital antes de preencher."
          fields={Object.entries(factLabels)
            .filter(([k]) => !['name', 'role', 'board', 'exam_date'].includes(k))
            .map(([key, label]) => ({ key, label, type: 'text' }))}
          initial={details.metadata}
          onClose={() => setDetails(undefined)}
          onSave={async (v) => {
            await send(`/contests/${details.id}`, { ...details, metadata: v }, 'PUT');
            await mutate(async () => true, 'Informações salvas');
          }}
        />
      )}
    </>
  );
}
