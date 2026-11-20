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

---

# 基礎の復習（対話でつまずいた所を、たとえでまとめる）

## 6. 全体像：誰が何を話すか

```
画面（React）→ サーバー（Java）→ DB（PostgreSQL）
                    ↑
              ここで MyBatis が働く
```

- **SQL**：DB へのお願いの文章。動詞は 4 つ：`SELECT`（取り出す）・`INSERT`（追加）・`UPDATE`（書き換え）・`DELETE`（消す）
- **MyBatis**：Java と DB の間の**通訳**。SQL は、自分で書く（Spring Data JPA は、それも自動で作る方式だった）
- **XML**：タグ（`<…>`）で構造を付ける書き方。ここでは、**SQL をしまっておく専用のメモ帳**

## 7. Mapper の .java と .xml：メニュー表とレシピ

| | たとえ | 中身 |
|---|---|---|
| .java（interface） | **メニュー表** | 名前・必要な材料（引数）・出てくる物（戻り値）だけ |
| .xml | **厨房のレシピ** | SQL そのもの |

結ぶのは、**名前の一致**だけ。

| Java 側 | XML 側 |
|---|---|
| `UserMapper`（パッケージ込み） | `namespace` |
| メソッド名 `findById` | `id="findById"` |
| `@Param("id")` | `#{id}` |

### つまずいた所：機械は「意味」ではなく「文字」を見る

`deleteById` と `deleteByPostId` は、**意味は同じ**（PostMapper の中では、どちらも投稿の番号で消す）。でも、**文字が違う**ので、MyBatis は別物として扱い、「レシピがありません」とエラーにする。人間は意味で読み、機械は一字一句で読む。

## 8. id と xxx_id の読み方（一番つまずいた所）

- **`id`**：その表の**行、自分自身**の番号（通し番号）。**固有なのは、その表の中だけ**（posts の 1 番と、comments の 1 番は、別の物）
- **`xxx_id`**：**xxx 表の `id` を、借りて書いた列**（「どの」「誰の」を示す）

| 列 | どの表の `id` を指すか |
|---|---|
| `post_id` | posts 表の `id` |
| `user_id` | users 表の `id` |
| `parent_comment_id` | comments 表**自身**の `id`（返信の「元のコメント」） |

- **posts 表に、`post_id` という列は、ない。** 「投稿の番号」は、posts 表の `id` そのもの。`post_id` は、**別の表（comments・post_likes）の中**で、「あの投稿」を指すために現れる
- たとえ：生徒名簿には出席番号（`id`）があり、委員会の名簿には、「出席番号いくつの生徒か」（`post_id`）を、コピーして書く

### メソッド名の読み方

「動詞 ＋ 何で探すか」。**メソッド名と戻り値の型が「概要」、XML の SQL が「詳細」。**

| メソッド | 探す列 | 返ってくる物 |
|---|---|---|
| `CommentMapper.findById` | comments の `id` | コメント **1 件**（`id` は、1 行に 1 つ） |
| `CommentMapper.findByPostId` | comments の `post_id` | その投稿に付いたコメント**全部**（同じ投稿に、何件も付く） |

「探す条件の列が、重なるか、重ならないか」で、1 件か複数かが決まる。

### Mapper の名前

`PostMapper` ＝ posts 表、`CommentMapper` ＝ comments 表、…と、**「主に担当する表」**の名前を付ける（**私たちの約束で、機械の決まりではない**）。

## 9. JOIN：つないで、ついでに持ってくる

comments 表には、書いた人の**番号**（`user_id`）しかない。画面には**名前**を出したいので、users 表と、番号でつなぐ。

```
comments（id, post_id, user_id, body）
users（id, username, display_name）
  → comments.user_id ＝ users.id の行を、つなげる
  → 1 枚の表（コメント ＋ 書いた人の名前）として読める
```

`CommentMapper.xml` の `JOIN users u ON u.id = c.user_id` が、その部分。メソッド名に `User` が出てこないのは、users は「**探す条件**」ではなく、「**ついでに持ってくる情報**」だから。

## 10. クラスとメソッド

- **クラス**：入れ物（名詞・**大文字**始まり）。`PostMapper` ＝ 動作をまとめる窓口、`Post`・`Comment` ＝ データを入れる箱
- **メソッド**：入れ物の中の動作（**動詞**・**小文字**始まり・**かっこ `()` が付く**）。`findById` など
- 呼び方 `postMapper.findById(5)` ＝ 「PostMapper の `findById` を、5 番で呼ぶ」（`.` は「の中の」）
- メソッドの読み方：`Post findById(Long id)` ＝ ① 戻り値の型（返ってくる物）② メソッド名 ③ 引数（渡す材料）
- 迷ったら：**名詞か動詞か・かっこがあるか・頭文字が大文字か** の 3 点を見る（`Comment` をメソッドと間違えたが、名詞・大文字始まりなので、クラス）

## 11. 学び方のふり返り

- **つまずいた順**：「何をしているか」の全体像 → 名前の一致 → `id` と `post_id` → クラスとメソッド。**言葉の意味が分からないまま進むと、あとの話が全部ぼやける**ので、途中で止めて、実物の表で見直したのが、効いた
- 理解を確かめるときは、**自分の言葉で答える**と、どこが分かっていないかが、はっきりする（`post_id` を「posts 表の見えない列」と思っていたことが、答えから分かった）
