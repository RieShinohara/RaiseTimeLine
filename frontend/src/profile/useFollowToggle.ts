import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { followUser, unfollowUser, type FollowUser } from '../api/users'

// 人の一覧（フォロー中・フォロワー・検索結果）の、行ごとのフォロー・解除。
// setUsers は、その一覧の「人の並び」を書き換える関数（結果を待ってから、その行のボタンを変えるために使う）
export function useFollowToggle(setUsers: Dispatch<SetStateAction<FollowUser[]>>) {
  // フォロー・解除を送信中の人のユーザー名（ボタンを押せなくするために、画面にも渡す）
  const [pendingNames, setPendingNames] = useState<ReadonlySet<string>>(new Set())
  // フォロー・解除に失敗した理由（画面に出す。なければ null）
  const [followError, setFollowError] = useState<string | null>(null)
  // 連打の判断は、画面の再描画を待たない「印」で行う（state だと、描画の前に、2 回目が通ってしまう）
  const sending = useRef(new Set<string>())

  // 一覧の 1 人を、フォロー・解除する。結果（サーバーが返した状態）を待ってから、その行のボタンを変える
  // （いいね・プロフィールのフォローと同じ。先に変えると、失敗したとき、嘘の状態が見える）
  const toggleFollow = useCallback(
    async (target: FollowUser) => {
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
    },
    [setUsers],
  )

  const clearFollowError = useCallback(() => setFollowError(null), [])

  return { pendingNames, followError, toggleFollow, clearFollowError }
}
