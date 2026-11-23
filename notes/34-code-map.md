# コードの場所の地図：どのファイルの、どこに、何が書いてあるか

2026-11-23。「コードを追いかける」復習の 1 回目（いいね）と 2 回目（フォロー）の記録。復習 F（[ノート 33](33-review-f.md)）の続き。

**きっかけ（ユーザーの気づき）：** 「実際に、どのコードを見たらそう書いてあるのか、という復習を、さっぱりやってこなかった。実際にやって初めて、理解できた。流れに沿って、どのファイルのどの行に何が書いてあるかと、日本語と英単語（プログラミング言語の単語）を結びつける必要がある」。

**注意：行番号は、2026-11-23 時点。** コードを変えると、ずれる。**目印の英単語**で探せるようにしておく。

## 1. 地図の作り方（4 つの列）
| 列 | 書くこと |
|---|---|
| 順 | 流れの順番（画面 → 入口 → Controller → Service → Mapper → DB → 返事） |
| 日本語の役割 | その場所が、何をするか |
| ファイルと行 | 開いて、見つけた場所 |
| 目印の英単語 | その行にある、探すときの手がかり（日本語の意味つき） |

**進め方：** ① コードを見ずに、道すじを言葉で言う → ② 質問で、抜けを埋める → ③ 実物のコードを、数行だけ見て、答え合わせ。ファイル名だけをもらって、**行番号と英単語は、自分で見つける。**

## 2. 道すじの地図：いいね（`PUT/DELETE /api/posts/{id}/like`）
| 順 | 日本語の役割 | ファイルと行 | 目印の英単語 |
|---|---|---|---|
| 1 | 画面：返事を待って、画面を変える | [useLikeToggle.ts](../frontend/src/timeline/useLikeToggle.ts) 22〜23 | `await`（待つ）、`likePost`、`patch`（部分的に直す） |
| 2 | 入口：ログイン必須（それ以外すべて） | [SecurityConfig.java](../backend/src/main/java/com/example/raisetimeline/auth/SecurityConfig.java) 54 | `anyRequest`、`authenticated` |
| 3 | 住所（共通部分） | [PostLikeController.java](../backend/src/main/java/com/example/raisetimeline/post/PostLikeController.java) 14 | `RequestMapping` |
| 4 | 方式：PUT ＝「この状態にして」／DELETE ＝取り消し | 同 23・28 | `PutMapping`、`DeleteMapping` |
| 5 | 住所の `{id}` と、札から取った本人の id | 同 24 | `PathVariable`、`AuthenticationPrincipal` |
| 6 | 投稿があるか確認（なければ 404） | [PostLikeService.java](../backend/src/main/java/com/example/raisetimeline/post/PostLikeService.java) 23、39〜43 | `requireExists`、`NOT_FOUND` |
| 7 | Mapper に「挿入して」と依頼 | 同 25 | `insert` |
| 8 | 実際の SQL（重なったら、何もしない） | [PostLikeMapper.xml](../backend/src/main/resources/mapper/PostLikeMapper.xml) 8〜12 | `INSERT INTO`、`ON CONFLICT DO NOTHING` |
| 9 | 同じ人の二重を断る（主キー）／存在しない相手を断る（外部キー） | [V4](../backend/src/main/resources/db/migration/V4__create_post_likes.sql) 9／6・7 | `PRIMARY KEY`、`REFERENCES` |
| 10 | 返事（数と「押したか」）。返事の入れ物＝DTO | PostLikeService.java 45〜47 | `LikeResponse`、`count`、`exists` |

