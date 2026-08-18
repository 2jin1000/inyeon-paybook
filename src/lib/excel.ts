import type { EventDraft, EventRecord } from '../types'
import { displayName, normalizeEventType, splitName } from '../types'
import { formatWon, toISODate } from './format'

/** 엑셀에서 읽어들인 원본 시트 */
export interface SheetData {
  sheetNames: string[]
  activeSheet: string
  headers: string[]
  rows: Array<Record<string, unknown>>
}

/** 우리 필드 <- 엑셀 컬럼 이름 매핑 */
export interface ColumnMapping {
  event_date: string | null
  target_name: string | null
  event_type: string | null
  amount: string | null
  attended: string | null
  sent_wreath: string | null
  notes: string | null
}

export const MAPPING_FIELDS: Array<{
  key: keyof ColumnMapping
  label: string
  required: boolean
  hint: string
}> = [
  { key: 'event_date', label: '날짜', required: true, hint: '2026-08-18, 2026.8.18 모두 인식' },
  { key: 'target_name', label: '성명', required: true, hint: '"홍길동(대학동기)" 형태면 관계까지 분리' },
  { key: 'event_type', label: '경조내역', required: false, hint: '결혼/부고/개업… 없으면 기타' },
  { key: 'amount', label: '금액', required: false, hint: '"50,000원" 처럼 적혀 있어도 인식' },
  { key: 'attended', label: '참석여부', required: false, hint: 'O/X, 참석/불참, TRUE/FALSE' },
  { key: 'sent_wreath', label: '화환 송부', required: false, hint: 'O/X, 화환' },
  { key: 'notes', label: '비고', required: false, hint: '메모 · 계좌번호 등' },
]

const HEADER_HINTS: Record<keyof ColumnMapping, string[]> = {
  event_date: ['날짜', '일자', '일시', '경조일', '행사일', 'date', 'event_date'],
  target_name: ['성명', '이름', '대상', '대상자', '성함', 'name', 'target_name'],
  event_type: ['경조내역', '경조', '분류', '구분', '종류', '내역', '사유', 'type', 'event_type'],
  amount: ['금액', '지출', '축의', '조의', '부조', '비용', 'amount', '원'],
  attended: ['참석', '방문', '참여', 'attend'],
  sent_wreath: ['화환', '화한', '조화', '근조', 'wreath'],
  notes: ['비고', '메모', '기타사항', '특이', 'note', 'memo', '내용'],
}

function normalizeHeader(header: string): string {
  return header.replace(/\s|_|-|\(|\)|\[|\]/g, '').toLowerCase()
}

/** 헤더 이름을 보고 매핑을 추정한다. 사용자가 화면에서 고칠 수 있다. */
export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    event_date: null,
    target_name: null,
    event_type: null,
    amount: null,
    attended: null,
    sent_wreath: null,
    notes: null,
  }
  const used = new Set<string>()

  for (const field of Object.keys(HEADER_HINTS) as Array<keyof ColumnMapping>) {
    const hints = HEADER_HINTS[field]
    // 정확히 일치 -> 부분 일치 순으로 찾는다.
    const exact = headers.find(
      (h) => !used.has(h) && hints.some((hint) => normalizeHeader(h) === normalizeHeader(hint)),
    )
    const partial =
      exact ??
      headers.find(
        (h) => !used.has(h) && hints.some((hint) => normalizeHeader(h).includes(normalizeHeader(hint))),
      )
    if (partial) {
      mapping[field] = partial
      used.add(partial)
    }
  }
  return mapping
}

/** xlsx 는 무거워서(≈400KB) 실제로 가져오기/내보내기를 할 때만 내려받는다. */
async function loadXLSX() {
  return import('xlsx')
}

export async function readWorkbook(file: File, sheetName?: string): Promise<SheetData> {
  const XLSX = await loadXLSX()
  const buffer = await file.arrayBuffer()
  const book = XLSX.read(buffer, { cellDates: true })
  const sheetNames = book.SheetNames
  const activeSheet = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0]
  if (!activeSheet) throw new Error('시트를 찾을 수 없습니다.')
  const sheet = book.Sheets[activeSheet]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
    dateNF: 'yyyy-mm-dd',
  })
  const headerMatrix = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false })
  const headers = (headerMatrix[0] ?? [])
    .map((h) => String(h ?? '').trim())
    .filter((h) => h.length > 0)
  return { sheetNames, activeSheet, headers, rows }
}

const TRUE_WORDS = ['o', 'ㅇ', '○', '●', 'v', 'y', 'yes', 'true', '1', '참석', '방문', '참여', '송부', '화환', '예', '함']
const FALSE_WORDS = ['x', '×', 'n', 'no', 'false', '0', '불참', '미참석', '미참', '없음', '아니오', '안함', '-']

function parseBoolean(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw
  const value = String(raw ?? '').trim().toLowerCase()
  if (!value) return false
  if (FALSE_WORDS.includes(value)) return false
  if (TRUE_WORDS.includes(value)) return true
  if (FALSE_WORDS.some((w) => w.length > 1 && value.includes(w))) return false
  if (TRUE_WORDS.some((w) => w.length > 1 && value.includes(w))) return true
  return false
}

