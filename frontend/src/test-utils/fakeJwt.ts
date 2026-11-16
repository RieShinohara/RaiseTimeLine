// テスト用の札（JWT の形をした偽物）。署名はでたらめ。中身（ペイロード）の exp だけを、画面側が読む。サンプルは、すべて架空
export function fakeJwt(expSeconds: number): string {
  const encode = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encode({ alg: 'HS256' })}.${encode({ sub: '1', exp: expSeconds })}.signature`
}
