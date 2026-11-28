# コードの言葉の表（少しずつ足す）

コードに出てくる言葉を、実物のファイルと行で確かめながら、少しずつ集める。行番号は、書いた日の時点（ずれたら、言葉を `Ctrl + Shift + F` で探す）。探し方の操作は、[ノート 36](36-login-path.md) の 6。

**足し方**：①ファイルで言葉を見つける → ②意味を予想する → ③確かめて、表に 1 行足す。「意味」は、読み返すときに、自分の言葉に直してよい。

## 1. 言葉の表

| 言葉 | 読み方 | 意味 | 見た場所 | 仲間の言葉 | 足した日 |
|---|---|---|---|---|---|
| `fetch` | フェッチ | 画面（auth.ts）⇔サーバー（AuthController.java）のやり取り。画面側からお願いを送り、返事を受け取る道具 | [auth.ts:24](../frontend/src/api/auth.ts#L24) | `await`、`res`、JSON | 2026-11-28 |
| `JSON` | ジェイソン | 通信するときの共通の形（文字） | [auth.ts:26-27](../frontend/src/api/auth.ts#L26-L27)、[34](../frontend/src/api/auth.ts#L34) | `JSON.stringify`、`res.json()` | 2026-11-28 |
| `async` | エイシンク（アシンクとも） | 中で待つことがある関数の目印。非同期 | [auth.ts:21](../frontend/src/api/auth.ts#L21)、[AuthContext.tsx:18](../frontend/src/auth/AuthContext.tsx#L18) | `await` | 2026-11-28 |
| `await` | アウェイト | 時間のかかる仕事が終わるのを待ってから、次へ進む | [auth.ts:24](../frontend/src/api/auth.ts#L24)、[32](../frontend/src/api/auth.ts#L32)、[34](../frontend/src/api/auth.ts#L34) | `async` | 2026-11-28 |
| `const` | コンスト | 名前を作って、中身を入れる。あとから入れ直さない | [AuthContext.tsx:19](../frontend/src/auth/AuthContext.tsx#L19)、[tokenStorage.ts:12](../frontend/src/auth/tokenStorage.ts#L12) | `let`、`final`（Java） | 2026-11-28 |
| `let` | レット | 名前を作る。中身は、あとからでも入れられる | [auth.ts:22](../frontend/src/api/auth.ts#L22) | `const` | 2026-11-28 |
| スコープ | — | 名前が使える範囲（`const`・`let` は、作った `{ }` の中） | [auth.ts:22-34](../frontend/src/api/auth.ts#L22-L34) | `{ }` | 2026-11-28 |

## 2. 短い説明

### JSON：両側が、それぞれ翻訳する

```
画面の中のデータ
   ↓ JSON.stringify（auth.ts 27 行目）
【JSON：文字】 ── 通信 ──→
   ↓ Spring が翻訳（AuthController.java 36 行目の @RequestBody）
Java のデータ（LoginRequest）
```

- 帰りは逆。Java の `LoginResponse` を Spring が JSON にし、画面が `res.json()`（auth.ts 34 行目）で読み戻す。
- JSON は Java 専用ではない。送るときも、受け取るときも使う。
- このアプリの例外：ログアウトの返事は中身がない（番号 204 だけ）。読み込むだけのお願い（GET）は、送る中身がない。

### `async` と `await`

```ts
async function postJson … {      // 21 行目：中で待つことがある仕事
    await fetch(…)               // 24 行目：返事（番号）が届くのを待つ
    await readMessage(res)       // 32 行目：失敗のとき、中身の文言を読むのを待つ
    await res.json()             // 34 行目：中身を読んで、画面で使える形にするのを待つ
}
```

- 関数の中で `await` を使うなら、その関数に `async` を付ける。
- 非同期：待っている間も、画面は固まらない（呼び出しベルを受け取って、料理を待つ間に、ほかのことができる）。
- 返事は 2 回待つ：箱が届くのを待ち（24 行目）、開けて中身を読み終わるのを待つ（32・34 行目）。
- もし [AuthContext.tsx:19](../frontend/src/auth/AuthContext.tsx#L19) の `await` がないと、次の `saveSession(res)` のときに、返事がまだ届いていない（このアプリでは、TypeScript が形の違いをエラーにするので、ビルドで気づける）。

### `const` と `let`、スコープ

```ts
let res: Response        // 22 行目：外で名前だけ作る
try {
  res = await fetch(…)   // 24 行目：中で中身を入れる（前に let が付かない）
} catch {
  throw …
}
// 32〜34 行目：try の外で res を使う
```

- 前に `const` や `let` が付いていれば「作る」。付いていなければ「すでにある名前に入れる」。
- 24 行目で `const res = …` と作ると、`res` は `try { }` の中だけのものになり、32〜34 行目から使えない。だから、外で `let` で作っている。

## 3. 次に足したい言葉（候補）
`return`、`try`・`catch`、`throw`、`export`・`import`、`function`、`interface`、Java の `private`・`static`・`final`・`public`。
