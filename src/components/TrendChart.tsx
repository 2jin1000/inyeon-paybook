import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import type { MonthPoint } from '../lib/stats'
import { formatMonthKey, formatWon } from '../lib/format'

/** 계열이 하나뿐이라 범례 없이 제목이 계열을 설명한다. 색도 하나만 쓰고 최고치만 진하게 둔다. */
const SERIES = '#2a78d6'
const AXIS_INK = '#6b7385'
const GRID_INK = '#e3e8f2'

export default function TrendChart({ data }: { data: MonthPoint[] }) {
  const max = Math.max(...data.map((point) => point.total), 0)

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: 4 }}>
          <CartesianGrid vertical={false} stroke={GRID_INK} strokeDasharray="2 4" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: AXIS_INK, fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <Tooltip
            cursor={{ fill: 'rgba(17,24,39,0.05)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const point = payload[0].payload as MonthPoint
              return (
                <div className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-xs shadow-lg">
                  <p className="font-semibold text-ink-100">{formatMonthKey(point.key)}</p>
                  <p className="mt-0.5 tabular-nums text-ink-300">
                    {formatWon(point.total)}원 · {point.count}건
                  </p>
                </div>
              )
            }}
          />
          <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={26}>
            {data.map((point) => (
              <Cell
                key={point.key}
                fill={SERIES}
                fillOpacity={point.total === max && max > 0 ? 1 : 0.55}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
