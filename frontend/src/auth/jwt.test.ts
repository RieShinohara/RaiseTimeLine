import { expect, test } from 'vitest'
import { fakeJwt } from '../test-utils/fakeJwt'
import { isTokenExpired, readExpiry } from './jwt'

const NOW = Date.UTC(2026, 10, 16, 12, 0, 0)
const nowSeconds = NOW / 1000

test('札の中身から、期限（exp）を読める', () => {
  expect(readExpiry(fakeJwt(1234567890))).toBe(1234567890)
})

test('読めない札は、期限なし（null）', () => {
  expect(readExpiry('access-1')).toBeNull()
  expect(readExpiry('a.!!!.c')).toBeNull()
  expect(readExpiry(`a.${btoa('{"sub":"1"}')}.c`)).toBeNull()
})

test('期限が過ぎていれば切れている。余裕（10 秒）以内でも、切れている扱い', () => {
  expect(isTokenExpired(fakeJwt(nowSeconds - 1), 10, NOW)).toBe(true)
  expect(isTokenExpired(fakeJwt(nowSeconds + 5), 10, NOW)).toBe(true)
  expect(isTokenExpired(fakeJwt(nowSeconds + 60), 10, NOW)).toBe(false)
})

test('期限が読めない札は、切れていない扱い（サーバーが決める）', () => {
  expect(isTokenExpired('access-1', 10, NOW)).toBe(false)
})
