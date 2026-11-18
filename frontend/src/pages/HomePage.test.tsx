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
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    ...extra,
  }
}

function page(posts: Post[], hasNext = false): PostPage {
  return { posts, hasNext }
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

// 「一番下まで進んだ」という合図を送る。
// 投稿が画面に出た直後は、目印の見張りが、まだ作り直されていないことがある（読み込みが終わってから、作り直される）。
// 見張りができるのを待ってから、合図を送る（待たないと、遅い環境〈CI〉でだけ、たまに失敗する）
async function reachBottom() {
  await waitFor(() => expect(FakeIntersectionObserver.instances.length).toBeGreaterThan(0))
  act(() => FakeIntersectionObserver.instances.at(-1)!.reachBottom())
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
  expect(fetchMock.mock.calls[0][0]).toBe('/api/posts?size=20')
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
  expect(screen.queryByRole('button', { name: '投稿する' })).not.toBeInTheDocument()
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
  // 失敗したときは、目印を進めない（最新からの読み込みを 2 回している）
  expect(timelineCalls().map(([url]) => url)).toEqual(['/api/posts?size=20', '/api/posts?size=20'])
})

test('一番下まで進むと、いちばん古い投稿の id を before にして、続きを読み込む', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(200, page([post(3, '三番目'), post(2, '二番目')], true)))
  fetchMock.mockResolvedValueOnce(jsonResponse(200, page([post(1, '一番目')], false)))
  renderApp('/')
  expect(await screen.findByText('三番目')).toBeInTheDocument()
  expect(screen.queryByText('これ以上ありません')).not.toBeInTheDocument()

  await reachBottom()

  expect(await screen.findByText('一番目')).toBeInTheDocument()
  expect(timelineCalls()[1][0]).toBe('/api/posts?before=2&size=20')
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

  await user.click(await screen.findByRole('button', { name: '投稿する' }))
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

  await user.click(screen.getByRole('button', { name: '投稿する' }))
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

  await user.click(await screen.findByRole('button', { name: '投稿する' }))
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

  await user.click(await screen.findByRole('button', { name: '投稿する' }))
  await user.type(within(await screen.findByRole('dialog')).getByRole('textbox'), '途中でやめる')
  await user.click(screen.getByRole('button', { name: 'キャンセル' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

  await user.click(screen.getByRole('button', { name: '投稿する' }))
  expect(within(await screen.findByRole('dialog')).getByRole('textbox')).toHaveValue('')
})

// ここから：編集・削除（⑤-3a）。DEMO_USER（id 1）が書いた投稿と、他の人（id 2）の投稿
function mine(id: number, body: string, extra: Partial<Post> = {}): Post {
  return post(id, body, { author: { id: 1, username: 'demo_user', displayName: 'デモ' }, ...extra })
}

function loginAndLoad(posts: Post[]) {
  saveSession({ accessToken: 'access-1', refreshToken: 'refresh-1', user: DEMO_USER })
  fetchMock.mockResolvedValueOnce(jsonResponse(200, page(posts)))
  renderApp('/')
}

test('編集・削除のボタンは、自分の投稿だけに出る（ログインなしでは、出ない）', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(200, page([mine(2, '自分の投稿'), post(1, '他の人の投稿')])))
  renderApp('/')
  expect(await screen.findByText('自分の投稿')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /を編集$/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /を削除$/ })).not.toBeInTheDocument()
})

test('ログイン中は、自分の投稿にだけ、編集と削除のボタンが出る', async () => {
  loginAndLoad([mine(2, '自分の投稿'), post(1, '他の人の投稿')])
  expect(await screen.findByText('他の人の投稿')).toBeInTheDocument()
  const articles = screen.getAllByRole('article')
  expect(within(articles[0]).getByRole('button', { name: /を編集$/ })).toBeInTheDocument()
  expect(within(articles[0]).getByRole('button', { name: /を削除$/ })).toBeInTheDocument()
  expect(within(articles[1]).queryByRole('button', { name: /を編集$/ })).not.toBeInTheDocument()
  expect(within(articles[1]).queryByRole('button', { name: /を削除$/ })).not.toBeInTheDocument()
})

test('編集：今の本文が入ったモーダルで直して保存すると、同じ場所で置き換わり「編集済み」になる', async () => {
  const user = userEvent.setup()
  loginAndLoad([mine(2, '直す前の本文'), post(1, '他の人の投稿')])
  await screen.findByText('直す前の本文')
  fetchMock.mockResolvedValueOnce(jsonResponse(200, mine(2, '直したあとの本文', { updatedAt: '2026-11-16T07:00:00Z' })))

  await user.click(within(screen.getAllByRole('article')[0]).getByRole('button', { name: /を編集$/ }))
  const dialog = await screen.findByRole('dialog')
  const input = within(dialog).getByRole('textbox')
  expect(input).toHaveValue('直す前の本文')
  const save = within(dialog).getByRole('button', { name: '保存' })
  expect(save).toBeDisabled() // 本文が同じままでは、保存できない

  await user.clear(input)
  await user.type(input, '直したあとの本文')
  await user.click(save)

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  const articles = screen.getAllByRole('article')
  expect(within(articles[0]).getByText('直したあとの本文')).toBeInTheDocument()
  expect(within(articles[0]).getByText('編集済み')).toBeInTheDocument()
  expect(within(articles[1]).getByText('他の人の投稿')).toBeInTheDocument()
  expect(screen.queryByText('直す前の本文')).not.toBeInTheDocument()

  const [url, init] = fetchMock.mock.calls[1]
  expect(url).toBe('/api/posts/2')
  expect(init.method).toBe('PUT')
  expect(JSON.parse(init.body)).toEqual({ body: '直したあとの本文' })
  expect(new Headers(init.headers).get('Authorization')).toBe('Bearer access-1')
})

