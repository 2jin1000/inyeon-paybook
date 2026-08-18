import { useRef, useState } from 'react'
import { useApp, useImageUrl } from '../store'
import { compressImage } from '../lib/image'
import { useToast } from './ui'

/**
 * 청첩장 / 부고장 이미지 첨부.
 * 저장소(로컬 IndexedDB 또는 Supabase Storage)에 바로 올리고 image_path 만 폼에 넘긴다.
 */
export function ImagePicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (path: string | null) => void
}) {
  const { repo } = useApp()
  const toast = useToast()
  const url = useImageUrl(value)
  const [busy, setBusy] = useState(false)
  const [zoom, setZoom] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | null | undefined) {
    if (!file || !repo) return
    setBusy(true)
    try {
      const blob = await compressImage(file)
      const path = await repo.putImage(blob)
      if (value) await repo.removeImage(value).catch(() => {})
      onChange(path)
    } catch (error) {
      toast(error instanceof Error ? error.message : '이미지를 저장하지 못했습니다.', 'error')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleRemove() {
    if (!value || !repo) return
    onChange(null)
    await repo.removeImage(value).catch(() => {})
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      {value && url ? (
        <div className="relative overflow-hidden rounded-xl border border-ink-700">
          <img
            src={url}
            alt="첨부한 청첩장 또는 부고장"
            className="max-h-56 w-full cursor-zoom-in object-cover"
            onClick={() => setZoom(true)}
          />
          <div className="flex gap-2 border-t border-ink-700 bg-ink-850 p-2">
            <button
              type="button"
              className="btn-ghost flex-1 py-2 text-xs"
              onClick={() => inputRef.current?.click()}
            >
              다시 선택
            </button>
            <button
              type="button"
              className="btn flex-1 border border-rose-500/40 bg-rose-500/10 py-2 text-xs text-rose-500"
              onClick={() => void handleRemove()}
            >
              삭제
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            void handleFile(event.dataTransfer.files?.[0])
          }}
          className="flex w-full flex-col items-center gap-1 rounded-xl border border-dashed border-ink-700 bg-ink-850/60 px-4 py-6 text-center transition hover:border-brand-500"
        >
          <span className="text-2xl" aria-hidden>
            {busy ? '⏳' : '🖼️'}
          </span>
          <span className="text-sm font-medium text-ink-100">
            {busy ? '저장하는 중…' : '청첩장 · 부고장 이미지 첨부'}
          </span>
          <span className="text-xs text-ink-400">갤러리에서 선택하거나 파일을 끌어다 놓으세요</span>
        </button>
      )}

      {value && !url ? (
        <p className="mt-2 text-xs text-ink-400">이미지를 불러오는 중이거나 찾을 수 없습니다.</p>
      ) : null}

      {zoom && url ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setZoom(false)}
        >
          <img src={url} alt="첨부 이미지 원본" className="max-h-full max-w-full object-contain" />
        </div>
      ) : null}
    </div>
  )
}
