export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const form = options.body instanceof FormData;
  const res = await fetch('/api' + path, {
    ...options,
    keepalive: path.startsWith('/timer') || path.endsWith('/position'),
    headers: {
      'X-Study-Client': 'cronograma',
      ...(!form && options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    let message = 'Falha ao comunicar com o banco local';
    try {
      message = (await res.json()).error || message;
    } catch {}
    throw Error(message);
  }
  return res.json();
}
export const send = <T = unknown>(path: string, body: unknown, method = 'POST') =>
  api<T>(path, { method, body: JSON.stringify(body) });
export async function download(path: string, filename: string) {
  const res = await fetch('/api' + path, { headers: { 'X-Study-Client': 'cronograma' } });
  if (!res.ok) throw Error('Não foi possível exportar');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const pct = (value: number | null) =>
  value === null
    ? 'Sem dados'
    : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}%`;
export const duration = (minutes: number) =>
  minutes > 0 && minutes < 1
    ? `${Math.round(minutes * 60)} s`
    : minutes >= 60
      ? `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}min`
      : `${Math.round(minutes)} min`;
export const formatDate = (value: string) =>
  value ? new Date(value + 'T12:00:00').toLocaleDateString('pt-BR') : 'Não informado';
