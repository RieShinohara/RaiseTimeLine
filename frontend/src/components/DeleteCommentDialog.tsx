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
import { deleteComment } from '../api/comments'

// 消そうとしているコメント（または返信）
export interface DeleteTarget {
  id: number
  // 返信が付いているコメントか（付いていれば、返信も消える）
  hasReplies: boolean
  isReply: boolean
}

interface Props {
  // null のときは、閉じている
  target: DeleteTarget | null
  onClose: () => void
  onDeleted: () => void
}

// コメントの削除の確認（CMT-1c：返信が付いたコメントを消すと、返信も一緒に消える。元に戻せない）
export default function DeleteCommentDialog({ target, onClose, onDeleted }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  function close() {
    setError(null)
    onClose()
  }

  async function handleDelete() {
    if (!target) return
    setDeleting(true)
    setError(null)
    try {
      await deleteComment(target.id)
      onDeleted()
      close()
    } catch (err) {
      // 失敗したときは、閉じない（理由を出して、やり直せるようにする）
      setError(err instanceof Error ? err.message : 'エラーが起きました。もう一度、試してください')
    } finally {
      setDeleting(false)
    }
  }

  const noun = target?.isReply ? '返信' : 'コメント'
  return (
    <Dialog open={target !== null} onClose={deleting ? undefined : close} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pr: 6 }}>
        確認
        <IconButton
          aria-label="閉じる"
          onClick={close}
          disabled={deleting}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Typography>この{noun}を削除しますか？</Typography>
        <Typography variant="body2" color="text.secondary">
          {target?.hasReplies ? '付いている返信も、一緒に消えます。' : ''}削除した{noun}は元に戻せません。
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
    </Dialog>
  )
}
