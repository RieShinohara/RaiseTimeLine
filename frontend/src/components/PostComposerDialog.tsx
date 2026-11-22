import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import { useState, type FormEvent } from 'react'
import { createPost, updatePost, type Post } from '../api/posts'
import { useRestoreFocusOnClose } from './useRestoreFocusOnClose'

// サーバーと同じ数え方（Java の文字数＝JavaScript の length。絵文字などは、2 文字分に数える）
export const MAX_POST_LENGTH = 280

interface Props {
  open: boolean
  onClose: () => void
  // 投稿・保存に成功したときに、サーバーが返した投稿を渡す
  onDone: (post: Post) => void
  // 渡すと、その投稿の本文を直す「編集」になる。渡さなければ、新しい投稿
  editing?: Post
}

// 「＋ 投稿する」「編集」で開く、投稿のモーダル（POST-5。編集も、同じモーダルを使う）
export default function PostComposerDialog({ open, onClose, onDone, editing }: Props) {
  const [body, setBody] = useState(editing?.body ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const tooLong = body.length > MAX_POST_LENGTH
  // 編集では、本文が変わっていないときは、保存できない
  const unchanged = editing !== undefined && body === editing.body
  const canSubmit = body.trim().length > 0 && !tooLong && !unchanged && !submitting

  function close() {
    setBody(editing?.body ?? '')
    setError(null)
    onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const post = editing ? await updatePost(editing.id, body) : await createPost(body)
      onDone(post)
      close()
    } catch (err) {
      // 失敗したときは、閉じない。入力した内容も、残す
      setError(err instanceof Error ? err.message : 'エラーが起きました。もう一度、試してください')
    } finally {
      setSubmitting(false)
    }
  }

  // 新規投稿：閉じたあとの、フォーカスの戻しを、自分で行う（MUI の自動の戻しは、画面の本体の aria-hidden が外れる前に動いて、
  // ブラウザが警告する。品質チェック F12・F21）。
  // 編集：閉じるとすぐ部品ごと消える作り（HomePage の `{editing && …}`）で、今のままで、フォーカスは戻り、警告も出ない
  // （本物のブラウザで確認済み）ので、MUI の自動の戻しに任せる
  const restoreFocus = useRestoreFocusOnClose(open)

  return (
    <Dialog
      {...(editing ? {} : restoreFocus)}
      open={open}
      onClose={submitting ? undefined : close}
      fullWidth
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>{editing ? '投稿を編集' : '投稿する'}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            label={editing ? '本文' : 'いまどうしてる？'}
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
            {editing ? '保存' : '投稿'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
