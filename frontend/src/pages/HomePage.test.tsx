import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Post, PostPage } from '../api/posts'
import { saveSession } from '../auth/tokenStorage'
import { jsonResponse, renderApp } from '../test-utils/render'

// サンプルは、すべて架空（実在の人・アドレスではない）
const DEMO_USER = { id: 1, email: 'demo@example.com', username: 'demo_user', displayName: 'デモ' }

function post(id: number, body: string, extra: Partial<Post> = {}): Post {
  return {
    id,
    body,
    createdAt: '2026-11-16T05:30:00Z',
    updatedAt: null,
    author: { id: 2, username: 'sample_user', displayName: 'サンプル' },
    ...extra,
  }
}

function page(posts: Post[], pageNo = 0, hasNext = false): PostPage {
  return { posts, page: pageNo, size: 20, hasNext }
}

const fetchMock = vi.fn()

// 画面の一番下の目印が見えた、という合図を、自分で送るための偽物（jsdom には、本物がない）
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = []
  callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    FakeIntersectionObserver.instances.push(this)
  }
  observe() {}
  unobserve() {}
  disconnect() {
    FakeIntersectionObserver.instances = FakeIntersectionObserver.instances.filter((i) => i !== this)
  }
  takeRecords() {
    return []
  }
  reachBottom() {
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

function reachBottom() {
  const observer = FakeIntersectionObserver.instances.at(-1)
  expect(observer).toBeDefined()
  act(() => observer!.reachBottom())
}

function timelineCalls() {
  return fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/posts?'))
}

beforeEach(() => {
  localStorage.clear()
  fetchMock.mockReset()
  FakeIntersectionObserver.instances = []
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('タイムラインは、ログインなしで見られる（札は付けず、1 ページ目を読む）', async () => {
  fetchMock.mockResolvedValueOnce(
    jsonResponse(200, page([post(2, '二番目の投稿'), post(1, '一番目の投稿', { updatedAt: '2026-11-16T06:00:00Z' })])),
  )
  renderApp('/')

  expect(await screen.findByText('二番目の投稿')).toBeInTheDocument()
  expect(fetchMock.mock.calls[0][0]).toBe('/api/posts?page=0&size=20')
  // 並びは、サーバーが返した順（新しい順）のまま
  const articles = screen.getAllByRole('article')
  expect(within(articles[0]).getByText('二番目の投稿')).toBeInTheDocument()
  expect(within(articles[1]).getByText('一番目の投稿')).toBeInTheDocument()
  // 投稿者の表示名と @ユーザー名。編集した投稿だけ「編集済み」
  expect(within(articles[0]).getByText('サンプル')).toBeInTheDocument()
  expect(within(articles[0]).getByText('@sample_user')).toBeInTheDocument()
  expect(within(articles[0]).queryByText('編集済み')).not.toBeInTheDocument()
  expect(within(articles[1]).getByText('編集済み')).toBeInTheDocument()
  expect(screen.getByText('これ以上ありません')).toBeInTheDocument()
  // ログインしていないので、投稿のボタンは出ない
  expect(screen.queryByRole('button', { name: '＋ 投稿する' })).not.toBeInTheDocument()
})

test('本文の HTML は、文字として表示する（XSS の対策）', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(200, page([post(1, '<img src=x onerror=alert(1)>')])))
  renderApp('/')

  expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
  expect(document.querySelector('article img')).toBeNull()
})

test('投稿が 1 件もないときは、「まだ投稿がありません」と出る', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(200, page([])))
  renderApp('/')

  expect(await screen.findByText('まだ投稿がありません')).toBeInTheDocument()
})

test('読み込みに失敗したら理由を出し、「もう一度」で、同じページをやり直せる', async () => {
  const user = userEvent.setup()
  fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
  fetchMock.mockResolvedValueOnce(jsonResponse(200, page([post(1, 'やり直したら読めた')])))
  renderApp('/')

  expect(await screen.findByText(/読み込めませんでした/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'もう一度' }))

  expect(await screen.findByText('やり直したら読めた')).toBeInTheDocument()
  expect(screen.queryByText(/読み込めませんでした/)).not.toBeInTheDocument()
  // 失敗したときは、ページを進めない（0 ページ目を 2 回読んでいる）
  expect(timelineCalls().map(([url]) => url)).toEqual(['/api/posts?page=0&size=20', '/api/posts?page=0&size=20'])
})

