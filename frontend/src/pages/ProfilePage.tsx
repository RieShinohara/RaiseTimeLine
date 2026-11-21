import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import Alert from '@mui/material/Alert'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Link from '@mui/material/Link'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useCallback, useState } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { fetchUserPosts } from '../api/users'
import { useAuth } from '../auth/useAuth'
import PostCard from '../components/PostCard'
import ProfileEditDialog from '../components/ProfileEditDialog'
import { useProfile } from '../profile/useProfile'
import { useInfiniteScroll } from '../timeline/useInfiniteScroll'
import { useLikeToggle } from '../timeline/useLikeToggle'
import { useTimeline } from '../timeline/useTimeline'

// プロフィールの画面（/users/:username）：ユーザーの情報・フォロー／解除・投稿の一覧（UC-9・UC-10）。ログインなしで見られる
export default function ProfilePage() {
  const { username = '' } = useParams()
  // 別のユーザーの URL に変わったときは、作り直す（前の人の状態が、残らないように）
  return <Profile key={username} username={username} />
}

function Profile({ username }: { username: string }) {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const {
    profile,
    loading,
    error,
    notFound,
    load,
    followPending,
    followError,
    toggleFollow,
    clearFollowError,
    applyProfile,
  } = useProfile(username)
  // 編集のダイアログ。開くたびに editKey を増やして、新しく作り直す
  const [editing, setEditing] = useState(false)
  const [editKey, setEditKey] = useState(0)

  function openEdit() {
    setEditKey((n) => n + 1)
    setEditing(true)
  }

  const back = (
    <Link
      component={RouterLink}
      to="/"
      underline="hover"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
    >
      <ArrowBackIcon fontSize="small" />
      タイムラインへ
    </Link>
  )

  if (notFound) {
    return (
      <Box>
        {back}
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          ユーザーが見つかりません
        </Typography>
      </Box>
    )
  }

  // 自分のプロフィールには、フォローのボタンを出さない（本当の確認は、サーバーが行う。自分自身は 400）
  const isMe = user !== null && profile !== null && user.id === profile.id

  return (
    <Box>
      <Box sx={{ mb: 2 }}>{back}</Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={28} aria-label="読み込み中" />
        </Box>
      )}
      {error && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={load}>
              もう一度
            </Button>
          }
        >
          読み込めませんでした（{error}）
        </Alert>
      )}

      {profile && (
        <>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            {/* アイコン画像は、画像の保存先（S3）を作るときに、投稿の画像と一緒に作る。それまでは、表示名の頭文字 */}
            <Avatar aria-hidden sx={{ width: 64, height: 64, fontSize: 28 }}>
              {Array.from(profile.displayName)[0] ?? '?'}
            </Avatar>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography component="h2" variant="h5" sx={{ fontWeight: 'bold', overflowWrap: 'anywhere' }}>
                {profile.displayName}
              </Typography>
              <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                @{profile.username}
              </Typography>
            </Box>
            {!isMe && (
              <Button
                variant={profile.followedByMe ? 'outlined' : 'contained'}
                disabled={followPending}
                aria-label={
                  profile.followedByMe
                    ? `${profile.displayName}のフォローを解除する`
                    : `${profile.displayName}をフォローする`
                }
                // ログインなしで押されたら、ログインの画面へ案内する（フォローは、ログインが要る）
                onClick={user ? () => void toggleFollow() : () => void navigate('/login')}
              >
                {profile.followedByMe ? 'フォロー解除' : 'フォロー'}
              </Button>
            )}
            {/* 自分のプロフィールには、フォローの代わりに「編集」（本当の確認は、サーバーが行う。他の人のは 403） */}
            {isMe && (
              <Button variant="outlined" onClick={openEdit}>
                編集
              </Button>
            )}
          </Box>

          {profile.bio && (
            <Typography sx={{ mt: 2, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{profile.bio}</Typography>
          )}

          {/* フォロー中・フォロワーの数。押すと、一覧の画面（UC-16）へ */}
          <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
            <Link
              component={RouterLink}
              to={`/users/${encodeURIComponent(profile.username)}/following`}
              variant="body2"
              underline="hover"
              color="inherit"
            >
              <strong>{profile.followingCount}</strong> フォロー中
            </Link>
            <Link
              component={RouterLink}
              to={`/users/${encodeURIComponent(profile.username)}/followers`}
              variant="body2"
              underline="hover"
              color="inherit"
            >
              <strong>{profile.followerCount}</strong> フォロワー
            </Link>
          </Box>

          <Typography component="h3" variant="h6" sx={{ mt: 3, mb: 1 }}>
            投稿
          </Typography>
          <ProfilePosts username={username} />
        </>
      )}

      {/* フォロー・解除に失敗したとき（数と見た目は、元のまま）。数秒で消える */}
      <Snackbar open={followError !== null} autoHideDuration={5000} onClose={clearFollowError}>
        <Alert severity="error" onClose={clearFollowError} sx={{ width: '100%' }}>
          {followError}
        </Alert>
      </Snackbar>

      {/* 開くたびに key を変えて、作り直す（前の入力が、残らないように） */}
      {isMe && profile && (
        <ProfileEditDialog
          key={editKey}
          open={editing}
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            applyProfile(saved)
            // ヘッダーの自分の名前も、すぐ変える
            updateUser({ displayName: saved.displayName })
          }}
        />
      )}
    </Box>
  )
}

// そのユーザーの投稿の一覧（新しい順。下へ進むと自動で増える）。いいねと、コメントを見る操作ができる
function ProfilePosts({ username }: { username: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fetchPage = useCallback((before?: number) => fetchUserPosts(username, before), [username])
  const { posts, hasNext, loading, error, loadMore, patch } = useTimeline(fetchPage)
  const likes = useLikeToggle(patch)
  const sentinelRef = useInfiniteScroll(loadMore, hasNext && !loading && !error)

  return (
    <>
      <Stack spacing={2}>
        {posts.map((post) => (
          <PostCard
            key={post.id}
            // ログアウトしたあとは、「押した状態」を出さない（読み込んだときの、前の人の状態が、残らないように）
            post={user ? post : { ...post, likedByMe: false }}
            // 編集・削除は、タイムラインから行う（ここでは出さない）
            onToggleLike={user ? (p) => void likes.toggle(p) : () => void navigate('/login')}
            likePending={likes.pendingIds.has(post.id)}
            onOpenComments={(p) => void navigate(`/posts/${p.id}`)}
          />
        ))}
      </Stack>

      {error && (
        <Alert
          severity="error"
          sx={{ mt: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => void loadMore()}>
              もう一度
            </Button>
          }
        >
          読み込めませんでした（{error}）
        </Alert>
      )}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={28} aria-label="投稿を読み込み中" />
        </Box>
      )}
      {!loading && !error && posts.length === 0 && !hasNext && (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          まだ投稿がありません
        </Typography>
      )}
      {!hasNext && posts.length > 0 && (
        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
          これ以上ありません
        </Typography>
      )}
      {/* この目印が見えたら、続きを読む */}
      <div ref={sentinelRef} />

      {/* いいねに失敗したとき（数と見た目は、元のまま）。数秒で消える */}
      <Snackbar open={likes.error !== null} autoHideDuration={5000} onClose={likes.clearError}>
        <Alert severity="error" onClose={likes.clearError} sx={{ width: '100%' }}>
          {likes.error}
        </Alert>
      </Snackbar>
    </>
  )
}
