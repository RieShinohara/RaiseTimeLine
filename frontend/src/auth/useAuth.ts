import { createContext, useContext } from 'react'
import type { AuthUser } from './tokenStorage'

// 「今、ログイン中の人」を、画面全体で共有するための入れ物と、取り出す関数。
// （部品と、関数を、同じファイルに置くと、開発中の自動更新が効かなくなるので、別ファイルにしている）

export interface AuthValue {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth は、AuthProvider の中で使ってください')
  return value
}
