import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Post, PostPage } from '../api/posts'
import { saveSession } from '../auth/tokenStorage'
import { fakeJwt } from '../test-utils/fakeJwt'
import { jsonResponse, renderApp } from '../test-utils/render'
import { POLL_INTERVAL_MS } from '../timeline/useNewPostsCount'

// 新着の確認（30 秒ごとのポーリング）と、浮かぶバナーのテスト。サンプルは、すべて架空
const DEMO_USER = { id: 1, email: 'demo@example.com', username: 'demo_user', displayName: 'デモ' }
// 1 ページ目の一番上の投稿の id。画面は、これを after にして新着を確かめる
const TOP_ID = 10
const TOP_CREATED_AT = '2026-11-16T05:30:00.123456Z'

function post(id: number, body: string, createdAt = TOP_CREATED_AT, authorId = 2): Post {
  return {
    id,
    body,
    createdAt,
    updatedAt: null,
    author: { id: authorId, username: 'sample_user', displayName: 'サンプル' },
  }
}

function page(posts: Post[]): PostPage {
  return { posts, hasNext: false }
}

// サーバーの、偽物の状態（テストごとに書き換える）
let timeline: PostPage
let newCount: number | 'fail'
const fetchMock = vi.fn()
const scrollTo = vi.fn()

function newCountCalls() {
  return fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/posts/new-count'))
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
}

// 30 秒、進める（タイマーと、そのあとの通信の結果の反映まで待つ）
async function advancePoll(ms = POLL_INTERVAL_MS) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  localStorage.clear()
  fetchMock.mockReset()
  scrollTo.mockReset()
  timeline = page([post(10, '一番上の投稿')])
  newCount = 0
  setVisibility('visible')
  fetchMock.mockImplementation((url: string) => {
    if (url.startsWith('/api/posts/new-count')) {
      if (newCount === 'fail') return Promise.reject(new TypeError('Failed to fetch'))
      return Promise.resolve(jsonResponse(200, { count: newCount }))
    }
    if (url.startsWith('/api/posts?')) return Promise.resolve(jsonResponse(200, timeline))
    return Promise.resolve(jsonResponse(404, { message: '想定していない通信です' }))
  })
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('scrollTo', scrollTo)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  // @ts-expect-error テスト用に差し替えた値を、元に戻す（ブラウザ本来の動きに）
  delete document.visibilityState
})

test('30 秒ごとに、一番上の投稿の id を after にして、新着を確かめ、あればバナーを出す', async () => {
  renderApp('/')
  expect(await screen.findByText('一番上の投稿')).toBeInTheDocument()
  expect(newCountCalls()).toHaveLength(0)

  // 30 秒に、少し足りない。余裕は 1 秒（偽の時計は、本物の時計も少し進むので、1 ミリ秒の余裕だと、遅い環境で 30 秒を超えて、たまに失敗する）
  await advancePoll(POLL_INTERVAL_MS - 1000)
  expect(newCountCalls()).toHaveLength(0)

  newCount = 2
  await advancePoll(1000)
  expect(newCountCalls()).toHaveLength(1)
  expect(newCountCalls()[0][0]).toBe(`/api/posts/new-count?after=${TOP_ID}`)
  expect(await screen.findByRole('button', { name: '2件の新しい投稿があります' })).toBeInTheDocument()
})

test('新着が 0 件のときは、バナーを出さない', async () => {
  renderApp('/')
  await screen.findByText('一番上の投稿')
  await advancePoll()
  expect(newCountCalls()).toHaveLength(1)
  expect(screen.queryByRole('button', { name: /件の新しい投稿があります/ })).not.toBeInTheDocument()
})

test('バナーを押すと、1 ページ目を読み直して、一番上へスクロールし、バナーは消える', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderApp('/')
  await screen.findByText('一番上の投稿')
  newCount = 1
  await advancePoll()
  const banner = await screen.findByRole('button', { name: '1件の新しい投稿があります' })

  // サーバーに、新しい投稿ができた
  timeline = page([post(11, '新着の投稿', '2026-11-16T05:31:00.000001Z'), post(10, '一番上の投稿')])
  newCount = 0
  await user.click(banner)

  expect(await screen.findByText('新着の投稿')).toBeInTheDocument()
  const articles = screen.getAllByRole('article')
  expect(within(articles[0]).getByText('新着の投稿')).toBeInTheDocument()
  expect(within(articles[1]).getByText('一番上の投稿')).toBeInTheDocument()
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: /件の新しい投稿があります/ })).not.toBeInTheDocument(),
  )
  // 次からは、新しい一番上の id を、基準にする
  await advancePoll()
  expect(newCountCalls().at(-1)![0]).toBe('/api/posts/new-count?after=11')
})

test('バナーを押して読み直しに失敗したら、バナーは残り、スクロールもしない', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderApp('/')
  await screen.findByText('一番上の投稿')
  newCount = 3
  await advancePoll()
  const banner = await screen.findByRole('button', { name: '3件の新しい投稿があります' })

  fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch')))
  await user.click(banner)

  await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => String(u).startsWith('/api/posts?'))).toHaveLength(2))
  expect(scrollTo).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '3件の新しい投稿があります' })).toBeInTheDocument()
  expect(screen.getByText('一番上の投稿')).toBeInTheDocument()
})