function parseCellDate(raw: unknown): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return toISODate(raw)
  const value = String(raw ?? '').trim()
  if (!value) return null

  // 엑셀 시리얼 값 (1900-01-01 = 1, 윤년 버그 때문에 기준일은 1899-12-30)
  if (/^\d{5}$/.test(value)) {
    const serial = Number(value)
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000)
    if (!Number.isNaN(date.getTime())) {
      return toISODate(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    }
  }
  // 20260818
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`

  const matched = value.match(/(\d{2,4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/)
  if (matched) {
    let year = Number(matched[1])
    if (year < 100) year += year < 70 ? 2000 : 1900
    const month = Number(matched[2])
    const day = Number(matched[3])
    const date = new Date(year, month - 1, day)
    if (date.getMonth() === month - 1 && date.getDate() === day) return toISODate(date)
  }
  const fallback = new Date(value)
  if (!Number.isNaN(fallback.getTime())) return toISODate(fallback)
  return null
}

function parseCellAmount(raw: unknown): number {
  if (typeof raw === 'number') return Math.round(raw)
  const value = String(raw ?? '')
  const manwon = value.match(/^\s*(\d+(?:\.\d+)?)\s*만/)
  if (manwon) return Math.round(Number(manwon[1]) * 10_000)
  const digits = value.replace(/[^\d]/g, '')
  return digits ? Number(digits) : 0
}

export interface ConversionResult {
  drafts: EventDraft[]
  skipped: Array<{ row: number; reason: string }>
}

export function rowsToDrafts(
  rows: Array<Record<string, unknown>>,
  mapping: ColumnMapping,
): ConversionResult {
  const drafts: EventDraft[] = []
  const skipped: Array<{ row: number; reason: string }> = []

  rows.forEach((row, index) => {
    const rowNumber = index + 2 // 헤더가 1행
    const rawName = mapping.target_name ? String(row[mapping.target_name] ?? '').trim() : ''
    const rawDate = mapping.event_date ? row[mapping.event_date] : ''
    const date = parseCellDate(rawDate)

    if (!rawName && !date) return // 완전히 빈 줄은 조용히 건너뛴다
    if (!rawName) {
      skipped.push({ row: rowNumber, reason: '성명이 비어 있음' })
      return
    }
    if (!date) {
      skipped.push({ row: rowNumber, reason: `날짜를 읽을 수 없음 ("${String(rawDate ?? '')}")` })
      return
    }

    const { target_name, relation } = splitName(rawName)
    const notesParts: string[] = []
    if (mapping.notes) {
      const note = String(row[mapping.notes] ?? '').trim()
      if (note) notesParts.push(note)
    }

    drafts.push({
      target_name,
      relation,
      event_date: date,
      event_type: normalizeEventType(
        mapping.event_type ? String(row[mapping.event_type] ?? '') : '',
      ),
      amount: mapping.amount ? parseCellAmount(row[mapping.amount]) : 0,
      attended: mapping.attended ? parseBoolean(row[mapping.attended]) : false,
      sent_wreath: mapping.sent_wreath ? parseBoolean(row[mapping.sent_wreath]) : false,
      notes: notesParts.join('\n'),
      image_path: null,
    })
  })

  return { drafts, skipped }
}

/** 내역을 엑셀 파일로 저장한다. 헤더는 가져오기가 그대로 다시 읽을 수 있는 이름을 쓴다. */
export async function exportToExcel(records: EventRecord[], fileName?: string): Promise<void> {
  const XLSX = await loadXLSX()
  const rows = records.map((record) => ({
    날짜: record.event_date,
    성명: displayName(record),
    경조내역: record.event_type,
    금액: record.amount,
    참석여부: record.attended ? 'O' : 'X',
    화환송부: record.sent_wreath ? 'O' : 'X',
    비고: record.notes,
  }))

  const sheet = XLSX.utils.json_to_sheet(rows, {
    header: ['날짜', '성명', '경조내역', '금액', '참석여부', '화환송부', '비고'],
  })
  sheet['!cols'] = [
    { wch: 12 },
    { wch: 18 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 40 },
  ]
  if (rows.length > 0) sheet['!autofilter'] = { ref: `A1:G${rows.length + 1}` }

  const total = records.reduce((sum, record) => sum + record.amount, 0)
  const summary = XLSX.utils.json_to_sheet([
    { 항목: '총 건수', 값: `${records.length}건` },
    { 항목: '총 지출', 값: `${formatWon(total)}원` },
    { 항목: '참석', 값: `${records.filter((r) => r.attended).length}건` },
    { 항목: '화환 송부', 값: `${records.filter((r) => r.sent_wreath).length}건` },
    { 항목: '내보낸 시각', 값: new Date().toLocaleString('ko-KR') },
  ])
  summary['!cols'] = [{ wch: 14 }, { wch: 24 }]

  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, '경조사내역')
  XLSX.utils.book_append_sheet(book, summary, '요약')
  XLSX.writeFile(book, fileName ?? `인연페이북_${toISODate(new Date())}.xlsx`)
}
