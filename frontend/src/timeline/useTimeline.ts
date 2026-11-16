import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchPosts, type Post } from '../api/posts'

// 同じ id の投稿は、2 回出さない。
// ページ番号方式は、新しい投稿が入ると、全体がずれて、同じ投稿が、また出ることがあるため
export function appendUnique(current: Post[], incoming: Post[]): Post[] {
  const seen = new Set(current.map((p) => p.id))
  return [...current, ...incoming.filter((p) => !seen.has(p.id))]
}

// タイムライン（全体）の、投稿の並びと、続きの読み込み
export function useTimeline() {
  const [posts, setPosts] = useState<Post[]>([])
  const [hasNext, setHasNext] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 次に読むページ。読み込みが成功したときだけ進める（失敗したら、同じページをやり直せる）
  const nextPage = useRef(0)
  // 読み込み中に、もう一度始めない（画面の再描画や、スクロールの連続で、二重にならないように）
  const busy = useRef(false)

  const loadMore = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setLoading(true)
    setError(null)
    try {
      const result = await fetchPosts(nextPage.current)
      nextPage.current += 1
      setPosts((current) => appendUnique(current, result.posts))
      setHasNext(result.hasNext)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが起きました')
    } finally {
      busy.current = false
      setLoading(false)
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

  return { posts, hasNext, loading, error, loadMore, prepend }
}
