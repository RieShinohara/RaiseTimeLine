import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import { useState, type FormEvent } from 'react'
import { MAX_POST_LENGTH } from './PostComposerDialog'

interface Props {
  // 入力欄の名前（読み上げにも使う）。例：「コメントを書く」「返信を書く」
  label: string
  submitLabel: string
  // 本文を送る。失敗したら、理由つきの Error を投げる（入力は残る）
  onSubmit: (body: string) => Promise<void>
  // 渡すと「キャンセル」が出る（返信の入力欄を閉じる）
  onCancel?: () => void
  autoFocus?: boolean
}

// コメントと返信で共用の入力欄。280 文字まで（CMT-2。サーバーと同じ数え方）。空は送れない
export default function CommentForm({ label, submitLabel, onSubmit, onCancel, autoFocus = false }: Props) {
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const tooLong = body.length > MAX_POST_LENGTH
  const canSubmit = body.trim().length > 0 && !tooLong && !submitting

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(body.trim())
      setBody('')
    } catch (err) {
      // 失敗したときは、入力した内容を残す
      setError(err instanceof Error ? err.message : 'エラーが起きました。もう一度、試してください')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box component="form" onSubmit={(e: FormEvent) => void handleSubmit(e)} noValidate sx={{ mb: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}
      <TextField
        label={label}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        multiline
        minRows={2}
        fullWidth
        autoFocus={autoFocus}
        error={tooLong}
        helperText={`${body.length} / ${MAX_POST_LENGTH}${tooLong ? '（280 文字までです）' : ''}`}
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
        {onCancel && (
          <Button onClick={onCancel} disabled={submitting}>
            キャンセル
          </Button>
        )}
        <Button type="submit" variant="contained" disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </Box>
    </Box>
  )
}
