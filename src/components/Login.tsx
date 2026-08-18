import { useState } from 'react'
import { useApp } from '../store'
import { describeAuthError, supabase } from '../lib/supabase'
import { useToast } from './ui'

type Mode = 'signin' | 'signup'

/** Supabase 가 설정된 경우에만 보이는 로그인 화면. 로그인 없이 로컬로 쓰는 길도 함께 둔다. */
export function Login() {
  const { continueLocally } = useApp()
  const toast = useToast()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw new Error(describeAuthError(error.message))
        toast('가입 완료. 메일 인증이 필요하면 받은 메일함을 확인해 주세요.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw new Error(describeAuthError(error.message))
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : '로그인하지 못했습니다.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function sendMagicLink() {
    if (!supabase) return
    if (!email.trim()) {
      toast('이메일을 먼저 입력해 주세요.', 'error')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) throw new Error(describeAuthError(error.message))
      toast('로그인 링크를 메일로 보냈습니다.')
    } catch (error) {
      toast(error instanceof Error ? error.message : '메일을 보내지 못했습니다.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/15 text-3xl">
            🧧
          </div>
          <h1 className="mt-4 text-2xl font-extrabold">인연 페이북</h1>
          <p className="mt-1 text-sm text-ink-400">
            경조사 지출과 인맥을 한 곳에서 관리하세요
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="field-label" htmlFor="email">
              이메일
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="field"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="password">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className="field"
              placeholder="6자 이상"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? '처리 중…' : mode === 'signin' ? '로그인' : '가입하기'}
          </button>
        </form>

        <div className="mt-3 flex items-center justify-between text-xs">
          <button
            type="button"
            className="text-brand-400 underline underline-offset-2"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          >
            {mode === 'signin' ? '계정이 없으신가요? 가입하기' : '이미 계정이 있으신가요? 로그인'}
          </button>
          <button
            type="button"
            className="text-ink-400 underline underline-offset-2"
            onClick={() => void sendMagicLink()}
            disabled={busy}
          >
            메일로 로그인 링크 받기
          </button>
        </div>

        <div className="mt-8 border-t border-ink-800 pt-5">
          <button type="button" className="btn-ghost w-full" onClick={continueLocally}>
            로그인 없이 이 기기에서만 쓰기
          </button>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-ink-400">
            나중에 설정에서 로그인하면 이 기기의 기록을 계정으로 올릴 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}
