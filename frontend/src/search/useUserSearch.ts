import { useCallback, useEffect, useState } from 'react'
import { searchUsers, type FollowUser } from '../api/users'
import { useFollowToggle } from '../profile/useFollowToggle'

// ユーザー検索の結果の読み込みと、行ごとのフォロー・解除。
// 別の言葉に変わるときは、呼ぶ側が key を変えて、作り直す（前の結果が、残らないように）
export function useUserSearch(q: string) {
  const [users, setUsers] = useState<FollowUser[]>([])
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // 「もう一度」を押すたびに増やして、読み込みをやり直す
  const [attempt, setAttempt] = useState(0)
  // 行ごとのフォロー・解除（フォロー中・フォロワーの一覧と共通）
  const { pendingNames, followError, toggleFollow, clearFollowError } = useFollowToggle(setUsers)

  useEffect(() => {
    let cancelled = false
    searchUsers(q)
      .then((page) => {
        if (cancelled) return
        setUsers(page.users)
        setHasNext(page.hasNext)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'エラーが起きました')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    // 画面を離れた・やり直したあとに、前の読み込みの結果が、入り込まないようにする
    return () => {
      cancelled = true
    }
  }, [q, attempt])

  // 読み込みに失敗したあとの「もう一度」
  const load = useCallback(() => {
    setError(null)
    setLoading(true)
    setAttempt((n) => n + 1)
  }, [])

  return { users, hasNext, loading, error, load, pendingNames, followError, toggleFollow, clearFollowError }
}
