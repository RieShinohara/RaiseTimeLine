import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { CommentItem, CommentList, Reply } from '../api/comments'
import type { Post } from '../api/posts'
import { saveSession } from '../auth/tokenStorage'
import { jsonResponse, renderApp } from '../test-utils/render'

// サンプルは、すべて架空（実在の人・アドレスではない）。ログイン中の人は id=1、投稿した人は id=2、コメントした人は id=3
const ME = { id: 1, email: 'demo@example.com', username: 'demo_user', displayName: 'デモ' }
const POST_AUTHOR = { id: 2, username: 'post_user', displayName: '投稿者' }
const OTHER = { id: 3, username: 'other_user', displayName: '別の人' }

function post(extra: Partial<Post> = {}): Post {
  return {
    id: 10,
    body: '詳細画面の投稿',
    createdAt: '2026-11-18T05:30:00Z',
    updatedAt: null,
    author: POST_AUTHOR,
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    ...extra,
  }
}

function reply(id: number, body: string, author = OTHER): Reply {
  return { id, body, createdAt: '2026-11-18T06:10:00Z', author }
}

function comment(id: number, body: string, replies: Reply[] = [], author = OTHER): CommentItem {
  return { id, body, createdAt: '2026-11-18T06:00:00Z', author, replies }
}

function list(comments: CommentItem[]): CommentList {
  const count = comments.reduce((n, c) => n + 1 + c.replies.length, 0)
  return { comments, commentCount: count }
}

const fetchMock = vi.fn()

// 画面を開くときの、2 つの通信（投稿・コメント一覧）に答える
function open(comments: CommentItem[], p: Post = post()) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === undefined || init.method === 'GET') {
      if (url === '/api/posts/10') return Promise.resolve(jsonResponse(200, p))
      if (url === '/api/posts/10/comments') return Promise.resolve(jsonResponse(200, list(comments)))
    }
    return Promise.resolve(jsonResponse(500))
  })
}

function login() {
  saveSession({ accessToken: 'access-1', refreshToken: 'refresh-1', user: ME })
}

beforeEach(() => {
  localStorage.clear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('投稿と、コメント・返信が、古い順に入れ子で出る（ログインなしでも見られる）', async () => {
  open([comment(1, '一つ目のコメント', [reply(2, '一つ目への返信')]), comment(3, '二つ目のコメント')])
  renderApp('/posts/10')

  expect(await screen.findByText('詳細画面の投稿')).toBeInTheDocument()
  expect(await screen.findByText('一つ目のコメント')).toBeInTheDocument()
  expect(screen.getByText('一つ目への返信')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'コメント（3）' })).toBeInTheDocument()
  const items = screen.getAllByRole('listitem')
  expect(items).toHaveLength(2)
  expect(within(items[0]).getByText('一つ目への返信')).toBeInTheDocument()
  // 札を付けない読み込み。ログインなしなので、入力欄の代わりに案内が出て、「返信」のボタンもない
  expect(screen.getByText(/コメントするには/)).toBeInTheDocument()
  expect(screen.queryByLabelText('コメントを書く')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /に返信$/ })).not.toBeInTheDocument()
})

test('コメントがないときは、「まだコメントがありません」と出る', async () => {
  open([])
  renderApp('/posts/10')
  expect(await screen.findByText('まだコメントがありません')).toBeInTheDocument()
})

test('投稿がないときは、「投稿が見つかりません」と出る', async () => {
  fetchMock.mockResolvedValue(jsonResponse(404, { message: '投稿が見つかりません' }))
  renderApp('/posts/999')
  expect(await screen.findByText('投稿が見つかりません')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'タイムラインへ' })).toBeInTheDocument()
})

test('読み込みに失敗したら理由を出し、「もう一度」でやり直せる', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
  open([])
  renderApp('/posts/10')
  expect(await screen.findByText(/読み込めませんでした/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'もう一度' }))
  expect(await screen.findByText('詳細画面の投稿')).toBeInTheDocument()
})

test('コメントを書くと、送ったあとに一覧を読み直して、増えたコメントと数が出る', async () => {
  login()
  open([])
  renderApp('/posts/10')
  await screen.findByText('まだコメントがありません')

  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return Promise.resolve(jsonResponse(201, comment(5, '新しいコメント', [], ME)))
    if (url === '/api/posts/10/comments')
      return Promise.resolve(jsonResponse(200, list([comment(5, '新しいコメント', [], ME)])))
    return Promise.resolve(jsonResponse(200, post()))
  })
  await userEvent.type(screen.getByLabelText('コメントを書く'), '新しいコメント')
  await userEvent.click(screen.getByRole('button', { name: 'コメントする' }))

  expect(await screen.findByRole('heading', { name: 'コメント（1）' })).toBeInTheDocument()
  expect(screen.getByText('新しいコメント')).toBeInTheDocument()
  const sent = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
  expect(sent[0]).toBe('/api/posts/10/comments')
  expect(JSON.parse(sent[1].body as string)).toEqual({ body: '新しいコメント' })
  expect(screen.getByLabelText('コメントを書く')).toHaveValue('')
})

