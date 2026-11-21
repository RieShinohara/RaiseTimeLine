// 札とユーザー情報を、ブラウザの localStorage に保存する（AUTH-9）。
// localStorage が使えない（プライベートウィンドウなど）ときも、落ちないようにする。
// ユーザー情報に、パスワード（ハッシュを含む）は入れない（サーバーが返さない）

export interface AuthUser {
  id: number
  email: string
  username: string
  displayName: string
}

const ACCESS_TOKEN = 'accessToken'
const REFRESH_TOKEN = 'refreshToken'
const USER_INFO = 'userInfo'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // 保存できなくても、画面は動かす（再読み込みで、ログインし直しになるだけ）
  }
}

export function getAccessToken(): string | null {
  return read(ACCESS_TOKEN)
}

export function getRefreshToken(): string | null {
  return read(REFRESH_TOKEN)
}

// 保存してあった値が、ユーザー情報の形か確かめる（手で書き換えた・古い版の形、などのとき、想定外の値で動かないため）
function isAuthUser(value: unknown): value is AuthUser {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'number' &&
    Number.isFinite(v.id) &&
    typeof v.email === 'string' &&
    typeof v.username === 'string' &&
    typeof v.displayName === 'string'
  )
}

// 形が違うとき（壊れた JSON を含む）は null＝ログインしていない状態として扱う
export function getUser(): AuthUser | null {
  const raw = read(USER_INFO)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isAuthUser(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveSession(session: { accessToken: string; refreshToken: string; user: AuthUser }): void {
  write(ACCESS_TOKEN, session.accessToken)
  write(REFRESH_TOKEN, session.refreshToken)
  write(USER_INFO, JSON.stringify(session.user))
}

// ユーザー情報だけを保存し直す（プロフィールの編集で、表示名が変わったとき）
export function saveUser(user: AuthUser): void {
  write(USER_INFO, JSON.stringify(user))
}

export function saveAccessToken(accessToken: string): void {
  write(ACCESS_TOKEN, accessToken)
}

export function clearSession(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN)
    localStorage.removeItem(REFRESH_TOKEN)
    localStorage.removeItem(USER_INFO)
  } catch {
    // 消せなくても、何もしない
  }
}
