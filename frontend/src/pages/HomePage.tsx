import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import { useAuth } from '../auth/useAuth'

// 仮のトップ画面。タイムラインは、講義 28 で作る
export default function HomePage() {
  const { user } = useAuth()
  return (
    <Card>
      <CardContent>
        {user ? (
          <Typography variant="body1">
            ようこそ、{user.displayName}さん（@{user.username}）。
          </Typography>
        ) : (
          <Typography variant="body1">ログインしなくても、見るだけはできます。</Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          タイムラインは、これから作ります。
        </Typography>
      </CardContent>
    </Card>
  )
}
