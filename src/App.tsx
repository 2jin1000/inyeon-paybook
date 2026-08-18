import { useEffect, useState } from 'react'
import { AppProvider, useApp } from './store'
import type { EventRecord } from './types'
import { Dashboard } from './pages/Dashboard'
import { Records } from './pages/Records'
import { People } from './pages/People'
import { Settings } from './pages/Settings'
import { EventForm } from './components/EventForm'
import { Login } from './components/Login'
import { Spinner, ToastProvider } from './components/ui'

type Tab = 'home' | 'records' | 'people' | 'settings'

const TABS: Array<{ key: Tab; label: string; emoji: string }> = [
  { key: 'home', label: '대시보드', emoji: '📊' },
  { key: 'records', label: '내역', emoji: '🧾' },
  { key: 'people', label: '인맥', emoji: '👥' },
  { key: 'settings', label: '설정', emoji: '⚙️' },
]

const TITLES: Record<Tab, string> = {
  home: '인연 페이북',
  records: '경조사 내역',
  people: '인맥 히스토리',
  settings: '설정',
}

function Shell() {
  const { loading, needsLogin, mode, error, refresh } = useApp()
  const [tab, setTab] = useState<Tab>(() => {
    const hash = window.location.hash.replace('#', '') as Tab
    return TABS.some((t) => t.key === hash) ? hash : 'home'
  })
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<EventRecord | null>(null)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    window.location.hash = tab
  }, [tab])

  useEffect(() => {
    const goOnline = () => {
      setOnline(true)
      void refresh()
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [refresh])

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(record: EventRecord) {
    setEditing(record)
    setFormOpen(true)
  }

  if (needsLogin) return <Login />
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label="준비하는 중…" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <header className="sticky top-0 z-20 border-b border-ink-800/70 bg-ink-950/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-extrabold tracking-tight">{TITLES[tab]}</h1>
          <div className="flex items-center gap-2">
            {!online ? (
              <span className="chip bg-warm-500/15 text-warm-500">오프라인</span>
            ) : null}
            <span className="chip border border-ink-800 bg-ink-900 text-ink-400">
              {mode === 'cloud' ? '☁️ 동기화' : '📱 이 기기'}
            </span>
          </div>
        </div>
      </header>

      {error ? (
        <div className="mx-4 mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-500">
          {error}
          <button
            type="button"
            className="ml-2 underline underline-offset-2"
            onClick={() => void refresh()}
          >
            다시 시도
          </button>
        </div>
      ) : null}

      <main className="flex-1 pt-3">
        {tab === 'home' ? <Dashboard onSelect={openEdit} /> : null}
        {tab === 'records' ? <Records onSelect={openEdit} /> : null}
        {tab === 'people' ? <People onSelect={openEdit} /> : null}
        {tab === 'settings' ? <Settings /> : null}
      </main>

      {/* 하단 탭 + 가운데 기록 버튼 */}
      <div className="h-24" aria-hidden />
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-800 bg-ink-950/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-stretch justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          {TABS.slice(0, 2).map((item) => (
            <TabButton key={item.key} item={item} active={tab === item.key} onClick={setTab} />
          ))}

          <button
            type="button"
            onClick={openNew}
            aria-label="경조사 기록하기"
            className="relative -mt-7 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-500 text-2xl text-white shadow-lg shadow-brand-500/30 transition active:scale-95"
          >
            +
          </button>

          {TABS.slice(2).map((item) => (
            <TabButton key={item.key} item={item} active={tab === item.key} onClick={setTab} />
          ))}
        </div>
      </nav>

      <EventForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
    </div>
  )
}

function TabButton({
  item,
  active,
  onClick,
}: {
  item: { key: Tab; label: string; emoji: string }
  active: boolean
  onClick: (tab: Tab) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(item.key)}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition ${
        active ? 'text-brand-400' : 'text-ink-400'
      }`}
    >
      <span className="text-lg" aria-hidden>
        {item.emoji}
      </span>
      {item.label}
    </button>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ToastProvider>
  )
}
