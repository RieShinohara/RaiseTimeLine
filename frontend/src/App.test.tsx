import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getAccessToken, getRefreshToken, saveSession } from './auth/tokenStorage'
import { jsonResponse, renderApp } from './test-utils/render'

// サンプルは、すべて架空（実在の人・アドレスではない）
const DEMO_USER = { id: 1, email: 'demo@example.com', username: 'demo_user', displayName: 'デモ' }

const EMPTY_PAGE = { posts: [], page: 0, size: 20, hasNext: false }

const fetchMock = vi.fn()

beforeEach(() => {
  localStorage.clear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function fillRegisterForm(user: ReturnType<typeof userEvent.setup>, overrides: Record<string, string> = {}) {
  const v = {
    email: 'demo@example.com',
    password: 'password1',
    confirm: 'password1',
    username: 'demo_user',
    displayName: 'デモ',
    ...overrides,
  }
  await user.type(screen.getByLabelText(/^メールアドレス/), v.email)
  await user.type(screen.getByLabelText(/^パスワード(?!（確認）)/), v.password)
  await user.type(screen.getByLabelText(/^パスワード（確認）/), v.confirm)
  await user.type(screen.getByLabelText(/^ユーザー名/), v.username)
  await user.type(screen.getByLabelText(/^表示名/), v.displayName)
}

test('土台：アプリ名が表示される', () => {
  fetchMock.mockResolvedValue(jsonResponse(200, EMPTY_PAGE))
  renderApp('/')
  expect(screen.getByRole('heading', { name: 'RaiseTimeLine' })).toBeInTheDocument()
})

test('未ログインのヘッダーには、ログインとユーザー登録がある', () => {
  fetchMock.mockResolvedValue(jsonResponse(200, EMPTY_PAGE))
  renderApp('/')
  expect(screen.getByRole('link', { name: 'ログイン' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'ユーザー登録' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'ログアウト' })).not.toBeInTheDocument()
})

test('登録すると、お知らせつきでログイン画面へ進む（自動ログインはしない）', async () => {
  const user = userEvent.setup()
  fetchMock.mockResolvedValueOnce(jsonResponse(201, DEMO_USER))
  renderApp('/register')
  await fillRegisterForm(user)
  await user.click(screen.getByRole('button', { name: '登録する' }))

  expect(await screen.findByText('登録が完了しました。ログインしてください。')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'ログイン' })).toBeInTheDocument()
  expect(getAccessToken()).toBeNull()

  // サーバーに送った内容：パスワード確認は、送らない
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/auth/register')
  expect(JSON.parse(init.body)).toEqual({
    email: 'demo@example.com',
    password: 'password1',
    username: 'demo_user',
    displayName: 'デモ',
  })
})

test('パスワード確認が違うときは、サーバーに送らず、理由を表示する', async () => {
  const user = userEvent.setup()
  renderApp('/register')
  await fillRegisterForm(user, { confirm: 'password2' })
  await user.click(screen.getByRole('button', { name: '登録する' }))

  expect(await screen.findByText('パスワードが、一致しません')).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('すでに使われているとき（409）は、サーバーの文言を表示する', async () => {
  const user = userEvent.setup()
  fetchMock.mockResolvedValueOnce(jsonResponse(409, { message: 'このユーザー名は、すでに使われています' }))
  renderApp('/register')
  await fillRegisterForm(user)
  await user.click(screen.getByRole('button', { name: '登録する' }))

  expect(await screen.findByText('このユーザー名は、すでに使われています')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'ユーザー登録' })).toBeInTheDocument()
})

test('ログインすると、札を保存して、ヘッダーに名前が出る', async () => {
  const user = userEvent.setup()
  fetchMock.mockResolvedValueOnce(
    jsonResponse(200, { accessToken: 'access-1', refreshToken: 'refresh-1', user: DEMO_USER }),
  )
  renderApp('/login')
  await user.type(screen.getByLabelText(/^メールアドレス/), 'demo@example.com')
  await user.type(screen.getByLabelText(/^パスワード/), 'password1')
  await user.click(screen.getByRole('button', { name: 'ログイン' }))

  expect(await screen.findByText('デモ（@demo_user）')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
  expect(getAccessToken()).toBe('access-1')
  expect(getRefreshToken()).toBe('refresh-1')
})

test('ログインに失敗したら、サーバーの文言を表示して、札は保存しない', async () => {
  const user = userEvent.setup()
  fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: 'メールアドレスかパスワードが違います' }))
  renderApp('/login')
  await user.type(screen.getByLabelText(/^メールアドレス/), 'demo@example.com')
  await user.type(screen.getByLabelText(/^パスワード/), 'wrong-pass1')
  await user.click(screen.getByRole('button', { name: 'ログイン' }))

  expect(await screen.findByText('メールアドレスかパスワードが違います')).toBeInTheDocument()
  expect(getAccessToken()).toBeNull()
})

test('サーバーにつながらないときは、つながらない旨を表示する', async () => {
  const user = userEvent.setup()
  fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
  renderApp('/login')
  await user.type(screen.getByLabelText(/^メールアドレス/), 'demo@example.com')
  await user.type(screen.getByLabelText(/^パスワード/), 'password1')
  await user.click(screen.getByRole('button', { name: 'ログイン' }))

  expect(await screen.findByText(/サーバーにつながりません/)).toBeInTheDocument()
})

test('ログアウトすると、サーバーで札を無効にして、札を捨てて、ログイン画面へ戻る', async () => {
  const user = userEvent.setup()
  saveSession({ accessToken: 'access-1', refreshToken: 'refresh-1', user: DEMO_USER })
  // トップ画面は、開くとタイムラインを読む。URL ごとに、返事を分ける
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(url.startsWith('/api/posts') ? jsonResponse(200, EMPTY_PAGE) : jsonResponse(204)),
  )
  renderApp('/')
  expect(screen.getByText('デモ（@demo_user）')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'ログアウト' }))

  await waitFor(() => expect(screen.getByRole('heading', { name: 'ログイン' })).toBeInTheDocument())
  expect(getAccessToken()).toBeNull()
  expect(getRefreshToken()).toBeNull()
  const logoutCall = fetchMock.mock.calls.find(([url]) => url === '/api/auth/logout')
  expect(logoutCall).toBeDefined()
  expect(JSON.parse(logoutCall![1].body)).toEqual({ refreshToken: 'refresh-1' })
})

test('すでにログイン中に、ログイン画面を開くと、トップ（タイムライン）へ移る', async () => {
  saveSession({ accessToken: 'access-1', refreshToken: 'refresh-1', user: DEMO_USER })
  fetchMock.mockResolvedValue(jsonResponse(200, EMPTY_PAGE))
  renderApp('/login')
  expect(await screen.findByRole('button', { name: '投稿する' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'ログイン' })).not.toBeInTheDocument()
})
