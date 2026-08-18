import type { EventRecord, EventType } from '../types'
import { EVENT_META } from '../types'
import { displayName } from '../types'
import { monthKey, percent, yearKey } from './format'

export interface Summary {
  count: number
  total: number
  attended: number
  wreath: number
  attendedRate: number
  wreathRate: number
  average: number
}

export function summarize(records: EventRecord[]): Summary {
  const count = records.length
  const total = records.reduce((sum, r) => sum + r.amount, 0)
  const attended = records.filter((r) => r.attended).length
  const wreath = records.filter((r) => r.sent_wreath).length
  return {
    count,
    total,
    attended,
    wreath,
    attendedRate: percent(attended, count),
    wreathRate: percent(wreath, count),
    average: count ? Math.round(total / count) : 0,
  }
}

export function filterByMonth(records: EventRecord[], key: string): EventRecord[] {
  return records.filter((r) => monthKey(r.event_date) === key)
}

export function filterByYear(records: EventRecord[], key: string): EventRecord[] {
  return records.filter((r) => yearKey(r.event_date) === key)
}

export interface TypeSlice {
  type: EventType
  count: number
  total: number
  color: string
  share: number
}

export function byType(records: EventRecord[]): TypeSlice[] {
  const map = new Map<EventType, { count: number; total: number }>()
  for (const record of records) {
    const entry = map.get(record.event_type) ?? { count: 0, total: 0 }
    entry.count += 1
    entry.total += record.amount
    map.set(record.event_type, entry)
  }
  const grand = records.reduce((sum, r) => sum + r.amount, 0)
  return [...map.entries()]
    .map(([type, entry]) => ({
      type,
      count: entry.count,
      total: entry.total,
      color: EVENT_META[type].color,
      share: percent(entry.total, grand),
    }))
    .sort((a, b) => b.total - a.total || b.count - a.count)
}

export interface MonthPoint {
  key: string
  label: string
  total: number
  count: number
}

/** 최근 n개월 추이. 데이터가 없는 달도 0으로 채워 그래프가 끊기지 않게 한다. */
export function monthlyTrend(records: EventRecord[], months = 12, anchor = new Date()): MonthPoint[] {
  const points: MonthPoint[] = []
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const inMonth = records.filter((r) => monthKey(r.event_date) === key)
    points.push({
      key,
      label: `${date.getMonth() + 1}월`,
      total: inMonth.reduce((sum, r) => sum + r.amount, 0),
      count: inMonth.length,
    })
  }
  return points
}

export interface PersonSummary {
  key: string
  name: string
  relation: string
  label: string
  count: number
  total: number
  lastDate: string
  records: EventRecord[]
}

/** 같은 사람(이름+관계)의 기록을 묶는다. 히스토리 검색과 인맥 화면에서 쓴다. */
export function byPerson(records: EventRecord[]): PersonSummary[] {
  const map = new Map<string, PersonSummary>()
  for (const record of records) {
    const key = `${record.target_name}|${record.relation}`
    const existing = map.get(key)
    if (existing) {
      existing.count += 1
      existing.total += record.amount
      existing.records.push(record)
      if (record.event_date > existing.lastDate) existing.lastDate = record.event_date
    } else {
      map.set(key, {
        key,
        name: record.target_name,
        relation: record.relation,
        label: displayName(record),
        count: 1,
        total: record.amount,
        lastDate: record.event_date,
        records: [record],
      })
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total || b.count - a.count)
}

/** 이름·관계·메모·분류를 한 번에 훑는 단순 검색 */
export function searchRecords(records: EventRecord[], query: string): EventRecord[] {
  const q = query.trim().toLowerCase()
  if (!q) return records
  return records.filter((record) =>
    [record.target_name, record.relation, record.notes, record.event_type, record.event_date]
      .join(' ')
      .toLowerCase()
      .includes(q),
  )
}

export function relationBreakdown(records: EventRecord[]): Array<{ relation: string; count: number; total: number }> {
  const map = new Map<string, { count: number; total: number }>()
  for (const record of records) {
    const key = record.relation || '미분류'
    const entry = map.get(key) ?? { count: 0, total: 0 }
    entry.count += 1
    entry.total += record.amount
    map.set(key, entry)
  }
  return [...map.entries()]
    .map(([relation, entry]) => ({ relation, ...entry }))
    .sort((a, b) => b.total - a.total)
}
