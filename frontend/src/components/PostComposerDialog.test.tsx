import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import { createPost, type Post } from '../api/posts'
import PostComposerDialog from './PostComposerDialog'

vi.mock('../api/posts', () => ({ createPost: vi.fn(), updatePost: vi.fn() }))

const createPostMock = vi.mocked(createPost)

// サンプルは、すべて架空
const POST: Post = {
  id: 7,
  body: '直そうとしている投稿',
  createdAt: '2026-11-22T05:30:00Z',
  updatedAt: null,
  author: { id: 1, username: 'demo_user', displayName: 'デモ' },
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
}

beforeEach(() => {
  createPostMock.mockReset()
})

// F21：MUI の自動の「フォーカスを戻す」は、閉じるとき、画面の本体の aria-hidden が外れる前に動いて、ブラウザが警告する。
// 新規投稿は、自分で、閉じ終わってから戻している。ここでは「戻ること」（キーボードの人が位置を見失わない）を守る。
// ※ 警告そのものは、jsdom では出ないので、本物のブラウザ（Chrome）のコンソールで確かめた

// 新規投稿（HomePage の「投稿する」と同じ：いつも置いてあって、open で開き閉じする）
function NewHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>開く</button>
      <PostComposerDialog open={open} onClose={() => setOpen(false)} onDone={vi.fn()} />
    </>
  )
}

// 編集（HomePage の編集と同じ：開くときに作り、閉じるとすぐ消える）
function EditHarness() {
  const [editing, setEditing] = useState<Post | null>(null)
  return (
    <>
      <button onClick={() => setEditing(POST)}>編集する</button>
      {editing && <PostComposerDialog open editing={editing} onClose={() => setEditing(null)} onDone={vi.fn()} />}
    </>
  )
}

test('新規投稿：キャンセルで閉じたあと、押したボタンに、フォーカスが戻る', async () => {
  render(<NewHarness />)
  const opener = screen.getByRole('button', { name: '開く' })
  await userEvent.click(opener)

  await userEvent.click(await screen.findByRole('button', { name: 'キャンセル' }))

  await waitFor(() => expect(opener).toHaveFocus())
})

test('新規投稿：投稿して閉じたあとも、押したボタンに、フォーカスが戻る', async () => {
  createPostMock.mockResolvedValue({ ...POST, id: 8, body: '新しい投稿' })
  render(<NewHarness />)
  const opener = screen.getByRole('button', { name: '開く' })
  await userEvent.click(opener)

  const dialog = await screen.findByRole('dialog', { name: '投稿する' })
  await userEvent.type(within(dialog).getByRole('textbox'), '新しい投稿')
  await userEvent.click(within(dialog).getByRole('button', { name: '投稿' }))

  await waitFor(() => expect(createPostMock).toHaveBeenCalledWith('新しい投稿'))
  await waitFor(() => expect(opener).toHaveFocus())
})

test('編集：閉じるとすぐ部品ごと消える作りでも、押したボタンに、フォーカスが戻る', async () => {
  render(<EditHarness />)
  const opener = screen.getByRole('button', { name: '編集する' })
  await userEvent.click(opener)

  await userEvent.click(await screen.findByRole('button', { name: 'キャンセル' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await waitFor(() => expect(opener).toHaveFocus())
})
