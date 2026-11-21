import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import { useState, type FormEvent } from 'react'
import { updateProfile, type Profile } from '../api/users'
import { useRestoreFocusOnClose } from './useRestoreFocusOnClose'

// サーバーと同じ数え方（Java の文字数＝JavaScript の length。絵文字などは、2 文字分に数える）
export const MAX_DISPLAY_NAME_LENGTH = 50
export const MAX_BIO_LENGTH = 160

interface Props {
  open: boolean
  profile: Profile
  onClose: () => void
  // 保存に成功したときに、サーバーが返した（直したあとの）プロフィールを渡す
  onSaved: (profile: Profile) => void
}

// 自分のプロフィールを直すダイアログ（UC-11）。直せるのは、表示名と自己紹介だけ（ユーザー名・メールは、変えられない）。
// 呼ぶ側は、開くたびに key を変えて、作り直す（前の入力が、残らないように）
export default function ProfileEditDialog({ open, profile, onClose, onSaved }: Props) {
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const restoreFocus = useRestoreFocusOnClose(open)

  const nameTooLong = displayName.length > MAX_DISPLAY_NAME_LENGTH
  const bioTooLong = bio.length > MAX_BIO_LENGTH
  // サーバーは、前後の空白を取ってから検査・保存する。ここも、同じ見方で「変わったか」を決める
  const unchanged = displayName.trim() === profile.displayName && bio.trim() === (profile.bio ?? '')
  const canSubmit = displayName.trim().length > 0 && !nameTooLong && !bioTooLong && !unchanged && !submitting

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const saved = await updateProfile(profile.username, { displayName, bio })
      onSaved(saved)
      onClose()
    } catch (err) {
      // 失敗したときは、閉じない。入力した内容も、残す
      setError(err instanceof Error ? err.message : 'エラーが起きました。もう一度、試してください')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      disableRestoreFocus={restoreFocus.disableRestoreFocus}
      slotProps={restoreFocus.slotProps}
    >
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>プロフィールを編集</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            label="表示名"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            fullWidth
            autoFocus
            margin="dense"
            error={nameTooLong}
            helperText={`${displayName.length} / ${MAX_DISPLAY_NAME_LENGTH}${nameTooLong ? '（50 文字までです）' : ''}`}
          />
          <TextField
            label="自己紹介"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            margin="dense"
            error={bioTooLong}
            helperText={`${bio.length} / ${MAX_BIO_LENGTH}${bioTooLong ? '（160 文字までです）' : ''}`}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>
            キャンセル
          </Button>
          <Button type="submit" variant="contained" disabled={!canSubmit}>
            保存
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
