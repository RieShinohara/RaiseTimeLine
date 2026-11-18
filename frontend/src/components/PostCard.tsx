import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import FavoriteIcon from '@mui/icons-material/Favorite'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import type { Post } from '../api/posts'
import { formatDateTime } from '../timeline/format'

interface Props {
  post: Post
  // 自分の投稿のときだけ、編集・削除のボタンを出す（本当の確認は、サーバーが行う）
  onEdit?: (post: Post) => void
  onDelete?: (post: Post) => void
  // いいねのボタン。渡されたときだけ出す。ログインなしで押されたときの案内は、呼ぶ側が決める。
  // likePending：送信中（返事が来るまで、押せない）
  onToggleLike?: (post: Post) => void
  likePending?: boolean
}

// ボタンの名前に入れる、本文の頭（読み上げで、どの投稿のボタンか分かるように）
function excerpt(body: string, max = 20): string {
  const chars = Array.from(body.replace(/\s+/g, ' '))
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : chars.join('')
}

// 投稿 1 件のカード
export default function PostCard({ post, onEdit, onDelete, onToggleLike, likePending = false }: Props) {
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
            <Typography component="span" noWrap sx={{ fontWeight: 'bold' }}>
              {author.displayName}
            </Typography>
            <Typography component="span" variant="body2" color="text.secondary" noWrap sx={{ flexGrow: 1 }}>
              @{author.username}
            </Typography>
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
            {/* コメント数（返信を含む）。表示だけ。詳細画面へのリンクにするのは、詳細画面ができたとき。
                アイコンと数を 1 つにまとめて、「…のコメント 3 件」と読み上げる */}
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
