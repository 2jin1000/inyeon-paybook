import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePastedText } from '../src/lib/parseText'
import { guessMapping, rowsToDrafts } from '../src/lib/excel'
import { byPerson, byType, monthlyTrend, summarize } from '../src/lib/stats'
import { normalizeEventType, splitName } from '../src/types'
import { formatAmountInput, parseAmount, relativeDay } from '../src/lib/format'

const THIS_YEAR = new Date().getFullYear()

test('부고 문자 파싱', () => {
  const { patch } = parsePastedText(`
    訃告
    홍길동님의 부친께서 2026년 3월 5일 별세하셨기에 삼가 알려드립니다.
    빈소: 서울성모병원 장례식장 3호실
    발인: 2026년 3월 7일
    마음 전하실 곳: 국민은행 123-45-6789 홍길동
  `)
  assert.equal(patch.event_type, '부고')
  assert.equal(patch.event_date, '2026-03-05')
  assert.equal(patch.target_name, '홍길동')
  assert.match(patch.notes ?? '', /계좌/)
})

test('모바일 청첩장 파싱 (연도 생략)', () => {
  const { patch } = parsePastedText('신랑 김철수 · 신부 이영희\n12월 20일 토요일 오후 1시\n더컨벤션 웨딩홀')
  assert.equal(patch.event_type, '결혼')
  assert.equal(patch.target_name, '김철수')
  assert.ok(patch.event_date?.endsWith('-12-20'), `got ${patch.event_date}`)
})

test('금액 표기 파싱', () => {
  assert.equal(parsePastedText('축의금 5만원 전달').patch.amount, 50_000)
  assert.equal(parsePastedText('조의금 100,000원 송금').patch.amount, 100_000)
  assert.equal(parseAmount('50,000원'), 50_000)
  assert.equal(formatAmountInput('1234567'), '1,234,567')
})

test('이름/관계 분리와 분류 정규화', () => {
  assert.deepEqual(splitName('홍길동(대학동기)'), { target_name: '홍길동', relation: '대학동기' })
  assert.deepEqual(splitName('홍길동'), { target_name: '홍길동', relation: '' })
  assert.equal(normalizeEventType('위로'), '병문안')
  assert.equal(normalizeEventType('결혼(축의금)'), '결혼')
  assert.equal(normalizeEventType('부친상'), '부고')
  assert.equal(normalizeEventType(''), '기타')
})

test('엑셀 헤더 추정 + 행 변환', () => {
  const rows = [
    { 날짜: '2024.03.05', 성명: '김영희(직장동료)', 경조내역: '결혼', 금액: '100,000', '송금및참석여부': '참석', 비고: '동행 박대리' },
    { 날짜: '20240712', 성명: '이철수', 경조내역: '부친상', 금액: '5만', '송금및참석여부': 'X', 비고: '' },
    { 날짜: '', 성명: '', 경조내역: '', 금액: '', '송금및참석여부': '', 비고: '' },
    { 날짜: '이상한값', 성명: '박모름', 경조내역: '', 금액: '', '송금및참석여부': '', 비고: '' },
  ]
  const mapping = guessMapping(Object.keys(rows[0]))
  assert.equal(mapping.event_date, '날짜')
  assert.equal(mapping.target_name, '성명')
  assert.equal(mapping.event_type, '경조내역')
  assert.equal(mapping.amount, '금액')

  const { drafts, skipped } = rowsToDrafts(rows, { ...mapping, attended: '송금및참석여부' })
  assert.equal(drafts.length, 2)
  assert.equal(drafts[0].event_date, '2024-03-05')
  assert.equal(drafts[0].target_name, '김영희')
  assert.equal(drafts[0].relation, '직장동료')
  assert.equal(drafts[0].amount, 100_000)
  assert.equal(drafts[0].attended, true)
  assert.equal(drafts[1].event_date, '2024-07-12')
  assert.equal(drafts[1].event_type, '부고')
  assert.equal(drafts[1].amount, 50_000)
  assert.equal(drafts[1].attended, false)
  assert.equal(skipped.length, 1) // 날짜를 못 읽은 1행
})

const sample = [
  rec('1', '홍길동', '대학동기', `${THIS_YEAR}-01-10`, '결혼', 100_000, true, false),
  rec('2', '홍길동', '대학동기', `${THIS_YEAR}-05-02`, '부고', 50_000, false, true),
  rec('3', '김영희', '직장동료', `${THIS_YEAR}-05-20`, '결혼', 200_000, true, true),
]

function rec(
  id: string, name: string, relation: string, date: string, type: string,
  amount: number, attended: boolean, wreath: boolean,
) {
  return {
    id, target_name: name, relation, event_date: date,
    event_type: normalizeEventType(type), amount, attended, sent_wreath: wreath,
    notes: '', image_path: null, created_at: date, updated_at: date,
  }
}

test('집계', () => {
  const summary = summarize(sample)
  assert.equal(summary.count, 3)
  assert.equal(summary.total, 350_000)
  assert.equal(summary.attendedRate, 67)
  assert.equal(summary.wreathRate, 67)

  const types = byType(sample)
  assert.equal(types[0].type, '결혼')
  assert.equal(types[0].total, 300_000)
  assert.equal(types[0].share, 86)

  const people = byPerson(sample)
  assert.equal(people.length, 2)
  assert.equal(people[0].label, '김영희(직장동료)')
  assert.equal(people.find((p) => p.name === '홍길동')?.total, 150_000)

  const trend = monthlyTrend(sample, 12, new Date(`${THIS_YEAR}-05-15T00:00:00`))
  assert.equal(trend.length, 12)
  assert.equal(trend.at(-1)?.total, 250_000) // 5월: 50,000 + 200,000
})

test('상대 날짜', () => {
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  assert.equal(relativeDay(iso), '오늘')
})

