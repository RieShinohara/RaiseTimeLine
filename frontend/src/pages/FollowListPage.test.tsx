import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { FollowState, FollowUser, FollowUserPage, Profile } from '../api/users'
import { saveSession } from '../auth/tokenStorage'
import { jsonResponse, renderApp } from '../test-utils/render'

// サンプルは、すべて架空（実在の人・アドレスではない）。ログイン中の人は id=1（demo_user）、一覧の持ち主は id=2（owner_user）
const ME = { id: 1, email: 'demo@example.com', username: 'demo_user', displayName: 'デモ' }

function member(id: number, extra: Partial<FollowUser> = {}): FollowUser {
  return {
    id,
    username: `member_${id}`,
    displayName: `メンバー${id}`,
    bio: null,
    followedByMe: false,
    ...extra,
  }
}

function page(users: FollowUser[], hasNext = false): FollowUserPage {
  return { users, hasNext }
}

const OWNER: Profile = {
  id: 2,
  username: 'owner_user',
  displayName: '持ち主',
  bio: null,
  followingCount: 2,
  followerCount: 3,
  followedByMe: false,
}

const fetchMock = vi.fn()

// 一覧の通信に答える。followers・following は、それぞれの一覧。follow は、フォロー・解除の通信への答え
function open(
  followers: FollowUserPage,
  following: FollowUserPage = page([]),
  follow?: (url: string, init: RequestInit) => Promise<Response>,
) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (method === 'GET') {
      if (url === '/api/users/owner_user/followers') return Promise.resolve(jsonResponse(200, followers))
      if (url === '/api/users/owner_user/following') return Promise.resolve(jsonResponse(200, following))
      if (url === '/api/users/owner_user') return Promise.resolve(jsonResponse(200, OWNER))
      if (url === '/api/users/owner_user/posts?size=20')
        return Promise.resolve(jsonResponse(200, { posts: [], hasNext: false }))
    }
    if (url.endsWith('/follow') && follow) return follow(url, init!)
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

test('フォロワーの一覧が出る（ログインなしでも見られる）。名前・自己紹介・ボタンがある', async () => {
  open(page([member(10, { bio: '一人目の自己紹介' }), member(11)]))
  renderApp('/users/owner_user/followers')

  expect(await screen.findByRole('heading', { name: '@owner_user のフォロワー' })).toBeInTheDocument()
  expect(await screen.findByText('メンバー10')).toBeInTheDocument()
  expect(screen.getByText('一人目の自己紹介')).toBeInTheDocument()
  expect(screen.getByText('メンバー11')).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  // ログインなしでも、ボタンは出る（押すと、ログイン画面へ）
  expect(screen.getByRole('button', { name: 'メンバー10をフォローする' })).toBeInTheDocument()
})

test('フォロー中の一覧は、following の一覧を読む（フォロワーとは別の読み先）', async () => {
  open(page([member(10)]), page([member(20), member(21)]))
  renderApp('/users/owner_user/following')

  expect(await screen.findByRole('heading', { name: '@owner_user のフォロー中' })).toBeInTheDocument()
  expect(await screen.findByText('メンバー20')).toBeInTheDocument()
  expect(screen.getByText('メンバー21')).toBeInTheDocument()
  expect(screen.queryByText('メンバー10')).not.toBeInTheDocument()
})

test('0 件のときは、「まだいません」と出る', async () => {
  open(page([]))
  renderApp('/users/owner_user/followers')
  expect(await screen.findByText('まだいません')).toBeInTheDocument()
})

test('hasNext のときは、「最初の 50 人を表示しています」と出る。ないときは出ない', async () => {
  open(page([member(10)], true))
  renderApp('/users/owner_user/followers')
  expect(await screen.findByText('最初の 50 人を表示しています')).toBeInTheDocument()
})

test('hasNext でないときは、お知らせは出ない', async () => {
  open(page([member(10)], false))
  renderApp('/users/owner_user/followers')
  expect(await screen.findByText('メンバー10')).toBeInTheDocument()
  expect(screen.queryByText(/最初の 50 人/)).not.toBeInTheDocument()
})

test('存在しないユーザーは、「ユーザーが見つかりません」と出る', async () => {
  fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(404, { message: 'ユーザーが見つかりません' })))
  renderApp('/users/nobody/followers')
  expect(await screen.findByText('ユーザーが見つかりません')).toBeInTheDocument()
})

test('読み込みに失敗したときは、理由と「もう一度」が出て、押すとやり直せる', async () => {
  fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(500, { message: 'サーバーのエラー' })))
  const user = userEvent.setup()
  renderApp('/users/owner_user/followers')
  expect(await screen.findByText(/読み込めませんでした（サーバーのエラー）/)).toBeInTheDocument()

  open(page([member(10)]))
  await user.click(screen.getByRole('button', { name: 'もう一度' }))
  expect(await screen.findByText('メンバー10')).toBeInTheDocument()
})

test('一覧からフォローすると、その行のボタンが「フォロー解除」に変わる（ほかの行は、そのまま）', async () => {
  login()
  open(page([member(10), member(11)]), page([]), () => Promise.resolve(jsonResponse(200, followState(1, true))))
  const user = userEvent.setup()
  renderApp('/users/owner_user/followers')

  await user.click(await screen.findByRole('button', { name: 'メンバー10をフォローする' }))

  expect(await screen.findByRole('button', { name: 'メンバー10のフォローを解除する' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'メンバー11をフォローする' })).toBeInTheDocument()
  expect(followCalls()).toHaveLength(1)
  expect(followCalls()[0][0]).toBe('/api/users/member_10/follow')
  expect(followCalls()[0][1]).toMatchObject({ method: 'PUT' })
})

