import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { EVENT_TYPES, type EventRecord, type EventType } from '../types'
import { formatMonthKey, formatWon, monthKey } from '../lib/format'
import { searchRecords, summarize } from '../lib/stats'
import { EmptyState, Spinner } from '../components/ui'
import { EventCard } from '../components/EventCard'

type SortKey = 'date-desc' | 'date-asc' | 'amount-desc'

export function Records({ onSelect }: { onSelect: (record: EventRecord) => void }) {
  const { records, loading } = useApp()
  const [query, setQuery] = useState('')
  const [types, setTypes] = useState<Set<EventType>>(new Set())
  const [sort, setSort] = useState<SortKey>('date-desc')

  const filtered = useMemo(() => {
    let list = searchRecords(records, query)
    if (types.size > 0) list = list.filter((record) => types.has(record.event_type))
    const sorted = [...list]
    if (sort === 'date-asc') sorted.sort((a, b) => (a.event_date < b.event_date ? -1 : 1))
    else if (sort === 'amount-desc') sorted.sort((a, b) => b.amount - a.amount)
    return sorted
  }, [records, query, types, sort])

  const summary = useMemo(() => summarize(filtered), [filtered])

  // 날짜순일 때만 월 단위로 묶어 보여준다.
  const groups = useMemo(() => {
    if (sort === 'amount-desc') return [{ key: '', items: filtered }]
    const map = new Map<string, EventRecord[]>()
    for (const record of filtered) {
      const key = monthKey(record.event_date)
      const bucket = map.get(key)
      if (bucket) bucket.push(record)
      else map.set(key, [record])
    }
    return [...map.entries()].map(([key, items]) => ({ key, items }))
  }, [filtered, sort])

  function toggleType(type: EventType) {
    setTypes((current) => {
      const next = new Set(current)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  if (loading) return <Spinner />

  return (
    <div className="px-4 pb-6">
      {/* 검색 + 필터 (한 줄로 묶어 목록 위에 둔다) */}
      <div className="sticky top-0 z-10 -mx-4 space-y-2 bg-ink-950/95 px-4 pb-3 pt-1 backdrop-blur">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
            🔍
          </span>
          <input
            className="field pl-10"
            placeholder="이름 · 관계 · 메모 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-100"
              onClick={() => setQuery('')}
              aria-label="검색어 지우기"
            >
              ×
            </button>
          ) : null}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {EVENT_TYPES.map((type) => {
            const active = types.has(type)
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className={`chip shrink-0 border transition ${
                  active
                    ? 'border-brand-500 bg-brand-500/15 text-brand-400'
                    : 'border-ink-700 bg-ink-850 text-ink-400'
                }`}
              >
                {type}
              </button>
            )
          })}
          <select
            className="shrink-0 rounded-full border border-ink-700 bg-ink-850 px-2.5 py-1 text-xs text-ink-300 outline-none"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            aria-label="정렬"
          >
            <option value="date-desc">최신순</option>
            <option value="date-asc">오래된순</option>
            <option value="amount-desc">금액순</option>
          </select>
        </div>

        <p className="text-xs text-ink-400">
          {summary.count}건 · 합계{' '}
          <span className="font-semibold text-ink-300">{formatWon(summary.total)}원</span>
          {summary.count > 0 ? ` · 평균 ${formatWon(summary.average)}원` : ''}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="조건에 맞는 기록이 없습니다"
          description={query ? `"${query}" 검색 결과가 없습니다.` : '필터를 바꿔보세요.'}
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.key || 'all'}>
              {group.key ? (
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 className="text-sm font-semibold text-ink-100">
                    {formatMonthKey(group.key)}
                  </h2>
                  <span className="text-xs tabular-nums text-ink-400">
                    {formatWon(group.items.reduce((sum, r) => sum + r.amount, 0))}원 ·{' '}
                    {group.items.length}건
                  </span>
                </div>
              ) : null}
              <div className="space-y-2">
                {group.items.map((record) => (
                  <EventCard key={record.id} record={record} onSelect={onSelect} showYear />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
