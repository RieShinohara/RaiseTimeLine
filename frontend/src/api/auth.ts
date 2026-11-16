import type { AuthUser } from '../auth/tokenStorage'
import { ApiError, NETWORK_ERROR_MESSAGE, readMessage } from './errors'

// 認証 API（/api/auth/...）を呼ぶ関数。ここは「札なし」で呼ぶ（札の自動更新は、http.ts の役目）

export { ApiError }

export interface RegisterRequest {
  email: string
  password: string
  username: string
  displayName: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE)
  }
  if (!res.ok) throw new ApiError(res.status, await readMessage(res))
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export function register(request: RegisterRequest): Promise<AuthUser> {
  return postJson<AuthUser>('/api/auth/register', request)
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return postJson<LoginResponse>('/api/auth/login', { email, password })
}

export function refresh(refreshToken: string): Promise<{ accessToken: string }> {
  return postJson<{ accessToken: string }>('/api/auth/refresh', { refreshToken })
}

export function logout(refreshToken: string): Promise<void> {
  return postJson<void>('/api/auth/logout', { refreshToken })
}
