import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { Post } from '../api/posts'
import PostCard from './PostCard'

// 編集・削除ボタンの名前（品質チェック F7）。サンプルは、すべて架空
function post(id: number, body: string): Post {
  return {
    id,
    body,
    createdAt: '2026-11-17T05:30:00Z',
    updatedAt: null,
    author: { id: 1, username: 'sample_user', displayName: 'サンプル' },
  }
}

test('編集・削除ボタンの名前に、どの投稿かが分かる情報（投稿者と本文の頭）が入る', () => {
  render(<PostCard post={post(1, 'こんにちは')} onEdit={vi.fn()} onDelete={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'サンプルの投稿「こんにちは」を編集' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'サンプルの投稿「こんにちは」を削除' })).toBeInTheDocument()
})

test('長い本文は、20 文字で切って「…」を付け、改行は空白 1 つにする', () => {
  const body = 'あ'.repeat(25)
  render(<PostCard post={post(2, `${body}\n\n二行目`)} onEdit={vi.fn()} />)
  expect(screen.getByRole('button', { name: `サンプルの投稿「${'あ'.repeat(20)}…」を編集` })).toBeInTheDocument()
  render(<PostCard post={post(3, '一行目\n二行目')} onEdit={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'サンプルの投稿「一行目 二行目」を編集' })).toBeInTheDocument()
})

test('2 つの投稿のボタンは、名前で区別できる', () => {
  render(
    <>
      <PostCard post={post(1, '最初の投稿')} onEdit={vi.fn()} />
      <PostCard post={post(2, '次の投稿')} onEdit={vi.fn()} />
    </>,
  )
  const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))
  expect(new Set(names).size).toBe(2)
})

test('onEdit・onDelete がなければ（他の人の投稿）、ボタンは出ない', () => {
  render(<PostCard post={post(1, '他の人の投稿')} />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
