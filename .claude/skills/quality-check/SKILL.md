---
name: quality-check
description: このプロジェクトの品質チェックの手順。ユーザーが「品質チェック」「全体の点検」「コードレビューして」「標準から外れていないか見て」「lint を足して」「文書と実装のずれを直して」などと言ったとき、または大きな機能がそろった節目に点検するときは、必ずこのスキルを使うこと。バックエンド（Spring Boot・MyBatis・Spring Security・JWT）、フロントエンド（React・Material UI）、画像（S3）、Terraform（terraform/。AWS の構成。できたら）、文書（docs/・README）を、読んで点検し、静的チェック（oxlint、Prettier、Checkstyle、SpotBugs、JaCoCo、terraform fmt・validate、tflint、trivy）を実行して、結果を docs/quality-review.md に記録する。「Terraform の点検」「インフラのチェック」「セキュリティの弱点を探して」と言われたときも使う。指摘を見つけたら、点検の PR では直さず、記録して、ユーザーに優先度を決めてもらう。
---

# 品質チェックの手順

## 目的と原則
機能が「動く」だけでなく、「標準的な作りで、安全で、文書と合っている」ことを確かめる。**このアプリ（RaiseTimeLine）では、まだ一度も点検していない**（2026-11-15 時点）。最初の点検は、認証と投稿など、いくつかの機能がそろった節目に行い、結果を `docs/quality-review.md` に**新しく作る**（まだ、このファイルはない）。
進め方の見本は、TaskManagement の記録：`C:\CursorProject\AI_Engineer_Course\TaskManagement\docs\quality-review.md`（結果の例）と、`...\TaskManagement\notes\07-quality-check.md`（学び）、`...\notes\08-aws-terraform-guide.md` の 10.6（Terraform の点検）。**読んでよいが、書き換えない。**

守ること：
- **CLAUDE.md の GitHub 運用ルールに従う。** 先に Issue を作り、ブランチ（`gh issue develop`）、コミット、PR の順。main に直接触らない。マージはユーザーが行う
- **点検の PR では、動作を変えるコードの修正をしない。** 指摘は `docs/quality-review.md` に記録し、直すかどうかと優先度は、ユーザーが決める。直すときは、別の Issue・PR にする（機能は、API → 画面の順）
- **どちらが正しいかは、ユーザーが決める。** 文書と実装がずれていたら、基本は、実装を正にして文書を直す。ただし、ユーザーが「設計書が正」と言ったものは、文書を直さず、実装を直す別の Issue を作る。仕様を変えるときは、先にユーザーに確認する（CLAUDE.md 第6章）
- **読んで見つけたことと、動かして確かめたことを、区別して書く。** 再現していない指摘を、確認済みのように書かない
- ユーザーは初学者。結果は日本語で、専門用語をかみ砕いて説明する
- **公開リポジトリ**なので、点検の記録にも、秘密・IP・アカウント ID・実在の名前を書かない（CLAUDE.md 4）

## 手順

### 0. 計画する（プランモードのとき）
点検の範囲、進め方、PR の分け方（既定は **1 Issue・1 PR**、コミットは領域別）を、先にユーザーに見せて、承認をもらう。まだできていない領域（Terraform など）は、範囲に入れない。

### 1. 現状を調べる（読み取りのみ。3 方面を並行してよい）
大きな点検では、Explore エージェントを、方面ごとに 1 つ（最大 3 つ）使うと速い。各エージェントには、「ファイル:行、重大度（高・中・低）、理由、推奨修正」の形で報告させる。**エージェントの報告は、そのまま信じず、重要な指摘は、実コードで確かめてから記録する**（行番号のずれや、見当違いがありうる）。

