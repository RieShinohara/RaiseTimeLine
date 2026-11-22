import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { FollowState, FollowUser, FollowUserPage } from '../api/users'
import { saveSession } from '../auth/tokenStorage'
import { jsonResponse, renderApp } from '../test-utils/render'

// ユーザー検索（ヘッダーの検索欄と、結果の画面）のテスト。サンプルは、すべて架空
const ME = { id: 1, email: 'demo@example.com', username: 'demo_user', displayName: 'デモ' }

function person(id: number, extra: Partial<FollowUser> = {}): FollowUser {
  return { id, username: `member_${id}`, displayName: `メンバー${id}`, bio: null, followedByMe: false, ...extra }
}

function page(users: FollowUser[], hasNext = false): FollowUserPage {
  return { users, hasNext }
}

const fetchMock = vi.fn()

// 検索の通信に答える（q ごとの答えを、results に入れる）。follow は、フォロー・解除の通信への答え
let results: Record<string, FollowUserPage | 'fail'>
let follow: ((url: string, init: RequestInit) => Promise<Response>) | undefined

function searchCalls() {
  return fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/users?'))
}

beforeEach(() => {
  localStorage.clear()
  results = {}
  follow = undefined
  fetchMock.mockReset()
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.startsWith('/api/users?q=')) {
      const q = decodeURIComponent(url.slice('/api/users?q='.length))
      const answer = results[q]
      if (answer === 'fail') return Promise.resolve(jsonResponse(500, { message: 'サーバーのエラー' }))
      return Promise.resolve(jsonResponse(200, answer ?? page([])))
    }
    if (url.endsWith('/follow') && follow) return follow(url, init!)
    if (url === '/api/users/member_2') return Promise.reject(new Error('プロフィールは、この画面のテストでは読まない'))
    return Promise.resolve(jsonResponse(404, { message: '想定していない通信です' }))
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function login() {
  saveSession({ accessToken: 'access-1', refreshToken: 'refresh-1', user: ME })
}

function followState(followerCount: number, following: boolean): FollowState {
  return { followerCount, following }
}

test('検索欄に入力して Enter を押すと、検索結果の画面へ進み、結果が一覧で出る（ログインなしでも使える）', async () => {
  const user = userEvent.setup()
  results['山田'] = page([person(2, { displayName: '山田太郎', bio: 'よろしくお願いします' }), person(3)])
  renderApp('/')

  await user.type(screen.getByRole('textbox', { name: 'ユーザーを検索' }), '山田{Enter}')

  expect(await screen.findByRole('heading', { name: '「山田」の検索結果' })).toBeInTheDocument()
  const items = screen.getAllByRole('listitem')
  expect(items).toHaveLength(2)
  expect(within(items[0]).getByText('山田太郎')).toBeInTheDocument()
  expect(within(items[0]).getByText('よろしくお願いします')).toBeInTheDocument()
  expect(searchCalls()[0][0]).toBe(`/api/users?q=${encodeURIComponent('山田')}`)
})

test('空や空白だけで Enter を押しても、検索しない（画面も動かない）', async () => {
  const user = userEvent.setup()
  renderApp('/')

  const input = screen.getByRole('textbox', { name: 'ユーザーを検索' })
  await user.type(input, '{Enter}')
  await user.type(input, '   {Enter}')

  expect(searchCalls()).toHaveLength(0)
  expect(screen.queryByRole('heading', { name: /の検索結果/ })).not.toBeInTheDocument()
  // 画面も動かない（動くと、検索結果の画面の「入力してください」の案内が出る）
  expect(screen.queryByText('上の検索欄に、ユーザー名か表示名を入力してください')).not.toBeInTheDocument()
})

test('前後の空白は取って検索し、言葉を変えて検索し直すと、結果が入れ替わる', async () => {
  const user = userEvent.setup()
  results['abc'] = page([person(2, { displayName: '最初の結果' })])
  results['xyz'] = page([person(3, { displayName: '次の結果' })])
  renderApp('/')

  const input = screen.getByRole('textbox', { name: 'ユーザーを検索' })
  await user.type(input, '  abc  {Enter}')
  expect(await screen.findByText('最初の結果')).toBeInTheDocument()
  expect(searchCalls()[0][0]).toBe('/api/users?q=abc')

  await user.clear(input)
  await user.type(input, 'xyz{Enter}')
  expect(await screen.findByText('次の結果')).toBeInTheDocument()
  expect(screen.queryByText('最初の結果')).not.toBeInTheDocument()
})

test('一致する人がいないときは、「見つかりません」と出る', async () => {
  results['nobody'] = page([])
  renderApp('/search?q=nobody')

  expect(await screen.findByText('「nobody」に一致するユーザーは、見つかりません')).toBeInTheDocument()
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
})

test('言葉がない URL（/search）では、入力の案内を出し、検索しない', async () => {
  renderApp('/search')

  expect(await screen.findByText('上の検索欄に、ユーザー名か表示名を入力してください')).toBeInTheDocument()
  expect(searchCalls()).toHaveLength(0)
})

test('読み込みに失敗したら、理由と「もう一度」が出て、押すとやり直す', async () => {
  const user = userEvent.setup()
  results['abc'] = 'fail'
  renderApp('/search?q=abc')

  expect(await screen.findByText('読み込めませんでした（サーバーのエラー）')).toBeInTheDocument()

  results['abc'] = page([person(2, { displayName: '直った結果' })])
  await user.click(screen.getByRole('button', { name: 'もう一度' }))
  expect(await screen.findByText('直った結果')).toBeInTheDocument()
  expect(searchCalls()).toHaveLength(2)
})

test('20 人を超えるときは、「最初の 20 人を表示しています」と案内する', async () => {
  results['a'] = page([person(2)], true)
  renderApp('/search?q=a')

  expect(
    await screen.findByText('最初の 20 人を表示しています。名前をしぼると、見つけやすくなります'),
  ).toBeInTheDocument()
})

test('結果の名前を押すと、その人のプロフィールへ進む', async () => {
  const user = userEvent.setup()
  results['a'] = page([person(2, { displayName: '押す人' })])
  renderApp('/search?q=a')

  await user.click(await screen.findByRole('button', { name: '押す人（@member_2）のプロフィールを開く' }))

  // プロフィールの画面に移った（検索結果の見出しは、なくなる）
  await waitFor(() => expect(screen.queryByRole('heading', { name: '「a」の検索結果' })).not.toBeInTheDocument())
})

test('ログイン中は、結果の人をフォロー・解除でき、自分の行にはボタンが出ない', async () => {
  const user = userEvent.setup()
  login()
  results['a'] = page([person(1, { displayName: 'デモ' }), person(2, { displayName: '相手' })])
  follow = (_url, init) => Promise.resolve(jsonResponse(200, followState(5, init.method === 'PUT')))
  renderApp('/search?q=a')

  await screen.findByText('相手')
  // 自分（id=1）の行には、ボタンがない
  expect(screen.queryByRole('button', { name: 'デモをフォローする' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '相手をフォローする' }))
  expect(await screen.findByRole('button', { name: '相手のフォローを解除する' })).toBeInTheDocument()
  const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/follow'))!
  expect(call[0]).toBe('/api/users/member_2/follow')
  expect(call[1].method).toBe('PUT')
  expect(new Headers(call[1].headers).get('Authorization')).toBe('Bearer access-1')

  await user.click(screen.getByRole('button', { name: '相手のフォローを解除する' }))
  expect(await screen.findByRole('button', { name: '相手をフォローする' })).toBeInTheDocument()
})

test('ログインなしでフォローを押すと、ログインの画面へ案内する（フォローの通信はしない）', async () => {
  const user = userEvent.setup()
  results['a'] = page([person(2, { displayName: '相手' })])
  renderApp('/search?q=a')

  await user.click(await screen.findByRole('button', { name: '相手をフォローする' }))

  expect(await screen.findByRole('heading', { name: 'ログイン' })).toBeInTheDocument()
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/follow'))).toBe(false)
})
