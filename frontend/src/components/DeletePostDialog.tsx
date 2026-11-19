import CloseIcon from '@mui/icons-material/Close'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { deletePost, type Post } from '../api/posts'
import { useRestoreFocusOnClose } from './useRestoreFocusOnClose'

interface Props {
  // 消そうとしている投稿。null のときは、閉じている
  post: Post | null
  onClose: () => void
  onDeleted: (post: Post) => void
}

// 削除の確認（POST-2：投稿と、付いていたコメント・いいね・画像は、すべて消える。元に戻せない）
export default function DeletePostDialog({ post, onClose, onDeleted }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  // 閉じたあと、押したボタンへ、フォーカスを戻す（閉じる前に戻すと、ブラウザが警告する。F12）
  const restoreFocus = useRestoreFocusOnClose(post !== null)

  function close() {
    setError(null)
    onClose()
  }

  async function handleDelete() {
    if (!post) return
    setDeleting(true)
    setError(null)
    try {
      await deletePost(post.id)
      onDeleted(post)
      close()
    } catch (err) {
      // 失敗したときは、閉じない（理由を出して、やり直せるようにする）
      setError(err instanceof Error ? err.message : 'エラーが起きました。もう一度、試してください')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog {...restoreFocus} open={post !== null} onClose={deleting ? undefined : close} fullWidth maxWidth="xs">
      {/* 見出しは、何を消すかが分かる文字だけにする（「閉じる」ボタンを入れると、名前が「確認 閉じる」になる。F11） */}
      <DialogTitle sx={{ pr: 6 }}>投稿を削除</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Typography>この投稿を削除しますか？</Typography>
        <Typography variant="body2" color="text.secondary">
          削除した投稿は元に戻せません。
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={close} disabled={deleting}>
          キャンセル
        </Button>
        <Button variant="contained" color="error" onClick={() => void handleDelete()} disabled={deleting}>
          削除する
        </Button>
      </DialogActions>
      <IconButton
        aria-label="閉じる"
        onClick={close}
        disabled={deleting}
        sx={{ position: 'absolute', right: 8, top: 8 }}
      >
        <CloseIcon />
      </IconButton>
    </Dialog>
  )
}
