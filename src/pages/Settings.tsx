import { useState } from 'react'
import { useApp } from '../store'
import { exportToExcel } from '../lib/excel'
import { formatWon } from '../lib/format'
import { summarize } from '../lib/stats'
import { ConfirmDialog, useToast } from '../components/ui'
import { ImportDialog } from '../components/ImportDialog'

export function Settings() {
  const {
    records,
    mode,
    cloudAvailable,
    email,
    signOut,
    clearAll,
    migrateLocalToCloud,
    useCloud,
  } = useApp()
  const toast = useToast()
  const [importOpen, setImportOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [busy, setBusy] = useState(false)

  const summary = summarize(records)

  async function handleExport() {
    if (records.length === 0) {
      toast('내보낼 기록이 없습니다.', 'info')
      return
    }
    setBusy(true)
    try {
      await exportToExcel(records)
      toast(`${records.length}건을 엑셀로 저장했습니다.`)
    } catch (error) {
      toast(error instanceof Error ? error.message : '내보내지 못했습니다.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleMigrate() {
    setBusy(true)
    try {
      const count = await migrateLocalToCloud()
      toast(
        count > 0
          ? `로컬 기록 ${count}건을 계정으로 올렸습니다.`
          : '올릴 로컬 기록이 없습니다.',
        count > 0 ? 'ok' : 'info',
      )
    } catch (error) {
      toast(error instanceof Error ? error.message : '업로드하지 못했습니다.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleClear() {
    setConfirmClear(false)
    try {
      await clearAll()
      toast('모든 기록을 삭제했습니다.')
    } catch (error) {
      toast(error instanceof Error ? error.message : '삭제하지 못했습니다.', 'error')
    }
  }

  return (
    <div className="space-y-4 px-4 pb-6">
      {/* 저장 상태 */}
      <section className="card">
        <h2 className="text-sm font-semibold text-ink-100">데이터 저장 위치</h2>
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-ink-800 bg-ink-850 p-3">
          <span className="text-2xl" aria-hidden>
            {mode === 'cloud' ? '☁️' : '📱'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink-100">
              {mode === 'cloud' ? '클라우드 동기화 중' : '이 브라우저에만 저장 중'}
            </p>
            <p className="mt-0.5 text-xs text-ink-400">
              {mode === 'cloud'
                ? `${email} · 다른 기기에서 로그인하면 같은 데이터를 볼 수 있습니다.`
                : '로그인 없이 바로 쓰는 모드입니다. 기기를 바꾸면 데이터가 따라가지 않으니 엑셀로 내보내 백업해 두세요.'}
            </p>
          </div>
        </div>

        {mode === 'cloud' ? (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="btn-ghost flex-1 py-2.5 text-xs"
              disabled={busy}
              onClick={() => void handleMigrate()}
            >
              로컬 기록 올리기
            </button>
            <button
              type="button"
              className="btn-ghost flex-1 py-2.5 text-xs"
              onClick={() => void signOut()}
            >
              로그아웃
            </button>
          </div>
        ) : cloudAvailable ? (
          <button type="button" className="btn-primary mt-2 w-full py-2.5 text-sm" onClick={useCloud}>
            로그인하고 클라우드로 전환
          </button>
        ) : (
          <p className="mt-2 rounded-xl border border-ink-800 bg-ink-900 p-3 text-xs leading-relaxed text-ink-400">
            <span className="font-semibold text-ink-300">클라우드로 쓰려면</span> 프로젝트 루트의{' '}
            <code className="rounded bg-ink-850 px-1">.env</code> 파일에 Supabase URL 과 anon key 를
            넣고 앱을 다시 실행하세요. 자세한 절차는 README 를 참고하세요.
          </p>
        )}
      </section>

      {/* 데이터 */}
      <section className="card">
        <h2 className="text-sm font-semibold text-ink-100">데이터 관리</h2>
        <p className="mt-1 text-xs text-ink-400">
          현재 {summary.count}건 · 합계 {formatWon(summary.total)}원
        </p>
        <div className="mt-3 space-y-2">
          <button
            type="button"
            className="btn-ghost w-full justify-start"
            onClick={() => setImportOpen(true)}
          >
            📥 엑셀 가져오기
            <span className="ml-auto text-xs font-normal text-ink-400">기존 표를 매핑해서 등록</span>
          </button>
          <button
            type="button"
            className="btn-ghost w-full justify-start"
            disabled={busy}
            onClick={() => void handleExport()}
          >
            📤 엑셀로 내보내기
            <span className="ml-auto text-xs font-normal text-ink-400">내역 + 요약 시트</span>
          </button>
          <button
            type="button"
            className="btn w-full justify-start border border-rose-500/40 bg-rose-500/10 text-rose-500"
            onClick={() => setConfirmClear(true)}
          >
            🗑️ 전체 삭제
          </button>
        </div>
      </section>

      {/* 앱 정보 */}
      <section className="card">
        <h2 className="text-sm font-semibold text-ink-100">앱 정보</h2>
        <dl className="mt-3 space-y-2 text-xs">
          <div className="flex justify-between">
            <dt className="text-ink-400">제품명</dt>
            <dd className="text-ink-300">인연 페이북 (In-yeon Paybook)</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-400">버전</dt>
            <dd className="text-ink-300">1.0.0</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-400">설치</dt>
            <dd className="text-ink-300">브라우저 메뉴 → 홈 화면에 추가</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-ink-400">
          오프라인에서도 열리며, 네트워크가 돌아오면 클라우드 모드에서 자동으로 다시 불러옵니다.
        </p>
      </section>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />

      <ConfirmDialog
        open={confirmClear}
        title="모든 기록을 삭제할까요?"
        message={`${summary.count}건이 모두 지워지며 되돌릴 수 없습니다.\n먼저 엑셀로 내보내 두는 것을 권합니다.`}
        confirmLabel="전체 삭제"
        onConfirm={() => void handleClear()}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}
