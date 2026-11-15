import type { AuthUser } from '../auth/tokenStorage'

// 認証 API（/api/auth/...）を呼ぶ関数。ここは「札なし」で呼ぶ（札の自動更新は、http.ts の役目）

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

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

// サーバーが返す {"message": "..."} を、取り出す。読めなければ、決まった文言にする
async function readMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string }
    if (body.message) return body.message
  } catch {
    // JSON でないときは、下の文言にする
  }
  return 'エラーが起きました。もう一度、試してください'
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
    throw new ApiError(0, 'サーバーにつながりません。しばらくしてから、もう一度、試してください')
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
