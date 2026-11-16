import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
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
}

// 投稿 1 件のカード。いいね数・コメント数は、あとの機能で足す
export default function PostCard({ post, onEdit, onDelete }: Props) {
  const { author } = post
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
            <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
              {post.updatedAt ? '編集済み' : ''}
            </Typography>
            {onEdit && (
              <IconButton size="small" aria-label="編集" onClick={() => onEdit(post)}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            )}
            {onDelete && (
              <IconButton size="small" aria-label="削除" onClick={() => onDelete(post)}>
                <DeleteOutlinedIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}
