import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import type { Post } from '../api/posts'
import { formatDateTime } from '../timeline/format'

// 投稿 1 件のカード。いいね数・コメント数・編集・削除は、あとの機能で足す
export default function PostCard({ post }: { post: Post }) {
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
          {post.updatedAt && (
            <Typography variant="caption" color="text.secondary">
              編集済み
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}
