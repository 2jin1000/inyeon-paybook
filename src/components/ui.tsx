import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { EVENT_META, type EventType } from '../types'
import { formatAmountInput, parseAmount } from '../lib/format'

/* ------------------------------------------------------------------ 토스트 */

type Toast = { id: number; message: string; tone: 'ok' | 'error' | 'info' }

const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  const push = useCallback((message: string, tone: Toast['tone'] = 'ok') => {
    const id = ++seq.current
    setToasts((list) => [...list, { id, message, tone }])
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3200)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto w-full max-w-sm rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur ${
              toast.tone === 'error'
                ? 'border-rose-500/40 bg-rose-500/15 text-rose-100'
                : toast.tone === 'info'
                  ? 'border-ink-600 bg-ink-850/95 text-ink-100'
                  : 'border-mint-500/40 bg-mint-500/15 text-mint-500'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

/* ------------------------------------------------------------------- 토글 */

export function Toggle({
  checked,
  onChange,
  label,
  description,
  emoji,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  description?: string
  emoji?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
        checked ? 'border-brand-500/60 bg-brand-500/10' : 'border-ink-700 bg-ink-850'
      }`}
    >
      {emoji ? <span className="text-lg">{emoji}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink-100">{label}</span>
        {description ? <span className="block text-xs text-ink-400">{description}</span> : null}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? 'bg-brand-500' : 'bg-ink-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  )
}

/* ------------------------------------------------------------- 금액 입력기 */

export function AmountInput({
  value,
  onChange,
  autoFocus,
}: {
  value: number
  onChange: (next: number) => void
  autoFocus?: boolean
}) {
  const [text, setText] = useState(() => (value ? formatAmountInput(String(value)) : ''))
  const id = useId()

  // 외부에서 값이 바뀐 경우(붙여넣기 파싱 등) 표시를 맞춘다.
  useEffect(() => {
    const current = parseAmount(text)
    if (current !== value) setText(value ? formatAmountInput(String(value)) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const quickAmounts = [50_000, 100_000, 200_000, 300_000]

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          className="field pr-10 text-right text-2xl font-bold tabular-nums"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          autoFocus={autoFocus}
          value={text}
          onChange={(event) => {
            const formatted = formatAmountInput(event.target.value)
            setText(formatted)
            onChange(parseAmount(formatted))
          }}
        />
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-base text-ink-400">
          원
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {quickAmounts.map((amount) => (
          <button
            key={amount}
            type="button"
            className="rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-xs font-medium text-ink-300 transition hover:border-brand-500 hover:text-ink-100"
            onClick={() => {
              const next = parseAmount(text) + amount
              setText(formatAmountInput(String(next)))
              onChange(next)
            }}
          >
            +{amount / 10_000}만
          </button>
        ))}
        <button
          type="button"
          className="rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-xs font-medium text-ink-400 transition hover:border-rose-500 hover:text-rose-500"
          onClick={() => {
            setText('')
            onChange(0)
          }}
        >
          지우기
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 배지 */

export function TypeBadge({ type, size = 'md' }: { type: EventType; size?: 'sm' | 'md' }) {
  const meta = EVENT_META[type]
  return (
    <span
      className={`chip ${size === 'sm' ? 'text-[11px]' : 'text-xs'}`}
      style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
    >
      <span aria-hidden>{meta.emoji}</span>
      {type}
    </span>
  )
}

/* ------------------------------------------------------------- 바텀 시트 */

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl border border-ink-800 bg-ink-900 shadow-2xl sm:rounded-3xl"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-ink-800 px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg px-2 py-1 text-xl leading-none text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <footer className="shrink-0 border-t border-ink-800 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 확인창 */

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '삭제',
  onConfirm,
  onCancel,
  danger = true,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative w-full max-w-sm rounded-2xl border border-ink-800 bg-ink-900 p-5 shadow-2xl"
      >
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-2 whitespace-pre-line text-sm text-ink-300">{message}</p>
        <div className="mt-5 flex gap-2">
          <button type="button" className="btn-ghost flex-1" onClick={onCancel}>
            취소
          </button>
          <button
            type="button"
            className={`btn flex-1 text-white ${danger ? 'bg-rose-500 hover:bg-rose-500/80' : 'bg-brand-500 hover:bg-brand-600'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- 세그먼트 */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (next: T) => void
}) {
  return (
    <div className="flex rounded-xl border border-ink-800 bg-ink-900 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            value === option.value ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-100'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------- 상태 표시 */

export function EmptyState({
  emoji,
  title,
  description,
  action,
}: {
  emoji: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-700 px-6 py-12 text-center">
      <div className="text-4xl" aria-hidden>
        {emoji}
      </div>
      <p className="mt-3 text-base font-semibold text-ink-100">{title}</p>
      {description ? <p className="mt-1 text-sm text-ink-400">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-ink-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink-700 border-t-brand-500" />
      {label ?? '불러오는 중…'}
    </div>
  )
}

/* --------------------------------------------------------------- 진행 바 */

export function Meter({
  value,
  max,
  color,
  label,
  caption,
}: {
  value: number
  max: number
  color: string
  label: string
  caption?: string
}) {
  const ratio = useMemo(() => (max > 0 ? Math.min(100, (value / max) * 100) : 0), [value, max])
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="truncate text-sm text-ink-300">{label}</span>
        {caption ? <span className="shrink-0 text-xs tabular-nums text-ink-400">{caption}</span> : null}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-800">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${ratio}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