test('返信：コメントの「返信」を押すと入力欄が開き、親の id つきで送る。返信には「返信」ボタンがない', async () => {
  login()
  open([comment(1, '親のコメント', [reply(2, '既存の返信')])])
  renderApp('/posts/10')
  await screen.findByText('親のコメント')
  // 「返信」のボタンは、コメントにだけ（返信にはない）
  expect(screen.getAllByRole('button', { name: /に返信$/ })).toHaveLength(1)

  await userEvent.click(screen.getByRole('button', { name: '別の人のコメント「親のコメント」に返信' }))
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return Promise.resolve(jsonResponse(201, comment(9, '新しい返信', [], ME)))
    if (url === '/api/posts/10/comments')
      return Promise.resolve(
        jsonResponse(200, list([comment(1, '親のコメント', [reply(2, '既存の返信'), reply(9, '新しい返信', ME)])])),
      )
    return Promise.resolve(jsonResponse(200, post()))
  })
  await userEvent.type(screen.getByLabelText('返信を書く'), '新しい返信')
  await userEvent.click(screen.getByRole('button', { name: '返信する' }))

  expect(await screen.findByText('新しい返信')).toBeInTheDocument()
  const sent = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
  expect(JSON.parse(sent[1].body as string)).toEqual({ body: '新しい返信', parentCommentId: 1 })
  // 送れたら、返信の入力欄は閉じる
  expect(screen.queryByLabelText('返信を書く')).not.toBeInTheDocument()
})

test('削除のボタンは、書いた人と、投稿した人にだけ出る', async () => {
  // ログイン中は id=1。自分が書いたコメントには出て、他の人のコメントには出ない（投稿者でもないので）
  login()
  open([comment(1, '自分のコメント', [], ME), comment(2, '他の人のコメント')])
  renderApp('/posts/10')
  await screen.findByText('自分のコメント')
  expect(screen.getAllByRole('button', { name: /を削除$/ })).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'デモのコメント「自分のコメント」を削除' })).toBeInTheDocument()
})

test('投稿した人には、他の人のコメントにも削除が出る。ログインなしでは、出ない', async () => {
  saveSession({ accessToken: 'a', refreshToken: 'r', user: { ...ME, id: POST_AUTHOR.id } })
  open([comment(1, '他の人のコメント')])
  const view = renderApp('/posts/10')
  await screen.findByText('他の人のコメント')
  expect(screen.getByRole('button', { name: '別の人のコメント「他の人のコメント」を削除' })).toBeInTheDocument()
  view.unmount()

  localStorage.clear()
  renderApp('/posts/10')
  await screen.findByText('他の人のコメント')
  expect(screen.queryByRole('button', { name: /を削除$/ })).not.toBeInTheDocument()
})

test('返信が付いたコメントを消す確認には、「返信も消えます」と出る。消すと一覧が読み直される', async () => {
  login()
  open([comment(1, '親', [reply(2, '返信', ME)], ME)])
  renderApp('/posts/10')
  await screen.findByText('親')

  await userEvent.click(screen.getByRole('button', { name: 'デモのコメント「親」を削除' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText(/付いている返信も、一緒に消えます/)).toBeInTheDocument()

  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }))
    if (url === '/api/posts/10/comments') return Promise.resolve(jsonResponse(200, list([])))
    return Promise.resolve(jsonResponse(200, post()))
  })
  await userEvent.click(within(dialog).getByRole('button', { name: '削除する' }))

  expect(await screen.findByText('まだコメントがありません')).toBeInTheDocument()
  expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/comments/1' && init?.method === 'DELETE')).toBe(true)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

test('返信のないコメントの確認には、「返信も」の文言は出ない。キャンセルなら消さない', async () => {
  login()
  open([comment(1, '返信なし', [], ME)])
  renderApp('/posts/10')
  await screen.findByText('返信なし')

  await userEvent.click(screen.getByRole('button', { name: 'デモのコメント「返信なし」を削除' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).queryByText(/返信も/)).not.toBeInTheDocument()
  await userEvent.click(within(dialog).getByRole('button', { name: 'キャンセル' }))

  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false)
})

test('いいねは、詳細画面でも押せる。編集・削除のボタンは、投稿には出ない', async () => {
  login()
  open([], post({ author: { ...POST_AUTHOR, id: ME.id } }))
  renderApp('/posts/10')
  await screen.findByText('詳細画面の投稿')

  expect(screen.queryByRole('button', { name: /の投稿「.*」を(編集|削除)$/ })).not.toBeInTheDocument()
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { likeCount: 1, liked: true }))
  await userEvent.click(screen.getByRole('button', { name: /にいいねする$/ }))
  expect(await screen.findByRole('button', { name: /のいいねを取り消す$/ })).toBeInTheDocument()
})
