import SearchIcon from '@mui/icons-material/Search'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { useState, type FormEvent } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

// 検索の言葉の長さの上限（サーバーと同じ。表示名の上限）
const MAX_SEARCH_LENGTH = 50

// 画面の上の帯。検索欄（ユーザー検索。ログインなしでも使える）と、
// ログイン中は「表示名・@ユーザー名・ログアウト」、未ログインは「ログイン・ユーザー登録」
export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [searchText, setSearchText] = useState('')

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  // Enter で、検索結果の画面へ。空・空白だけなら、動かない（SRCH-3）
  function handleSearch(e: FormEvent) {
    e.preventDefault()
    const q = searchText.trim()
    if (q === '') return
    void navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <AppBar position="static">
      {/* 狭い画面では、検索欄を 2 段目に回す（flexWrap と order） */}
      <Toolbar sx={{ flexWrap: 'wrap' }}>
        <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
          <Box component={RouterLink} to="/" sx={{ color: 'inherit', textDecoration: 'none' }}>
            RaiseTimeLine
          </Box>
        </Typography>
        <Box
          component="form"
          role="search"
          onSubmit={handleSearch}
          sx={{
            order: { xs: 3, sm: 0 },
            flexBasis: { xs: '100%', sm: 240 },
            mr: { sm: 2 },
            pb: { xs: 1, sm: 0 },
          }}
        >
          <TextField
            size="small"
            fullWidth
            placeholder="ユーザーを検索"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            slotProps={{
              htmlInput: { 'aria-label': 'ユーザーを検索', maxLength: MAX_SEARCH_LENGTH },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ bgcolor: 'rgba(255, 255, 255, 0.7)', borderRadius: 1 }}
          />
        </Box>
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
