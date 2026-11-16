// 登録の入力チェック。バックエンドと、同じ条件にする（docs/features/01-auth.md 3.6）。
// ここは「親切のための、早めの確認」。本当の確認は、サーバー側で必ず行われる

export interface RegisterValues {
  email: string
  password: string
  passwordConfirm: string
  username: string
  displayName: string
}

export type RegisterErrors = Partial<Record<keyof RegisterValues, string>>

export function validateRegister(values: RegisterValues): RegisterErrors {
  const errors: RegisterErrors = {}

  if (!values.email.trim()) errors.email = 'メールアドレスを入力してください'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
    errors.email = 'メールアドレスの形が正しくありません'
  else if (values.email.trim().length > 255) errors.email = 'メールアドレスは 255 文字までです'

  if (!values.password) errors.password = 'パスワードを入力してください'
  else if (!/^(?=.*[A-Za-z])(?=.*\d)[\x21-\x7E]{8,72}$/.test(values.password))
    errors.password =
      'パスワードは、半角の英数字と記号で、8〜72 文字にしてください。英字と数字を 1 文字以上ずつ含めます'

  if (values.passwordConfirm !== values.password) errors.passwordConfirm = 'パスワードが、一致しません'

  if (!values.username) errors.username = 'ユーザー名を入力してください'
  else if (!/^[A-Za-z0-9_]{2,30}$/.test(values.username))
    errors.username = 'ユーザー名は 2〜30 文字の、英数字とアンダースコアだけです'

  if (!values.displayName.trim()) errors.displayName = '表示名を入力してください'
  else if (values.displayName.length > 50) errors.displayName = '表示名は 50 文字までです'

  return errors
}
