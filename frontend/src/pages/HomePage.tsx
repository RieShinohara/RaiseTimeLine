import AddIcon from '@mui/icons-material/Add'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Fab from '@mui/material/Fab'
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
  const { posts, hasNext, loading, error, syncedId, loadMore, reload, prepend, replace, remove } = useTimeline()
  const newCount = useNewPostsCount(syncedId)
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
    // 下の余白（pb）は、右下の浮かぶボタンに、最後のカードが隠れないようにするため
    <Box sx={{ pb: 10 }}>
      <NewPostsBanner count={newCount} onClick={() => void showNewPosts()} />
      <Tabs value={0} sx={{ mb: 2 }}>
        <Tab label="全体" />
      </Tabs>
      {/* 画面の右下に固定。下へ読み進めても、いつでも押せる（ログイン中だけ）。
          画面が広いときは、一覧の右端の内側に寄せる（一覧の幅は 600px。左右の余白は 24px） */}
      {user && (
        <Fab
          variant="extended"
          color="primary"
          onClick={() => setComposing(true)}
          sx={{ position: 'fixed', bottom: 24, right: 'max(16px, calc(50% - 276px))' }}
        >
          <AddIcon sx={{ mr: 1 }} />
          投稿する
        </Fab>
      )}

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
