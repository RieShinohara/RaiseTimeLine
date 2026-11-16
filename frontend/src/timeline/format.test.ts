import { expect, test } from 'vitest'
import { formatDateTime } from './format'

test('日時を、見る人の時刻で「2026/11/16 14:30」の形にする', () => {
  // 時刻は、実行する PC のタイムゾーンで表示されるので、同じタイムゾーンで作った日時で確かめる
  const iso = new Date(2026, 10, 16, 14, 5).toISOString()
  expect(formatDateTime(iso)).toBe('2026/11/16 14:05')
})

test('マイクロ秒まである、サーバーの日時も読める', () => {
  expect(formatDateTime('2026-11-16T05:30:12.123456Z')).not.toBe('')
})

test('読めない日時は、空にする', () => {
  expect(formatDateTime('きのう')).toBe('')
})
