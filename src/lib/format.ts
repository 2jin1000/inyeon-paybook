/** 금액 포맷/파싱, 날짜 유틸. 화면 전반에서 공유한다. */

const won = new Intl.NumberFormat('ko-KR')

export function formatWon(amount: number): string {
  return won.format(Math.round(amount || 0))
}

/** 큰 금액을 "1,250만" 처럼 축약한다. 통계 타일용. */
export function formatCompactWon(amount: number): string {
  const value = Math.round(amount || 0)
  if (Math.abs(value) >= 100_000_000) {
    const eok = value / 100_000_000
    return `${won.format(Math.round(eok * 10) / 10)}억`
  }
  if (Math.abs(value) >= 10_000) {
    return `${won.format(Math.round(value / 10_000))}만`
  }
  return won.format(value)
}

/** 입력 문자열에서 숫자만 남긴다. "50,000원" -> 50000 */
export function parseAmount(raw: string): number {
  const digits = (raw ?? '').replace(/[^\d]/g, '')
  if (!digits) return 0
  return Math.min(Number(digits), 9_999_999_999)
}

/** 입력 중 천 단위 콤마를 붙인다. 빈 값은 빈 문자열 유지. */
export function formatAmountInput(raw: string): string {
  const digits = (raw ?? '').replace(/[^\d]/g, '')
  if (!digits) return ''
  return won.format(Number(digits))
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function toISODate(date: Date): string {
  // 로컬 타임존 기준 YYYY-MM-DD (toISOString 은 UTC 라 날짜가 밀릴 수 있다)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** "2026. 8. 18. (화)" */
export function formatDateLong(iso: string): string {
  const date = parseISO(iso)
  if (!date) return iso
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. (${WEEKDAYS[date.getDay()]})`
}

/** "8월 18일 (화)" */
export function formatDateShort(iso: string): string {
  const date = parseISO(iso)
  if (!date) return iso
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`
}

export function parseISO(iso: string): Date | null {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  if (!matched) return null
  const date = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

/** YYYY-MM 키 */
export function monthKey(iso: string): string {
  return (iso ?? '').slice(0, 7)
}

export function yearKey(iso: string): string {
  return (iso ?? '').slice(0, 4)
}

/** "2026-08" -> "2026년 8월" */
export function formatMonthKey(key: string): string {
  const [y, m] = key.split('-')
  if (!y || !m) return key
  return `${y}년 ${Number(m)}월`
}

/** 오늘 기준 상대 표현. 과거는 "3일 전", 미래는 "3일 후". */
export function relativeDay(iso: string): string {
  const date = parseISO(iso)
  if (!date) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return '오늘'
  if (diff === 1) return '내일'
  if (diff === -1) return '어제'
  if (diff > 0) return `${diff}일 후`
  return `${-diff}일 전`
}

export function percent(part: number, total: number): number {
  if (!total) return 0
  return Math.round((part / total) * 100)
}
