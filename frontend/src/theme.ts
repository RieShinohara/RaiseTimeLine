import { createTheme } from '@mui/material/styles'

// 画面全体の色・文字の設定（Material UI のテーマ）。見た目の細かい調整は、機能がそろってから行う
export const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    background: { default: '#f5f7fa' },
  },
  components: {
    // ボタンの角の丸み。標準は 4px。ユーザーが、20px（ほぼ丸型）を選んだ（2026-11-16。Issue #76）
    MuiButton: { styleOverrides: { root: { borderRadius: 20 } } },
  },
  typography: {
    fontFamily: ['"Roboto"', '"Noto Sans JP"', '"Hiragino Kaku Gothic ProN"', '"Yu Gothic"', 'sans-serif'].join(','),
  },
})
