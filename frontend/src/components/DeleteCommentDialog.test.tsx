import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import { deleteComment } from '../api/comments'
import DeleteCommentDialog, { type DeleteTarget } from './DeleteCommentDialog'

vi.mock('../api/comments', () => ({ deleteComment: vi.fn() }))

const deleteCommentMock = vi.mocked(deleteComment)

beforeEach(() => {
  deleteCommentMock.mockReset()
})

function setup(target: DeleteTarget = { id: 5, hasReplies: false, isReply: false }) {
  const onClose = vi.fn()
  const onDeleted = vi.fn()
  render(<DeleteCommentDialog target={target} onClose={onClose} onDeleted={onDeleted} />)
  return { onClose, onDeleted }
}

// F11：ダイアログの名前は、見出しの文字から作られる。「閉じる」ボタンが、見出しの中にあると、「確認 閉じる」になる
test('ダイアログの名前は、何を消すかが分かる（コメント・返信）', async () => {
  const { unmount } = render(
    <DeleteCommentDialog target={{ id: 1, hasReplies: false, isReply: false }} onClose={vi.fn()} onDeleted={vi.fn()} />,
  )
  expect(await screen.findByRole('dialog', { name: 'コメントを削除' })).toBeInTheDocument()
  unmount()

  render(
    <DeleteCommentDialog target={{ id: 2, hasReplies: false, isReply: true }} onClose={vi.fn()} onDeleted={vi.fn()} />,
  )
  expect(await screen.findByRole('dialog', { name: '返信を削除' })).toBeInTheDocument()
})

test('「閉じる」ボタンは、見出しの外にある', async () => {
  setup()
  const dialog = await screen.findByRole('dialog', { name: 'コメントを削除' })
  const heading = within(dialog).getByRole('heading', { name: 'コメントを削除' })
  expect(within(heading).queryByRole('button')).not.toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: '閉じる' })).toBeInTheDocument()
})

// F12：MUI の自動の「フォーカスを戻す」は、閉じるとき、画面の本体の aria-hidden が外れる前に動いて、ブラウザが警告する。
// そこで、自分で、閉じ終わってから戻している。ここでは「戻ること」（キーボードの人が位置を見失わない）を守る。
// ※ 警告そのものは、jsdom では出ないので、本物のブラウザ（Chrome）のコンソールで確かめた
function Harness() {
  const [target, setTarget] = useState<DeleteTarget | null>(null)
  return (
    <>
      <button onClick={() => setTarget({ id: 5, hasReplies: false, isReply: false })}>開く</button>
      <DeleteCommentDialog target={target} onClose={() => setTarget(null)} onDeleted={vi.fn()} />
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

test('消せたら、知らせて、閉じる', async () => {
  deleteCommentMock.mockResolvedValue(undefined)
  const { onClose, onDeleted } = setup()

  await userEvent.click(await screen.findByRole('button', { name: '削除する' }))

  await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1))
  expect(deleteCommentMock).toHaveBeenCalledWith(5)
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('消せなかったら、理由を出して、閉じない（やり直せる）', async () => {
  deleteCommentMock.mockRejectedValue(new Error('このコメントは、削除できません'))
  const { onClose, onDeleted } = setup()

  await userEvent.click(await screen.findByRole('button', { name: '削除する' }))

  expect(await screen.findByText('このコメントは、削除できません')).toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
  expect(onDeleted).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '削除する' })).toBeEnabled()
})

test('消している間は、どのボタンも押せない', async () => {
  // 答えが来るまで待たせる
  deleteCommentMock.mockImplementation(() => new Promise<void>(() => {}))
  setup()

  await userEvent.click(await screen.findByRole('button', { name: '削除する' }))

  await waitFor(() => expect(screen.getByRole('button', { name: '削除する' })).toBeDisabled())
  expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '閉じる' })).toBeDisabled()
})

test('返信が付いているときは、返信も消えることを知らせる', async () => {
  setup({ id: 3, hasReplies: true, isReply: false })
  expect(await screen.findByText(/付いている返信も、一緒に消えます/)).toBeInTheDocument()
})
