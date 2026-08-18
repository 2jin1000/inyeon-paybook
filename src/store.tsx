import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import type { EventDraft, EventRecord } from './types'
import { CloudRepo } from './lib/repo/cloud'
import { LocalRepo } from './lib/repo/local'
import type { Repo, RepoMode } from './lib/repo/types'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const LOCAL_FALLBACK_KEY = 'inyeon:use-local'

interface AppContextValue {
  mode: RepoMode
  cloudAvailable: boolean
  session: Session | null
  email: string | null
  records: EventRecord[]
  loading: boolean
  error: string | null
  needsLogin: boolean
  repo: Repo | null
  refresh: () => Promise<void>
  addRecord: (draft: EventDraft) => Promise<EventRecord>
  updateRecord: (id: string, patch: Partial<EventDraft>) => Promise<EventRecord>
  removeRecord: (id: string) => Promise<void>
  importRecords: (drafts: EventDraft[]) => Promise<number>
  clearAll: () => Promise<void>
  continueLocally: () => void
  useCloud: () => void
  signOut: () => Promise<void>
  /** 로컬에 쌓인 기록을 로그인 계정으로 올린다. 올린 건수를 반환. */
  migrateLocalToCloud: () => Promise<number>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)
  const [preferLocal, setPreferLocal] = useState(
    () => localStorage.getItem(LOCAL_FALLBACK_KEY) === '1',
  )
  const [records, setRecords] = useState<EventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Supabase 세션 추적
  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setAuthReady(true)
      if (next) {
        // 로그인하면 클라우드로 승격한다.
        localStorage.removeItem(LOCAL_FALLBACK_KEY)
        setPreferLocal(false)
      }
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const cloudAvailable = isSupabaseConfigured
  const useCloudRepo = cloudAvailable && Boolean(session) && !preferLocal
  const needsLogin = cloudAvailable && !session && !preferLocal && authReady

  const repo = useMemo<Repo | null>(() => {
    if (useCloudRepo && supabase && session) return new CloudRepo(supabase, session.user.id)
    if (!cloudAvailable || preferLocal) return new LocalRepo()
    return null
  }, [useCloudRepo, session, cloudAvailable, preferLocal])

  const repoRef = useRef<Repo | null>(repo)
  repoRef.current = repo

  const refresh = useCallback(async () => {
    const current = repoRef.current
    if (!current) {
      setRecords([])
      setLoading(false)
      return
    }
    try {
      setError(null)
      const list = await current.list()
      setRecords(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authReady) return
    setLoading(true)
    void refresh()
    if (!repo) return
    return repo.subscribe(() => {
      void refresh()
    })
  }, [repo, refresh, authReady])

  const addRecord = useCallback(
    async (draft: EventDraft) => {
      if (!repoRef.current) throw new Error('저장소가 준비되지 않았습니다.')
      const created = await repoRef.current.create(draft)
      await refresh()
      return created
    },
    [refresh],
  )

  const updateRecord = useCallback(
    async (id: string, patch: Partial<EventDraft>) => {
      if (!repoRef.current) throw new Error('저장소가 준비되지 않았습니다.')
      const updated = await repoRef.current.update(id, patch)
      await refresh()
      return updated
    },
    [refresh],
  )

  const removeRecord = useCallback(
    async (id: string) => {
      if (!repoRef.current) throw new Error('저장소가 준비되지 않았습니다.')
      await repoRef.current.remove(id)
      await refresh()
    },
    [refresh],
  )

  const importRecords = useCallback(
    async (drafts: EventDraft[]) => {
      if (!repoRef.current) throw new Error('저장소가 준비되지 않았습니다.')
      const created = await repoRef.current.bulkCreate(drafts)
      await refresh()
      return created.length
    },
    [refresh],
  )

  const clearAll = useCallback(async () => {
    if (!repoRef.current) return
    await repoRef.current.clear()
    await refresh()
  }, [refresh])

  const continueLocally = useCallback(() => {
    localStorage.setItem(LOCAL_FALLBACK_KEY, '1')
    setPreferLocal(true)
  }, [])

  const useCloud = useCallback(() => {
    localStorage.removeItem(LOCAL_FALLBACK_KEY)
    setPreferLocal(false)
  }, [])

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
    setRecords([])
  }, [])

  const migrateLocalToCloud = useCallback(async () => {
    if (!useCloudRepo || !repoRef.current) throw new Error('로그인 후 이용할 수 있습니다.')
    const local = new LocalRepo()
    const pending = await local.list()
    if (pending.length === 0) return 0
    const drafts: EventDraft[] = pending.map(({ id: _id, created_at, updated_at, ...rest }) => {
      void created_at
      void updated_at
      // 이미지는 로컬 IndexedDB 전용 키라 클라우드에서 참조할 수 없다.
      return { ...rest, image_path: null }
    })
    const created = await repoRef.current.bulkCreate(drafts)
    await refresh()
    return created.length
  }, [useCloudRepo, refresh])

  const value: AppContextValue = {
    mode: repo?.mode ?? 'local',
    cloudAvailable,
    session,
    email: session?.user.email ?? null,
    records,
    loading: loading || !authReady,
    error,
    needsLogin,
    repo,
    refresh,
    addRecord,
    updateRecord,
    removeRecord,
    importRecords,
    clearAll,
    continueLocally,
    useCloud,
    signOut,
    migrateLocalToCloud,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('AppProvider 안에서만 사용할 수 있습니다.')
  return ctx
}

/** image_path 를 화면에 쓸 수 있는 URL 로 바꿔주고, 로컬 object URL 은 정리한다. */
export function useImageUrl(path: string | null | undefined): string | null {
  const { repo } = useApp()
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let revoked: string | null = null
    let alive = true
    if (!path || !repo) {
      setUrl(null)
      return
    }
    void repo.getImageUrl(path).then((resolved) => {
      if (!alive) {
        if (resolved?.startsWith('blob:')) URL.revokeObjectURL(resolved)
        return
      }
      if (resolved?.startsWith('blob:')) revoked = resolved
      setUrl(resolved)
    })
    return () => {
      alive = false
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [path, repo])

  return url
}
