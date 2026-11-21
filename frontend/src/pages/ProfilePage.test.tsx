import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Post, PostPage } from '../api/posts'
import type { FollowState, Profile } from '../api/users'
import { saveSession } from '../auth/tokenStorage'
import { jsonResponse, renderApp } from '../test-utils/render'

// サンプルは、すべて架空（実在の人・アドレスではない）。ログイン中の人は id=1（demo_user）、見られる人は id=2（other_user）
const ME = { id: 1, email: 'demo@example.com', username: 'demo_user', displayName: 'デモ' }

function profile(extra: Partial<Profile> = {}): Profile {
  return {
    id: 2,
    username: 'other_user',
    displayName: '別の人',
    bio: '自己紹介です。\n二行目です。',
    followingCount: 5,
    followerCount: 3,
    followedByMe: false,
    ...extra,
  }
}

function post(id: number, body: string): Post {
  return {
    id,
    body,
    createdAt: '2026-11-21T05:30:00Z',
    updatedAt: null,
    author: { id: 2, username: 'other_user', displayName: '別の人' },
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
  }
}

function page(posts: Post[], hasNext = false): PostPage {
  return { posts, hasNext }
}

const fetchMock = vi.fn()

// 画面を開くときの、2 つの通信（プロフィール・投稿の一覧）に答える。follow は、フォロー・解除の通信への答え
function open(
  p: Profile,
  posts: Post[] = [post(10, '別の人の投稿')],
  follow?: (init: RequestInit) => Promise<Response>,
) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (method === 'GET') {
      if (url === `/api/users/${p.username}`) return Promise.resolve(jsonResponse(200, p))
      if (url === `/api/users/${p.username}/posts?size=20`) return Promise.resolve(jsonResponse(200, page(posts)))
    }
    if (url === `/api/users/${p.username}/follow` && follow) return follow(init!)
    return Promise.resolve(jsonResponse(500))
  })
}

function followState(followerCount: number, following: boolean): FollowState {
  return { followerCount, following }
}

function login() {
  saveSession({ accessToken: 'access-1', refreshToken: 'refresh-1', user: ME })
}

function followCalls() {
  return fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/follow'))
}

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
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('プロフィールと投稿の一覧が出る（ログインなしでも見られる）', async () => {
  open(profile())
  renderApp('/users/other_user')

  expect(await screen.findByRole('heading', { name: '別の人' })).toBeInTheDocument()
  expect(screen.getByText('@other_user')).toBeInTheDocument()
  expect(screen.getByText(/自己紹介です。/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '5 フォロー中' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '3 フォロワー' })).toBeInTheDocument()
  expect(await screen.findByText('別の人の投稿')).toBeInTheDocument()
  // ログインなしでも、フォローのボタンは出る（押すと、ログイン画面へ）
  expect(screen.getByRole('button', { name: '別の人をフォローする' })).toBeInTheDocument()
})

test('自己紹介が未設定のときは、何も出さない', async () => {
  open(profile({ bio: null }))
  renderApp('/users/other_user')

  expect(await screen.findByRole('heading', { name: '別の人' })).toBeInTheDocument()
  expect(screen.queryByText(/自己紹介です。/)).not.toBeInTheDocument()
})

test('投稿が 0 件のときは、「まだ投稿がありません」と出る', async () => {
  open(profile(), [])
  renderApp('/users/other_user')
  expect(await screen.findByText('まだ投稿がありません')).toBeInTheDocument()
})

test('存在しないユーザーは、「ユーザーが見つかりません」と出る', async () => {
  fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(404, { message: 'ユーザーが見つかりません' })))
  renderApp('/users/nobody')
  expect(await screen.findByText('ユーザーが見つかりません')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /フォロー/ })).not.toBeInTheDocument()
})

test('読み込みに失敗したときは、理由と「もう一度」が出て、押すとやり直せる', async () => {
  fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(500, { message: 'サーバーのエラー' })))
  const user = userEvent.setup()
  renderApp('/users/other_user')
  expect(await screen.findByText(/読み込めませんでした（サーバーのエラー）/)).toBeInTheDocument()

  open(profile())
  await user.click(screen.getByRole('button', { name: 'もう一度' }))
  expect(await screen.findByRole('heading', { name: '別の人' })).toBeInTheDocument()
})

test('フォローすると、「フォロー解除」に変わり、フォロワー数が増える', async () => {
  login()
  open(profile(), undefined, () => Promise.resolve(jsonResponse(200, followState(4, true))))
  const user = userEvent.setup()
  renderApp('/users/other_user')

  await user.click(await screen.findByRole('button', { name: '別の人をフォローする' }))

  expect(await screen.findByRole('button', { name: '別の人のフォローを解除する' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '4 フォロワー' })).toBeInTheDocument()
  expect(followCalls()).toHaveLength(1)
  expect(followCalls()[0][1]).toMatchObject({ method: 'PUT' })
})

