import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/errors'
import { fetchProfile, followUser, unfollowUser, type Profile } from '../api/users'

// プロフィールの読み込みと、フォロー・解除。別のユーザーに移るときは、呼ぶ側が key を変えて、作り直す（状態が混ざらないように）
export function useProfile(username: string) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // ユーザーがいない（404）。「見つかりません」と、読み込みの失敗を、分けて見せる
  const [notFound, setNotFound] = useState(false)
  // 「もう一度」を押すたびに増やして、読み込みをやり直す
  const [attempt, setAttempt] = useState(0)
  // フォロー・解除を送信中か（ボタンを押せなくするために、画面にも渡す）
  const [followPending, setFollowPending] = useState(false)
  // フォロー・解除に失敗した理由（画面に出す。なければ null）
  const [followError, setFollowError] = useState<string | null>(null)
  // 連打の判断は、画面の再描画を待たない「印」で行う（state だと、描画の前に、2 回目が通ってしまう）
  const sending = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetchProfile(username)
      .then((p) => {
        if (!cancelled) setProfile(p)
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
  }, [username, attempt])

  // 読み込みに失敗したあとの「もう一度」
  const load = useCallback(() => {
    setError(null)
    setLoading(true)
    setAttempt((n) => n + 1)
  }, [])

  // フォロー・解除。結果（サーバーが返した数と状態）を待ってから、画面を変える（いいねと同じ。先に変えると、失敗したとき、嘘の数が見える）
  const toggleFollow = useCallback(async () => {
    if (!profile || sending.current) return
    sending.current = true
    setFollowPending(true)
    setFollowError(null)
    try {
      const result = profile.followedByMe ? await unfollowUser(username) : await followUser(username)
      setProfile((current) =>
        current ? { ...current, followerCount: result.followerCount, followedByMe: result.following } : current,
      )
    } catch (e) {
      setFollowError(`うまくいきませんでした（${e instanceof Error ? e.message : 'エラーが起きました'}）`)
    } finally {
      sending.current = false
      setFollowPending(false)
    }
  }, [profile, username])

  const clearFollowError = useCallback(() => setFollowError(null), [])

  return { profile, loading, error, notFound, load, followPending, followError, toggleFollow, clearFollowError }
}
