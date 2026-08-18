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
  /** 가입은 됐지만 메일 인증이 남은 상태. 인증 링크가 어디로 가든 이 화면으로 돌아오면 된다. */
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  /** 계정이 없는 상태로 로그인을 시도했을 때 가입으로 안내한다. */
  const [noAccountHint, setNoAccountHint] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw new Error(describeAuthError(error.message))
        if (data.session) {
          // 메일 인증이 꺼져 있으면 곧바로 로그인된다.
          toast('가입 완료. 바로 시작할 수 있습니다.')
        } else {
          setPendingEmail(email.trim())
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          // 처음 오신 분이 계정 없이 로그인을 누르는 경우가 가장 흔하다.
          if (error.message.toLowerCase().includes('invalid login credentials')) {
            setNoAccountHint(true)
          }
          throw new Error(describeAuthError(error.message))
        }
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

  async function resendConfirmation() {
    if (!supabase || !pendingEmail) return
    setBusy(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: pendingEmail,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) throw new Error(describeAuthError(error.message))
      toast('확인 메일을 다시 보냈습니다.')
    } catch (error) {
      toast(error instanceof Error ? error.message : '메일을 보내지 못했습니다.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // 가입 직후 안내 화면. 인증 링크가 다른 주소로 이동해도 당황하지 않도록 미리 설명한다.
  if (pendingEmail) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/15 text-3xl">
            📮
          </div>
          <h1 className="mt-4 text-xl font-extrabold">확인 메일을 보냈습니다</h1>
          <p className="mt-2 text-sm text-ink-300">
            <span className="font-semibold text-ink-100">{pendingEmail}</span> 으로 보낸 메일에서
            확인 링크를 눌러 주세요.
          </p>

          <ol className="mt-5 space-y-2 rounded-xl border border-ink-800 bg-ink-900 p-4 text-left text-xs leading-relaxed text-ink-300">
            <li>
              <span className="font-semibold text-ink-100">1.</span> 메일함(스팸함도 확인)에서 확인
              링크를 누릅니다.
            </li>
            <li>
              <span className="font-semibold text-ink-100">2.</span> 링크를 누른 뒤 빈 페이지나 오류
              화면이 나와도 <span className="text-mint-500">인증은 정상 처리된 것</span>입니다.
            </li>
            <li>
              <span className="font-semibold text-ink-100">3.</span> 그 창을 닫고 이 화면으로 돌아와
              아래 버튼으로 로그인하세요.
            </li>
          </ol>

          <button
            type="button"
            className="btn-primary mt-5 w-full"
            onClick={() => {
              setPendingEmail(null)
              setMode('signin')
            }}
          >
            인증했습니다 · 로그인하기
          </button>
          <div className="mt-3 flex items-center justify-center gap-4 text-xs">
            <button
              type="button"
              className="text-ink-400 underline underline-offset-2"
              onClick={() => void resendConfirmation()}
              disabled={busy}
            >
              메일 다시 보내기
            </button>
            <button
              type="button"
              className="text-ink-400 underline underline-offset-2"
              onClick={() => setPendingEmail(null)}
            >
              다른 이메일로 가입
            </button>
          </div>
        </div>
      </div>
    )
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

        {noAccountHint && mode === 'signin' ? (
          <div className="mt-3 rounded-xl border border-brand-500/40 bg-brand-500/8 p-3 text-xs leading-relaxed text-ink-300">
            <p>
              이 앱을 처음 쓰신다면 <span className="font-semibold text-ink-100">계정부터 만들어야</span>{' '}
              합니다. 같은 이메일·비밀번호로 바로 가입할 수 있습니다.
            </p>
            <button
              type="button"
              className="btn-primary mt-2 w-full py-2.5 text-xs"
              onClick={() => {
                setNoAccountHint(false)
                setMode('signup')
              }}
            >
              이 이메일로 가입하기
            </button>
          </div>
        ) : null}

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
