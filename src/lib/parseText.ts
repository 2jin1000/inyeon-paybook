import type { EventDraft, EventType } from '../types'
import { toISODate } from './format'

/**
 * 카카오톡 등에서 복사한 부고 문자 / 모바일 청첩장 문구를 파싱해
 * 입력 폼을 미리 채운다. 확신이 없는 값은 채우지 않고 사용자가 직접 고르게 둔다.
 */
export interface ParseResult {
  patch: Partial<EventDraft>
  /** 무엇을 알아냈는지 사용자에게 보여줄 요약 */
  hits: string[]
}

const TYPE_HINTS: Array<{ type: EventType; words: string[] }> = [
  {
    type: '부고',
    words: ['부고', '訃告', '별세', '소천', '운명', '영면', '발인', '빈소', '장례', '조의', '삼가', '상주', '故'],
  },
  {
    type: '결혼',
    words: ['결혼', '청첩', '화혼', '혼인', '예식', '웨딩', '신랑', '신부', '백년가약', '결혼식'],
  },
  { type: '개업', words: ['개업', '오픈', 'OPEN', '창업', '이전 개업', '개원', '개소'] },
  { type: '병문안', words: ['입원', '쾌유', '병문안', '수술', '병상', '완쾌'] },
  { type: '축하', words: ['돌잔치', '백일', '출산', '승진', '영전', '취임', '입학', '졸업', '생신', '고희', '칠순', '환갑'] },
  { type: '찬조', words: ['찬조', '후원', '기부', '성금'] },
]

const BANK_WORDS = [
  '은행', '농협', '신한', '국민', '우리', '하나', '기업', '카카오뱅크', '토스', '새마을', '수협', '우체국', '부산', '대구', '광주', '경남', 'SC', '씨티', '케이뱅크',
]

function detectType(text: string): { type: EventType | null; word: string | null } {
  for (const { type, words } of TYPE_HINTS) {
    const found = words.find((word) => text.includes(word))
    if (found) return { type, word: found }
  }
  return { type: null, word: null }
}

function detectDate(text: string): string | null {
  const today = new Date()

  // 2026년 8월 18일 / 2026-08-18 / 2026.08.18 / 2026/8/18
  const full = text.match(/(20\d{2})\s*[년.\-/]\s*(\d{1,2})\s*[월.\-/]\s*(\d{1,2})\s*일?/)
  if (full) {
    const [, y, m, d] = full
    return safeISO(Number(y), Number(m), Number(d))
  }

  // 8월 18일 / 08.18 / 8/18 (연도 없음)
  const partial = text.match(/(?<![\d.])(\d{1,2})\s*[월.\-/]\s*(\d{1,2})\s*일?(?![\d.])/)
  if (partial) {
    const month = Number(partial[1])
    const day = Number(partial[2])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let iso = safeISO(today.getFullYear(), month, day)
      if (iso) {
        const guessed = new Date(iso)
        const monthAgo = new Date(today.getTime() - 45 * 86_400_000)
        // 청첩장은 대개 미래 날짜다. 한참 지난 날짜면 내년으로 본다.
        if (guessed < monthAgo) iso = safeISO(today.getFullYear() + 1, month, day)
      }
      return iso
    }
  }
  return null
}

function safeISO(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(year, month - 1, day)
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return toISODate(date)
}

function detectName(text: string, type: EventType | null): { name: string; hint: string } | null {
  const nameChars = '[가-힣]{2,4}'

  if (type === '결혼') {
    const groom = text.match(new RegExp(`신랑\\s*[:：]?\\s*(${nameChars})`))
    if (groom) return { name: groom[1], hint: '신랑' }
    const bride = text.match(new RegExp(`신부\\s*[:：]?\\s*(${nameChars})`))
    if (bride) return { name: bride[1], hint: '신부' }
  }

  if (type === '부고') {
    const deceased = text.match(new RegExp(`故\\s*(${nameChars})`))
    if (deceased) return { name: deceased[1], hint: '故인' }
    const mourner = text.match(new RegExp(`상\\s*주\\s*[:：]?\\s*(${nameChars})`))
    if (mourner) return { name: mourner[1], hint: '상주' }
    const passed = text.match(new RegExp(`(${nameChars})\\s*(?:님|씨)?\\s*(?:께서)?\\s*(?:별세|소천|운명|영면)`))
    if (passed) return { name: passed[1], hint: '고인' }
  }

  // 공통: "홍길동 님", "홍길동님", "홍길동 씨"
  const honorific = text.match(new RegExp(`(${nameChars})\\s*(?:님|씨)`))
  if (honorific) return { name: honorific[1], hint: '이름' }

  return null
}

function detectAmount(text: string): number | null {
  const manwon = text.match(/(\d{1,4})\s*만\s*원/)
  if (manwon) return Number(manwon[1]) * 10_000
  const won = text.match(/([\d,]{4,})\s*원/)
  if (won) {
    const value = Number(won[1].replace(/,/g, ''))
    if (value >= 1000) return value
  }
  return null
}

function detectAccount(text: string): string | null {
  const account = text.match(/(\d{2,6}[-\s]\d{2,6}[-\s]\d{2,7}(?:[-\s]\d{1,6})?)/)
  if (!account) return null
  const line =
    text
      .split('\n')
      .find((l) => l.includes(account[1])) ?? account[1]
  const trimmed = line.trim()
  const hasBank = BANK_WORDS.some((bank) => trimmed.includes(bank))
  return hasBank || /계좌|입금|송금/.test(trimmed) ? trimmed.slice(0, 60) : account[1]
}

function detectPlace(text: string): string | null {
  const place = text.match(
    /((?:[가-힣A-Za-z0-9()·\s]{2,20})?(?:장례식장|병원\s*장례식장|추모관|웨딩홀|컨벤션|예식장|호텔|더컨벤션|아트홀|하우스)(?:\s*[가-힣0-9]{0,10}(?:관|층|홀|호실|호))?)/,
  )
  if (!place) return null
  return place[1].replace(/\s+/g, ' ').trim().slice(0, 40)
}

export function parsePastedText(raw: string): ParseResult {
  const text = (raw ?? '').trim()
  const patch: Partial<EventDraft> = {}
  const hits: string[] = []
  if (!text) return { patch, hits }

  const { type, word } = detectType(text)
  if (type) {
    patch.event_type = type
    hits.push(`분류 ${type}${word ? ` ("${word}")` : ''}`)
  }

  const date = detectDate(text)
  if (date) {
    patch.event_date = date
    hits.push(`일자 ${date}`)
  }

  const name = detectName(text, type)
  if (name) {
    patch.target_name = name.name
    hits.push(`${name.hint} ${name.name}`)
  }

  const amount = detectAmount(text)
  if (amount) {
    patch.amount = amount
    hits.push(`금액 ${amount.toLocaleString('ko-KR')}원`)
  }

  const notes: string[] = []
  const place = detectPlace(text)
  if (place) {
    notes.push(`장소: ${place}`)
    hits.push(`장소 ${place}`)
  }
  const account = detectAccount(text)
  if (account) {
    notes.push(`계좌: ${account}`)
    hits.push('계좌번호')
  }
  if (notes.length > 0) patch.notes = notes.join('\n')

  return { patch, hits }
}
