import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchPosts, type Post } from '../api/posts'

// 投稿が 1 件もないときの、「ここより新しい」の基準（id は 1 から始まるので、0 より大きい投稿は、すべて新着）
export const NO_POSTS_ID = 0

// 1 ページ目の、一番上の投稿の id。投稿がなければ NO_POSTS_ID
function topId(posts: Post[]): number {
  return posts[0]?.id ?? NO_POSTS_ID
}

// タイムライン（全体）の、投稿の並びと、続きの読み込み
export function useTimeline() {
  const [posts, setPosts] = useState<Post[]>([])
  const [hasNext, setHasNext] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // サーバーと同期した時点の「一番上の投稿の id」。新着の確認（new-count）の基準。
  // 自分の投稿を足しても変えない（変えると、その間の、他の人の新着を取りこぼす）。1 ページ目を読んだときだけ更新する
  const [syncedId, setSyncedId] = useState<number | null>(null)
  // 続きを読む目印：これまでに読んだ中で、いちばん古い投稿の id（「ここより古いもの」を読む）。
  // undefined は、まだ何も読んでいない（最新から読む）。読み込みが成功したときだけ進める（失敗したら、同じ所をやり直せる）。
  // 一覧（posts）の最後ではなく、読んだ結果から決める（自分の投稿の追加や削除に、影響されない）
  const cursor = useRef<number | undefined>(undefined)
  // 読み込み中に、もう一度始めない（画面の再描画や、スクロールの連続で、二重にならないように）
  const busy = useRef(false)

  const loadMore = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setLoading(true)
    setError(null)
    try {
      const before = cursor.current
      const result = await fetchPosts(before)
      cursor.current = result.posts.at(-1)?.id ?? before
      if (before === undefined) setSyncedId(topId(result.posts))
      setPosts((current) => [...current, ...result.posts])
      setHasNext(result.hasNext)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが起きました')
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [])

  // 新着バナーを押したとき：1 ページ目から読み直して、一覧を入れ替える。成功したら true。
  // 失敗したときや、ほかの読み込み中のときは、何も変えず false（バナーは残り、もう一度、押せる）
  const reload = useCallback(async (): Promise<boolean> => {
    if (busy.current) return false
    busy.current = true
    try {
      const result = await fetchPosts()
      cursor.current = result.posts.at(-1)?.id
      setSyncedId(topId(result.posts))
      setPosts(result.posts)
      setHasNext(result.hasNext)
      setError(null)
      return true
    } catch {
      return false
    } finally {
      busy.current = false
    }
  }, [])

  // 画面を開いたときに、最初のページを読む
  useEffect(() => {
    void loadMore()
  }, [loadMore])

  // 自分が投稿したときに、一番上に足す（同じ id が、すでにあれば、置き換える）
  const prepend = useCallback((post: Post) => {
    setPosts((current) => [post, ...current.filter((p) => p.id !== post.id)])
  }, [])

  // 編集した投稿を、同じ場所で、置き換える
  const replace = useCallback((post: Post) => {
    setPosts((current) => current.map((p) => (p.id === post.id ? post : p)))
  }, [])

  // 削除した投稿を、一覧から外す
  const remove = useCallback((id: number) => {
    setPosts((current) => current.filter((p) => p.id !== id))
  }, [])

  return { posts, hasNext, loading, error, syncedId, loadMore, reload, prepend, replace, remove }
}