## 3. 道すじの地図：フォロー（`PUT/DELETE /api/users/{username}/follow`）
| 順 | 日本語の役割 | ファイルと行 | 目印の英単語 |
|---|---|---|---|
| 1 | 画面：返事を待って、ボタンを変える | [useFollowToggle.ts](../frontend/src/profile/useFollowToggle.ts) 23〜24 | `await`、`followUser`（関数）、`unfollowUser` |
| 2 | 入口：ログイン必須（PUT・DELETE は、GET だけのルールに当てはまらない） | SecurityConfig.java 54（札を見る係は 57、401 は 56） | `anyRequest`、`authenticated`、`jwtFilter`、`UNAUTHORIZED` |
| 3 | 住所と方式 | [FollowController.java](../backend/src/main/java/com/example/raisetimeline/follow/FollowController.java) 14・23・28 | `RequestMapping`、`PutMapping`、`DeleteMapping` |
| 4 | 確認①：相手がいるか（呼ぶだけに見えて、中に `throw`） | [FollowService.java](../backend/src/main/java/com/example/raisetimeline/follow/FollowService.java) 35 → 90〜96 | `requireUser`、`throw`、`NOT_FOUND` |
| 5 | 確認②：自分自身か | 同 36〜38 | `if`、`throw`、`BAD_REQUEST` |
| 6 | Mapper に依頼。DB が断った場合を受け止める | 同 40、39〜44 | `insert`、`try`、`catch`、`DataIntegrityViolationException` |
| 7 | 実際の SQL（いいねと、ほぼ同じ形） | [FollowMapper.xml](../backend/src/main/resources/mapper/FollowMapper.xml) 8〜12 | `INSERT INTO`、`ON CONFLICT DO NOTHING` |
| 8 | DB の網（主キー・外部キー・CHECK） | [V6](../backend/src/main/resources/db/migration/V6__create_follows.sql) 9／6・7／10 | `PRIMARY KEY`、`REFERENCES`、`CHECK`（`<>`） |
| 9 | 返事（数と状態） | FollowService.java 45 | `FollowResponse`、`countFollowers` |

**共通点：** いいねとフォローは、同じ形の道すじ（住所・方式・確認・`insert`・`ON CONFLICT DO NOTHING`・主キー・外部キー）。同じ型の問題には、同じ型の解き方。

## 4. 英単語の一覧（日本語の意味つき）
| 英単語 | 意味 | どこで見たか |
|---|---|---|
| `exists` | 存在する？ | Mapper の SQL・メソッド名 |
| `authenticated` | 認証済み（有効な札がある） | SecurityConfig |
| `permitAll` | 全員に許可（ログインなしで可） | SecurityConfig |
| `anyRequest` | それ以外すべての注文 | SecurityConfig 54 |
| `insert` | 挿入する（DB に登録する） | Mapper |
| `delete` | 削除する | Mapper |
| `count` | 数える | `countFollowers` ほか |
| `require〜` | 〜を必須にする（なければ止める） | `requireExists`、`requireUser` |
| `throw` | 投げる＝エラーにして止める（**確認を見つける目印**） | Service |
| `try` / `catch` | 試す／受け止める（失敗を拾う囲い） | FollowService 39〜44 |
| `RequestMapping` | 住所（共通部分）への対応づけ | Controller |
| `PutMapping` / `DeleteMapping` | その方式で来たら、このメソッドが担当 | Controller |
| `PathVariable` | 住所の中の変数（`{id}`、`{username}`） | Controller |
| `AuthenticationPrincipal` | 認証された本人（札から取った id） | Controller |
| `await` | 返事を待つ | 画面の hook |
| `REFERENCES` | 参照する（外部キー） | V4・V6 |
| `PRIMARY KEY` | 主な鍵（同じ行を 2 つ作らせない） | V4・V6 |
| `NOT NULL` | 空っぽは、ダメ | V4・V6 |
| `CHECK` | 条件を調べる | V6 |
| `ON CONFLICT DO NOTHING` | 重なったら、何もしない（エラーにしない） | Mapper の SQL |
| `CASCADE` | 連鎖（元が消えたら、一緒に消す） | V4・V6 |

