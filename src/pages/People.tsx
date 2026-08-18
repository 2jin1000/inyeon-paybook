import { useMemo, useState } from 'react'
import { useApp } from '../store'
import type { EventRecord } from '../types'
import { formatDateLong, formatWon, relativeDay } from '../lib/format'
import { byPerson, type PersonSummary } from '../lib/stats'
import { EmptyState, Sheet, Spinner, TypeBadge } from '../components/ui'

/** 인맥 탭: 사람 단위로 묶어 보여주고, 선택하면 그 사람과의 히스토리를 타임라인으로 편다. */
export function People({ onSelect }: { onSelect: (record: EventRecord) => void }) {
  const { records, loading } = useApp()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<PersonSummary | null>(null)

  const people = useMemo(() => byPerson(records), [records])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return people
    return people.filter((person) => person.label.toLowerCase().includes(q))
  }, [people, query])

  // 목록이 갱신돼도 열려 있는 시트가 최신 데이터를 보게 한다.
  const active = selected ? (people.find((person) => person.key === selected.key) ?? null) : null

  if (loading) return <Spinner />

  return (
    <div className="px-4 pb-6">
      <div className="sticky top-0 z-10 -mx-4 bg-ink-950/95 px-4 pb-3 pt-1 backdrop-blur">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
            🔍
          </span>
          <input
            className="field pl-10"
            placeholder="인물 검색 (예: 홍길동)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <p className="mt-2 text-xs text-ink-400">
          {filtered.length}명 · 누적{' '}
          {formatWon(filtered.reduce((sum, person) => sum + person.total, 0))}원
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          emoji="👥"
          title={query ? '검색 결과가 없습니다' : '아직 인물 기록이 없습니다'}
          description={query ? undefined : '경조사를 기록하면 사람별로 자동으로 묶입니다.'}
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((person) => (
            <li key={person.key}>
              <button
                type="button"
                onClick={() => setSelected(person)}
                className="flex w-full items-center gap-3 rounded-2xl border border-ink-800 bg-ink-900/70 p-3.5 text-left transition hover:border-ink-600"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-800 text-sm font-bold text-ink-300">
                  {person.name.slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink-100">
                    {person.name}
                    {person.relation ? (
                      <span className="ml-1.5 text-xs font-normal text-ink-400">
                        {person.relation}
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-xs text-ink-400">
                    {person.count}건 · 마지막 {relativeDay(person.lastDate)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[15px] font-bold tabular-nums">
                    {formatWon(person.total)}
                  </span>
                  <span className="block text-[11px] text-ink-400">원</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={Boolean(active)}
        onClose={() => setSelected(null)}
        title={active ? active.label : ''}
      >
        {active ? (
          <div>
            <div className="mb-4 grid grid-cols-3 gap-2">
              <Stat label="총 지출" value={`${formatWon(active.total)}원`} />
              <Stat label="건수" value={`${active.count}건`} />
              <Stat
                label="참석"
                value={`${active.records.filter((r) => r.attended).length}건`}
              />
            </div>

            {/* 타임라인 */}
            <ol className="relative space-y-4 border-l border-ink-800 pl-5">
              {[...active.records]
                .sort((a, b) => (a.event_date < b.event_date ? 1 : -1))
                .map((record) => (
                  <li key={record.id} className="relative">
                    <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-ink-900 bg-brand-500 ring-1 ring-ink-800" />
                    <button
                      type="button"
                      className="w-full rounded-xl border border-ink-800 bg-ink-850 p-3 text-left transition hover:border-ink-600"
                      onClick={() => {
                        setSelected(null)
                        onSelect(record)
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-ink-400">
                          {formatDateLong(record.event_date)}
                        </span>
                        <span className="text-sm font-bold tabular-nums">
                          {formatWon(record.amount)}원
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <TypeBadge type={record.event_type} size="sm" />
                        {record.attended ? (
                          <span className="text-xs text-mint-500">🙋 참석</span>
                        ) : null}
                        {record.sent_wreath ? (
                          <span className="text-xs text-warm-500">💐 화환</span>
                        ) : null}
                      </div>
                      {record.notes ? (
                        <p className="mt-1.5 whitespace-pre-line text-xs text-ink-400">
                          {record.notes.length > 140
                            ? `${record.notes.slice(0, 140)}…`
                            : record.notes}
                        </p>
                      ) : null}
                    </button>
                  </li>
                ))}
            </ol>
          </div>
        ) : null}
      </Sheet>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-850 p-3 text-center">
      <p className="text-[11px] text-ink-400">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-ink-100">{value}</p>
    </div>
  )
}
