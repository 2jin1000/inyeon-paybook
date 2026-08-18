import type { EventDraft, EventRecord } from '../../types'

export type RepoMode = 'local' | 'cloud'

/**
 * 저장소 어댑터. 로컬(IndexedDB)과 Supabase 구현이 같은 인터페이스를 만족하므로
 * 화면 코드는 어느 쪽에 붙어 있는지 몰라도 된다.
 */
export interface Repo {
  readonly mode: RepoMode
  list(): Promise<EventRecord[]>
  create(draft: EventDraft): Promise<EventRecord>
  update(id: string, patch: Partial<EventDraft>): Promise<EventRecord>
  remove(id: string): Promise<void>
  bulkCreate(drafts: EventDraft[]): Promise<EventRecord[]>
  /** 전체 삭제 (설정 화면의 초기화). */
  clear(): Promise<void>
  /** 이미지 저장 후 image_path 반환. */
  putImage(blob: Blob): Promise<string>
  /** 화면에 표시할 수 있는 URL. 로컬 모드는 object URL 이므로 revoke 필요. */
  getImageUrl(path: string): Promise<string | null>
  removeImage(path: string): Promise<void>
  /** 다른 기기/탭의 변경을 구독한다. 지원하지 않으면 no-op 해제 함수를 돌려준다. */
  subscribe(onChange: () => void): () => void
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // 구형 브라우저/비보안 컨텍스트 폴백
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function stamp(): string {
  return new Date().toISOString()
}
