import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import UserCard from '../components/UserCard'
import { useUserSearch } from '../search/useUserSearch'

// サーバーが返す上限（docs/features/08-user-search.md。SRCH-2）
const SHOWN_LIMIT = 20

// ユーザー検索の結果の画面（/search?q=…。UC-12）。ログインなしで使える
export default function SearchPage() {
  const [params] = useSearchParams()
  // 前後の空白は取る（サーバーも取る。空白だけの言葉では、探さない）
  const q = (params.get('q') ?? '').trim()

  if (q === '') {
    return (
      <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
        上の検索欄に、ユーザー名か表示名を入力してください
      </Typography>
    )
  }
  // 別の言葉に変わったときは、作り直す（前の結果が、残らないように）
  return <SearchResults key={q} q={q} />
}

function SearchResults({ q }: { q: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { users, hasNext, loading, error, load, pendingNames, followError, toggleFollow, clearFollowError } =
    useUserSearch(q)

  return (
    <Box>
      <Typography component="h2" variant="h5" sx={{ fontWeight: 'bold', mb: 2, overflowWrap: 'anywhere' }}>
        「{q}」の検索結果
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
          「{q}」に一致するユーザーは、見つかりません
        </Typography>
      )}

      <Stack spacing={2} component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {users.map((u) => (
          <UserCard
            key={u.id}
            person={u}
            isMe={user !== null && user.id === u.id}
            pending={pendingNames.has(u.username)}
            // ログインなしで押されたら、ログインの画面へ案内する（フォローは、ログインが要る）
            onToggleFollow={user ? (p) => void toggleFollow(p) : () => void navigate('/login')}
            onOpenProfile={(name) => void navigate(`/users/${encodeURIComponent(name)}`)}
          />
        ))}
      </Stack>

      {hasNext && (
        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
          最初の {SHOWN_LIMIT} 人を表示しています。名前をしぼると、見つけやすくなります
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
