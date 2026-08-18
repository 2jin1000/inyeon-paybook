import { useEffect, useMemo, useState } from 'react'
import {
  EVENT_META,
  EVENT_TYPES,
  emptyDraft,
  type EventDraft,
  type EventRecord,
  type EventType,
} from '../types'
import { formatDateLong, relativeDay, todayISO, toISODate } from '../lib/format'
import { parsePastedText } from '../lib/parseText'
import { useApp } from '../store'
import { AmountInput, ConfirmDialog, Sheet, Toggle, useToast } from './ui'
import { ImagePicker } from './ImagePicker'

const RELATION_PRESETS = ['가족', '친척', '직장동료', '대학동기', '고등학교', '지인', '거래처', '동호회']

export function EventForm({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: EventRecord | null
}) {
  const { addRecord, updateRecord, removeRecord, records } = useApp()
  const toast = useToast()
  const [draft, setDraft] = useState<EventDraft>(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      const { id: _id, created_at: _c, updated_at: _u, ...rest } = editing
      setDraft(rest)
    } else {
      setDraft(emptyDraft())
    }
    setPasteOpen(false)
    setPasteText('')
  }, [open, editing])

  // 이미 입력한 관계들을 모아 프리셋에 더한다.
  const relationOptions = useMemo(() => {
    const used = new Set(records.map((r) => r.relation).filter(Boolean))
    return [...new Set([...RELATION_PRESETS, ...used])].slice(0, 14)
  }, [records])

  // 같은 이름이 이미 있으면 관계를 자동으로 제안한다.
  const nameSuggestion = useMemo(() => {
    if (!draft.target_name.trim() || draft.relation) return null
    const match = records.find(
      (r) => r.target_name === draft.target_name.trim() && r.relation,
    )
    return match?.relation ?? null
  }, [draft.target_name, draft.relation, records])

  function patch(next: Partial<EventDraft>) {
    setDraft((current) => ({ ...current, ...next }))
  }

  function applyPaste() {
    const { patch: parsed, hits } = parsePastedText(pasteText)
    if (hits.length === 0) {
      toast('문구에서 알아낼 수 있는 정보가 없었습니다. 직접 입력해 주세요.', 'info')
      return
    }
    patch(parsed)
    // 원문은 비고 아래에 붙여 나중에 확인할 수 있게 남긴다.
    setDraft((current) => ({
      ...current,
      notes: [current.notes, parsed.notes, `— 원문 —\n${pasteText.trim()}`]
        .filter(Boolean)
        .join('\n')
        .slice(0, 2000),
    }))
    toast(`${hits.join(' · ')} 을(를) 채웠습니다.`)
    setPasteOpen(false)
    setPasteText('')
  }

  async function save() {
    if (!draft.target_name.trim()) {
      toast('대상자 이름을 입력해 주세요.', 'error')
      return
    }
    if (!draft.event_date) {
      toast('일자를 선택해 주세요.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload: EventDraft = { ...draft, target_name: draft.target_name.trim() }
      if (editing) {
        await updateRecord(editing.id, payload)
        toast('기록을 수정했습니다.')
      } else {
        await addRecord(payload)
        toast('기록을 저장했습니다.')
      }
      onClose()
    } catch (error) {
      toast(error instanceof Error ? error.message : '저장하지 못했습니다.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing) return
    setConfirmDelete(false)
    try {
      await removeRecord(editing.id)
      toast('기록을 삭제했습니다.')
      onClose()
    } catch (error) {
      toast(error instanceof Error ? error.message : '삭제하지 못했습니다.', 'error')
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={editing ? '기록 수정' : '경조사 기록'}
        footer={
          <div className="flex gap-2">
            {editing ? (
              <button
                type="button"
                className="btn border border-rose-500/40 bg-rose-500/10 px-4 text-rose-500"
                onClick={() => setConfirmDelete(true)}
              >
                삭제
              </button>
            ) : null}
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? '저장 중…' : editing ? '수정 저장' : '저장하기'}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          {/* 붙여넣기로 자동 채우기 */}
          <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => setPasteOpen((v) => !v)}
            >
              <span className="text-sm font-medium text-brand-400">
                📋 부고 문자 · 청첩장 문구 붙여넣기
              </span>
              <span className="text-ink-400">{pasteOpen ? '−' : '+'}</span>
            </button>
            {pasteOpen ? (
              <div className="mt-3 space-y-2">
                <textarea
                  className="field min-h-28 text-sm"
                  placeholder={'카카오톡에서 복사한 문구를 그대로 붙여넣어 주세요.\n이름 · 날짜 · 분류 · 장소 · 계좌번호를 찾아 채웁니다.'}
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                />
                <button
                  type="button"
                  className="btn-primary w-full py-2.5 text-sm"
                  disabled={!pasteText.trim()}
                  onClick={applyPaste}
                >
                  자동으로 채우기
                </button>
              </div>
            ) : null}
          </div>

          {/* 누가 */}
          <div>
            <label className="field-label" htmlFor="target-name">
              누가 <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                id="target-name"
                className="field flex-1"
                placeholder="홍길동"
                autoComplete="off"
                value={draft.target_name}
                onChange={(event) => patch({ target_name: event.target.value })}
              />
              <input
                className="field w-32"
                placeholder="관계"
                autoComplete="off"
                list="relation-options"
                value={draft.relation}
                onChange={(event) => patch({ relation: event.target.value })}
              />
              <datalist id="relation-options">
                {relationOptions.map((relation) => (
                  <option key={relation} value={relation} />
                ))}
              </datalist>
            </div>
            {nameSuggestion ? (
              <button
                type="button"
                className="mt-2 text-xs text-brand-400 underline underline-offset-2"
                onClick={() => patch({ relation: nameSuggestion })}
              >
                이전 기록의 관계 "{nameSuggestion}" 적용
              </button>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {relationOptions.slice(0, 6).map((relation) => (
                  <button
                    key={relation}
                    type="button"
                    onClick={() => patch({ relation })}
                    className={`chip border transition ${
                      draft.relation === relation
                        ? 'border-brand-500 bg-brand-500/15 text-brand-400'
                        : 'border-ink-700 bg-ink-850 text-ink-400 hover:text-ink-100'
                    }`}
                  >
                    {relation}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 언제 */}
          <div>
            <label className="field-label" htmlFor="event-date">
              언제 <span className="text-rose-500">*</span>
            </label>
            <input
              id="event-date"
              type="date"
              className="field"
              value={draft.event_date}
              onChange={(event) => patch({ event_date: event.target.value })}
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                className="chip border border-ink-700 bg-ink-850 text-ink-400 hover:text-ink-100"
                onClick={() => patch({ event_date: todayISO() })}
              >
                오늘
              </button>
              <button
                type="button"
                className="chip border border-ink-700 bg-ink-850 text-ink-400 hover:text-ink-100"
                onClick={() =>
                  patch({ event_date: toISODate(new Date(Date.now() - 86_400_000)) })
                }
              >
                어제
              </button>
              <span className="text-xs text-ink-400">
                {formatDateLong(draft.event_date)} · {relativeDay(draft.event_date)}
              </span>
            </div>
          </div>

          {/* 어떤 일 */}
          <div>
            <span className="field-label">어떤 일</span>
            <div className="grid grid-cols-4 gap-2">
              {EVENT_TYPES.map((type: EventType) => {
                const active = draft.event_type === type
                const meta = EVENT_META[type]
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => patch({ event_type: type })}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-xs font-medium transition ${
                      active ? 'border-transparent text-ink-100' : 'border-ink-700 bg-ink-850 text-ink-400'
                    }`}
                    style={active ? { backgroundColor: `${meta.color}2e`, borderColor: meta.color } : undefined}
                  >
                    <span className="text-lg" aria-hidden>
                      {meta.emoji}
                    </span>
                    {type}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 얼마 */}
          <div>
            <span className="field-label">얼마</span>
            <AmountInput value={draft.amount} onChange={(amount) => patch({ amount })} />
          </div>

          {/* 액션 체크 */}
          <div className="grid gap-2 sm:grid-cols-2">
            <Toggle
              emoji="💐"
              label="화환 송부"
              description={draft.sent_wreath ? '보냄' : '보내지 않음'}
              checked={draft.sent_wreath}
              onChange={(sent_wreath) => patch({ sent_wreath })}
            />
            <Toggle
              emoji="🙋"
              label="직접 참석"
              description={draft.attended ? '참석함' : '참석하지 않음'}
              checked={draft.attended}
              onChange={(attended) => patch({ attended })}
            />
          </div>

          {/* 비고 */}
          <div>
            <label className="field-label" htmlFor="notes">
              비고
            </label>
            <textarea
              id="notes"
              className="field min-h-24 text-sm"
              placeholder="송금 계좌번호, 동행자, 전달 사항 등"
              value={draft.notes}
              onChange={(event) => patch({ notes: event.target.value })}
            />
          </div>

          {/* 이미지 */}
          <div>
            <span className="field-label">청첩장 · 부고장 이미지</span>
            <ImagePicker value={draft.image_path} onChange={(image_path) => patch({ image_path })} />
          </div>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        title="기록을 삭제할까요?"
        message={`${draft.target_name || '이 기록'} 의 내역이 영구히 삭제됩니다.`}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