観点：
- **バックエンド**（`backend/`）：`build.gradle` と静的解析の有無。層の構成（Controller → Service → Mapper）と依存の向き。コンストラクタ注入。`@Transactional` の使い方。例外処理（`@RestControllerAdvice`、`ProblemDetail`）。入力の検査（`@Valid`、[01 認証](../../../docs/features/01-auth.md) の入力条件）。DTO と、DB の行を表すクラスの分離。HTTP ステータスと REST の設計。`application.yml`（秘密情報が入っていないか）。スキーマの管理（Flyway。`db/migration` の SQL と [データ設計](../../../docs/database-design.md) が合うか）。
  - **MyBatis**：SQL の値の埋め込みは `#{}`（安全）を使い、**`${}`（文字列の埋め込み。SQL インジェクションの原因）を使っていないか**。N+1（一覧で、1 件ごとに追加の SQL が走る）、索引、ページングの条件、`map-underscore-to-camel-case` の前提
  - **認証・認可**（Spring Security・JWT）：署名の鍵がリポジトリに入っていないか（環境変数など）。アクセストークン 15 分・リフレッシュトークン 7 日（UUID を DB に保存。ログアウトで revoked）が文書どおりか。BCrypt。CSRF 無効の理由と、CORS の許可先。**「ログインした本人だけが、自分の投稿・コメントを編集・削除できる」をサーバー側で拒否しているか**。見るだけの API は、ログインなしで使え、**どの API の応答にも、メールアドレスが含まれていない**か。リフレッシュトークンの値が、ログに出ていないか。ログインの失敗の対策は、仮決めで「作らない」（AUTH-5）
  - **画像（S3）**：種類・サイズの確認を、サーバー側で、**拡張子だけでなく中身でも**行っているか（IMG-3）。ファイル名が UUID か（IMG-1）。バックエンド経由で保存しているか（IMG-4）。差し替え・削除のとき、新しい保存が成功してから、古い画像を消しているか（IMG-5）。投稿の削除で、画像も消えるか（POST-2）。S3 の認証が、IAM ロール（アクセスキーを置かない）か。テストの画像を、テストコードの中で作っているか
  - テストの構成と、分離（Testcontainers）
- **フロントエンド**（`frontend/`）：lint の設定（`.oxlintrc.json`）。`tsconfig` の `strict`。コンポーネントの分割。`useEffect` の依存と不要な使用。状態管理、連続操作の競合。API 層（エラー処理、`AbortSignal`、型の検証）。アクセシビリティ（Material UI の部品のラベル、キーボード操作、`aria-*`）。**XSS**（`dangerouslySetInnerHTML`。JWT を localStorage に置く方式なので、XSS が最大の弱点になる。AUTH-9）。トークンの扱い：期限切れ時の自動更新（リフレッシュ）、ログアウトで 2 つの札を消すこと、更新に失敗したときの動き。**ログインなしで見るだけ**の画面と、「フォロー中」などログインが要る画面の出し分け。ファイル入力の検査（種類・サイズ。画面側は便宜で、本当の確認はサーバー）。テストの網羅性
- **インフラ**（`terraform/`、`deploy/`。**まだできていない。できたら**）：[インフラ構成](../../../docs/infrastructure.md) の決定と合っているか。**入口（ingress）に `0.0.0.0/0` があるのは、ALB の 80 番だけ**（それ以外にあれば高）。RDS が Private Subnet で、公開されていないか。NAT Gateway を作っていないか（X-1）。S3 は、画像用のバケットだけ公開（読むだけ）で、書き込み・削除は IAM ロールだけか。IAM の権限が、必要最小限か。秘密の扱い（`sensitive`、`.gitignore`、`terraform.tfvars` をコミットしていないか）。変数の検証、費用がかかる物（ALB は使い終わったら `destroy`）、タグ、部品の版の固定（`.terraform.lock.hcl`）、コメントが今の状態と合っているか、`user_data` に秘密が入っていないか、`docs/infrastructure.md` とのずれ、CI に点検があるか。**読み取りだけ。`apply` は実行しない**
- **文書**：`docs/`（`requirements.md`、`features.md`、`features/` の 8 つ、`use-cases.md`、`database-design.md`、`non-functional-requirements.md`、`infrastructure.md`、`tech-stack.md`）、`README.md`、`CLAUDE.md`、`notes/`、（あれば）`CREDITS.md` を、実装（`backend/src`、`frontend/src`、設定ファイル）と突き合わせる。API のパスと項目、入力の制約、DB のテーブル、画面の項目と文言、バージョン、コマンド、リンク。**「文書に書いていない実装済みの機能」と、「実装していないのに書いてある機能」の両方**を探す。「仮決め」「暫定」「【未決】」が、実装で確定していないか

