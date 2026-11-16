import { ApiError, NETWORK_ERROR_MESSAGE, readMessage } from './errors'
import { apiFetch } from './http'

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

// 投稿する。ログインが要る（札を付けて送る。期限切れなら、http.ts が自動で更新する）
export async function createPost(body: string): Promise<Post> {
  let res: Response
  try {
    res = await apiFetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE)
  }
  // 401 の応答には、文言がない（Spring Security が、本文なしで返す）ので、ここで決める
  if (res.status === 401) throw new ApiError(401, 'ログインの期限が切れました。もう一度ログインしてください')
  if (!res.ok) throw new ApiError(res.status, await readMessage(res))
  return (await res.json()) as Post
}
