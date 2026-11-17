import { useEffect, useState } from 'react'
import { fetchNewCount } from '../api/posts'

// 新着の確認の間隔（TL-4：30 秒）
export const POLL_INTERVAL_MS = 30_000

// 30 秒ごとに、「after（投稿 id）より新しい投稿」の件数を確かめる（ポーリング）。after が null の間（最初の読み込み前）は、確かめない。
// ・画面を見ていない間（別のタブなど）は、確かめない。戻ってきたら、すぐに 1 回確かめる
// ・確かめるのに失敗しても、何も出さず、次の確認を待つ
// ・after が変わる（1 ページ目を読み直す）と、件数は 0 に戻る（古い after の結果は、使わない）
export function useNewPostsCount(after: number | null): number {
  const [result, setResult] = useState<{ after: number; count: number } | null>(null)

  useEffect(() => {
    if (after === null) return
    const base = after
    let cancelled = false

    async function check() {
      if (document.visibilityState === 'hidden') return
      try {
        const count = await fetchNewCount(base)
        if (!cancelled) setResult({ after: base, count })
      } catch {
        // 静かに待つ。次の確認（30 秒後）で、また試す
      }
    }

    const timer = setInterval(() => void check(), POLL_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [after])

  return result !== null && result.after === after ? result.count : 0
}
