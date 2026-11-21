import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'

interface Props {
  displayName: string
  username: string
  // 渡されたときだけ、押してプロフィールを開けるリンクにする（ログインの有無に関わらず、誰でも開ける）
  onOpen?: (username: string) => void
}

// 投稿・コメントの、「表示名 @ユーザー名」。onOpen があれば、2 つ合わせて 1 つのリンク（押すと、その人のプロフィールへ）
export default function AuthorName({ displayName, username, onOpen }: Props) {
  const content = (
    <>
      <Typography component="span" noWrap sx={{ fontWeight: 'bold' }}>
        {displayName}
      </Typography>
      <Typography component="span" variant="body2" color="text.secondary" noWrap>
        @{username}
      </Typography>
    </>
  )
  const layout = { display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0, flexGrow: 1 }
  if (!onOpen) return <Box sx={layout}>{content}</Box>
  return (
    <Link
      component="button"
      type="button"
      underline="hover"
      color="inherit"
      aria-label={`${displayName}（@${username}）のプロフィールを開く`}
      onClick={() => onOpen(username)}
      sx={{ ...layout, textAlign: 'left' }}
    >
      {content}
    </Link>
  )
}
