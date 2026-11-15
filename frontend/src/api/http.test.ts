import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearSession, getAccessToken, saveSession } from '../auth/tokenStorage'
import { jsonResponse } from '../test-utils/render'
import { apiFetch, setAuthLostHandler } from './http'

const USER = { id: 1, email: 'demo@example.com', username: 'demo_user', displayName: 'デモ' }
const fetchMock = vi.fn()
const lost = vi.fn()

beforeEach(() => {
  clearSession()
  fetchMock.mockReset()
  lost.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  setAuthLostHandler(lost)
})

afterEach(() => {
  setAuthLostHandler(null)
  vi.unstubAllGlobals()
})

function authHeaderOf(callIndex: number): string | null {
  return new Headers(fetchMock.mock.calls[callIndex][1].headers).get('Authorization')
}

test('アクセストークンを、Bearer で付けて送る', async () => {
  saveSession({ accessToken: 'access-1', refreshToken: 'refresh-1', user: USER })
  fetchMock.mockResolvedValueOnce(jsonResponse(200, {}))

  const res = await apiFetch('/api/posts')

  expect(res.status).toBe(200)
  expect(authHeaderOf(0)).toBe('Bearer access-1')
})

test('401 のとき、札を更新して、新しい札で、同じ操作をやり直す', async () => {
  saveSession({ accessToken: 'old', refreshToken: 'refresh-1', user: USER })
  fetchMock
    .mockResolvedValueOnce(jsonResponse(401)) // 期限切れ
    .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'new' })) // 更新
    .mockResolvedValueOnce(jsonResponse(200, { ok: true })) // やり直し

  const res = await apiFetch('/api/posts')

  expect(res.status).toBe(200)
  expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh')
  expect(authHeaderOf(2)).toBe('Bearer new')
  expect(getAccessToken()).toBe('new')
  expect(lost).not.toHaveBeenCalled()
})

test('リフレッシュトークンも無効なら、札を捨てて、ログインが切れたと知らせる', async () => {
  saveSession({ accessToken: 'old', refreshToken: 'refresh-1', user: USER })
  fetchMock
    .mockResolvedValueOnce(jsonResponse(401))
    .mockResolvedValueOnce(jsonResponse(401, { message: 'ログインの期限が切れました' }))

  const res = await apiFetch('/api/posts')

  expect(res.status).toBe(401)
  expect(getAccessToken()).toBeNull()
  expect(lost).toHaveBeenCalledTimes(1)
})

test('更新の通信が失敗したときは、ログインを切らない', async () => {
  saveSession({ accessToken: 'old', refreshToken: 'refresh-1', user: USER })
  fetchMock.mockResolvedValueOnce(jsonResponse(401)).mockRejectedValueOnce(new TypeError('Failed to fetch'))

  const res = await apiFetch('/api/posts')

  expect(res.status).toBe(401)
  expect(getAccessToken()).toBe('old')
  expect(lost).not.toHaveBeenCalled()
})

test('同時に 401 が来ても、札の更新は 1 回だけ', async () => {
  saveSession({ accessToken: 'old', refreshToken: 'refresh-1', user: USER })
  fetchMock.mockImplementation((url: string, init: RequestInit) => {
    if (url === '/api/auth/refresh') return Promise.resolve(jsonResponse(200, { accessToken: 'new' }))
    const bearer = new Headers(init.headers).get('Authorization')
    return Promise.resolve(jsonResponse(bearer === 'Bearer new' ? 200 : 401, {}))
  })

  const [a, b] = await Promise.all([apiFetch('/api/a'), apiFetch('/api/b')])

  expect(a.status).toBe(200)
  expect(b.status).toBe(200)
  const refreshCalls = fetchMock.mock.calls.filter(([url]) => url === '/api/auth/refresh')
  expect(refreshCalls).toHaveLength(1)
})

test('リフレッシュトークンがなければ、更新せずに 401 を返す', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(401))

  const res = await apiFetch('/api/posts')

  expect(res.status).toBe(401)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
