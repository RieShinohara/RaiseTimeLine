import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import { useState, type FormEvent } from 'react'
import { createPost, type Post } from '../api/posts'

// サーバーと同じ数え方（Java の文字数＝JavaScript の length。絵文字などは、2 文字分に数える）
export const MAX_POST_LENGTH = 280

interface Props {
  open: boolean
  onClose: () => void
  onPosted: (post: Post) => void
}

// 「＋ 投稿する」で開く、投稿のモーダル（POST-5）
export default function PostComposerDialog({ open, onClose, onPosted }: Props) {
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const tooLong = body.length > MAX_POST_LENGTH
  const canSubmit = body.trim().length > 0 && !tooLong && !submitting

  function close() {
    setBody('')
    setError(null)
    onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const post = await createPost(body)
      onPosted(post)
      close()
    } catch (err) {
      // 失敗したときは、閉じない。入力した内容も、残す
      setError(err instanceof Error ? err.message : 'エラーが起きました。もう一度、試してください')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={submitting ? undefined : close} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>投稿する</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            label="いまどうしてる？"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            multiline
            minRows={4}
            fullWidth
            autoFocus
            margin="dense"
            error={tooLong}
            helperText={`${body.length} / ${MAX_POST_LENGTH}${tooLong ? '（280 文字までです）' : ''}`}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={submitting}>
            キャンセル
          </Button>
          <Button type="submit" variant="contained" disabled={!canSubmit}>
            投稿
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
