import Container from '@mui/material/Container'
import { Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import PostDetailPage from './pages/PostDetailPage'
import ProfilePage from './pages/ProfilePage'
import RegisterPage from './pages/RegisterPage'

// 画面の枠（ヘッダー）と、URL ごとの画面。ログイン状態は、main.tsx の AuthProvider が持つ
export default function App() {
  return (
    <>
      <Header />
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/posts/:id" element={<PostDetailPage />} />
          <Route path="/users/:username" element={<ProfilePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </Container>
    </>
  )
}