### 2. 静的チェックを実行する
**画面のコマンドは、PowerShell で実行する**（Git Bash だと、`npm test` が失敗することがあった。[技術スタック](../../../docs/tech-stack.md) 4）。

| 対象 | コマンド | 場所 |
|---|---|---|
| 画面の lint | `npm run lint`（oxlint。`--deny-warnings` で、警告も失敗） | `frontend/` |
| 画面の整形 | `npm run format:check`（Prettier） | `frontend/` |
| 画面のテスト・ビルド | `npm test` ／ `npm run build` | `frontend/` |
| サーバーのテスト＋静的チェック | `.\gradlew.bat check`（テスト、Checkstyle、SpotBugs、JaCoCo。Docker Desktop が必要） | `backend/` |

- **道具の「成功」を、疑う**（CLAUDE.md 7）。0 件・成功が、空振りでないか、わざと壊して、失敗するかを確かめる。lint が何も表示しないのは、正常（違反がないとき）
- **CI（GitHub Actions）と同じ内容**：backend（`gradlew check`）、frontend（lint・format:check・test・build）。必須チェックは、この 2 つ（CLAUDE.md 3.7）。Terraform のジョブは、できたら足す
- 結果の場所：`backend/build/reports/`（`checkstyle/`、`spotbugs/`、`jacoco/test/html/index.html`）
- Bash で Gradle を動かすときは、`JAVA_HOME` を `C:\Program Files\Eclipse Adoptium\jdk-25*` にする
- ひっかかったものは、(1) 挙動を変えずに直す、(2) 理由を書いて、その行だけ除外する、(3) 規則を外す（理由を記録する）のどれかにする。挙動が変わる直し方は、別の課題にする。除外には、必ず理由を書く（`oxlint-disable-next-line 規則名 -- 理由`、`backend/config/spotbugs/exclude.xml` のコメント）
- 規則を足すときは、まず現状の違反の数と中身を見て、**ゆるい規則から始める**。新しい道具は、Java 25 と Gradle のバージョンで動くか、先に試す
- カバレッジのしきい値（`frontend/vite.config.ts`）は、まだ決めていない（測るだけ）。機能が増えたら、測った数字をもとに決めるか、ユーザーに相談する

**Terraform の点検**（`terraform/` ができたら。AWS には、つながない）：

| 対象 | コマンド | 注意 |
|---|---|---|
| 書式 | `terraform fmt -check ec2.tf main.tf …`（**`.tf` ファイルを指定する**） | **引数なしや `-diff` は、`terraform.tfvars`（自分の IP と DB のパスワード）も対象になり、中身が画面に出る**。使わない |
| 文法 | `terraform validate` | 先に `terraform init` が要る（AWS にはつながない） |
| 書き方（tflint） | Docker で使い捨て：`docker run --rm -v <コピー先>:/data -w /data --entrypoint sh ghcr.io/terraform-linters/tflint:v0.65.0 -c "tflint --init && tflint --format compact"` | 設定は `terraform/.tflint.hcl`。版は CI と合わせる |
| セキュリティ（trivy） | Docker で使い捨て：`docker run --rm -v <コピー先>:/src:ro aquasec/trivy:0.76.1 config --ignorefile /src/.trivyignore /src` | 指摘の一覧だけ見たいときは、`--format json` を、`node` などで要約する |

- **tflint と trivy には、`terraform.tfvars` を渡さない。** `.tf`・`user_data.sh`・`.tflint.hcl`・`.trivyignore`・`.terraform.lock.hcl` だけを、一時フォルダ（スクラッチパッド）にコピーして実行し、終わったら消す。PC には、道具を入れない
- Docker Desktop が起動していること。**Docker に Windows のパスを渡すときは、Git Bash の `$PWD` ではなく `$(pwd -W)`**（`$PWD` だと、空のフォルダを調べて「成功」になる。CLAUDE.md 5）。Bash で Windows のパスを渡すときは、`MSYS_NO_PATHCONV=1` と `cygpath -w` も使う
- **`terraform plan` は、AWS の読み取りと、`my_ip` などの値が要る。** 何も作らないが、使うときは、ユーザーに伝えてから。**`apply` と `destroy` は、点検では実行しない**（CLAUDE.md 第5章）。AWS 上に何もないときの `plan` は、「全部作る」と出るだけで、差分の確認には使えない（その旨を、記録に書く）
- trivy の指摘は、**「この設定が意図したものか」を、設計の前提（学習用の開発環境、使い終わったらすぐ消す。ALB の 80 番だけ `0.0.0.0/0`、HTTP のまま。X-1・X-3）と照らして**判断する。意図したものは、`terraform/.trivyignore` に、理由つきで書く（足すだけで CI は通るので、足す前に、本当に対応しなくてよいかを考える）。意図していない指摘は、直す候補として記録する

