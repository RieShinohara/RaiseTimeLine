import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/errors'
import { fetchComments, type CommentItem } from '../api/comments'
import { fetchPost, type Post } from '../api/posts'

// 詳細画面の、投稿とコメント一覧の読み込み。別の投稿に移るときは、呼ぶ側が key を変えて、作り直す（状態が混ざらないように）
export function usePostDetail(postId: number) {
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // 投稿がない（404）。「見つかりません」と、読み込みの失敗を、分けて見せる
  const [notFound, setNotFound] = useState(false)
  // 「もう一度」を押すたびに増やして、読み込みをやり直す
  const [attempt, setAttempt] = useState(0)
  // 一覧の読み直しの「何回目か」。読み直しが重なったとき、古い応答が、新しい一覧を上書きしないようにする（F10）
  const latestReload = useRef(0)

  useEffect(() => {
    // この読み込みより前に始めた読み直しの結果は、使わない
    latestReload.current += 1
    let cancelled = false
    // 投稿とコメントは、互いに待たずに、同時に読む
    Promise.all([fetchPost(postId), fetchComments(postId)])
      .then(([p, list]) => {
        if (cancelled) return
        setPost({ ...p, commentCount: list.commentCount })
        setComments(list.comments)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 404) setNotFound(true)
        else setError(e instanceof Error ? e.message : 'エラーが起きました')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    // 画面を離れた・やり直したあとに、前の読み込みの結果が、入り込まないようにする
    return () => {
      cancelled = true
    }
  }, [postId, attempt])

  // 読み込みに失敗したあとの「もう一度」
  const load = useCallback(() => {
    setError(null)
    setLoading(true)
    setAttempt((n) => n + 1)
  }, [])

  // コメントを書いた・消したあと：一覧だけを読み直す（サーバーの順番と数が正）。投稿の本文は、そのまま
  // 書く・消すを続けると、読み直しが重なる。応答の届く順番は、送った順とは限らないので、
  // 自分が「最後の読み直し」のときだけ、結果を反映する（古い応答は、捨てる）
  const reloadComments = useCallback(async () => {
    latestReload.current += 1
    const mine = latestReload.current
    const list = await fetchComments(postId)
    if (mine !== latestReload.current) return
    setComments(list.comments)
    setPost((current) => (current ? { ...current, commentCount: list.commentCount } : current))
  }, [postId])

  // 投稿の一部（いいねの数など）だけを書き換える（useLikeToggle に渡す）
  const patchPost = useCallback((id: number, changes: Partial<Post>) => {
    setPost((current) => (current && current.id === id ? { ...current, ...changes } : current))
  }, [])

  return { post, comments, loading, error, notFound, load, reloadComments, patchPost }
}
