import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/errors'
import { fetchFollowers, fetchFollowing, type FollowUser, type FollowUserPage } from '../api/users'
import { useFollowToggle } from './useFollowToggle'

// どちらの一覧か：followers＝その人を、フォローしている人。following＝その人が、フォローしている人
export type FollowListKind = 'followers' | 'following'

// フォロー中・フォロワーの一覧の読み込みと、行ごとのフォロー・解除。
// 別の人・別の種類に移るときは、呼ぶ側が key を変えて、作り直す（状態が混ざらないように）
export function useFollowList(kind: FollowListKind, username: string) {
  const [users, setUsers] = useState<FollowUser[]>([])
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // その人がいない（404）。「見つかりません」と、読み込みの失敗を、分けて見せる
  const [notFound, setNotFound] = useState(false)
  // 「もう一度」を押すたびに増やして、読み込みをやり直す
  const [attempt, setAttempt] = useState(0)
  // 行ごとのフォロー・解除（検索結果の画面と共通）
  const { pendingNames, followError, toggleFollow, clearFollowError } = useFollowToggle(setUsers)

  useEffect(() => {
    let cancelled = false
    const fetchList: (name: string) => Promise<FollowUserPage> = kind === 'followers' ? fetchFollowers : fetchFollowing
    fetchList(username)
      .then((page) => {
        if (cancelled) return
        setUsers(page.users)
        setHasNext(page.hasNext)
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
  }, [kind, username, attempt])

  // 読み込みに失敗したあとの「もう一度」
  const load = useCallback(() => {
    setError(null)
    setLoading(true)
    setAttempt((n) => n + 1)
  }, [])

  return { users, hasNext, loading, error, notFound, load, pendingNames, followError, toggleFollow, clearFollowError }
}
