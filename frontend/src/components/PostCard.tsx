import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import FavoriteIcon from '@mui/icons-material/Favorite'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import type { Post } from '../api/posts'
import AuthorName from './AuthorName'
import { excerpt, formatDateTime } from '../timeline/format'

interface Props {
  post: Post
  // 自分の投稿のときだけ、編集・削除のボタンを出す（本当の確認は、サーバーが行う）
  onEdit?: (post: Post) => void
  onDelete?: (post: Post) => void
  // いいねのボタン。渡されたときだけ出す。ログインなしで押されたときの案内は、呼ぶ側が決める。
  // likePending：送信中（返事が来るまで、押せない）
  onToggleLike?: (post: Post) => void
  likePending?: boolean
  // コメント数を、詳細画面を開くボタンにする。渡さなければ、数を表示するだけ（詳細画面の中）
  onOpenComments?: (post: Post) => void
  // 表示名・@ユーザー名を、プロフィールを開くリンクにする。渡さなければ、表示するだけ（プロフィールの画面の中）
  onOpenAuthor?: (username: string) => void
}

// 投稿 1 件のカード
export default function PostCard({
  post,
  onEdit,
  onDelete,
  onToggleLike,
  likePending = false,
  onOpenComments,
  onOpenAuthor,
}: Props) {
  const { author } = post
  // 例：「サンプルの投稿「こんにちは…」を編集」。どの投稿のボタンかが、名前だけで分かる（F7）
  const target = `${author.displayName}の投稿「${excerpt(post.body)}」`
  return (
    <Card component="article" variant="outlined">
      <CardContent sx={{ display: 'flex', gap: 1.5 }}>
        {/* アイコン画像は、プロフィールの機能で作る。それまでは、表示名の頭文字 */}
        <Avatar aria-hidden>{Array.from(author.displayName)[0] ?? '?'}</Avatar>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <AuthorName displayName={author.displayName} username={author.username} onOpen={onOpenAuthor} />
            <Typography component="time" variant="caption" color="text.secondary" dateTime={post.createdAt}>
              {formatDateTime(post.createdAt)}
            </Typography>
          </Box>
          {/* 本文は、文字として表示する（HTML として解釈しない）。改行は、そのまま見せる */}
          <Typography sx={{ mt: 0.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{post.body}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 28 }}>
            {onToggleLike && (
              <>
                {/* 押した状態は、ハートの形（塗りつぶし）と色で示し、aria-pressed でも伝える。名前は、どの投稿かが分かるように */}
                <IconButton
                  size="small"
                  color={post.likedByMe ? 'error' : 'default'}
                  aria-label={post.likedByMe ? `${target}のいいねを取り消す` : `${target}にいいねする`}
                  aria-pressed={post.likedByMe}
                  disabled={likePending}
                  onClick={() => onToggleLike(post)}
                >
                  {post.likedByMe ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
                </IconButton>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 1.5, minWidth: '1.5em' }}>
                  {post.likeCount}
                </Typography>
              </>
            )}
            {/* コメント数（返信を含む）。onOpenComments があれば、詳細画面を開くボタン。なければ表示だけ。
                どちらも、アイコンと数を 1 つにまとめて、「…のコメント 3 件」と読み上げる */}
            {onOpenComments ? (
              <Button
                size="small"
                color="inherit"
                aria-label={`${target}のコメントを見る（${post.commentCount} 件）`}
                startIcon={<ChatBubbleOutlineIcon fontSize="small" />}
                onClick={() => onOpenComments(post)}
                sx={{ color: 'text.secondary', minWidth: 0 }}
              >
                {post.commentCount}
              </Button>
            ) : (
              <Box
                role="img"
                aria-label={`${target}のコメント ${post.commentCount} 件`}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}
              >
                <ChatBubbleOutlineIcon fontSize="small" />
                <Typography variant="body2" aria-hidden>
                  {post.commentCount}
                </Typography>
              </Box>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1, ml: 1.5 }}>
              {post.updatedAt ? '編集済み' : ''}
            </Typography>
            {onEdit && (
              <IconButton size="small" aria-label={`${target}を編集`} onClick={() => onEdit(post)}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            )}
            {onDelete && (
              <IconButton size="small" aria-label={`${target}を削除`} onClick={() => onDelete(post)}>
                <DeleteOutlinedIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}
