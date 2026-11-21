import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

// 画面の上の帯。ログイン中は「表示名・@ユーザー名・ログアウト」、未ログインは「ログイン・ユーザー登録」
export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
          <Box component={RouterLink} to="/" sx={{ color: 'inherit', textDecoration: 'none' }}>
            RaiseTimeLine
          </Box>
        </Typography>
        {user ? (
          <>
            {/* 自分のプロフィールへ。名前の文字のまま、リンクにする */}
            <Typography variant="body2" sx={{ mr: 2 }}>
              <Box
                component={RouterLink}
                to={`/users/${encodeURIComponent(user.username)}`}
                sx={{ color: 'inherit', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                {user.displayName}（@{user.username}）
              </Box>
            </Typography>
            <Button color="inherit" onClick={handleLogout}>
              ログアウト
            </Button>
          </>
        ) : (
          <>
            <Button color="inherit" component={RouterLink} to="/login">
              ログイン
            </Button>
            <Button color="inherit" component={RouterLink} to="/register">
              ユーザー登録
            </Button>
          </>
        )}
      </Toolbar>
    </AppBar>
  )
}
