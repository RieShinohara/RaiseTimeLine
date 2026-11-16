import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Link from '@mui/material/Link'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useState, type FormEvent } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { ApiError, register } from '../api/auth'
import { validateRegister, type RegisterErrors, type RegisterValues } from '../auth/validators'

const EMPTY: RegisterValues = { email: '', password: '', passwordConfirm: '', username: '', displayName: '' }

export default function RegisterPage() {
  const navigate = useNavigate()
  const [values, setValues] = useState<RegisterValues>(EMPTY)
  const [errors, setErrors] = useState<RegisterErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function field(name: keyof RegisterValues, label: string, type = 'text', autoComplete?: string, helper?: string) {
    return (
      <TextField
        label={label}
        type={type}
        autoComplete={autoComplete}
        value={values[name]}
        onChange={(e) => setValues({ ...values, [name]: e.target.value })}
        error={Boolean(errors[name])}
        helperText={errors[name] ?? helper}
        required
      />
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const found = validateRegister(values)
    setErrors(found)
    setSubmitError(null)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    try {
      // パスワード確認は、画面だけで確かめる。サーバーには送らない
      await register({
        email: values.email.trim(),
        password: values.password,
        username: values.username,
        displayName: values.displayName.trim(),
      })
      // 自動ログインはしない。ログインの画面で、もう一度入力する（AUTH-3）
      navigate('/login', { state: { registered: true } })
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'エラーが起きました。もう一度、試してください')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom>
          ユーザー登録
        </Typography>
        {submitError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {submitError}
          </Alert>
        )}
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: 'grid', gap: 2 }}>
          {field('email', 'メールアドレス', 'email', 'email')}
          {field(
            'password',
            'パスワード',
            'password',
            'new-password',
            '半角の英数字と記号で、8〜72 文字。英字と数字を含めます',
          )}
          {field('passwordConfirm', 'パスワード（確認）', 'password', 'new-password')}
          {field('username', 'ユーザー名', 'text', 'username', '英数字と _ だけ、2〜30 文字。登録後は変えられません')}
          {field('displayName', '表示名', 'text', 'nickname', '50 文字まで。あとから変えられます')}
          <Button type="submit" variant="contained" disabled={submitting}>
            登録する
          </Button>
        </Box>
        <Typography variant="body2" sx={{ mt: 2 }}>
          アカウントをお持ちの方は{' '}
          <Link component={RouterLink} to="/login">
            ログイン
          </Link>
        </Typography>
      </CardContent>
    </Card>
  )
}
