import { createTheme } from '@mui/material/styles'

// 画面全体の色・文字の設定（Material UI のテーマ）。見た目の細かい調整は、機能がそろってから行う
export const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    background: { default: '#f5f7fa' },
  },
  typography: {
    fontFamily: ['"Roboto"', '"Noto Sans JP"', '"Hiragino Kaku Gothic ProN"', '"Yu Gothic"', 'sans-serif'].join(','),
  },
})
