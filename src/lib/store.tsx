import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'
import { ensureProfile } from './api'
import type { Profile } from './types'
import { toEmail } from './util'

// ===== Toast =====
type Toast = { id: number; msg: string; bad?: boolean }
const ToastCtx = createContext<{ push: (msg: string, bad?: boolean) => void }>({ push: () => {} })
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)
  const push = useCallback((msg: string, bad?: boolean) => {
    const id = ++idRef.current
    setToasts((t) => [...t, { id, msg, bad }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-[92vw]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg border px-4 py-3 text-sm font-medium shadow-lg animate-[slideUp_.2s_ease-out] ${
              t.bad ? 'bg-red-700 text-white border-red-800' : 'bg-ink text-paper border-zinc-700'
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ===== Phiên đăng nhập =====
type SessionState = {
  ready: boolean
  userId: string | null
  email: string | null
  profile: Profile | null
  reloadProfile: () => Promise<void>
  signIn: (login: string, password: string) => Promise<void>
  signUp: (login: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const SessionCtx = createContext<SessionState>(null as unknown as SessionState)
export const useSession = () => useContext(SessionCtx)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  const loadProfile = useCallback(async (uid: string, mail: string) => {
    try {
      const p = await ensureProfile(uid, mail)
      setProfile(p)
    } catch (e) {
      console.error(e)
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user
      if (u) {
        setUserId(u.id)
        setEmail(u.email ?? null)
        if (u.email) await loadProfile(u.id, u.email)
      }
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null
      setUserId(u?.id ?? null)
      setEmail(u?.email ?? null)
      if (u && u.email) loadProfile(u.id, u.email)
      if (!u) setProfile(null)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const signIn = useCallback(
    async (login: string, password: string) => {
      const { error, data } = await supabase.auth.signInWithPassword({ email: toEmail(login), password })
      if (error) throw new Error(error.message)
      if (data.user?.email) await loadProfile(data.user.id, data.user.email)
    },
    [loadProfile],
  )

  const signUp = useCallback(
    async (login: string, password: string) => {
      const { error, data } = await supabase.auth.signUp({ email: toEmail(login), password })
      if (error) throw new Error(error.message)
      if (data.session?.user?.email) await loadProfile(data.session.user.id, data.session.user.email)
      else if (data.user?.email) await loadProfile(data.user.id, data.user.email)
    },
    [loadProfile],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setUserId(null)
  }, [])

  const reloadProfile = useCallback(async () => {
    if (userId && email) await loadProfile(userId, email)
  }, [userId, email, loadProfile])

  const value = useMemo(
    () => ({ ready, userId, email, profile, reloadProfile, signIn, signUp, signOut }),
    [ready, userId, email, profile, reloadProfile, signIn, signUp, signOut],
  )
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>
}
