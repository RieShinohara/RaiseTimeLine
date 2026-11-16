import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import PostCard from '../components/PostCard'
import PostComposerDialog from '../components/PostComposerDialog'
import { useAuth } from '../auth/useAuth'
import { useInfiniteScroll } from '../timeline/useInfiniteScroll'
import { useTimeline } from '../timeline/useTimeline'

// トップ画面：タイムライン（全体）。ログインなしで見られる。「フォロー中」は、フォローの機能のときに足す
export default function HomePage() {
  const { user } = useAuth()
  const { posts, hasNext, loading, error, loadMore, prepend } = useTimeline()
  const [composing, setComposing] = useState(false)
  const sentinelRef = useInfiniteScroll(loadMore, hasNext && !loading && !error)

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Tabs value={0} sx={{ flexGrow: 1 }}>
          <Tab label="全体" />
        </Tabs>
        {user && (
          // アイコン集（@mui/icons-material）は、まだ入れていないので、「＋」は文字で表す
          <Button variant="contained" onClick={() => setComposing(true)}>
            ＋ 投稿する
          </Button>
        )}
      </Box>

      <Stack spacing={2}>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
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
          <CircularProgress size={28} aria-label="読み込み中" />
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

      {user && <PostComposerDialog open={composing} onClose={() => setComposing(false)} onPosted={prepend} />}
    </Box>
  )
}
