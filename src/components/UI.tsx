import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, Plus, LoaderCircle, FileQuestion, ArrowUpRight } from 'lucide-react';
export function Button({
  children,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  return (
    <button {...props} className={`btn ${variant} ${props.className || ''}`}>
      {children}
    </button>
  );
}
export function Empty({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon || <FileQuestion size={30} />}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Card({
  children,
  className = '',
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="card-heading">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Progress({ value, label }: { value: number | null; label?: string }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label || 'Progresso'}
      aria-valuenow={value ?? 0}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${value ?? 0}%` }} />
    </div>
  );
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'green' | 'amber' | 'red' | 'neutral' | 'blue';
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const node = ref.current;
    node?.querySelector<HTMLElement>('input,select,button,textarea')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && node) {
        const focusable = [
          ...node.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href]'),
        ].filter((x) => !x.hasAttribute('disabled'));
        const first = focusable[0],
          last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = '';
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <Button variant="ghost" aria-label="Fechar" onClick={onClose}>
            <X size={19} />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
export type Values = Record<string, string | number | boolean | null>;
export type Field = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox';
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  hint?: string;
  options?:
    { value: string; label: string }[] | ((values: Values) => { value: string; label: string }[]);
  hidden?: (values: Values) => boolean;
};
export function Editor({
  title,
  description,
  fields,
  initial = {},
  onClose,
  onSave,
  submitLabel = 'Salvar',
}: {
  title: string;
  description?: string;
  fields: Field[];
  initial?: Values;
  onClose: () => void;
  onSave: (values: Values) => Promise<unknown>;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<Values>(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await onSave(values);
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {description && <p className="muted form-description">{description}</p>}
        <div className="form-grid">
          {fields
            .filter((f) => !f.hidden?.(values))
            .map((f) => {
              const props = {
                'aria-label': f.label,
                id: `field-${f.key}`,
                name: f.key,
                required: f.required,
                value: String(values[f.key] ?? ''),
                onChange: (
                  e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
                ) =>
                  setValues((v) => ({
                    ...v,
                    [f.key]:
                      f.type === 'number'
                        ? e.target.value === ''
                          ? ''
                          : Number(e.target.value)
                        : f.type === 'checkbox'
                          ? (e.target as HTMLInputElement).checked
                          : e.target.value,
                  })),
              };
              const opts = typeof f.options === 'function' ? f.options(values) : f.options;
              return (
                <label
                  className={`field ${f.type === 'textarea' ? 'full' : ''} ${f.type === 'checkbox' ? 'check-field' : ''}`}
                  key={f.key}
                  htmlFor={props.id}
                >
                  <span>
                    {f.label}
                    {f.required ? ' *' : ''}
                  </span>
                  {f.type === 'select' ? (
                    <select {...props}>
                      {opts?.map((o) => (
                        <option value={o.value} key={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea {...props} rows={3} />
                  ) : f.type === 'checkbox' ? (
                    <input
                      {...props}
                      value={undefined}
                      type="checkbox"
                      checked={Boolean(values[f.key])}
                    />
                  ) : (
                    <input
                      {...props}
                      type={f.type || 'text'}
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      placeholder={f.placeholder}
                    />
                  )}{' '}
                  {f.hint && <small>{f.hint}</small>}
                </label>
              );
            })}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />} {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function Metric({
  label,
  value,
  description,
  icon,
  color = 'green',
}: {
  label: string;
  value: string | number;
  description: string;
  icon: ReactNode;
  color?: string;
}) {
  return (
    <Card className={`metric ${color}`}>
      <div className="metric-top">
        <span>{label}</span>
        <div className="metric-icon">{icon}</div>
      </div>
      <strong>{value}</strong>
      <p>{description}</p>
    </Card>
  );
}
export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </button>
  );
}
