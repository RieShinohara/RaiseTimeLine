import AddIcon from '@mui/icons-material/Add'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Fab from '@mui/material/Fab'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchFollowingNewCount, fetchFollowingPosts, fetchPosts, type Post } from '../api/posts'
import DeletePostDialog from '../components/DeletePostDialog'
import NewPostsBanner from '../components/NewPostsBanner'
import PostCard from '../components/PostCard'
import PostComposerDialog from '../components/PostComposerDialog'
import { useAuth } from '../auth/useAuth'
import { useInfiniteScroll } from '../timeline/useInfiniteScroll'
import { useLikeToggle } from '../timeline/useLikeToggle'
import { useNewPostsCount } from '../timeline/useNewPostsCount'
import { useTimeline } from '../timeline/useTimeline'

type TimelineKind = 'all' | 'following'

// トップ画面：タイムライン。「全体」はログインなしで見られる。「フォロー中」は、ログイン中だけ（TL-3）
export default function HomePage() {
  const { user } = useAuth()
  const [selected, setSelected] = useState<TimelineKind>('all')
  // ログアウトしたら、「フォロー中」のタブは消えるので、「全体」に戻す
  const kind: TimelineKind = user ? selected : 'all'

  return (
    <>
      <Tabs value={kind} onChange={(_, value: TimelineKind) => setSelected(value)} sx={{ mb: 2 }}>
        <Tab label="全体" value="all" />
        {user && <Tab label="フォロー中" value="following" />}
      </Tabs>
      {/* タブが変わったら、一覧を作り直す（前のタブの投稿・続きの目印・新着バナーが、残らないように） */}
      <Timeline key={kind} kind={kind} />
    </>
  )
}

// 一覧の読み先と、新着の確認先は、「全体」と「フォロー中」で、それぞれ決まった関数（毎回同じ物を渡す）
const SOURCES = {
  all: { fetchPage: fetchPosts, fetchCount: undefined },
  following: { fetchPage: fetchFollowingPosts, fetchCount: fetchFollowingNewCount },
} as const

function Timeline({ kind }: { kind: TimelineKind }) {
  const { user } = useAuth()
  const { fetchPage, fetchCount } = SOURCES[kind]
  const { posts, hasNext, loading, error, syncedId, loadMore, reload, prepend, replace, remove, patch } =
    useTimeline(fetchPage)
  const newCount = useNewPostsCount(syncedId, fetchCount)
  // 「フォロー中」で投稿したときのお知らせ（自分の投稿は、「フォロー中」に入らないため）
  const [postedNotice, setPostedNotice] = useState(false)
  const navigate = useNavigate()
  const likes = useLikeToggle(patch)
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
      {/* 固定のボタン。下へ読み進めても、いつでも押せる（ログイン中だけ）。
          横の位置は、どの幅でも、一覧の右端から 12px 離す（一覧の見える幅は 552px）。ただし、一覧が画面いっぱいの狭さでは、
          ボタンが画面の外に出ないよう、右端から 16px で止める（ボタンの幅は約 120px）。
          縦の位置は、広い画面（PC）は上のほう（ヘッダーの下）、狭い画面（スマホ）は右下 */}
      {user && (
        <Fab
          variant="extended"
          color="primary"
          onClick={() => setComposing(true)}
          sx={{
            position: 'fixed',
            left: 'min(calc(50% + 288px), calc(100% - 136px))',
            // 狭い画面（スマホ）：下
            bottom: 24,
            // 広い画面（PC）：上のほう（ヘッダーの下）
            '@media (min-width: 960px)': { top: 80, bottom: 'auto' },
          }}
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
              // ログアウトしたあとは、「押した状態」を出さない（読み込んだときの、前の人の状態が、残らないように）
              // ログアウトしたあとは、「押した状態」を出さない（読み込んだときの、前の人の状態が、残らないように）
              post={user ? post : { ...post, likedByMe: false }}
              onEdit={mine ? setEditing : undefined}
              onDelete={mine ? setDeleting : undefined}
              // ログインなしで押されたら、ログインの画面へ案内する（いいねは、ログインが要る）
              onToggleLike={user ? (p) => void likes.toggle(p) : () => void navigate('/login')}
              likePending={likes.pendingIds.has(post.id)}
              // コメント数を押すと、投稿の詳細画面（コメントを見る・書く）へ
              onOpenComments={(p) => void navigate(`/posts/${p.id}`)}
              // 名前を押すと、その人のプロフィールへ
              onOpenAuthor={(username) => void navigate(`/users/${encodeURIComponent(username)}`)}
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
          {kind === 'following' ? 'フォローしている人の投稿は、まだありません' : 'まだ投稿がありません'}
        </Typography>
      )}
      {!hasNext && posts.length > 0 && (
        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
          これ以上ありません
        </Typography>
      )}
      {/* この目印が見えたら、続きを読む */}
      <div ref={sentinelRef} />

      {/* 「全体」では、一番上に足す。「フォロー中」では、足さずに、お知らせを出す（TL-1） */}
      {user && (
        <PostComposerDialog
          open={composing}
          onClose={() => setComposing(false)}
          onDone={kind === 'following' ? () => setPostedNotice(true) : prepend}
        />
      )}
      {/* 編集は、投稿ごとに開き直す（key で、前の入力が残らないようにする） */}
      {editing && (
        <PostComposerDialog key={editing.id} open editing={editing} onClose={() => setEditing(null)} onDone={replace} />
      )}
      <DeletePostDialog post={deleting} onClose={() => setDeleting(null)} onDeleted={(post) => remove(post.id)} />
      <Snackbar open={postedNotice} autoHideDuration={6000} onClose={() => setPostedNotice(false)}>
        <Alert severity="success" onClose={() => setPostedNotice(false)} sx={{ width: '100%' }}>
          投稿しました。「全体」と、自分のプロフィールで見られます
        </Alert>
      </Snackbar>
      {/* いいねに失敗したとき（数と見た目は、元のまま）。数秒で消える */}
      <Snackbar open={likes.error !== null} autoHideDuration={5000} onClose={likes.clearError}>
        <Alert severity="error" onClose={likes.clearError} sx={{ width: '100%' }}>
          {likes.error}
        </Alert>
      </Snackbar>
    </Box>
  )
}
