/** 경조사 분류. PRD 2-A 목록을 기준으로 하며, 스키마 표의 '위로'는 가져오기 시 '병문안'으로 매핑한다. */
export const EVENT_TYPES = ['부고', '결혼', '개업', '축하', '병문안', '찬조', '기타'] as const

export type EventType = (typeof EVENT_TYPES)[number]

/**
 * 분류별 배지 색상 / 아이콘 (밝은 배경 기준).
 * 색은 배지 배경을 옅게 물들이는 용도이고, 식별은 항상 이름과 이모지가 담당한다.
 * 글자는 색이 아니라 본문 색을 쓰므로 색각 이상이나 흑백 출력에서도 읽힌다.
 * (차트도 단일 색 + 직접 라벨을 쓴다.)
 */
export const EVENT_META: Record<EventType, { color: string; emoji: string }> = {
  부고: { color: '#2a78d6', emoji: '🕯️' },
  결혼: { color: '#e87ba4', emoji: '💍' },
  개업: { color: '#eb6834', emoji: '🎉' },
  축하: { color: '#eda100', emoji: '🎁' },
  병문안: { color: '#1baf7a', emoji: '🏥' },
  찬조: { color: '#4a3aa7', emoji: '🤝' },
  기타: { color: '#6b7385', emoji: '📌' },
}

/** 가져오기 시 만나는 표기 흔들림을 표준 분류로 정규화한다. */
const TYPE_ALIASES: Record<string, EventType> = {
  위로: '병문안',
  문병: '병문안',
  조의: '부고',
  조사: '부고',
  부의: '부고',
  장례: '부고',
  상: '부고',
  조문: '부고',
  결혼식: '결혼',
  혼사: '결혼',
  청첩: '결혼',
  축의: '결혼',
  돌: '축하',
  돌잔치: '축하',
  생일: '축하',
  승진: '축하',
  출산: '축하',
  입학: '축하',
  졸업: '축하',
  개업식: '개업',
  이전: '개업',
  후원: '찬조',
  기부: '찬조',
}

export function normalizeEventType(raw: string | null | undefined): EventType {
  const value = (raw ?? '').trim()
  if (!value) return '기타'
  if ((EVENT_TYPES as readonly string[]).includes(value)) return value as EventType
  if (TYPE_ALIASES[value]) return TYPE_ALIASES[value]
  // "결혼(축의금)", "부친상" 처럼 다른 글자가 섞인 경우 부분 일치로 찾는다.
  for (const type of EVENT_TYPES) {
    if (value.includes(type)) return type
  }
  for (const [alias, type] of Object.entries(TYPE_ALIASES)) {
    if (value.includes(alias)) return type
  }
  return '기타'
}

export interface EventRecord {
  id: string
  /** 대상자 이름 */
  target_name: string
  /** 관계 (예: 대학동기) */
  relation: string
  /** YYYY-MM-DD */
  event_date: string
  event_type: EventType
  /** 원 단위 정수 */
  amount: number
  sent_wreath: boolean
  attended: boolean
  notes: string
  /**
   * 청첩장/부고장 이미지 위치.
   * 로컬 모드: IndexedDB 키 (`img:<uuid>`), Supabase 모드: 스토리지 경로 (`<uid>/<uuid>.jpg`)
   */
  image_path: string | null
  created_at: string
  updated_at: string
}

export type EventDraft = Omit<EventRecord, 'id' | 'created_at' | 'updated_at'>

/** 이름과 관계를 "홍길동(대학동기)" 형태로 합친다. */
export function displayName(record: Pick<EventRecord, 'target_name' | 'relation'>): string {
  return record.relation ? `${record.target_name}(${record.relation})` : record.target_name
}

/** "홍길동(대학동기)" 를 이름/관계로 분리한다. 괄호가 없으면 관계는 빈 값. */
export function splitName(raw: string): { target_name: string; relation: string } {
  const matched = raw.trim().match(/^(.*?)[(（[【]\s*([^)）\]】]*)[)）\]】]\s*$/)
  if (matched) {
    return { target_name: matched[1].trim(), relation: matched[2].trim() }
  }
  return { target_name: raw.trim(), relation: '' }
}

export function emptyDraft(): EventDraft {
  return {
    target_name: '',
    relation: '',
    event_date: new Date().toISOString().slice(0, 10),
    event_type: '결혼',
    amount: 0,
    sent_wreath: false,
    attended: false,
    notes: '',
    image_path: null,
  }
}
