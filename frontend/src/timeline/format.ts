const formatter = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

// サーバーの日時（ISO 形式）を、見る人の時刻で、「2026/11/16 14:30」の形にする
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return formatter.format(date)
}

// ボタンの名前に入れる、本文の頭（読み上げで、どの投稿・コメントのボタンか分かるように）。改行は空白 1 つにする
export function excerpt(body: string, max = 20): string {
  const chars = Array.from(body.replace(/\s+/g, ' '))
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : chars.join('')
}
