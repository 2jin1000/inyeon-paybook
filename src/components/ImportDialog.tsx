import { useMemo, useRef, useState } from 'react'
import { useApp } from '../store'
import { displayName } from '../types'
import { formatWon } from '../lib/format'
import {
  MAPPING_FIELDS,
  guessMapping,
  readWorkbook,
  rowsToDrafts,
  type ColumnMapping,
  type SheetData,
} from '../lib/excel'
import { Sheet, TypeBadge, useToast } from './ui'

/** 엑셀 → 우리 스키마 매핑 화면. 헤더를 추정해 채운 뒤 사용자가 고칠 수 있게 한다. */
export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { importRecords } = useApp()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [sheet, setSheet] = useState<SheetData | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)
  const [busy, setBusy] = useState(false)

  const converted = useMemo(() => {
    if (!sheet || !mapping) return null
    return rowsToDrafts(sheet.rows, mapping)
  }, [sheet, mapping])

  function reset() {
    setFile(null)
    setSheet(null)
    setMapping(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function loadFile(nextFile: File | undefined | null, sheetName?: string) {
    if (!nextFile) return
    setBusy(true)
    try {
      const data = await readWorkbook(nextFile, sheetName)
      setFile(nextFile)
      setSheet(data)
      setMapping(guessMapping(data.headers))
    } catch (error) {
      toast(error instanceof Error ? error.message : '파일을 읽지 못했습니다.', 'error')
      reset()
    } finally {
      setBusy(false)
    }
  }

  async function runImport() {
    if (!converted || converted.drafts.length === 0) return
    setBusy(true)
    try {
      const count = await importRecords(converted.drafts)
      toast(`${count}건을 가져왔습니다.`)
      reset()
      onClose()
    } catch (error) {
      toast(error instanceof Error ? error.message : '가져오지 못했습니다.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const ready = Boolean(mapping?.event_date && mapping?.target_name)

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="엑셀 가져오기"
      footer={
        sheet ? (
          <div className="flex gap-2">
            <button type="button" className="btn-ghost px-4" onClick={reset}>
              다시 선택
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={!ready || busy || !converted || converted.drafts.length === 0}
              onClick={() => void runImport()}
            >
              {busy ? '가져오는 중…' : `${converted?.drafts.length ?? 0}건 가져오기`}
            </button>
          </div>
        ) : null
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(event) => void loadFile(event.target.files?.[0])}
      />

      {!sheet ? (
        <div className="space-y-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              void loadFile(event.dataTransfer.files?.[0])
            }}
            className="flex w-full flex-col items-center gap-1 rounded-xl border border-dashed border-ink-700 bg-ink-850/60 px-4 py-10 text-center transition hover:border-brand-500"
          >
            <span className="text-3xl" aria-hidden>
              📄
            </span>
            <span className="text-sm font-medium text-ink-100">
              {busy ? '읽는 중…' : '엑셀 파일 선택 (.xlsx · .xls · .csv)'}
            </span>
            <span className="text-xs text-ink-400">파일을 끌어다 놓아도 됩니다</span>
          </button>
          <div className="rounded-xl border border-ink-800 bg-ink-900 p-3 text-xs leading-relaxed text-ink-400">
            <p className="mb-1 font-semibold text-ink-300">이런 표를 그대로 넣을 수 있습니다</p>
            <p>날짜 · 성명 · 경조내역 · 금액 · 송금/참석여부 · 비고</p>
            <p className="mt-1">
              헤더 이름이 달라도 다음 단계에서 직접 연결할 수 있습니다. "홍길동(대학동기)" 처럼
              적혀 있으면 이름과 관계를 자동으로 나눕니다.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-ink-800 bg-ink-900 px-3 py-2.5">
            <span className="min-w-0 flex-1 truncate text-sm text-ink-300">📄 {file?.name}</span>
            {sheet.sheetNames.length > 1 ? (
              <select
                className="shrink-0 rounded-lg border border-ink-700 bg-ink-850 px-2 py-1 text-xs text-ink-300 outline-none"
                value={sheet.activeSheet}
                onChange={(event) => void loadFile(file, event.target.value)}
              >
                {sheet.sheetNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          {/* 컬럼 매핑 */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-ink-100">컬럼 연결</h3>
            {MAPPING_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center gap-3">
                <div className="w-24 shrink-0">
                  <p className="text-sm text-ink-300">
                    {field.label}
                    {field.required ? <span className="text-rose-500"> *</span> : null}
                  </p>
                </div>
                <select
                  className="field flex-1 py-2 text-sm"
                  value={mapping?.[field.key] ?? ''}
                  onChange={(event) =>
                    setMapping((current) =>
                      current ? { ...current, [field.key]: event.target.value || null } : current,
                    )
                  }
                >
                  <option value="">— 사용 안 함 —</option>
                  {sheet.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <p className="text-xs text-ink-400">
              {MAPPING_FIELDS.find((f) => f.key === 'attended')?.hint}
            </p>
          </div>

          {/* 미리보기 */}
          {converted ? (
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-ink-100">미리보기</h3>
                <span className="text-xs text-ink-400">
                  전체 {sheet.rows.length}행 중 {converted.drafts.length}건 인식
                </span>
              </div>
              {converted.drafts.length === 0 ? (
                <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100">
                  가져올 수 있는 행이 없습니다. 날짜와 성명 컬럼 연결을 확인해 주세요.
                </p>
              ) : (
                <ul className="space-y-2">
                  {converted.drafts.slice(0, 5).map((draft, index) => (
                    <li
                      key={index}
                      className="rounded-xl border border-ink-800 bg-ink-850 p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-ink-100">{displayName(draft)}</span>
                        <span className="tabular-nums text-ink-100">
                          {formatWon(draft.amount)}원
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-400">
                        <span>{draft.event_date}</span>
                        <TypeBadge type={draft.event_type} size="sm" />
                        {draft.attended ? <span className="text-mint-500">참석</span> : null}
                        {draft.sent_wreath ? <span className="text-warm-500">화환</span> : null}
                      </div>
                    </li>
                  ))}
                  {converted.drafts.length > 5 ? (
                    <li className="text-center text-xs text-ink-400">
                      … 외 {converted.drafts.length - 5}건
                    </li>
                  ) : null}
                </ul>
              )}

              {converted.skipped.length > 0 ? (
                <div className="mt-3 rounded-xl border border-warm-500/30 bg-warm-500/10 p-3 text-xs text-warm-500">
                  <p className="font-semibold">건너뛴 행 {converted.skipped.length}개</p>
                  <ul className="mt-1 space-y-0.5">
                    {converted.skipped.slice(0, 5).map((item) => (
                      <li key={item.row}>
                        {item.row}행: {item.reason}
                      </li>
                    ))}
                    {converted.skipped.length > 5 ? (
                      <li>… 외 {converted.skipped.length - 5}개</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </Sheet>
  )
}
