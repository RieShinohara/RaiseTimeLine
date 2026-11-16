import AddIcon from '@mui/icons-material/Add'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import type { Post } from '../api/posts'
import DeletePostDialog from '../components/DeletePostDialog'
import NewPostsBanner from '../components/NewPostsBanner'
import PostCard from '../components/PostCard'
import PostComposerDialog from '../components/PostComposerDialog'
import { useAuth } from '../auth/useAuth'
import { useInfiniteScroll } from '../timeline/useInfiniteScroll'
import { useNewPostsCount } from '../timeline/useNewPostsCount'
import { useTimeline } from '../timeline/useTimeline'

// トップ画面：タイムライン（全体）。ログインなしで見られる。「フォロー中」は、フォローの機能のときに足す
export default function HomePage() {
  const { user } = useAuth()
  const { posts, hasNext, loading, error, syncedAt, loadMore, reload, prepend, replace, remove } = useTimeline()
  const newCount = useNewPostsCount(syncedAt)
  const [composing, setComposing] = useState(false)
  // 編集中の投稿・削除の確認中の投稿（なければ null）
  const [editing, setEditing] = useState<Post | null>(null)
  const [deleting, setDeleting] = useState<Post | null>(null)
  const sentinelRef = useInfiniteScroll(loadMore, hasNext && !loading && !error)

  // バナーを押したとき：1 ページ目から読み直して、一番上までスクロールする（失敗したら、動かない）
  async function showNewPosts() {
    if (await reload()) window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <Box>
      <NewPostsBanner count={newCount} onClick={() => void showNewPosts()} />
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Tabs value={0} sx={{ flexGrow: 1 }}>
          <Tab label="全体" />
        </Tabs>
        {user && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setComposing(true)}>
            投稿する
          </Button>
        )}
      </Box>

      <Stack spacing={2}>
        {posts.map((post) => {
          // 編集・削除は、自分の投稿だけ（他の人の分は、サーバーも断る）
          const mine = user !== null && user.id === post.author.id
          return (
            <PostCard
              key={post.id}
              post={post}
              onEdit={mine ? setEditing : undefined}
              onDelete={mine ? setDeleting : undefined}
            />
          )
        })}
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

      {user && <PostComposerDialog open={composing} onClose={() => setComposing(false)} onDone={prepend} />}
      {/* 編集は、投稿ごとに開き直す（key で、前の入力が残らないようにする） */}
      {editing && (
        <PostComposerDialog key={editing.id} open editing={editing} onClose={() => setEditing(null)} onDone={replace} />
      )}
      <DeletePostDialog post={deleting} onClose={() => setDeleting(null)} onDeleted={(post) => remove(post.id)} />
    </Box>
  )
}
