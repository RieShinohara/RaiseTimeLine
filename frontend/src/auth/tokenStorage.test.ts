import { beforeEach, expect, test } from 'vitest'
import { clearSession, getUser, saveSession } from './tokenStorage'

// 保存したユーザー情報を読むときの、形の確認（品質チェック F2）。サンプルは、すべて架空
const USER = { id: 1, email: 'demo@example.com', username: 'demo_user', displayName: 'デモ' }

beforeEach(() => {
  localStorage.clear()
})

test('正しい形のユーザー情報は、そのまま読める', () => {
  saveSession({ accessToken: 'a', refreshToken: 'r', user: USER })
  expect(getUser()).toEqual(USER)
})

test('保存がなければ、null', () => {
  expect(getUser()).toBeNull()
})

test('壊れた JSON は、null（ログインしていない状態）', () => {
  localStorage.setItem('userInfo', '{not json')
  expect(getUser()).toBeNull()
})

test.each([
  ['配列', '[1,2,3]'],
  ['数', '42'],
  ['null', 'null'],
  ['id が文字列', JSON.stringify({ ...USER, id: '1' })],
  ['id がない', JSON.stringify({ email: USER.email, username: USER.username, displayName: USER.displayName })],
  ['email が数', JSON.stringify({ ...USER, email: 5 })],
  ['username がない', JSON.stringify({ id: 1, email: USER.email, displayName: USER.displayName })],
  ['displayName が null', JSON.stringify({ ...USER, displayName: null })],
])('形が違うもの（%s）は、null（想定外の値で、画面が動かない）', (_name, raw) => {
  localStorage.setItem('userInfo', raw)
  expect(getUser()).toBeNull()
})

test('消したあとは、null', () => {
  saveSession({ accessToken: 'a', refreshToken: 'r', user: USER })
  clearSession()
  expect(getUser()).toBeNull()
})
