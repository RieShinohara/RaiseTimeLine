import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Post, PostPage } from '../api/posts'
import { saveSession } from '../auth/tokenStorage'
import { jsonResponse, renderApp } from '../test-utils/render'
import { POLL_INTERVAL_MS } from '../timeline/useNewPostsCount'

// 「フォロー中」のタブのテスト。サンプルは、すべて架空（実在の人・アドレスではない）
const DEMO_USER = { id: 1, email: 'demo@example.com', username: 'demo_user', displayName: 'デモ' }

function post(id: number, body: string, authorId = 2): Post {
  return {
    id,
    body,
    createdAt: '2026-11-22T05:30:00Z',
    updatedAt: null,
    author: { id: authorId, username: `user_${authorId}`, displayName: `ユーザー${authorId}` },
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
  }
}

function page(posts: Post[]): PostPage {
  return { posts, hasNext: false }
}

// サーバーの、偽物の状態（テストごとに書き換える）
let allPosts: PostPage
let followingPosts: PostPage
let followingNewCount: number
const fetchMock = vi.fn()

function calls(prefix: string) {
  return fetchMock.mock.calls.filter(([url]) => String(url).startsWith(prefix))
}

// 画面の一番下の目印の見張り（jsdom には、本物がない）
class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

beforeEach(() => {
  localStorage.clear()
  fetchMock.mockReset()
  allPosts = page([post(5, '全体の投稿')])
  followingPosts = page([post(9, 'フォロー中の人の投稿')])
  followingNewCount = 0
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.startsWith('/api/posts/following/new-count')) {
      return Promise.resolve(jsonResponse(200, { count: followingNewCount }))
    }
    if (url.startsWith('/api/posts/following')) return Promise.resolve(jsonResponse(200, followingPosts))
    if (url === '/api/posts' && init?.method === 'POST') {
      return Promise.resolve(jsonResponse(201, post(20, '今、投稿した', DEMO_USER.id)))
    }
    if (url.startsWith('/api/posts?')) return Promise.resolve(jsonResponse(200, allPosts))
    return Promise.resolve(jsonResponse(404, { message: '想定していない通信です' }))
  })
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function login() {
  saveSession({ accessToken: 'access-1', refreshToken: 'refresh-1', user: DEMO_USER })
}

test('ログインなしは「全体」のタブだけで、「フォロー中」は出ない（読みにも行かない）', async () => {
  renderApp('/')
  expect(await screen.findByText('全体の投稿')).toBeInTheDocument()

  expect(screen.getByRole('tab', { name: '全体' })).toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'フォロー中' })).not.toBeInTheDocument()
  expect(calls('/api/posts/following')).toHaveLength(0)
})

test('ログイン中は 2 つのタブが出て、最初は「全体」が選ばれている（「フォロー中」は読まない）', async () => {
  login()
  renderApp('/')
  expect(await screen.findByText('全体の投稿')).toBeInTheDocument()

  expect(screen.getByRole('tab', { name: '全体' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tab', { name: 'フォロー中' })).toHaveAttribute('aria-selected', 'false')
  expect(calls('/api/posts/following')).toHaveLength(0)
})

test('「フォロー中」を押すと、札を付けて「フォロー中」を読み、全体の投稿は消える。「全体」に戻すと、全体を読み直す', async () => {
  const user = userEvent.setup()
  login()
  renderApp('/')
  await screen.findByText('全体の投稿')

  await user.click(screen.getByRole('tab', { name: 'フォロー中' }))
  expect(await screen.findByText('フォロー中の人の投稿')).toBeInTheDocument()
  expect(screen.queryByText('全体の投稿')).not.toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'フォロー中' })).toHaveAttribute('aria-selected', 'true')
  const [url, init] = calls('/api/posts/following')[0]
  expect(url).toBe('/api/posts/following?size=20')
  expect(new Headers(init.headers).get('Authorization')).toBe('Bearer access-1')

  await user.click(screen.getByRole('tab', { name: '全体' }))
  expect(await screen.findByText('全体の投稿')).toBeInTheDocument()
  expect(screen.queryByText('フォロー中の人の投稿')).not.toBeInTheDocument()
  expect(calls('/api/posts?')).toHaveLength(2)
})

test('「フォロー中」が空のときは、案内を出す（「まだ投稿がありません」ではない）', async () => {
  const user = userEvent.setup()
  login()
  followingPosts = page([])
  renderApp('/')
  await screen.findByText('全体の投稿')

  await user.click(screen.getByRole('tab', { name: 'フォロー中' }))
  expect(await screen.findByText('フォローしている人の投稿は、まだありません')).toBeInTheDocument()
  expect(screen.queryByText('まだ投稿がありません')).not.toBeInTheDocument()
})

test('「フォロー中」で投稿したら、一覧には足さず、「全体とプロフィールで見られます」と知らせる', async () => {
  const user = userEvent.setup()
  login()
  renderApp('/')
  await screen.findByText('全体の投稿')
  await user.click(screen.getByRole('tab', { name: 'フォロー中' }))
  await screen.findByText('フォロー中の人の投稿')

  await user.click(screen.getByRole('button', { name: '投稿する' }))
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByRole('textbox'), '今、投稿した')
  await user.click(within(dialog).getByRole('button', { name: '投稿' }))

  expect(await screen.findByText('投稿しました。「全体」と、自分のプロフィールで見られます')).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  // 自分の投稿は、「フォロー中」に入らない
  expect(screen.queryByText('今、投稿した')).not.toBeInTheDocument()
  expect(screen.getAllByRole('article')).toHaveLength(1)
})

test('「全体」で投稿したときは、お知らせを出さず、一番上に足す', async () => {
  const user = userEvent.setup()
  login()
  renderApp('/')
  await screen.findByText('全体の投稿')

  await user.click(screen.getByRole('button', { name: '投稿する' }))
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByRole('textbox'), '今、投稿した')
  await user.click(within(dialog).getByRole('button', { name: '投稿' }))

  expect(await screen.findByText('今、投稿した')).toBeInTheDocument()
  expect(screen.queryByText(/自分のプロフィールで見られます/)).not.toBeInTheDocument()
})

test('「フォロー中」の新着は、「フォロー中」用の件数で確かめ、バナーを出す（「全体」の件数は呼ばない）', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  login()
  renderApp('/')
  await screen.findByText('全体の投稿')
  await user.click(screen.getByRole('tab', { name: 'フォロー中' }))
  await screen.findByText('フォロー中の人の投稿')

  followingNewCount = 2
  await act(async () => {
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
  })

  // after は、読んだときの一番上の投稿の id（9）
  expect(calls('/api/posts/following/new-count')[0][0]).toBe('/api/posts/following/new-count?after=9')
  expect(calls('/api/posts/new-count')).toHaveLength(0)
  expect(await screen.findByRole('button', { name: '2件の新しい投稿があります' })).toBeInTheDocument()
})
