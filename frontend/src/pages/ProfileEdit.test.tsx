import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Profile } from '../api/users'
import { getUser, saveSession } from '../auth/tokenStorage'
import { jsonResponse, renderApp } from '../test-utils/render'

// サンプルは、すべて架空（実在の人・アドレスではない）。ログイン中の人は id=1（demo_user）
const ME = { id: 1, email: 'demo@example.com', username: 'demo_user', displayName: 'デモ' }

function myProfile(extra: Partial<Profile> = {}): Profile {
  return {
    id: 1,
    username: 'demo_user',
    displayName: 'デモ',
    bio: '最初の自己紹介',
    followingCount: 0,
    followerCount: 0,
    followedByMe: false,
    ...extra,
  }
}

const fetchMock = vi.fn()

// 画面を開くときの通信に答える。put は、保存の通信への答え（省略すると、500）
function open(p: Profile, put?: (init: RequestInit) => Promise<Response>) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (method === 'GET' && url === `/api/users/${p.username}`) return Promise.resolve(jsonResponse(200, p))
    if (method === 'GET' && url === `/api/users/${p.username}/posts?size=20`)
      return Promise.resolve(jsonResponse(200, { posts: [], hasNext: false }))
    if (method === 'PUT' && url === `/api/users/${p.username}` && put) return put(init!)
    return Promise.resolve(jsonResponse(500))
  })
}

function login() {
  saveSession({ accessToken: 'access-1', refreshToken: 'refresh-1', user: ME })
}

function putCalls() {
  return fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
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

// 「編集」を押して、ダイアログを開く。入力欄と、保存ボタンを返す
async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: '編集' }))
  const dialog = await screen.findByRole('dialog', { name: 'プロフィールを編集' })
  return {
    dialog,
    name: within(dialog).getByLabelText('表示名'),
    bio: within(dialog).getByLabelText('自己紹介'),
    save: within(dialog).getByRole('button', { name: '保存' }),
  }
}

test('「編集」のボタンは、自分のプロフィールにだけ出る', async () => {
  // 他の人のプロフィール
  login()
  open(myProfile({ id: 2, username: 'other_user', displayName: '別の人' }))
  renderApp('/users/other_user')
  expect(await screen.findByRole('heading', { name: '別の人' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '編集' })).not.toBeInTheDocument()
})

test('ログインなしでは、「編集」のボタンは出ない', async () => {
  open(myProfile())
  renderApp('/users/demo_user')
  expect(await screen.findByRole('heading', { name: 'デモ' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '編集' })).not.toBeInTheDocument()
})

test('開くと、いまの内容が入っていて、変更するまで保存できない（自分のプロフィールには、フォローは出ない）', async () => {
  login()
  open(myProfile())
  const user = userEvent.setup()
  renderApp('/users/demo_user')
  expect(await screen.findByRole('heading', { name: 'デモ' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /フォロー/ })).not.toBeInTheDocument()

  const { name, bio, save } = await openDialog(user)

  expect(name).toHaveValue('デモ')
  expect(bio).toHaveValue('最初の自己紹介')
  expect(save).toBeDisabled()
})

test('自己紹介が未設定のときは、空の欄で開く', async () => {
  login()
  open(myProfile({ bio: null }))
  const user = userEvent.setup()
  renderApp('/users/demo_user')

  const { bio } = await openDialog(user)

  expect(bio).toHaveValue('')
})

test('表示名が空（空白だけ）のときは、保存できない', async () => {
  login()
  open(myProfile())
  const user = userEvent.setup()
  renderApp('/users/demo_user')
  const { name, save } = await openDialog(user)

  fireEvent.change(name, { target: { value: '   ' } })

  expect(save).toBeDisabled()
})

test('表示名は 50 文字まで、自己紹介は 160 文字まで（境界）', async () => {
  login()
  open(myProfile())
  const user = userEvent.setup()
  renderApp('/users/demo_user')
  const { dialog, name, bio, save } = await openDialog(user)

  fireEvent.change(name, { target: { value: 'あ'.repeat(50) } })
  expect(save).toBeEnabled()
  fireEvent.change(name, { target: { value: 'あ'.repeat(51) } })
  expect(save).toBeDisabled()
  expect(within(dialog).getByText('51 / 50（50 文字までです）')).toBeInTheDocument()

  fireEvent.change(name, { target: { value: 'デモ' } })
  fireEvent.change(bio, { target: { value: 'い'.repeat(160) } })
  expect(save).toBeEnabled()
  fireEvent.change(bio, { target: { value: 'い'.repeat(161) } })
  expect(save).toBeDisabled()
  expect(within(dialog).getByText('161 / 160（160 文字までです）')).toBeInTheDocument()
})

test('保存すると、プロフィールとヘッダーの名前が変わり、保存してある情報も新しくなる', async () => {
  login()
  open(myProfile(), () =>
    Promise.resolve(jsonResponse(200, myProfile({ displayName: '新しい名前', bio: '新しい自己紹介' }))),
  )
  const user = userEvent.setup()
  renderApp('/users/demo_user')
  const { name, bio, save } = await openDialog(user)

  fireEvent.change(name, { target: { value: '新しい名前' } })
  fireEvent.change(bio, { target: { value: '新しい自己紹介' } })
  await user.click(save)

  // プロフィールの表示が変わる（ダイアログは閉じる）
  expect(await screen.findByRole('heading', { name: '新しい名前' })).toBeInTheDocument()
  expect(screen.getByText('新しい自己紹介')).toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: 'プロフィールを編集' })).not.toBeInTheDocument()
  // ヘッダーの名前も、すぐ変わる。再読み込みしても、新しい名前のまま（保存してある情報）
  expect(screen.getByRole('link', { name: '新しい名前（@demo_user）' })).toBeInTheDocument()
  expect(getUser()?.displayName).toBe('新しい名前')
  // 送った中身
  expect(putCalls()).toHaveLength(1)
  expect(JSON.parse((putCalls()[0][1] as RequestInit).body as string)).toEqual({
    displayName: '新しい名前',
    bio: '新しい自己紹介',
  })
})

test('保存に失敗したときは、閉じずに理由を出し、入力も残る（ヘッダーの名前は変わらない）', async () => {
  login()
  open(myProfile(), () => Promise.resolve(jsonResponse(400, { message: '表示名は 50 文字までです' })))
  const user = userEvent.setup()
  renderApp('/users/demo_user')
  const { dialog, name, save } = await openDialog(user)

  fireEvent.change(name, { target: { value: '直した名前' } })
  await user.click(save)

  expect(await within(dialog).findByText('表示名は 50 文字までです')).toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: 'プロフィールを編集' })).toBeInTheDocument()
  expect(name).toHaveValue('直した名前')
  // ダイアログが開いている間、後ろの画面は読み上げから隠れている（aria-hidden）ので、hidden: true で探す
  expect(screen.getByRole('link', { name: 'デモ（@demo_user）', hidden: true })).toBeInTheDocument()
  expect(getUser()?.displayName).toBe('デモ')
})

test('キャンセルすると、何も送らず閉じる。開き直すと、元の内容に戻っている', async () => {
  login()
  open(myProfile())
  const user = userEvent.setup()
  renderApp('/users/demo_user')
  const first = await openDialog(user)
  fireEvent.change(first.name, { target: { value: '途中まで書いた名前' } })

  await user.click(within(first.dialog).getByRole('button', { name: 'キャンセル' }))
  await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'プロフィールを編集' })).not.toBeInTheDocument())
  expect(putCalls()).toHaveLength(0)

  const second = await openDialog(user)
  expect(second.name).toHaveValue('デモ')
})
