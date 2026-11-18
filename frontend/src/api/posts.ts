import { ApiError, NETWORK_ERROR_MESSAGE, readMessage } from './errors'
import { apiFetch, refreshIfExpired } from './http'

// 投稿 API（/api/posts）を呼ぶ関数（docs/features/02-post.md、04-timeline.md の API）

export interface PostAuthor {
  id: number
  username: string
  displayName: string
}

export interface Post {
  id: number
  body: string
  createdAt: string
  // 編集していなければ null（入っていれば「編集済み」）
  updatedAt: string | null
  author: PostAuthor
  // いいねの数と、ログイン中の自分が押したか（ログインなしは、常に false）
  likeCount: number
  likedByMe: boolean
  // コメントの数（返信を含む合計）
  commentCount: number
}

export interface PostPage {
  posts: Post[]
  hasNext: boolean
}

export const PAGE_SIZE = 20

// タイムラインを読む。before（投稿 id）を渡すと、それより古い投稿を読む（省略すると最新から）。
// ログインなしでも見られる。ログイン中は、札を付けて送る（「自分が押したか」が、自分の分として返る）
export async function fetchPosts(before?: number, size: number = PAGE_SIZE): Promise<PostPage> {
  const query = before === undefined ? `size=${size}` : `before=${before}&size=${size}`
  // 札の期限が切れていると、サーバーは「ログインなし」として扱い、押した状態が、すべて false になる。先に更新しておく
  await refreshIfExpired()
  let res: Response
  try {
    res = await apiFetch(`/api/posts?${query}`)
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE)
  }
  if (!res.ok) throw new ApiError(res.status, await readMessage(res))
  return (await res.json()) as PostPage
}

// after（投稿 id）より新しい投稿の件数（新着の確認用）。ログイン中は、自分の投稿を数えない（サーバーが判断）
export async function fetchNewCount(after: number): Promise<number> {
  // 札の期限が切れていると、サーバーは「ログインなし」として数える。先に更新しておく
  await refreshIfExpired()
  let res: Response
  try {
    res = await apiFetch(`/api/posts/new-count?after=${after}`)
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE)
  }
  if (!res.ok) throw new ApiError(res.status, await readMessage(res))
  return ((await res.json()) as { count: number }).count
}

// 投稿 1 件を読む（詳細画面用）。ログインなしでも見られる。見つからなければ、status 404 の ApiError
export async function fetchPost(id: number): Promise<Post> {
  // 札の期限が切れていると、サーバーは「ログインなし」として扱い、押した状態が false になる。先に更新しておく
  await refreshIfExpired()
  let res: Response
  try {
    res = await apiFetch(`/api/posts/${id}`)
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE)
  }
  if (!res.ok) throw new ApiError(res.status, await readMessage(res))
  return (await res.json()) as Post
}

// ログインが要る呼び出し。札を付けて送る（期限切れなら、http.ts が自動で更新する）。
// 失敗したときは、画面に出せる文言つきの ApiError にする（コメントの API からも使う）
export async function callWithLogin(path: string, init: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await apiFetch(path, init)
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE)
  }
  // 401 の応答には、文言がない（Spring Security が、本文なしで返す）ので、ここで決める
  if (res.status === 401) throw new ApiError(401, 'ログインの期限が切れました。もう一度ログインしてください')
  if (!res.ok) throw new ApiError(res.status, await readMessage(res))
  return res
}

function jsonBody(body: string): RequestInit {
  return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) }
}

// 投稿する
export async function createPost(body: string): Promise<Post> {
  const res = await callWithLogin('/api/posts', { method: 'POST', ...jsonBody(body) })
  return (await res.json()) as Post
}

// 自分の投稿の本文を直す（本人だけ。他の人の投稿は、サーバーが 403 で断る）
export async function updatePost(id: number, body: string): Promise<Post> {
  const res = await callWithLogin(`/api/posts/${id}`, { method: 'PUT', ...jsonBody(body) })
  return (await res.json()) as Post
}

// 自分の投稿を消す（本人だけ。元に戻せない）
export async function deletePost(id: number): Promise<void> {
  await callWithLogin(`/api/posts/${id}`, { method: 'DELETE' })
}

// いいねを押した・取り消したあとの、その投稿の数と、自分が押した状態
export interface LikeState {
  likeCount: number
  liked: boolean
}

// いいねを押す（何回押しても、結果は同じ）。ログインが要る
export async function likePost(id: number): Promise<LikeState> {
  const res = await callWithLogin(`/api/posts/${id}/like`, { method: 'PUT' })
  return (await res.json()) as LikeState
}

// いいねを取り消す（押していなくても、結果は同じ）。ログインが要る
export async function unlikePost(id: number): Promise<LikeState> {
  const res = await callWithLogin(`/api/posts/${id}/like`, { method: 'DELETE' })
  return (await res.json()) as LikeState
}
