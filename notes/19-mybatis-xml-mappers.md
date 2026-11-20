# MyBatis の SQL を XML に統一する

2026-11-20。Issue #135。講義で「SQL は XML で管理したほうがよいのでは」という話が出たので、5 つの Mapper（Comment・Post・PostLike・User・RefreshToken）を、アノテーション方式から XML 方式に移した。

## 1. SQL の書き方は 2 通りある

| | アノテーション方式 | XML 方式 |
|---|---|---|
| SQL の置き場所 | Java の Mapper の中（`@Select("""…""")`） | 別の `.xml` ファイル（`resources/mapper/`） |
| 結果の詰め替え | `@ConstructorArgs`・`@Arg` | `<resultMap>`（または `resultType`） |
| 向いている場面 | 短い SQL | 長い SQL、JOIN、動的な SQL（`<if>`・`<foreach>`） |

先生の CommentMapper は、SQL が長く、`@Arg` が 8 行並び、同じ内容のコピーもあって、読みにくかった。**私たちのコードは、そこまでは読みにくくなかった**（`@ConstructorArgs` を使っていない）。だから今回は「読みやすさを直す」というより、**「SQL の置き場所を 1 つにそろえる」ための移行**と、**学習のための体験**。

## 2. 結びつけの仕組み

- Java の `interface`（メソッドの宣言だけ）と、XML を、**名前**で結ぶ
  - XML の `namespace` ＝ interface の名前（パッケージ込み）
  - XML の `id` ＝ メソッド名
- XML の置き場所は、`application.yml` の `mybatis.mapper-locations`（`classpath:mapper/*.xml`）で教える。**ここを書き忘れると、「SQL が見つからない」エラーになる**
- 引数の名前（`#{postId}`）は、これまでと同じく、`@Param("postId")` の名前から来る。そこは変えていない

## 3. XML ならではの決まり

- **`<` と `>` は、記号として読まれる。** SQL の中の `p.id < #{before}` は、**`&lt;`** と書く（`>` は `&gt;`、`<>` は `&lt;&gt;`）。長い SQL なら、`<![CDATA[ … ]]>` で囲む手もある
- **`<sql id="…">` と `<include refid="…"/>`** で、同じ列の並びを 1 回だけ書いて使い回せる（`postColumns`・`commentColumns`）。コピーしていた所が、1 か所にまとまった
- `<foreach>` は、`<script>` で囲まなくてよくなった（XML は、最初から動的 SQL を読める）。IN の「空にしない」の決まりは、そのまま
- Java の中の `record`（`LikeCount`・`CommentCount`）は、XML からは `PostLikeMapper$LikeCount` のように、**`$`** で呼ぶ

## 4. 「成功」を疑って確かめたこと

- `gradlew check` は成功。**テストは 65 件・失敗 0・スキップ 0**（件数まで見た）
- **わざと壊してみた**：`UserMapper.xml` の `users` を `userz` に変えたら、テストが失敗した。→ XML が、**本当に使われている**（古い Java 側の SQL が、まだ動いているわけではない）
- サーバーを起動して、`/actuator/health` が UP。登録 → ログイン → 投稿 → いいね → コメント・返信 → 一覧（いいね数・押した状態・コメント数）→ 更新 → 削除 → ログアウトを、API で呼んで確かめた
- つまずき：**壊した XML を、`git checkout` では戻せなかった**（まだ git に入れていない新しいファイルは、戻す元がない）。PowerShell の `Set-Content` で書き戻すと、日本語のコメントが**文字化け**もした。→ ファイルの書き換えは、Write・Edit ツールで行う（CLAUDE.md 7 の注意どおり）。「わざと壊す」実験は、コミットしてからか、コピーを取ってから

## 5. 混在より統一がよい理由

「どこに SQL があるか」を、探さなくてよくなる。これから、プロフィール・フォロー・検索で、SQL は増えて、複雑になる。**増える前に、そろえておくと、移す量が少ない。**
