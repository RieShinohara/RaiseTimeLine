import { createTheme } from '@mui/material/styles'

// 画面全体の色・文字の設定（Material UI のテーマ）。見た目の細かい調整は、機能がそろってから行う
export const theme = createTheme({
  palette: {
    // ミントグリーン（仮の色。ユーザーが選んだ。2026-11-17。Issue #82。あとで変えてよい）。
    // 押す所（ボタン・タブ・リンク）は、濃いめのミントに白文字（コントラスト比 4.91）。面積の広い所は、パステル。
    // 明るいミントの上に白文字を置くと読みにくい（2.59）ので、押す所は、濃いめにした
    primary: { main: '#1B7F66', contrastText: '#FFFFFF' },
    background: { default: '#F1FAF6' },
    // 文字は、黒ではなく、深い緑がかった色（本文は背景に対して 10.56、補助の文字は 5.02）
    text: { primary: '#24403A', secondary: '#587068' },
  },
  components: {
    // ヘッダーの帯は、パステルミントに、濃い緑の文字（コントラスト比 6.83）
    MuiAppBar: { styleOverrides: { root: { backgroundColor: '#CDEFE0', color: '#14574A' } } },
    // ボタンの角の丸み。標準は 4px。ユーザーが、20px（ほぼ丸型）を選んだ（2026-11-16。Issue #76）
    MuiButton: { styleOverrides: { root: { borderRadius: 20 } } },
  },
  typography: {
    fontFamily: ['"Roboto"', '"Noto Sans JP"', '"Hiragino Kaku Gothic ProN"', '"Yu Gothic"', 'sans-serif'].join(','),
  },
})