### 3. 結果を記録する
`docs/quality-review.md` に、次の形で書く（最初の点検で、ファイルを新しく作る。形は、TaskManagement の記録を参考に）。
- 今回の対応（何を直した・入れたか、動かして確かめたこと）
- 今回は直さないこと：バックエンド（B1…）、フロントエンド（F1…）の表。列は「ID・重大度・場所・指摘・推奨・判断」。判断の欄は、ユーザーが決めるまで空にする
- 良かった点
- 文書と実装のずれ（直したものと、直していないもの）
- Terraform の点検は、**新しい章**として足す（例：「5. Terraform の点検」）。(1) 点検の方法と結果の要約、(2) 道具（trivy）の指摘の表（ID は、道具が付けた ID。「推奨」に、直す／対応しない＋理由）、(3) 読んで見つけたこと（T1…）の表、(4) 良かった点、(5) 点検中に起きたこと（学び）。**直すのは、別の Issue・PR**。小さな指摘は、1つの目的にまとめてよい。CI への追加など、仕組みを変えるものは、別にする

あわせて、`notes/` の学習ノートに学びを追記し（`notes/README.md` の表も更新）、文書を直したら、CLAUDE.md 第6章どおり、同じ PR で README・仕様書をそろえる。

### 4. 文書を直す
- Markdown のリンク切れを、機械的に確認する（`docs/`、`README.md`、`notes/`、`CLAUDE.md`）
- **改行コードに注意**：このリポジトリの Markdown は、CRLF のものがある。複数行を置換するときは、Edit ツールを使う（**Python は、この PC では使えない**。Windows ストアのダミーのため）。PowerShell で、日本語の文書を読み書きすると、**文字化けする**（`Get-Content` の既定の文字コードのため）。書き換えは、Edit・Write ツールで行う
- 書き換えた記述は、実装の該当箇所（ファイル:行）と、もう一度突き合わせる

### 5. PR を作る
- CLAUDE.md 3.5 のとおり：本文に `## 内容`、`## 確認したこと`（画面・サーバー・文書の領域別）、`Closes #番号`、「ユーザーの確認が必要」なこと、`Generated with Claude Code` の行
- 確認したことには、**実行した結果**だけを書く（lint の件数、テストの件数、ビルドの成否、リンク切れの数）。CI は、緑の ✓ だけで安心せず、**ログで、実際に調べたこと**を見る
- 「設計書が正」のものなど、別の課題は、先に Issue を作ってから、PR の本文で触れる

### Terraform の点検の、PR の確認したこと
- `terraform fmt -check`（`.tf` を指定）、`validate`、tflint、trivy の結果（件数）。**CI と同じ版の道具で**確かめる
- 文書の差分に、IP・パスワード・接続先の名前・アカウント ID が入っていないこと
- **確認できていないこと**を、正直に書く（例：AWS 上に何もないので、`plan` で差分を確かめていない）
- CI（`terraform` ジョブ）の結果。このジョブを必須チェックに足すかは、ユーザーの承認が要る（CLAUDE.md の 3.7）。✗ のときは、直してから、ユーザーに確認を頼む

## 次回に向けて
- 前回の記録（`docs/quality-review.md`。最初の点検のあと）の「判断」欄を見て、直すと決めたものが直っているか、先に確かめる
- 直ったものは、記録に「対応済み（PR 番号）」と書く
- 新しい道具の導入は、ユーザーの判断を待つ