test('編集に失敗したら、モーダルを閉じず、入力を残して理由を出す。元の投稿は変わらない', async () => {
  const user = userEvent.setup()
  loginAndLoad([mine(2, '元の本文')])
  await screen.findByText('元の本文')
  fetchMock.mockResolvedValueOnce(jsonResponse(404, { message: '投稿が見つかりません' }))

  await user.click(screen.getByRole('button', { name: /を編集$/ }))
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByRole('textbox'), 'つづき')
  await user.click(within(dialog).getByRole('button', { name: '保存' }))

  expect(await within(dialog).findByText('投稿が見つかりません')).toBeInTheDocument()
  expect(within(dialog).getByRole('textbox')).toHaveValue('元の本文つづき')
  // モーダルが開いている間、背後の画面は、支援技術から隠される（aria-hidden）ので、hidden も探す
  expect(screen.getByRole('article', { hidden: true })).toHaveTextContent('元の本文')
})

test('削除：確認のダイアログで「キャンセル」なら、何も消さない', async () => {
  const user = userEvent.setup()
  loginAndLoad([mine(2, '消さない投稿')])
  await screen.findByText('消さない投稿')

  await user.click(screen.getByRole('button', { name: /を削除$/ }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('この投稿を削除しますか？')).toBeInTheDocument()
  expect(within(dialog).getByText('削除した投稿は元に戻せません。')).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'キャンセル' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByText('消さない投稿')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1) // 一覧を読んだだけ。DELETE は送っていない
})

test('削除：「削除する」を押すと、サーバーに送り、一覧から消える', async () => {
  const user = userEvent.setup()
  loginAndLoad([mine(2, '消す投稿'), post(1, '残る投稿')])
  await screen.findByText('消す投稿')
  fetchMock.mockResolvedValueOnce(jsonResponse(204))

  await user.click(within(screen.getAllByRole('article')[0]).getByRole('button', { name: /を削除$/ }))
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '削除する' }))

  await waitFor(() => expect(screen.queryByText('消す投稿')).not.toBeInTheDocument())
  // ダイアログは、閉じる動き（アニメーション）のあとで消える
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByText('残る投稿')).toBeInTheDocument()
  const [url, init] = fetchMock.mock.calls[1]
  expect(url).toBe('/api/posts/2')
  expect(init.method).toBe('DELETE')
  expect(new Headers(init.headers).get('Authorization')).toBe('Bearer access-1')
})

test('削除に失敗したら、ダイアログを閉じず、理由を出す。投稿は残る', async () => {
  const user = userEvent.setup()
  loginAndLoad([mine(2, '消えない投稿')])
  await screen.findByText('消えない投稿')
  fetchMock.mockResolvedValueOnce(jsonResponse(403, { message: '他の人の投稿は、編集・削除できません' }))

  await user.click(screen.getByRole('button', { name: /を削除$/ }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: '削除する' }))

  expect(await within(dialog).findByText('他の人の投稿は、編集・削除できません')).toBeInTheDocument()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByText('消えない投稿')).toBeInTheDocument()
})

// ここから：いいね（⑥-2）。DEMO_USER（id 1）でログインして、他の人（id 2）の投稿にいいねする
function pressedLikeButton(article: HTMLElement) {
  return within(article).getByRole('button', { name: /のいいねを取り消す$/ })
}

test('ログイン中は、一覧を読むときにも札を付ける（「自分が押したか」が、自分の分として返るように）', async () => {
  loginAndLoad([post(1, '他の人の投稿')])
  expect(await screen.findByText('他の人の投稿')).toBeInTheDocument()
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/posts?size=20')
  expect(new Headers(init.headers).get('Authorization')).toBe('Bearer access-1')
})

test('ログインなしの一覧は、札を付けない。いいねの数は見える', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(200, page([post(1, '他の人の投稿', { likeCount: 5 })])))
  renderApp('/')
  const article = (await screen.findByText('他の人の投稿')).closest('article') as HTMLElement
  expect(within(article).getByText('5')).toBeInTheDocument()
  const init = fetchMock.mock.calls[0][1]
  expect(new Headers(init?.headers).get('Authorization')).toBeNull()
})

