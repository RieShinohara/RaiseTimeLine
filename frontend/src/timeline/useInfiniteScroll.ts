import { useEffect, useRef } from 'react'

// 画面の一番下の目印（sentinel）が見えたら、onReach を呼ぶ（無限スクロール）。
// active が false の間（読み込み中・続きがない・失敗中）は、見張らない。
// active が false → true に戻るたびに、見張り直す。そのとき、目印がまだ見えていれば、すぐに呼ばれる
export function useInfiniteScroll(onReach: () => void, active: boolean) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = sentinelRef.current
    if (!active || !element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onReach()
      },
      // 一番下に着く少し手前（200px）で、読み始める
      { rootMargin: '200px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [active, onReach])

  return sentinelRef
}