## 5. 今日の発見
### 発見 1：`FollowUser` と `followUser` は、別の物（大文字と小文字）
| | 文字 | 正体 | 見分け方 |
|---|---|---|---|
| `FollowUser` | F が大文字 | **型**（名詞。人の入れ物の名前） | `target: FollowUser`（useFollowToggle.ts 17 行） |
| `followUser` | f が小文字 | **関数**（動詞。「フォローする」という動き） | `followUser(...)`（同 23 行） |

**「名詞は大文字、動詞は小文字」**（[ノート 22](22-review-e.md) の決まり）。見た目はほぼ同じだが、機械は文字を見る。

### 発見 2：`posts` と `POST` は、別の物
`posts` は住所の中の**名前**。`POST` は**方式**。方式は、`@〇〇Mapping` を見る。

### 発見 3：ルール表は「住所＋方式」で当てはめ、上から順（SecurityConfig）
- 40〜41 行は、1 つの文（長いので、改行しているだけ。`;` まで続く）。「GET で `/api/posts/following` か `…/new-count` に来たらログイン必須」。`{id}`（45 行）に `following` が当てはまる穴を、先に書いて防ぐ（[ノート 27](27-following-timeline-api.md)）。
- `authenticated()` は 2 か所：40〜41 行（「フォロー中」だけ）と、54 行（それ以外すべて）。**フォローは、54 行**。
- 49〜50 行の `permitAll` は **GET だけ**。`GET /api/users/alice`（プロフィールを見る）は 49〜50 行、`PUT /api/users/alice`（編集）は GET に当てはまらず 54 行。**住所が同じでも、方式が違えば、別のルール。**

### 発見 4：主キー・外部キー・`NOT NULL` は、別のルール
`post_id BIGINT NOT NULL REFERENCES posts (id) ON DELETE CASCADE`（V4 の 6 行目）で、3 つが並ぶ。

| ルール | 断る物 |
|---|---|
| `NOT NULL` | 値が空っぽの行（`99999` は、空っぽではない） |
| `REFERENCES`（外部キー） | 値は入っているが、**存在しない相手**を指す行（`99999` は、ここで断られる） |
| `PRIMARY KEY (post_id, user_id)` | 同じ組み合わせの行（二重のいいね） |

`post_id` は、主キーの一部であり、外部キーでもある（2 つの役割）。

**外部キーと JOIN は別：** 外部キーは、表を作るときの約束で、**書き込むとき**に断る。JOIN は、**読むとき**に、2 つの表をつないで取り出す SQL。

### 発見 5：確認は、`throw` を目印に探す
フォローの確認は 3 個（相手がいるか／自分自身か／確認のあとに相手が消えた）。`requireUser(...)` のように、**呼んでいるだけ**に見える行も、中に `throw` がある。`try` は確認ではなく、DB が断った結果を受け止める囲い。

### 発見 6：API と Controller、DTO の位置づけ
API は、**約束事**（住所・方式・データの形）。その住所で受け付けて動く係が、Controller。DTO は、**返事を、お客様に出す形に整えた、お盆の上の料理**（`LikeResponse`・`FollowResponse`）。いいね・フォローの注文には、送る料理がないので、**注文側の DTO はない**（「料理がなかったら、ネコ型ロボットは要らない」）。

## 6. もう一度聞く問題（間を空けて）
1. 「`FollowUser` と `followUser` は、何が違うか」（大文字・小文字、型と関数）
2. 「`PUT /api/users/alice` が、どのルールに当てはまるか。なぜ、GET と違うのか」（SecurityConfig の何行目か）
3. 「主キー・外部キー・`NOT NULL` は、それぞれ、何を断るか」（V4 の 6・9 行目で）
4. 「外部キーと JOIN は、何が違うか」
5. 「Service の中で、確認を見つける目印は何か」（`throw`、`require〜`）
6. 「なぜ、いいねの `{id}` は `Long`、フォローの `{username}` は `String` か」（誰を、何で、指しているか）
7. 「コメントの道すじを、地図の形で書いてみる」（ファイルと行、英単語）