test('フォロー解除すると、「フォロー」に戻り、フォロワー数が減る', async () => {
  login()
  open(profile({ followedByMe: true, followerCount: 3 }), undefined, () =>
    Promise.resolve(jsonResponse(200, followState(2, false))),
  )
  const user = userEvent.setup()
  renderApp('/users/other_user')

  await user.click(await screen.findByRole('button', { name: '別の人のフォローを解除する' }))

  expect(await screen.findByRole('button', { name: '別の人をフォローする' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '2 フォロワー' })).toBeInTheDocument()
  expect(followCalls()[0][1]).toMatchObject({ method: 'DELETE' })
})

test('フォローに失敗したときは、数と見た目は元のままで、理由が出る', async () => {
  login()
  open(profile(), undefined, () => Promise.resolve(jsonResponse(404, { message: 'ユーザーが見つかりません' })))
  const user = userEvent.setup()
  renderApp('/users/other_user')

  await user.click(await screen.findByRole('button', { name: '別の人をフォローする' }))

  expect(await screen.findByText(/うまくいきませんでした（ユーザーが見つかりません）/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '別の人をフォローする' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '3 フォロワー' })).toBeInTheDocument()
})

test('返事が来るまでに連打しても、送るのは 1 回だけ', async () => {
  login()
  let finish: (res: Response) => void = () => {}
  open(
    profile(),
    undefined,
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve
      }),
  )
  // 送信中のボタンは、押せなくなる（pointer-events: none）。それでも押そうとした操作を、チェックなしで送る
  const user = userEvent.setup({ pointerEventsCheck: 0 })
  renderApp('/users/other_user')

  const button = await screen.findByRole('button', { name: '別の人をフォローする' })
  await user.click(button)
  expect(button).toBeDisabled()
  await user.click(button)
  await user.click(button)
  expect(followCalls()).toHaveLength(1)

  finish(jsonResponse(200, followState(4, true)))
  expect(await screen.findByRole('button', { name: '別の人のフォローを解除する' })).toBeInTheDocument()
})

test('自分のプロフィールには、フォローのボタンが出ない', async () => {
  login()
  open(profile({ id: 1, username: 'demo_user', displayName: 'デモ' }), [])
  renderApp('/users/demo_user')

  expect(await screen.findByRole('heading', { name: 'デモ' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /フォロー/ })).not.toBeInTheDocument()
})

test('ログインなしでフォローを押すと、ログイン画面へ案内される（通信は送らない）', async () => {
  open(profile())
  const user = userEvent.setup()
  renderApp('/users/other_user')

  await user.click(await screen.findByRole('button', { name: '別の人をフォローする' }))

  expect(await screen.findByRole('heading', { name: 'ログイン' })).toBeInTheDocument()
  expect(followCalls()).toHaveLength(0)
})

test('タイムラインの投稿の名前を押すと、その人のプロフィールへ移る', async () => {
  fetchMock.mockImplementation((url: string) => {
    if (url === '/api/posts?size=20') return Promise.resolve(jsonResponse(200, page([post(10, '別の人の投稿')])))
    if (url === '/api/users/other_user') return Promise.resolve(jsonResponse(200, profile()))
    if (url === '/api/users/other_user/posts?size=20')
      return Promise.resolve(jsonResponse(200, page([post(10, '別の人の投稿')])))
    return Promise.resolve(jsonResponse(500))
  })
  const user = userEvent.setup()
  renderApp('/')

  await user.click(await screen.findByRole('button', { name: '別の人（@other_user）のプロフィールを開く' }))

  expect(await screen.findByRole('heading', { name: '別の人' })).toBeInTheDocument()
  expect(screen.getByText(/自己紹介です。/)).toBeInTheDocument()
})

test('ヘッダーの自分の名前を押すと、自分のプロフィールへ移る', async () => {
  login()
  fetchMock.mockImplementation((url: string) => {
    if (url === '/api/posts?size=20') return Promise.resolve(jsonResponse(200, page([])))
    if (url === '/api/users/demo_user')
      return Promise.resolve(jsonResponse(200, profile({ id: 1, username: 'demo_user', displayName: 'デモ' })))
    if (url === '/api/users/demo_user/posts?size=20') return Promise.resolve(jsonResponse(200, page([])))
    return Promise.resolve(jsonResponse(500))
  })
  const user = userEvent.setup()
  renderApp('/')

  await user.click(screen.getByRole('link', { name: 'デモ（@demo_user）' }))

  await waitFor(() => expect(screen.getByRole('heading', { name: 'デモ' })).toBeInTheDocument())
})
