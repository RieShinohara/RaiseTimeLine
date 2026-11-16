import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import Button from '@mui/material/Button'

interface Props {
  count: number
  onClick: () => void
}

// 画面の上に浮かぶ、「N 件の新しい投稿があります」のバナー（ボタン）。
// モーダルではない：背後の画面は、スクロールも操作も、そのままできる。新着が 0 件のときは、出さない
export default function NewPostsBanner({ count, onClick }: Props) {
  if (count <= 0) return null
  return (
    <Button
      variant="contained"
      startIcon={<ArrowUpwardIcon />}
      onClick={onClick}
      sx={{
        position: 'fixed',
        // ヘッダー（AppBar）の少し下。モーダル（1300）よりは、下
        top: 72,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1200,
        boxShadow: 4,
        whiteSpace: 'nowrap',
      }}
    >
      {count}件の新しい投稿があります
    </Button>
  )
}
