import { useCallback, useRef, useState } from 'react'
import { likePost, unlikePost, type Post } from '../api/posts'

// いいねの押す・取り消す。
// ・結果（サーバーが返した数と状態）を待ってから、画面を変える（LIKE-3。先に変えると、失敗したとき、嘘の数が見える）
// ・同じ投稿は、返事が来るまで、二重に送らない（連打しても、1 回だけ）
export function useLikeToggle(patch: (id: number, changes: Partial<Post>) => void) {
  // 送信中の投稿の id（ボタンを押せなくするために、画面にも渡す）
  const [pendingIds, setPendingIds] = useState<ReadonlySet<number>>(new Set())
  // 失敗の理由（画面に出す。なければ null）
  const [error, setError] = useState<string | null>(null)
  // 連打の判断は、画面の再描画を待たない「印」で行う（state だと、描画の前に、2 回目が通ってしまう）
  const sending = useRef(new Set<number>())

  const toggle = useCallback(
    async (post: Post) => {
      if (sending.current.has(post.id)) return
      sending.current.add(post.id)
      setPendingIds(new Set(sending.current))
      setError(null)
      try {
        const result = post.likedByMe ? await unlikePost(post.id) : await likePost(post.id)
        patch(post.id, { likeCount: result.likeCount, likedByMe: result.liked })
      } catch (e) {
        setError(`うまくいきませんでした（${e instanceof Error ? e.message : 'エラーが起きました'}）`)
      } finally {
        sending.current.delete(post.id)
        setPendingIds(new Set(sending.current))
      }
    },
    [patch],
  )

  const clearError = useCallback(() => setError(null), [])

  return { pendingIds, error, toggle, clearError }
}
