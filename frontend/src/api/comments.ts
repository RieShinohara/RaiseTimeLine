import { ApiError, NETWORK_ERROR_MESSAGE, readMessage } from './errors'
import { apiFetch } from './http'
import { callWithLogin, type PostAuthor } from './posts'

// コメント API を呼ぶ関数（docs/features/05-comment.md 6a）

// 返信（1 段だけなので、さらに下の返信は持たない）
export interface Reply {
  id: number
  body: string
  createdAt: string
  author: PostAuthor
}

// コメント。返信は、古い順
export interface CommentItem extends Reply {
  replies: Reply[]
}

// commentCount は、返信を含む合計
export interface CommentList {
  comments: CommentItem[]
  commentCount: number
}

// コメントと返信を読む（古い順。ログインなしで可）。投稿がなければ、status 404 の ApiError
export async function fetchComments(postId: number): Promise<CommentList> {
  let res: Response
  try {
    res = await apiFetch(`/api/posts/${postId}/comments`)
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE)
  }
  if (!res.ok) throw new ApiError(res.status, await readMessage(res))
  return (await res.json()) as CommentList
}

// コメントを書く。parentCommentId を渡すと、そのコメントへの返信になる。ログインが要る
export async function createComment(postId: number, body: string, parentCommentId?: number): Promise<CommentItem> {
  const res = await callWithLogin(`/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, parentCommentId }),
  })
  return (await res.json()) as CommentItem
}

// コメント（または返信）を消す。書いた人と、投稿した人だけ。返信付きのコメントは、返信も消える
export async function deleteComment(id: number): Promise<void> {
  await callWithLogin(`/api/comments/${id}`, { method: 'DELETE' })
}
