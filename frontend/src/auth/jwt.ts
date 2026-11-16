// アクセストークン（JWT）の期限を、札の中身から読む。
// 札の中身（ペイロード）は、だれでも読める（秘密は入れていない）。署名が本物かどうかを確かめるのは、サーバーの役目。
// ここは「もうすぐ切れそうか」の見当をつけるだけ

// 期限（exp。1970 年からの秒数）を返す。読めなければ null
export function readExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    // JWT は、Base64 の「URL 版」（+ と / の代わりに - と _）で書かれている
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)))
    const exp = (JSON.parse(json) as { exp?: unknown }).exp
    return typeof exp === 'number' ? exp : null
  } catch {
    return null
  }
}

// 期限が切れている（または、marginSeconds 秒以内に切れる）か。期限が読めない札は、切れていない扱い
export function isTokenExpired(token: string, marginSeconds = 10, nowMs: number = Date.now()): boolean {
  const exp = readExpiry(token)
  if (exp === null) return false
  return exp * 1000 - marginSeconds * 1000 <= nowMs
}
