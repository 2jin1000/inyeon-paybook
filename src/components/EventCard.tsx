import type { EventRecord } from '../types'
import { displayName } from '../types'
import { formatDateShort, formatWon, relativeDay } from '../lib/format'
import { TypeBadge } from './ui'

export function EventCard({
  record,
  onSelect,
  showYear,
}: {
  record: EventRecord
  onSelect: (record: EventRecord) => void
  showYear?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(record)}
      className="w-full rounded-2xl border border-ink-800 bg-ink-900/70 p-3.5 text-left transition hover:border-ink-600 active:scale-[0.995]"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-ink-100">
              {displayName(record)}
            </span>
            <TypeBadge type={record.event_type} size="sm" />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-400">
            <span>
              {showYear ? `${record.event_date.slice(0, 4)}. ` : ''}
              {formatDateShort(record.event_date)}
            </span>
            <span aria-hidden>·</span>
            <span>{relativeDay(record.event_date)}</span>
            {record.attended ? <span className="text-mint-500">🙋 참석</span> : null}
            {record.sent_wreath ? <span className="text-warm-500">💐 화환</span> : null}
            {record.image_path ? <span>🖼️</span> : null}
          </div>
          {record.notes ? (
            <p className="mt-1.5 line-clamp-1 text-xs text-ink-400">
              {record.notes.replace(/\n+/g, ' · ')}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[15px] font-bold tabular-nums text-ink-100">
            {formatWon(record.amount)}
          </div>
          <div className="text-[11px] text-ink-400">원</div>
        </div>
      </div>
    </button>
  )
}