test('フォロー解除すると、「フォロー」に戻る', async () => {
  login()
  open(page([member(10, { followedByMe: true })]), page([]), () =>
    Promise.resolve(jsonResponse(200, followState(0, false))),
  )
  const user = userEvent.setup()
  renderApp('/users/owner_user/followers')

  await user.click(await screen.findByRole('button', { name: 'メンバー10のフォローを解除する' }))

  expect(await screen.findByRole('button', { name: 'メンバー10をフォローする' })).toBeInTheDocument()
  expect(followCalls()[0][1]).toMatchObject({ method: 'DELETE' })
})

test('フォローに失敗したときは、見た目は元のままで、理由が出る', async () => {
  login()
  open(page([member(10)]), page([]), () => Promise.resolve(jsonResponse(404, { message: 'ユーザーが見つかりません' })))
  const user = userEvent.setup()
  renderApp('/users/owner_user/followers')

  await user.click(await screen.findByRole('button', { name: 'メンバー10をフォローする' }))

  expect(await screen.findByText(/うまくいきませんでした（ユーザーが見つかりません）/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'メンバー10をフォローする' })).toBeInTheDocument()
})

test('返事が来るまでに連打しても、送るのは 1 回だけ', async () => {
  login()
  let finish: (res: Response) => void = () => {}
  open(
    page([member(10)]),
    page([]),
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve
      }),
  )
  // 送信中のボタンは、押せなくなる（pointer-events: none）。それでも押そうとした操作を、チェックなしで送る
  const user = userEvent.setup({ pointerEventsCheck: 0 })
  renderApp('/users/owner_user/followers')

  const button = await screen.findByRole('button', { name: 'メンバー10をフォローする' })
  await user.click(button)
  expect(button).toBeDisabled()
  await user.click(button)
  await user.click(button)
  expect(followCalls()).toHaveLength(1)

  finish(jsonResponse(200, followState(1, true)))
  expect(await screen.findByRole('button', { name: 'メンバー10のフォローを解除する' })).toBeInTheDocument()
})

test('自分の行には、フォローのボタンが出ない（ほかの人の行には出る）', async () => {
  login()
  open(page([member(1, { username: 'demo_user', displayName: 'デモ' }), member(10)]))
  renderApp('/users/owner_user/followers')

  expect(await screen.findByRole('button', { name: 'メンバー10をフォローする' })).toBeInTheDocument()
  const items = screen.getAllByRole('listitem')
  expect(items).toHaveLength(2)
  expect(within(items[0]).queryByRole('button', { name: /フォロー/ })).not.toBeInTheDocument()
})

test('ログインなしでフォローを押すと、ログイン画面へ案内される（通信は送らない）', async () => {
  open(page([member(10)]))
  const user = userEvent.setup()
  renderApp('/users/owner_user/followers')

  await user.click(await screen.findByRole('button', { name: 'メンバー10をフォローする' }))

  expect(await screen.findByRole('heading', { name: 'ログイン' })).toBeInTheDocument()
  expect(followCalls()).toHaveLength(0)
})

test('プロフィールの「フォロワー」の数を押すと、フォロワーの一覧へ移る', async () => {
  open(page([member(10)]), page([member(20)]))
  const user = userEvent.setup()
  renderApp('/users/owner_user')

  await user.click(await screen.findByRole('link', { name: '3 フォロワー' }))

  expect(await screen.findByRole('heading', { name: '@owner_user のフォロワー' })).toBeInTheDocument()
  expect(await screen.findByText('メンバー10')).toBeInTheDocument()
})

test('プロフィールの「フォロー中」の数を押すと、フォロー中の一覧へ移る', async () => {
  open(page([member(10)]), page([member(20)]))
  const user = userEvent.setup()
  renderApp('/users/owner_user')

  await user.click(await screen.findByRole('link', { name: '2 フォロー中' }))

  expect(await screen.findByRole('heading', { name: '@owner_user のフォロー中' })).toBeInTheDocument()
  expect(await screen.findByText('メンバー20')).toBeInTheDocument()
})

test('一覧の名前を押すと、その人のプロフィールへ移る。「プロフィールへ戻る」で持ち主へ戻れる', async () => {
  fetchMock.mockImplementation((url: string) => {
    if (url === '/api/users/owner_user/followers') return Promise.resolve(jsonResponse(200, page([member(10)])))
    if (url === '/api/users/member_10')
      return Promise.resolve(
        jsonResponse(200, { ...OWNER, id: 10, username: 'member_10', displayName: 'メンバー10', bio: '十番の紹介' }),
      )
    if (url === '/api/users/member_10/posts?size=20')
      return Promise.resolve(jsonResponse(200, { posts: [], hasNext: false }))
    return Promise.resolve(jsonResponse(500))
  })
  const user = userEvent.setup()
  renderApp('/users/owner_user/followers')

  await user.click(await screen.findByRole('button', { name: 'メンバー10（@member_10）のプロフィールを開く' }))

  expect(await screen.findByRole('heading', { name: 'メンバー10' })).toBeInTheDocument()
  expect(screen.getByText('十番の紹介')).toBeInTheDocument()
})
