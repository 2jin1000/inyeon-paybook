import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

/**
 * .env 에 키가 채워져 있을 때만 클라우드 모드로 동작한다.
 * 키가 없으면 앱은 로컬(IndexedDB) 모드로 그대로 실행된다.
 */
export const isSupabaseConfigured =
  Boolean(url && anonKey) && url.startsWith('http') && !url.includes('your-project')

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export const EVENTS_TABLE = 'events'
export const IMAGE_BUCKET = 'event-images'

/** Supabase 에러 메시지를 한국어 안내로 다듬는다. */
export function describeAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다.'
  if (m.includes('email not confirmed'))
    return '이메일 인증이 아직 안 됐습니다. 메일의 확인 링크를 누른 뒤(빈 페이지가 나와도 정상) 다시 로그인해 주세요.'
  if (m.includes('user already registered')) return '이미 가입된 이메일입니다. 로그인해 주세요.'
  // 앱이 아니라 Supabase 대시보드 설정 문제라, 어디를 봐야 하는지까지 알려준다.
  if (m.includes('signups not allowed') || m.includes('signup is disabled') || m.includes('signups are disabled'))
    return 'Supabase 에서 이메일 가입이 꺼져 있습니다. 대시보드 → Authentication → Sign In / Providers → Email 에서 "Enable Email provider" 를 켜 주세요.'
  if (m.includes('email logins are disabled') || m.includes('email provider'))
    return 'Supabase 에서 이메일 로그인이 꺼져 있습니다. 대시보드 → Authentication → Sign In / Providers → Email 을 활성화해 주세요.'
  if (m.includes('password should be at least')) return '비밀번호는 6자 이상이어야 합니다.'
  if (m.includes('rate limit') || m.includes('too many')) return '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'
  return message
}
