import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import { deletePost, type Post } from '../api/posts'
import DeletePostDialog from './DeletePostDialog'

vi.mock('../api/posts', () => ({ deletePost: vi.fn() }))

const deletePostMock = vi.mocked(deletePost)

// サンプルは、すべて架空
const POST: Post = {
  id: 7,
  body: '消そうとしている投稿',
  createdAt: '2026-11-18T05:30:00Z',
  updatedAt: null,
  author: { id: 1, username: 'demo_user', displayName: 'デモ' },
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
}

beforeEach(() => {
  deletePostMock.mockReset()
})

function setup() {
  const onClose = vi.fn()
  const onDeleted = vi.fn()
  render(<DeletePostDialog post={POST} onClose={onClose} onDeleted={onDeleted} />)
  return { onClose, onDeleted }
}

// F11：ダイアログの名前は、見出しの文字から作られる。「閉じる」ボタンが、見出しの中にあると、「確認 閉じる」になる
test('ダイアログの名前は、何を消すかが分かる', async () => {
  setup()
  expect(await screen.findByRole('dialog', { name: '投稿を削除' })).toBeInTheDocument()
})

test('「閉じる」ボタンは、見出しの外にある', async () => {
  setup()
  const dialog = await screen.findByRole('dialog', { name: '投稿を削除' })
  const heading = within(dialog).getByRole('heading', { name: '投稿を削除' })
  expect(within(heading).queryByRole('button')).not.toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: '閉じる' })).toBeInTheDocument()
})

// F12：MUI の自動の「フォーカスを戻す」は、閉じるとき、画面の本体の aria-hidden が外れる前に動いて、ブラウザが警告する。
// そこで、自分で、閉じ終わってから戻している。ここでは「戻ること」（キーボードの人が位置を見失わない）を守る。
// ※ 警告そのものは、jsdom では出ないので、本物のブラウザ（Chrome）のコンソールで確かめた
function Harness() {
  const [post, setPost] = useState<Post | null>(null)
  return (
    <>
      <button onClick={() => setPost(POST)}>開く</button>
      <DeletePostDialog post={post} onClose={() => setPost(null)} onDeleted={vi.fn()} />
    </>
  )
}

test('閉じたあと、押したボタンに、フォーカスが戻る', async () => {
  render(<Harness />)
  const opener = screen.getByRole('button', { name: '開く' })
  await userEvent.click(opener)

  await userEvent.click(await screen.findByRole('button', { name: 'キャンセル' }))

  await waitFor(() => expect(opener).toHaveFocus())
})

test('消せたら、その投稿を知らせて、閉じる', async () => {
  deletePostMock.mockResolvedValue(undefined)
  const { onClose, onDeleted } = setup()

  await userEvent.click(await screen.findByRole('button', { name: '削除する' }))

  await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(POST))
  expect(deletePostMock).toHaveBeenCalledWith(7)
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('消せなかったら、理由を出して、閉じない（やり直せる）', async () => {
  deletePostMock.mockRejectedValue(new Error('この投稿は、削除できません'))
  const { onClose, onDeleted } = setup()

  await userEvent.click(await screen.findByRole('button', { name: '削除する' }))

  expect(await screen.findByText('この投稿は、削除できません')).toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
  expect(onDeleted).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '削除する' })).toBeEnabled()
})

test('消している間は、どのボタンも押せない', async () => {
  deletePostMock.mockImplementation(() => new Promise<void>(() => {}))
  setup()

  await userEvent.click(await screen.findByRole('button', { name: '削除する' }))

  await waitFor(() => expect(screen.getByRole('button', { name: '削除する' })).toBeDisabled())
  expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '閉じる' })).toBeDisabled()
})