test('画面を見ていない間は確かめず、戻ってきたら、すぐに 1 回確かめる', async () => {
  renderApp('/')
  await screen.findByText('一番上の投稿')
  setVisibility('hidden')
  await advancePoll(POLL_INTERVAL_MS * 3)
  expect(newCountCalls()).toHaveLength(0)

  newCount = 1
  setVisibility('visible')
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await waitFor(() => expect(newCountCalls()).toHaveLength(1))
  expect(await screen.findByRole('button', { name: '1件の新しい投稿があります' })).toBeInTheDocument()
})

test('確かめるのに失敗しても、何も出さず、次の確認（30 秒後）をまた試す', async () => {
  renderApp('/')
  await screen.findByText('一番上の投稿')
  newCount = 'fail'
  await advancePoll()
  expect(newCountCalls()).toHaveLength(1)
  expect(screen.queryByRole('button', { name: /件の新しい投稿があります/ })).not.toBeInTheDocument()
  expect(screen.queryByText(/読み込めませんでした/)).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()

  newCount = 1
  await advancePoll()
  expect(newCountCalls()).toHaveLength(2)
  expect(await screen.findByRole('button', { name: '1件の新しい投稿があります' })).toBeInTheDocument()
})

test('続きを読み込んでも、基準の id は、1 ページ目の一番上のまま。続きは、いちばん古い id を before にして読む', async () => {
  // 画面の一番下の目印が見えた、という合図を、自分で送るための偽物（jsdom には、本物がない）
  const observers: { callback: IntersectionObserverCallback }[] = []
  class FakeIntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
      observers.push({ callback })
    }
    observe() {}
    unobserve() {}
    disconnect() {
      observers.length = 0
    }
    takeRecords() {
      return []
    }
  }
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)

  timeline = { posts: [post(10, '一番上の投稿')], hasNext: true }
  fetchMock.mockImplementation((url: string) => {
    if (url.startsWith('/api/posts/new-count')) return Promise.resolve(jsonResponse(200, { count: 0 }))
    if (url.startsWith('/api/posts?before=10')) {
      const older = post(5, '古い投稿', '2026-11-10T00:00:00.000000Z')
      return Promise.resolve(jsonResponse(200, { posts: [older], hasNext: false }))
    }
    return Promise.resolve(jsonResponse(200, timeline))
  })
  renderApp('/')
  await screen.findByText('一番上の投稿')
  // 読み込みが終わって、目印の見張りが、作り直されるのを待つ
  await waitFor(() => expect(observers.length).toBeGreaterThan(0))
  act(() => observers.at(-1)!.callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as never))
  expect(await screen.findByText('古い投稿')).toBeInTheDocument()

  await advancePoll()
  // 古い投稿（id 5）ではなく、1 ページ目の一番上（id 10）が、基準のまま
  expect(newCountCalls()[0][0]).toBe(`/api/posts/new-count?after=${TOP_ID}`)
})

test('自分が投稿しても、基準の id は変わらない（その間の、他の人の新着を取りこぼさない）', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const validToken = fakeJwt(Math.floor(Date.now() / 1000) + 600)
  saveSession({ accessToken: validToken, refreshToken: 'refresh-1', user: DEMO_USER })
  renderApp('/')
  await screen.findByText('一番上の投稿')

  const mine = post(12, '自分の投稿', '2026-11-16T05:40:00.000000Z', 1)
  fetchMock.mockImplementationOnce(() => Promise.resolve(jsonResponse(201, mine)))
  await user.click(screen.getByRole('button', { name: '投稿する' }))
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByRole('textbox'), '自分の投稿')
  await user.click(within(dialog).getByRole('button', { name: '投稿' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getAllByRole('article')[0]).toHaveTextContent('自分の投稿')

  await advancePoll()
  const [url, init] = newCountCalls()[0]
  // 基準は、自分の投稿（id 12）ではなく、サーバーと同期したときの一番上（id 10）のまま
  expect(url).toBe(`/api/posts/new-count?after=${TOP_ID}`)
  // ログイン中なので、札を付けて確かめる（サーバーが、自分の投稿を数えないため）
  expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${validToken}`)
})

test('アクセストークンの期限が切れていたら、確かめる前に、先に更新する', async () => {
  const expiredToken = fakeJwt(Math.floor(Date.now() / 1000) - 60)
  saveSession({ accessToken: expiredToken, refreshToken: 'refresh-1', user: DEMO_USER })
  fetchMock.mockImplementation((url: string) => {
    if (url === '/api/auth/refresh') return Promise.resolve(jsonResponse(200, { accessToken: 'new-access' }))
    if (url.startsWith('/api/posts/new-count')) return Promise.resolve(jsonResponse(200, { count: 0 }))
    return Promise.resolve(jsonResponse(200, timeline))
  })
  renderApp('/')
  await screen.findByText('一番上の投稿')

  await advancePoll()

  const urls = fetchMock.mock.calls.map(([u]) => String(u))
  const refreshAt = urls.indexOf('/api/auth/refresh')
  const checkAt = urls.findIndex((u) => u.startsWith('/api/posts/new-count'))
  expect(refreshAt).toBeGreaterThan(-1)
  expect(checkAt).toBeGreaterThan(refreshAt) // 更新が、先
  expect(new Headers(fetchMock.mock.calls[checkAt][1].headers).get('Authorization')).toBe('Bearer new-access')
})
