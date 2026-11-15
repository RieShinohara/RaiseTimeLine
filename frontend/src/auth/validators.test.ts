import { expect, test } from 'vitest'
import { validateRegister, type RegisterValues } from './validators'

const OK: RegisterValues = {
  email: 'demo@example.com',
  password: 'password1',
  passwordConfirm: 'password1',
  username: 'demo_user',
  displayName: 'デモ',
}

test('条件を満たす入力は、エラーなし', () => {
  expect(validateRegister(OK)).toEqual({})
})

test.each([
  ['メールの形が違う', { email: 'not-an-email' }, 'email'],
  ['メールが空', { email: '' }, 'email'],
  ['パスワードが短い', { password: 'abc1', passwordConfirm: 'abc1' }, 'password'],
  ['パスワードに数字がない', { password: 'onlyletters', passwordConfirm: 'onlyletters' }, 'password'],
  ['パスワードに英字がない', { password: '12345678', passwordConfirm: '12345678' }, 'password'],
  ['パスワード確認が違う', { passwordConfirm: 'password2' }, 'passwordConfirm'],
  ['ユーザー名が 1 文字', { username: 'a' }, 'username'],
  ['ユーザー名に使えない文字', { username: 'bad-name!' }, 'username'],
  ['表示名が空白だけ', { displayName: '   ' }, 'displayName'],
  ['表示名が 51 文字', { displayName: 'あ'.repeat(51) }, 'displayName'],
] as const)('%s', (_name, change, field) => {
  const errors = validateRegister({ ...OK, ...change })
  expect(errors[field]).toBeTruthy()
})
