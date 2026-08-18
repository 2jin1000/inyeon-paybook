import { createStore, del, get, getMany, keys, set, setMany, clear as idbClear } from 'idb-keyval'
import type { EventDraft, EventRecord } from '../../types'
import { normalizeEventType } from '../../types'
import { newId, stamp, type Repo } from './types'

const recordStore = createStore('inyeon-paybook', 'records')
const imageStore = createStore('inyeon-paybook-images', 'images')

const CHANNEL = 'inyeon-paybook-sync'

function sanitize(raw: unknown): EventRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.event_date !== 'string') return null
  return {
    id: r.id,
    target_name: String(r.target_name ?? ''),
    relation: String(r.relation ?? ''),
    event_date: r.event_date,
    event_type: normalizeEventType(String(r.event_type ?? '')),
    amount: Number(r.amount ?? 0) || 0,
    sent_wreath: Boolean(r.sent_wreath),
    attended: Boolean(r.attended),
    notes: String(r.notes ?? ''),
    image_path: typeof r.image_path === 'string' ? r.image_path : null,
    created_at: String(r.created_at ?? stamp()),
    updated_at: String(r.updated_at ?? stamp()),
  }
}

export function sortRecords(records: EventRecord[]): EventRecord[] {
  return records.sort((a, b) => {
    if (a.event_date !== b.event_date) return a.event_date < b.event_date ? 1 : -1
    return a.created_at < b.created_at ? 1 : -1
  })
}

/** 브라우저 IndexedDB 기반 저장소. 로그인 없이 즉시 동작하며 오프라인에서도 그대로 쓴다. */
export class LocalRepo implements Repo {
  readonly mode = 'local' as const

  private channel: BroadcastChannel | null =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null

  private notify() {
    this.channel?.postMessage('changed')
  }

  async list(): Promise<EventRecord[]> {
    const allKeys = await keys(recordStore)
    if (allKeys.length === 0) return []
    const values = await getMany(allKeys, recordStore)
    const records = values.map(sanitize).filter((r): r is EventRecord => r !== null)
    return sortRecords(records)
  }

  async create(draft: EventDraft): Promise<EventRecord> {
    const now = stamp()
    const record: EventRecord = { ...draft, id: newId(), created_at: now, updated_at: now }
    await set(record.id, record, recordStore)
    this.notify()
    return record
  }

  async bulkCreate(drafts: EventDraft[]): Promise<EventRecord[]> {
    const now = stamp()
    const records = drafts.map<EventRecord>((draft) => ({
      ...draft,
      id: newId(),
      created_at: now,
      updated_at: now,
    }))
    await setMany(
      records.map((record) => [record.id, record] as [string, EventRecord]),
      recordStore,
    )
    this.notify()
    return records
  }

  async update(id: string, patch: Partial<EventDraft>): Promise<EventRecord> {
    const existing = sanitize(await get(id, recordStore))
    if (!existing) throw new Error('수정할 기록을 찾지 못했습니다.')
    const next: EventRecord = { ...existing, ...patch, updated_at: stamp() }
    await set(id, next, recordStore)
    this.notify()
    return next
  }

  async remove(id: string): Promise<void> {
    const existing = sanitize(await get(id, recordStore))
    await del(id, recordStore)
    if (existing?.image_path) await this.removeImage(existing.image_path)
    this.notify()
  }

  async clear(): Promise<void> {
    await idbClear(recordStore)
    await idbClear(imageStore)
    this.notify()
  }

  async putImage(blob: Blob): Promise<string> {
    const path = `img:${newId()}`
    await set(path, blob, imageStore)
    return path
  }

  async getImageUrl(path: string): Promise<string | null> {
    const blob = await get<Blob>(path, imageStore)
    if (!blob) return null
    return URL.createObjectURL(blob)
  }

  async removeImage(path: string): Promise<void> {
    await del(path, imageStore)
  }

  subscribe(onChange: () => void): () => void {
    if (!this.channel) return () => {}
    const handler = () => onChange()
    this.channel.addEventListener('message', handler)
    return () => this.channel?.removeEventListener('message', handler)
  }
}
