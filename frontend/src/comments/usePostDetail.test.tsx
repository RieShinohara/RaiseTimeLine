import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { CommentItem, CommentList } from '../api/comments'
import type { Post } from '../api/posts'
import { jsonResponse } from '../test-utils/render'
import { usePostDetail } from './usePostDetail'

// サンプルは、すべて架空
const AUTHOR = { id: 2, username: 'post_user', displayName: '投稿者' }
const POST: Post = {
  id: 10,
  body: '詳細画面の投稿',
  createdAt: '2026-11-18T05:30:00Z',
  updatedAt: null,
  author: AUTHOR,
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
}

function item(id: number, body: string): CommentItem {
  return { id, body, createdAt: '2026-11-18T06:00:00Z', author: AUTHOR, replies: [] }
}

function listOf(comments: CommentItem[]): CommentList {
  return { comments, commentCount: comments.length }
}

const fetchMock = vi.fn()

beforeEach(() => {
  localStorage.clear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// F10：書く・消すのあとの「一覧の読み直し」が重なって、古い応答が、あとから届いたとき
test('読み直しが重なって、古い応答があとから届いても、新しい一覧を上書きしない', async () => {
  // 最初の読み込みだけ、すぐ答える。そのあとの一覧の読み直しは、こちらが答えるまで待たせる
  let initial = true
  const waiting: Array<(res: Response) => void> = []
  fetchMock.mockImplementation((url: string) => {
    if (url === '/api/posts/10') return Promise.resolve(jsonResponse(200, POST))
    if (url === '/api/posts/10/comments') {
      if (initial) return Promise.resolve(jsonResponse(200, listOf([item(1, '最初のコメント')])))
      return new Promise<Response>((resolve) => waiting.push(resolve))
    }
    return Promise.resolve(jsonResponse(500))
  })

  const { result } = renderHook(() => usePostDetail(10))
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.comments.map((c) => c.body)).toEqual(['最初のコメント'])

  initial = false
  let older!: Promise<void>
  let newer!: Promise<void>
  act(() => {
    older = result.current.reloadComments() // 1 回目（古い）
    newer = result.current.reloadComments() // 2 回目（新しい）
  })
  await waitFor(() => expect(waiting).toHaveLength(2))

  await act(async () => {
    // 新しい方の応答が先に届き、そのあとで、古い方の応答が届く
    waiting[1](jsonResponse(200, listOf([item(1, '最初のコメント'), item(2, '新しいコメント')])))
    await newer
    waiting[0](jsonResponse(200, listOf([item(1, '最初のコメント')])))
    await older
  })

  // 古い応答（1 件）で、上書きされていない
  expect(result.current.comments.map((c) => c.body)).toEqual(['最初のコメント', '新しいコメント'])
  expect(result.current.post?.commentCount).toBe(2)
})
