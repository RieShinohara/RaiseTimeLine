# 復習 E：SQL・Mapper・id・JOIN・クラスとメソッド

2026-11-21。復習 A〜D（[ノート 08](08-review-a.md)・[09](09-review-c.md)・[10](10-review-d.md)・[12](12-review-b.md)）の続き。[ノート 19](19-mybatis-xml-mappers.md)〜[21](21-profile-api.md) の土台を、「単語の意味 → 仕組み → 形式」の順で、問題と自分の答えの形で確かめた。実物は、[CommentMapper.java](../backend/src/main/java/com/example/raisetimeline/comment/CommentMapper.java) と [CommentMapper.xml](../backend/src/main/resources/mapper/CommentMapper.xml)。

## 復習 1：SQL と、Mapper の .java・.xml

### 問題と自分の答え
1. SQL とは？ →「DB へのお願いの言葉。DB は Java を使えないので、MyBatis が通訳になり、画面からの値を SQL に入れて DB にお願いする」
2. Mapper の .java と .xml は？ →「.java はメニュー（SQL のメソッドが書いてある）、.xml はレシピ（何を返すかが書いてある）」

### 補足と訂正
- **SQL を書くのは人。MyBatis は運び屋。** メソッドを呼ぶと、決まった SQL を DB に届けて、返事を Java の形に戻す。値を入れる穴が `#{}`。
- **訂正：.java に SQL は書かない。** 書くのは、メソッドの名前・渡す物・返す物だけ（料理名だけが載ったメニュー）。作り方（SQL）は .xml。
- **2 つは、名前が「文字として同じ」ことでつながる。** 機械は意味を見ない。1 文字違うと、つながらない。

| | .java | .xml |
|---|---|---|
| 場所の名前 | パッケージ名 ＋ `interface CommentMapper` | `namespace="com.example.raisetimeline.comment.CommentMapper"` |
| メソッド／SQL の名前 | `findByPostId` | `id="findByPostId"` |
| 値の穴の名前 | `@Param("postId")` | `#{postId}` |

## 復習 2：`id` と `post_id`、1 件か複数件か

### 問題と自分の答え
1. `id` と `post_id` の違い →「`id` はその表だけの通し番号。`post_id` は投稿の表に振られた id」
2. `findById` と `findByPostId` →「`findById` はその表の id で探すから 1 件。`findByPostId` は、その投稿に関する情報だから複数件かな」

### 補足
- 1 は、ほぼ正解。補足：**`post_id` は、`comments` 表の中にある列**で、「このコメントは、どの投稿へのものか」を表す。posts の `id` を**借りてきた**番号を書いておくことで、2 つの表がつながる。

| comments 表の列 | 意味 |
|---|---|
| `id` | コメント自身の番号 |
| `post_id` | どの投稿へのコメントか（posts の `id` を借りる） |
| `user_id` | 誰が書いたか（users の `id` を借りる） |

- 2 は正解。**見分けるコツは、返す型が `List<…>` かどうか。** `List<Comment> findByPostId` ＝ 複数件、`Comment findById` ＝ 1 件。名前の `By○○` は、「どの列で探すか」。

## 復習 3：JOIN

### 問題と自分の答え
- `JOIN users u ON u.id = c.user_id` は何のため？ →「users の表を JOIN して、Comment の表にない User Name を紐づけるため」
- なかったら？ →「コメントに、その人が誰かという名前を表示できない」

### 補足
- 正解。**`ON` の行が「つなぎ目」**：users の `id` と、comments の `user_id` が同じ行どうしをつなぐ。借りた番号を「返してもらう」のが JOIN（メモに「7 番」とあるので、名簿で 7 番を引いて、名前を添える）。
- 表の短い呼び名：`comments c`・`users u`。
- **JOIN がないと、名前が要るたびに users を引くことになり、コメント 20 件で SQL が 21 回**（N+1。[ノート 11](11-likes-api-n-plus-one.md)）。JOIN で 1 回にまとめている。

## 復習 4：クラスとメソッド、`int` と `long`

### 問題と自分の答え
実物の 4 行（`insert`・`findByPostId`・`findById`・`countByPostId`）を見て、答えた。
1. クラスの名前 → `Comment`・`List<Comment>`・`Long`
2. メソッドの名前 → `insert`・`findByPostId`・`findById`・`countByPostId`
3. `( )` の中 →「リクエスト（注文票）。postId の値の投稿に紐づくデータ」
4. `int` と `long` →「取り扱えるデータの大きさ。32 ビットと 64 ビット」

### 補足
- 1・2 は正解。**クラスは名詞・頭が大文字、メソッドは動詞・頭が小文字。** `List` も大文字（クラス）。`List<Comment>` は「`Comment` の入った `List`」。
- 3：`( )` の中は、**引数（ひきすう）**＝メソッドを呼ぶときに渡す物。「リクエスト」は通信の全体で、`( )` の中は、そこから取り出した「投稿の番号 1 つ」。読み方は「**型 ＋ 名前**」（`Long postId` ＝ `postId` という名前の `Long` 型の物）。

| 部分 | 意味 | たとえ |
|---|---|---|
| `List<Comment>` | 返す物 | 出てくる料理 |
| `findByPostId` | メソッドの名前 | 料理の名前 |
| `( Long postId )` | 渡す物 | 注文票に書く内容 |

- 4 は正解。

| | 大きさ | 入る数の範囲（目安） |
|---|---|---|
| `int` | 32 ビット | 約 ±21 億 |
| `long` | 64 ビット | 約 ±900 京 |

  投稿・コメントの番号は増え続けるので、上限が大きい `long`（`Long`）を使う。
- **小文字 `long` と大文字 `Long` は別物。** 小文字は、ただの数値の種類（クラスではない。null にはなれない）。大文字はクラスで、「値がまだない」＝ null も表せる。実物では、`countByPostId` が `long`（数は必ず 0 以上）、`findById` の引数が `Long`。「頭が大文字ならクラス」の見分け方の実例。

## まとめ
| テーマ | 結果 |
|---|---|
| SQL・MyBatis の役割 | 合っている（SQL は人が書き、MyBatis は運び屋） |
| .java と .xml | 合っている（訂正：.java に SQL はない。つなぐのは文字の一致） |
| `id` と `post_id`、1 件か複数件か | 合っている（見分けるコツは `List<…>`） |
| JOIN | 合っている（`ON` がつなぎ目。ないと N+1） |
| クラスとメソッド、引数、`int` と `long` | 合っている（「引数」という言葉、`long` と `Long` の違いを補足） |

## 残り（次の復習の候補）
- フォロー API の守り：主キー・CHECK・外部キーが何を止めるか、本人だけ 403（[ノート 20](20-follow-api.md)・[21](21-profile-api.md)）。③の実装の中で、思い出す機会がある。
