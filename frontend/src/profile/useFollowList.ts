import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/errors'
import {
  fetchFollowers,
  fetchFollowing,
  followUser,
  unfollowUser,
  type FollowUser,
  type FollowUserPage,
} from '../api/users'

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
  // フォロー・解除を送信中の人のユーザー名（ボタンを押せなくするために、画面にも渡す）
  const [pendingNames, setPendingNames] = useState<ReadonlySet<string>>(new Set())
  // フォロー・解除に失敗した理由（画面に出す。なければ null）
  const [followError, setFollowError] = useState<string | null>(null)
  // 連打の判断は、画面の再描画を待たない「印」で行う（state だと、描画の前に、2 回目が通ってしまう）
  const sending = useRef(new Set<string>())

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

  // 一覧の 1 人を、フォロー・解除する。結果（サーバーが返した状態）を待ってから、その行のボタンを変える
  // （いいね・プロフィールのフォローと同じ。先に変えると、失敗したとき、嘘の状態が見える）
  const toggleFollow = useCallback(async (target: FollowUser) => {
    if (sending.current.has(target.username)) return
    sending.current.add(target.username)
    setPendingNames(new Set(sending.current))
    setFollowError(null)
    try {
      const result = target.followedByMe ? await unfollowUser(target.username) : await followUser(target.username)
      setUsers((current) => current.map((u) => (u.id === target.id ? { ...u, followedByMe: result.following } : u)))
    } catch (e) {
      setFollowError(`うまくいきませんでした（${e instanceof Error ? e.message : 'エラーが起きました'}）`)
    } finally {
      sending.current.delete(target.username)
      setPendingNames(new Set(sending.current))
    }
  }, [])

  const clearFollowError = useCallback(() => setFollowError(null), [])

  return { users, hasNext, loading, error, notFound, load, pendingNames, followError, toggleFollow, clearFollowError }
}
