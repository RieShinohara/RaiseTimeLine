import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import CommentForm from './CommentForm'

function setup(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(<CommentForm label="コメントを書く" submitLabel="コメントする" onSubmit={onSubmit} />)
  return {
    onSubmit,
    button: screen.getByRole('button', { name: 'コメントする' }),
    box: screen.getByLabelText('コメントを書く'),
  }
}

test('空や空白だけのときは、送れない', async () => {
  const { button, box } = setup()
  expect(button).toBeDisabled()
  await userEvent.type(box, '   ')
  expect(button).toBeDisabled()
})

test('280 文字までは送れ、281 文字になると送れず、理由が出る', async () => {
  const { button, box } = setup()
  await userEvent.click(box)
  await userEvent.paste('あ'.repeat(280))
  expect(button).toBeEnabled()
  expect(screen.getByText('280 / 280')).toBeInTheDocument()
  await userEvent.paste('あ')
  expect(button).toBeDisabled()
  expect(screen.getByText(/281 \/ 280（280 文字までです）/)).toBeInTheDocument()
})

test('送ると、前後の空白を取った本文で onSubmit が呼ばれ、入力欄が空になる', async () => {
  const { onSubmit, button, box } = setup()
  await userEvent.type(box, '  こんにちは  ')
  await userEvent.click(button)
  expect(onSubmit).toHaveBeenCalledWith('こんにちは')
  expect(box).toHaveValue('')
})

test('失敗したら、理由が出て、入力は残る（送り直せる）', async () => {
  const { button, box } = setup(vi.fn().mockRejectedValue(new Error('投稿が見つかりません')))
  await userEvent.type(box, '残る本文')
  await userEvent.click(button)
  expect(await screen.findByText('投稿が見つかりません')).toBeInTheDocument()
  expect(box).toHaveValue('残る本文')
})

test('送信中は、二重に送れない', async () => {
  let finish: () => void = () => {}
  const onSubmit = vi.fn().mockReturnValue(new Promise<void>((resolve) => (finish = resolve)))
  const { button, box } = setup(onSubmit)
  await userEvent.type(box, '連打')
  await userEvent.click(button)
  expect(button).toBeDisabled()
  // ボタンが押せないだけでなく、Enter などでフォームが直接送られても、2 回目は送らない
  fireEvent.submit(box.closest('form')!)
  expect(onSubmit).toHaveBeenCalledTimes(1)
  finish()
})
