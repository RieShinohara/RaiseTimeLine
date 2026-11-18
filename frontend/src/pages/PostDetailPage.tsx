import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Link from '@mui/material/Link'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { createComment } from '../api/comments'
import { useAuth } from '../auth/useAuth'
import CommentForm from '../components/CommentForm'
import CommentThread from '../components/CommentThread'
import DeleteCommentDialog, { type DeleteTarget } from '../components/DeleteCommentDialog'
import PostCard from '../components/PostCard'
import { usePostDetail } from '../comments/usePostDetail'
import { useLikeToggle } from '../timeline/useLikeToggle'

// 投稿の詳細画面（/posts/:id）：投稿と、コメント・返信を見る、書く、消す（CMT-6）。ログインなしで見られる
export default function PostDetailPage() {
  const { id } = useParams()
  // 別の投稿の URL に変わったときは、作り直す（前の投稿の状態が、残らないように）
  return <PostDetail key={id} postId={Number(id)} />
}

function PostDetail({ postId }: { postId: number }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { post, comments, loading, error, notFound, load, reloadComments, patchPost } = usePostDetail(postId)
  const likes = useLikeToggle(patchPost)
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null)
  // コメントは送れたが、一覧の読み直しに失敗したとき（送り直さないよう、入力欄ではなく、ここに出す）
  const [refreshFailed, setRefreshFailed] = useState(false)

  async function refresh() {
    setRefreshFailed(false)
    try {
      await reloadComments()
    } catch {
      setRefreshFailed(true)
    }
  }

  // コメント・返信を送る。送信（失敗したら、理由が入力欄に出て、入力が残る）のあと、一覧を読み直す
  async function submit(body: string, parentCommentId?: number) {
    await createComment(postId, body, parentCommentId)
    await refresh()
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

  if (!Number.isInteger(postId) || notFound) {
    return (
      <Box>
        {back}
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          投稿が見つかりません
        </Typography>
      </Box>
    )
  }

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
            <Button color="inherit" size="small" onClick={() => void load()}>
              もう一度
            </Button>
          }
        >
          読み込めませんでした（{error}）
        </Alert>
      )}

      {post && (
        <>
          <PostCard
            // ログアウトしたあとは、「押した状態」を出さない（HomePage と同じ）。編集・削除は、タイムラインから行う
            post={user ? post : { ...post, likedByMe: false }}
            onToggleLike={user ? (p) => void likes.toggle(p) : () => void navigate('/login')}
            likePending={likes.pendingIds.has(post.id)}
          />

          <Typography component="h2" variant="h6" sx={{ mt: 3, mb: 1 }}>
            コメント（{post.commentCount}）
          </Typography>

          {user ? (
            <CommentForm label="コメントを書く" submitLabel="コメントする" onSubmit={(body) => submit(body)} />
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              コメントするには、
              <Link component={RouterLink} to="/login">
                ログイン
              </Link>
              が必要です。
            </Alert>
          )}

          {refreshFailed && (
            <Alert
              severity="warning"
              sx={{ mb: 2 }}
              action={
                <Button color="inherit" size="small" onClick={() => void refresh()}>
                  もう一度
                </Button>
              }
            >
              送れましたが、一覧を読み直せませんでした。
            </Alert>
          )}

          {comments.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
              まだコメントがありません
            </Typography>
          ) : (
            <Box component="ul" sx={{ p: 0, m: 0 }}>
              {comments.map((comment) => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  currentUserId={user?.id ?? null}
                  postAuthorId={post.author.id}
                  onReply={(parentId, body) => submit(body, parentId)}
                  onDelete={setDeleting}
                />
              ))}
            </Box>
          )}
        </>
      )}

      <DeleteCommentDialog target={deleting} onClose={() => setDeleting(null)} onDeleted={() => void refresh()} />
      {/* いいねに失敗したとき（数と見た目は、元のまま）。数秒で消える */}
      <Snackbar open={likes.error !== null} autoHideDuration={5000} onClose={likes.clearError}>
        <Alert severity="error" onClose={likes.clearError} sx={{ width: '100%' }}>
          {likes.error}
        </Alert>
      </Snackbar>
    </Box>
  )
}
