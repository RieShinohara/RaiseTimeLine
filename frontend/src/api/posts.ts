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
}

export interface PostPage {
  posts: Post[]
  page: number
  size: number
  hasNext: boolean
}

export const PAGE_SIZE = 20

// タイムラインを読む。ログインなしで見られるので、札は付けない
export async function fetchPosts(page: number, size: number = PAGE_SIZE): Promise<PostPage> {
  let res: Response
  try {
    res = await fetch(`/api/posts?page=${page}&size=${size}`)
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE)
  }
  if (!res.ok) throw new ApiError(res.status, await readMessage(res))
  return (await res.json()) as PostPage
}

// since より新しい投稿の件数（新着の確認用）。ログイン中は、自分の投稿を数えない（サーバーが判断）。
// since は、サーバーが返した日時の文字列を、変換せずに渡す（変換すると、細かい桁が落ちて、一番上の投稿自身が数えられることがある）
export async function fetchNewCount(since: string): Promise<number> {
  // 札の期限が切れていると、サーバーは「ログインなし」として数える。先に更新しておく
  await refreshIfExpired()
  let res: Response
  try {
    res = await apiFetch(`/api/posts/new-count?since=${encodeURIComponent(since)}`)
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE)
  }
  if (!res.ok) throw new ApiError(res.status, await readMessage(res))
  return ((await res.json()) as { count: number }).count
}

// ログインが要る呼び出し。札を付けて送る（期限切れなら、http.ts が自動で更新する）。
// 失敗したときは、画面に出せる文言つきの ApiError にする
async function callWithLogin(path: string, init: RequestInit): Promise<Response> {
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
