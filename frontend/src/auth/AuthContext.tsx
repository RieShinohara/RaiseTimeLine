import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { login as loginApi, logout as logoutApi } from '../api/auth'
import { setAuthLostHandler } from '../api/http'
import { clearSession, getRefreshToken, getUser, saveSession, type AuthUser } from './tokenStorage'
import { AuthContext } from './useAuth'

// 「今、ログイン中の人」を持ち、画面全体に配る部品（取り出すときは、useAuth を使う）
export function AuthProvider({ children }: { children: ReactNode }) {
  // 再読み込みしても、ログインが続くように、保存してある情報から始める
  const [user, setUser] = useState<AuthUser | null>(getUser)

  // 札の更新に失敗したとき（7 日たった、ログアウト済みなど）は、ログアウトの状態にする
  useEffect(() => {
    setAuthLostHandler(() => setUser(null))
    return () => setAuthLostHandler(null)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginApi(email, password)
    saveSession(res)
    setUser(res.user)
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken()
    try {
      // サーバー側で、リフレッシュトークンを無効にする。失敗しても、この端末では、ログアウトする
      if (refreshToken) await logoutApi(refreshToken)
    } catch {
      // 通信できなくても、続ける
    } finally {
      clearSession()
      setUser(null)
    }
  }, [])

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