test('一番下まで進むと、続きを読み込み、同じ投稿は 2 回出さない', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(200, page([post(3, '三番目'), post(2, '二番目')], 0, true)))
  // 2 ページ目の先頭は、1 ページ目の最後と、同じ投稿（新しい投稿が入って、ずれたときの再現）
  fetchMock.mockResolvedValueOnce(jsonResponse(200, page([post(2, '二番目'), post(1, '一番目')], 1, false)))
  renderApp('/')
  expect(await screen.findByText('三番目')).toBeInTheDocument()
  expect(screen.queryByText('これ以上ありません')).not.toBeInTheDocument()

  reachBottom()

  expect(await screen.findByText('一番目')).toBeInTheDocument()
  expect(timelineCalls()[1][0]).toBe('/api/posts?page=1&size=20')
  expect(screen.getAllByText('二番目')).toHaveLength(1)
  expect(screen.getAllByRole('article')).toHaveLength(3)
  // 続きがないので、これ以上は読まない
  expect(await screen.findByText('これ以上ありません')).toBeInTheDocument()
  expect(FakeIntersectionObserver.instances).toHaveLength(0)
  expect(timelineCalls()).toHaveLength(2)
})

test('ログイン中は「＋ 投稿する」が出て、投稿のモーダルで、本文の条件を確かめられる', async () => {
  const user = userEvent.setup()
  saveSession({ accessToken: 'access-1', refreshToken: 'refresh-1', user: DEMO_USER })
  fetchMock.mockResolvedValueOnce(jsonResponse(200, page([])))
  renderApp('/')

  await user.click(await screen.findByRole('button', { name: '＋ 投稿する' }))
  const dialog = await screen.findByRole('dialog')
  const submit = within(dialog).getByRole('button', { name: '投稿' })
  expect(submit).toBeDisabled() // 空では、投稿できない

  const input = within(dialog).getByRole('textbox')
  await user.type(input, '   ')
  expect(submit).toBeDisabled() // 空白だけも、投稿できない

  await user.clear(input)
  await user.click(input)
  await user.paste('あ'.repeat(281))
  expect(within(dialog).getByText(/281 \/ 280/)).toBeInTheDocument()
  expect(submit).toBeDisabled() // 281 文字は、投稿できない

  await user.clear(input)
  await user.click(input)
  await user.paste('あ'.repeat(280))
  expect(within(dialog).getByText('280 / 280')).toBeInTheDocument()
  expect(submit).toBeEnabled()
})

test('投稿すると、札を付けて送り、モーダルが閉じて、一番上に表示される', async () => {
  const user = userEvent.setup()
  saveSession({ accessToken: 'access-1', refreshToken: 'refresh-1', user: DEMO_USER })
  fetchMock.mockResolvedValueOnce(jsonResponse(200, page([post(1, '前からある投稿')])))
  fetchMock.mockResolvedValueOnce(
    jsonResponse(201, post(2, '今、投稿した', { author: { id: 1, username: 'demo_user', displayName: 'デモ' } })),
  )
  renderApp('/')
  expect(await screen.findByText('前からある投稿')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '＋ 投稿する' }))
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByRole('textbox'), '今、投稿した')
  await user.click(within(dialog).getByRole('button', { name: '投稿' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  const articles = screen.getAllByRole('article')
  expect(within(articles[0]).getByText('今、投稿した')).toBeInTheDocument()
  expect(within(articles[1]).getByText('前からある投稿')).toBeInTheDocument()

  const [url, init] = fetchMock.mock.calls[1]
  expect(url).toBe('/api/posts')
  expect(init.method).toBe('POST')
  expect(JSON.parse(init.body)).toEqual({ body: '今、投稿した' })
  expect(new Headers(init.headers).get('Authorization')).toBe('Bearer access-1')
})

test('投稿に失敗したら、モーダルを閉じず、入力した内容を残して、理由を出す', async () => {
  const user = userEvent.setup()
  saveSession({ accessToken: 'access-1', refreshToken: 'refresh-1', user: DEMO_USER })
  fetchMock.mockResolvedValueOnce(jsonResponse(200, page([])))
  fetchMock.mockResolvedValueOnce(jsonResponse(400, { message: '本文は 280 文字までです' }))
  renderApp('/')

  await user.click(await screen.findByRole('button', { name: '＋ 投稿する' }))
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByRole('textbox'), '消えてほしくない文章')
  await user.click(within(dialog).getByRole('button', { name: '投稿' }))

  expect(await within(dialog).findByText('本文は 280 文字までです')).toBeInTheDocument()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(within(dialog).getByRole('textbox')).toHaveValue('消えてほしくない文章')
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
})

test('キャンセルすると、入力を捨てて閉じる', async () => {
  const user = userEvent.setup()
  saveSession({ accessToken: 'access-1', refreshToken: 'refresh-1', user: DEMO_USER })
  fetchMock.mockResolvedValueOnce(jsonResponse(200, page([])))
  renderApp('/')

  await user.click(await screen.findByRole('button', { name: '＋ 投稿する' }))
  await user.type(within(await screen.findByRole('dialog')).getByRole('textbox'), '途中でやめる')
  await user.click(screen.getByRole('button', { name: 'キャンセル' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

  await user.click(screen.getByRole('button', { name: '＋ 投稿する' }))
  expect(within(await screen.findByRole('dialog')).getByRole('textbox')).toHaveValue('')
})
