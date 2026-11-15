import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from './App'

// 土台の確認：Material UI の部品を使った画面が、描かれる
test('アプリ名と、土台のメッセージが表示される', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'RaiseTimeLine' })).toBeInTheDocument()
  expect(screen.getByText(/画面の土台ができました/)).toBeInTheDocument()
})