test('いいねを押すと、札を付けて PUT で送り、返事を待ってから、数と押した状態が変わる', async () => {
  const user = userEvent.setup()
  loginAndLoad([post(1, '他の人の投稿', { likeCount: 2 })])
  const article = (await screen.findByText('他の人の投稿')).closest('article') as HTMLElement

  // 返事は、あとから返す（返事が来るまでの様子を見る）
  let reply: (r: Response) => void = () => {}
  fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => (reply = resolve)))
  await user.click(within(article).getByRole('button', { name: /にいいねする$/ }))

  // 返事の前：数は、そのまま。ボタンは、押せない
  expect(within(article).getByText('2')).toBeInTheDocument()
  expect(within(article).getByRole('button', { name: /にいいねする$/ })).toBeDisabled()

  reply(jsonResponse(200, { likeCount: 3, liked: true }))
  await waitFor(() => expect(within(article).getByText('3')).toBeInTheDocument())
  expect(pressedLikeButton(article)).toHaveAttribute('aria-pressed', 'true')
  expect(pressedLikeButton(article)).toBeEnabled()

  const [url, init] = fetchMock.mock.calls[1]
  expect(url).toBe('/api/posts/1/like')
  expect(init.method).toBe('PUT')
  expect(new Headers(init.headers).get('Authorization')).toBe('Bearer access-1')
})

test('押した状態で押すと、DELETE で取り消して、数が減る', async () => {
  const user = userEvent.setup()
  loginAndLoad([post(1, '他の人の投稿', { likeCount: 3, likedByMe: true })])
  const article = (await screen.findByText('他の人の投稿')).closest('article') as HTMLElement
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { likeCount: 2, liked: false }))

  await user.click(pressedLikeButton(article))

  await waitFor(() => expect(within(article).getByText('2')).toBeInTheDocument())
  expect(within(article).getByRole('button', { name: /にいいねする$/ })).toHaveAttribute('aria-pressed', 'false')
  expect(fetchMock.mock.calls[1][1].method).toBe('DELETE')
})

test('いいねに失敗したら、理由を出し、数と押した状態は、元のまま', async () => {
  const user = userEvent.setup()
  loginAndLoad([post(1, '他の人の投稿', { likeCount: 2 })])
  const article = (await screen.findByText('他の人の投稿')).closest('article') as HTMLElement
  fetchMock.mockResolvedValueOnce(jsonResponse(404, { message: '投稿が見つかりません' }))

  await user.click(within(article).getByRole('button', { name: /にいいねする$/ }))

  expect(await screen.findByText('うまくいきませんでした（投稿が見つかりません）')).toBeInTheDocument()
  expect(within(article).getByText('2')).toBeInTheDocument()
  expect(within(article).getByRole('button', { name: /にいいねする$/ })).toHaveAttribute('aria-pressed', 'false')
  expect(within(article).getByRole('button', { name: /にいいねする$/ })).toBeEnabled()
})

test('ログインなしでハートを押すと、いいねは送らず、ログインの画面へ案内する', async () => {
  const user = userEvent.setup()
  fetchMock.mockResolvedValueOnce(jsonResponse(200, page([post(1, '他の人の投稿')])))
  renderApp('/')
  const article = (await screen.findByText('他の人の投稿')).closest('article') as HTMLElement

  await user.click(within(article).getByRole('button', { name: /にいいねする$/ }))

  // 入力欄の名前には、必須の印（ * ）が付くので、正規表現で探す
  expect(await screen.findByLabelText(/メールアドレス/)).toBeInTheDocument()
  // 一覧を読んだ 1 回だけ。いいねの通信は、していない
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('自分の投稿にも、いいねできる（投稿した本人も、押せる）', async () => {
  const user = userEvent.setup()
  loginAndLoad([mine(1, '自分の投稿')])
  const article = (await screen.findByText('自分の投稿')).closest('article') as HTMLElement
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { likeCount: 1, liked: true }))

  await user.click(within(article).getByRole('button', { name: /にいいねする$/ }))

  await waitFor(() => expect(pressedLikeButton(article)).toBeInTheDocument())
})

test('トップ画面を開いたままログインが切れたら、「押した状態」は消える（数は、そのまま見える）', async () => {
  const user = userEvent.setup()
  loginAndLoad([post(1, '他の人の投稿', { likeCount: 3, likedByMe: true })])
  const article = (await screen.findByText('他の人の投稿')).closest('article') as HTMLElement
  // 取り消しの操作 → 札が期限切れ（401）→ 札の更新も無効（401）→ ログインが切れる
  fetchMock.mockResolvedValueOnce(jsonResponse(401))
  fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: 'リフレッシュトークンが無効です' }))

  await user.click(pressedLikeButton(article))

  expect(await screen.findByText(/ログインの期限が切れました/)).toBeInTheDocument()
  // ログインしていない扱いになるので、前の人の「押した状態」は出さない。数は、そのまま
  expect(within(article).getByRole('button', { name: /にいいねする$/ })).toHaveAttribute('aria-pressed', 'false')
  expect(within(article).getByText('3')).toBeInTheDocument()
})
