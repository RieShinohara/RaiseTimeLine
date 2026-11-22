import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import type { FollowUser } from '../api/users'
import AuthorName from './AuthorName'

interface Props {
  person: FollowUser
  // 自分の行には、フォローのボタンを出さない（本当の確認は、サーバーが行う。自分自身は 400）
  isMe: boolean
  // フォロー・解除を送信中（ボタンを押せなくする）
  pending: boolean
  // フォロー・解除のボタンが押されたとき（ログインなしなら、ログインの画面へ案内するのは、呼ぶ側）
  onToggleFollow: (person: FollowUser) => void
  // 名前が押されたとき（その人のプロフィールを開く）
  onOpenProfile: (username: string) => void
}

// 人の一覧（フォロー中・フォロワー・検索結果）の、1 人分のカード。<li> として使う
export default function UserCard({ person, isMe, pending, onToggleFollow, onOpenProfile }: Props) {
  return (
    <Card component="li" variant="outlined">
      <CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        {/* アイコン画像は、S3 のときに作る。それまでは、表示名の頭文字 */}
        <Avatar aria-hidden>{Array.from(person.displayName)[0] ?? '?'}</Avatar>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Box sx={{ display: 'flex' }}>
            <AuthorName displayName={person.displayName} username={person.username} onOpen={onOpenProfile} />
          </Box>
          {person.bio && (
            <Typography
              variant="body2"
              sx={{
                mt: 0.5,
                overflowWrap: 'anywhere',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {person.bio}
            </Typography>
          )}
        </Box>
        {!isMe && (
          <Button
            size="small"
            variant={person.followedByMe ? 'outlined' : 'contained'}
            disabled={pending}
            aria-label={
              person.followedByMe ? `${person.displayName}のフォローを解除する` : `${person.displayName}をフォローする`
            }
            onClick={() => onToggleFollow(person)}
          >
            {person.followedByMe ? 'フォロー解除' : 'フォロー'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
