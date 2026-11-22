import { ApiError, NETWORK_ERROR_MESSAGE, readMessage } from './errors'
import { apiFetch, refreshIfExpired } from './http'
import { callWithLogin, PAGE_SIZE, type PostPage } from './posts'

// プロフィール・フォローの API（/api/users/...）を呼ぶ関数（docs/features/07-profile-follow.md の 8）

export interface Profile {
  id: number
  username: string
  displayName: string
  // 未設定は null
  bio: string | null
  followingCount: number
  followerCount: number
  // ログイン中の自分が、この人をフォローしているか（ログインなしは、常に false）
  followedByMe: boolean
}

// フォロー・解除のあとの、相手のフォロワー数と、いまフォローしているか
export interface FollowState {
  followerCount: number
  following: boolean
}

// ログインなしでも見られる読み取り。札の期限が切れていると、サーバーは「ログインなし」として扱い、
// 「フォローしているか」などが false になる。先に更新しておく
async function getJson<T>(path: string): Promise<T> {
  await refreshIfExpired()
  let res: Response
  try {
    res = await apiFetch(path)
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE)
  }
  if (!res.ok) throw new ApiError(res.status, await readMessage(res))
  return (await res.json()) as T
}

// プロフィールを読む。見つからなければ、status 404 の ApiError
export function fetchProfile(username: string): Promise<Profile> {
  return getJson<Profile>(`/api/users/${encodeURIComponent(username)}`)
}

// そのユーザーの投稿の一覧（新しい順）。before（投稿 id）を渡すと、それより古い投稿を読む。見つからなければ 404
export function fetchUserPosts(username: string, before?: number, size: number = PAGE_SIZE): Promise<PostPage> {
  const query = before === undefined ? `size=${size}` : `before=${before}&size=${size}`
  return getJson<PostPage>(`/api/users/${encodeURIComponent(username)}/posts?${query}`)
}

// 自分のプロフィールを直す（本人だけ。他の人のは、サーバーが 403 で断る）。ユーザー名・メールは、変えられない。
// bio は、空なら、サーバーが「未設定（null）」にする。返事は、直したあとのプロフィール
export async function updateProfile(username: string, input: { displayName: string; bio: string }): Promise<Profile> {
  const res = await callWithLogin(`/api/users/${encodeURIComponent(username)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return (await res.json()) as Profile
}

// フォローする（何回押しても、結果は同じ）。ログインが要る
export async function followUser(username: string): Promise<FollowState> {
  const res = await callWithLogin(`/api/users/${encodeURIComponent(username)}/follow`, { method: 'PUT' })
  return (await res.json()) as FollowState
}

// フォローを解除する（フォローしていなくても、結果は同じ）。ログインが要る
export async function unfollowUser(username: string): Promise<FollowState> {
  const res = await callWithLogin(`/api/users/${encodeURIComponent(username)}/follow`, { method: 'DELETE' })
  return (await res.json()) as FollowState
}

// フォロー中・フォロワーの一覧の 1 人分（メールは含まれない）。followedByMe：ログイン中の自分が、この人をフォローしているか
// （ログインなし・自分自身の行は false）
export interface FollowUser {
  id: number
  username: string
  displayName: string
  bio: string | null
  followedByMe: boolean
}

// 一覧。サーバーは、フォローした日時の新しい順に、最初の 50 人まで返す。hasNext：50 人より先に、まだいるか
export interface FollowUserPage {
  users: FollowUser[]
  hasNext: boolean
}

// その人を、フォローしている人（フォロワー）。ログインなしでも見られる。見つからなければ、status 404 の ApiError
export function fetchFollowers(username: string): Promise<FollowUserPage> {
  return getJson<FollowUserPage>(`/api/users/${encodeURIComponent(username)}/followers`)
}

// ユーザー検索（ユーザー名か表示名に、q を含む人。大文字小文字を区別しない）。ログインなしでも使える。
// サーバーは、ユーザー名の順に、最初の 20 人まで返す。q が空・50 文字超だと、status 400 の ApiError
export function searchUsers(q: string): Promise<FollowUserPage> {
  return getJson<FollowUserPage>(`/api/users?q=${encodeURIComponent(q)}`)
}

// その人が、フォローしている人（フォロー中）
export function fetchFollowing(username: string): Promise<FollowUserPage> {
  return getJson<FollowUserPage>(`/api/users/${encodeURIComponent(username)}/following`)
}
