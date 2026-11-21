import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import Alert from '@mui/material/Alert'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CircularProgress from '@mui/material/CircularProgress'
import Link from '@mui/material/Link'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import AuthorName from '../components/AuthorName'
import { useFollowList, type FollowListKind } from '../profile/useFollowList'

// 「何人まで表示するか」の目安の文言（サーバーが返す上限。docs/features/07-profile-follow.md の 8）
const SHOWN_LIMIT = 50

const TITLES: Record<FollowListKind, string> = { followers: 'フォロワー', following: 'フォロー中' }

// フォロー中・フォロワーの一覧の画面（/users/:username/followers・/following。UC-16）。ログインなしで見られる
export default function FollowListPage({ kind }: { kind: FollowListKind }) {
  const { username = '' } = useParams()
  // 別の人・別の種類の URL に変わったときは、作り直す（前の一覧が、残らないように）
  return <FollowList key={`${kind}:${username}`} kind={kind} username={username} />
}

function FollowList({ kind, username }: { kind: FollowListKind; username: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { users, hasNext, loading, error, notFound, load, pendingNames, followError, toggleFollow, clearFollowError } =
    useFollowList(kind, username)

  const back = (
    <Link
      component={RouterLink}
      to={`/users/${encodeURIComponent(username)}`}
      underline="hover"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
    >
      <ArrowBackIcon fontSize="small" />
      プロフィールへ戻る
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

  return (
    <Box>
      <Box sx={{ mb: 2 }}>{back}</Box>
      <Typography component="h2" variant="h5" sx={{ fontWeight: 'bold', mb: 2, overflowWrap: 'anywhere' }}>
        @{username} の{TITLES[kind]}
      </Typography>

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
      {!loading && !error && users.length === 0 && (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          まだいません
        </Typography>
      )}

      <Stack spacing={2} component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {users.map((u) => {
          // 自分の行には、フォローのボタンを出さない（本当の確認は、サーバーが行う。自分自身は 400）
          const isMe = user !== null && user.id === u.id
          return (
            <Card key={u.id} component="li" variant="outlined">
              <CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                {/* アイコン画像は、S3 のときに作る。それまでは、表示名の頭文字 */}
                <Avatar aria-hidden>{Array.from(u.displayName)[0] ?? '?'}</Avatar>
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Box sx={{ display: 'flex' }}>
                    <AuthorName
                      displayName={u.displayName}
                      username={u.username}
                      onOpen={(name) => void navigate(`/users/${encodeURIComponent(name)}`)}
                    />
                  </Box>
                  {u.bio && (
                    <Typography
                      variant="body2"
                      sx={{
                        mt: 0.5,
                        overflowWrap: 'anywhere',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {u.bio}
                    </Typography>
                  )}
                </Box>
                {!isMe && (
                  <Button
                    size="small"
                    variant={u.followedByMe ? 'outlined' : 'contained'}
                    disabled={pendingNames.has(u.username)}
                    aria-label={
                      u.followedByMe ? `${u.displayName}のフォローを解除する` : `${u.displayName}をフォローする`
                    }
                    // ログインなしで押されたら、ログインの画面へ案内する（フォローは、ログインが要る）
                    onClick={user ? () => void toggleFollow(u) : () => void navigate('/login')}
                  >
                    {u.followedByMe ? 'フォロー解除' : 'フォロー'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </Stack>

      {hasNext && (
        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
          最初の {SHOWN_LIMIT} 人を表示しています
        </Typography>
      )}

      {/* フォロー・解除に失敗したとき（見た目は、元のまま）。数秒で消える */}
      <Snackbar open={followError !== null} autoHideDuration={5000} onClose={clearFollowError}>
        <Alert severity="error" onClose={clearFollowError} sx={{ width: '100%' }}>
          {followError}
        </Alert>
      </Snackbar>
    </Box>
  )
}
