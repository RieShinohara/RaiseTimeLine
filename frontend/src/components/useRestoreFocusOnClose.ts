import { useLayoutEffect, useRef } from 'react'

// ダイアログを閉じたあと、開く前にフォーカスのあったボタンへ、フォーカスを戻す（キーボードの人が、位置を見失わないように）。
//
// MUI の自動の「フォーカスを戻す」は、閉じるときに、画面の本体（#root）の aria-hidden を外すより先に動く。
// すると、ブラウザが「隠れている要素の中に、フォーカスが残っている」と警告する（品質チェック F12）。
// そこで、自動の戻しを止めて（disableRestoreFocus）、閉じ終わってから（onExited）、自分で戻す。
export function useRestoreFocusOnClose(open: boolean) {
  const opener = useRef<HTMLElement | null>(null)

  // 開いた瞬間に、フォーカスのある要素（押したボタン）を覚える。MUI がフォーカスをダイアログへ動かすのは、
  // このあと（useEffect）なので、ここなら、まだ押したボタンにある
  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement) opener.current = document.activeElement
  }, [open])

  return {
    disableRestoreFocus: true,
    slotProps: {
      transition: {
        onExited: () => {
          // 押したボタンが、もうない（例：消したコメントのボタン）ときは、何も起きない
          opener.current?.focus()
          opener.current = null
        },
      },
    },
  }
}
