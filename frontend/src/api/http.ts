import { isTokenExpired } from '../auth/jwt'
import { clearSession, getAccessToken, getRefreshToken, saveAccessToken } from '../auth/tokenStorage'
import { ApiError, refresh } from './auth'

// ログインが要る API（投稿・いいねなど）を呼ぶときの、共通の入口。
// ・アクセストークンを、Authorization ヘッダー（Bearer）に付ける
// ・401（札の期限切れ）が返ったら、リフレッシュトークンで新しい札をもらって、同じ操作をやり直す
// ・リフレッシュトークンも使えなければ、札を捨てて、「ログインが切れた」と画面に知らせる

let authLostHandler: (() => void) | null = null

// 「ログインが切れた」ときに呼ぶ関数を、登録する（AuthProvider が使う）
export function setAuthLostHandler(handler: (() => void) | null): void {
  authLostHandler = handler
}

type RefreshResult = 'ok' | 'invalid' | 'error'

// 同時に何本も 401 が来ても、更新は 1 回だけにする（同じ札を、何度も使わない）
let refreshing: Promise<RefreshResult> | null = null

async function tryRefresh(): Promise<RefreshResult> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return 'invalid'
  try {
    const { accessToken } = await refresh(refreshToken)
    saveAccessToken(accessToken)
    return 'ok'
  } catch (e) {
    // 札が無効（401 など）なら、ログインし直し。通信の失敗なら、ログインは切らない
    return e instanceof ApiError && e.status !== 0 ? 'invalid' : 'error'
  }
}

// 更新を、1 回だけ行う（同時に呼ばれても、同じ更新を待つ）。結果に応じて、ログイン切れも知らせる
async function runRefresh(): Promise<RefreshResult> {
  refreshing ??= tryRefresh().finally(() => {
    refreshing = null
  })
  const result = await refreshing
  if (result === 'invalid') {
    clearSession()
    authLostHandler?.()
  }
  return result
}

// アクセストークンの期限が切れていたら、先に更新する。
// ログインなしでも使える API（新着の件数など）は、期限切れの札を「札なし」として扱い、401 を返さない。
// そのまま呼ぶと、「ログイン中の人」として扱われず、自分の投稿も数えられてしまうため
export async function refreshIfExpired(): Promise<void> {
  const token = getAccessToken()
  if (!token || !getRefreshToken() || !isTokenExpired(token)) return
  await runRefresh()
}

function send(input: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const res = await send(input, init)
  if (res.status !== 401 || !getRefreshToken()) return res

  const result = await runRefresh()
  if (result === 'ok') return send(input, init)
  return res
}
