import { Suspense, lazy, useMemo, useState } from 'react'
import { useApp } from '../store'
import { EVENT_META, type EventRecord } from '../types'
import {
  formatCompactWon,
  formatMonthKey,
  formatWon,
  monthKey,
  percent,
  yearKey,
} from '../lib/format'
import { byType, monthlyTrend, relationBreakdown, summarize } from '../lib/stats'
import { EmptyState, Meter, Segmented, Spinner, TypeBadge } from '../components/ui'
import { EventCard } from '../components/EventCard'

/** 차트 계열 색(단일 색). 크기 비교가 목적이라 분류별로 색을 나누지 않고 라벨로 구분한다. */
const SERIES = '#3987e5'

// 차트 라이브러리는 첫 화면 로딩을 늦추지 않도록 따로 내려받는다.
const TrendChart = lazy(() => import('../components/TrendChart'))

type Period = 'month' | 'year' | 'all'

export function Dashboard({ onSelect }: { onSelect: (record: EventRecord) => void }) {
  const { records, loading } = useApp()
  const [period, setPeriod] = useState<Period>('month')

  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thisYear = String(now.getFullYear())

  const scoped = useMemo(() => {
    if (period === 'month') return records.filter((r) => monthKey(r.event_date) === thisMonth)
    if (period === 'year') return records.filter((r) => yearKey(r.event_date) === thisYear)
    return records
  }, [records, period, thisMonth, thisYear])

  const monthSummary = useMemo(
    () => summarize(records.filter((r) => monthKey(r.event_date) === thisMonth)),
    [records, thisMonth],
  )
  const yearSummary = useMemo(
    () => summarize(records.filter((r) => yearKey(r.event_date) === thisYear)),
    [records, thisYear],
  )
  const scopedSummary = useMemo(() => summarize(scoped), [scoped])
  const types = useMemo(() => byType(scoped), [scoped])
  const relations = useMemo(() => relationBreakdown(scoped).slice(0, 5), [scoped])
  const trend = useMemo(() => monthlyTrend(records, 12, now), [records]) // eslint-disable-line react-hooks/exhaustive-deps
  const trendMax = Math.max(...trend.map((point) => point.total), 0)
  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return records.filter((r) => r.event_date >= today).slice(-3).reverse()
  }, [records])
  const recent = useMemo(() => records.slice(0, 5), [records])

  if (loading) return <Spinner />

  if (records.length === 0) {
    return (
      <div className="px-4 py-8">
        <EmptyState
          emoji="🗂️"
          title="아직 기록이 없습니다"
          description="아래 + 버튼으로 첫 경조사를 기록하거나, 설정에서 기존 엑셀 파일을 가져오세요."
        />
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 pb-6">
      {/* 이번 달 / 올해 누적 */}
      <section className="card bg-gradient-to-br from-ink-850 to-ink-900">
        <p className="text-sm text-ink-300">이번 달 지출</p>
        <p className="mt-1 text-4xl font-extrabold tabular-nums text-ink-100">
          {formatWon(monthSummary.total)}
          <span className="ml-1 text-xl font-semibold text-ink-300">원</span>
        </p>
        <p className="mt-1 text-xs text-ink-400">
          {formatMonthKey(thisMonth)} · {monthSummary.count}건
          {monthSummary.count > 0 ? ` · 건당 평균 ${formatCompactWon(monthSummary.average)}원` : ''}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-800 pt-3">
          <div>
            <p className="text-xs text-ink-400">올해 누적</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums">
              {formatWon(yearSummary.total)}
              <span className="ml-0.5 text-xs font-medium text-ink-400">원</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-400">올해 건수</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums">
              {yearSummary.count}
              <span className="ml-0.5 text-xs font-medium text-ink-400">건</span>
            </p>
          </div>
        </div>
      </section>

      {/* 월별 추이 — 단일 계열이라 범례 없이 제목이 계열을 설명한다 */}
      <section className="card">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink-100">최근 12개월 지출</h2>
          <span className="text-xs text-ink-400">단위: 원</span>
        </div>
        <Suspense fallback={<div className="h-44 w-full animate-pulse rounded-xl bg-ink-850" />}>
          <TrendChart data={trend} />
        </Suspense>
        {trendMax > 0 ? (
          <p className="mt-1 text-xs text-ink-400">
            가장 많이 쓴 달 ·{' '}
            {formatMonthKey(trend.find((point) => point.total === trendMax)?.key ?? '')}{' '}
            {formatCompactWon(trendMax)}원
          </p>
        ) : null}
      </section>

      {/* 기간 선택 */}
      <Segmented<Period>
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'month', label: '이번 달' },
          { value: 'year', label: '올해' },
          { value: 'all', label: '전체' },
        ]}
      />

      {/* 카테고리 분석 — 막대마다 이름·금액을 직접 표시해 색에만 의존하지 않는다 */}
      <section className="card">
        <h2 className="mb-3 text-sm font-semibold text-ink-100">분류별 지출</h2>
        {types.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">이 기간에는 기록이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {types.map((slice) => (
              <Meter
                key={slice.type}
                value={slice.total}
                max={types[0].total}
                color={SERIES}
                label={`${EVENT_META[slice.type].emoji} ${slice.type} · ${slice.count}건`}
                caption={`${formatWon(slice.total)}원 (${slice.share}%)`}
              />
            ))}
          </div>
        )}
      </section>

      {/* 참여도 통계 */}
      <section className="card">
        <h2 className="mb-3 text-sm font-semibold text-ink-100">참여도</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-ink-800 bg-ink-850 p-3">
            <p className="text-xs text-ink-400">직접 참석</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-ink-100">
              {scopedSummary.attendedRate}
              <span className="text-sm font-medium text-ink-400">%</span>
            </p>
            <p className="text-xs text-ink-400">
              {scopedSummary.attended} / {scopedSummary.count}건
            </p>
          </div>
          <div className="rounded-xl border border-ink-800 bg-ink-850 p-3">
            <p className="text-xs text-ink-400">화환 송부</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-ink-100">
              {scopedSummary.wreathRate}
              <span className="text-sm font-medium text-ink-400">%</span>
            </p>
            <p className="text-xs text-ink-400">
              {scopedSummary.wreath} / {scopedSummary.count}건
            </p>
          </div>
        </div>
        <div className="mt-3 space-y-3">
          <Meter
            value={scopedSummary.attended}
            max={scopedSummary.count}
            color={SERIES}
            label="참석한 경조사"
            caption={`${scopedSummary.attended}건`}
          />
          <Meter
            value={scopedSummary.wreath}
            max={scopedSummary.count}
            color={SERIES}
            label="화환을 보낸 경조사"
            caption={`${scopedSummary.wreath}건`}
          />
        </div>
      </section>

      {/* 관계별 */}
      {relations.length > 0 ? (
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold text-ink-100">관계별 지출 상위</h2>
          <div className="space-y-3">
            {relations.map((row) => (
              <Meter
                key={row.relation}
                value={row.total}
                max={relations[0].total}
                color={SERIES}
                label={`${row.relation} · ${row.count}건`}
                caption={`${formatWon(row.total)}원 (${percent(row.total, scopedSummary.total)}%)`}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* 다가오는 일정 */}
      {upcoming.length > 0 ? (
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-ink-100">다가오는 경조사</h2>
          <div className="space-y-2">
            {upcoming.map((record) => (
              <EventCard key={record.id} record={record} onSelect={onSelect} />
            ))}
          </div>
        </section>
      ) : null}

      {/* 최근 기록 */}
      <section>
        <h2 className="mb-2 px-1 text-sm font-semibold text-ink-100">최근 기록</h2>
        <div className="space-y-2">
          {recent.map((record) => (
            <EventCard key={record.id} record={record} onSelect={onSelect} />
          ))}
        </div>
      </section>

      {/* 색에만 의존하지 않도록, 분류 배지 범례를 함께 둔다 */}
      <section className="card">
        <h2 className="mb-2 text-sm font-semibold text-ink-100">분류 표기</h2>
        <div className="flex flex-wrap gap-1.5">
          {types.map((slice) => (
            <TypeBadge key={slice.type} type={slice.type} size="sm" />
          ))}
        </div>
      </section>
    </div>
  )
}
