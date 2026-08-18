import type { SupabaseClient } from '@supabase/supabase-js'
import type { EventDraft, EventRecord } from '../../types'
import { normalizeEventType } from '../../types'
import { EVENTS_TABLE, IMAGE_BUCKET } from '../supabase'
import { sortRecords } from './local'
import { newId, type Repo } from './types'

type Row = {
  id: string
  user_id: string
  target_name: string | null
  relation: string | null
  event_date: string
  event_type: string | null
  amount: number | null
  sent_wreath: boolean | null
  attended: boolean | null
  notes: string | null
  image_path: string | null
  created_at: string
  updated_at: string
}

function toRecord(row: Row): EventRecord {
  return {
    id: row.id,
    target_name: row.target_name ?? '',
    relation: row.relation ?? '',
    event_date: row.event_date,
    event_type: normalizeEventType(row.event_type),
    amount: Number(row.amount ?? 0) || 0,
    sent_wreath: Boolean(row.sent_wreath),
    attended: Boolean(row.attended),
    notes: row.notes ?? '',
    image_path: row.image_path,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function toRow(draft: Partial<EventDraft>) {
  const row: Record<string, unknown> = {}
  if (draft.target_name !== undefined) row.target_name = draft.target_name
  if (draft.relation !== undefined) row.relation = draft.relation
  if (draft.event_date !== undefined) row.event_date = draft.event_date
  if (draft.event_type !== undefined) row.event_type = draft.event_type
  if (draft.amount !== undefined) row.amount = draft.amount
  if (draft.sent_wreath !== undefined) row.sent_wreath = draft.sent_wreath
  if (draft.attended !== undefined) row.attended = draft.attended
  if (draft.notes !== undefined) row.notes = draft.notes
  if (draft.image_path !== undefined) row.image_path = draft.image_path
  return row
}

/** Supabase(Postgres + Storage) 저장소. 로그인한 사용자의 행만 RLS 로 보인다. */
export class CloudRepo implements Repo {
  readonly mode = 'cloud' as const

  constructor(
    private client: SupabaseClient,
    private userId: string,
  ) {}

  async list(): Promise<EventRecord[]> {
    const { data, error } = await this.client
      .from(EVENTS_TABLE)
      .select('*')
      .order('event_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return sortRecords((data as Row[]).map(toRecord))
  }

  async create(draft: EventDraft): Promise<EventRecord> {
    const { data, error } = await this.client
      .from(EVENTS_TABLE)
      .insert({ ...toRow(draft), user_id: this.userId })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return toRecord(data as Row)
  }

  async bulkCreate(drafts: EventDraft[]): Promise<EventRecord[]> {
    if (drafts.length === 0) return []
    const created: EventRecord[] = []
    // 큰 엑셀 파일도 통과하도록 나눠서 넣는다.
    for (let i = 0; i < drafts.length; i += 200) {
      const chunk = drafts.slice(i, i + 200)
      const { data, error } = await this.client
        .from(EVENTS_TABLE)
        .insert(chunk.map((draft) => ({ ...toRow(draft), user_id: this.userId })))
        .select()
      if (error) throw new Error(error.message)
      created.push(...(data as Row[]).map(toRecord))
    }
    return created
  }

  async update(id: string, patch: Partial<EventDraft>): Promise<EventRecord> {
    const { data, error } = await this.client
      .from(EVENTS_TABLE)
      .update({ ...toRow(patch), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return toRecord(data as Row)
  }

  async remove(id: string): Promise<void> {
    const { data } = await this.client
      .from(EVENTS_TABLE)
      .select('image_path')
      .eq('id', id)
      .maybeSingle()
    const { error } = await this.client.from(EVENTS_TABLE).delete().eq('id', id)
    if (error) throw new Error(error.message)
    const imagePath = (data as { image_path: string | null } | null)?.image_path
    if (imagePath) await this.removeImage(imagePath)
  }

  async clear(): Promise<void> {
    const { error } = await this.client.from(EVENTS_TABLE).delete().eq('user_id', this.userId)
    if (error) throw new Error(error.message)
  }

  async putImage(blob: Blob): Promise<string> {
    const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg'
    const path = `${this.userId}/${newId()}.${ext}`
    const { error } = await this.client.storage
      .from(IMAGE_BUCKET)
      .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false })
    if (error) throw new Error(error.message)
    return path
  }

  async getImageUrl(path: string): Promise<string | null> {
    const { data, error } = await this.client.storage
      .from(IMAGE_BUCKET)
      .createSignedUrl(path, 60 * 60)
    if (error) return null
    return data?.signedUrl ?? null
  }

  async removeImage(path: string): Promise<void> {
    await this.client.storage.from(IMAGE_BUCKET).remove([path])
  }

  subscribe(onChange: () => void): () => void {
    const channel = this.client
      .channel('events-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: EVENTS_TABLE, filter: `user_id=eq.${this.userId}` },
        () => onChange(),
      )
      .subscribe()
    return () => {
      void this.client.removeChannel(channel)
    }
  }
}
