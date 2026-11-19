# 起動・停止の手順書

RaiseTimeLine を、自分の PC で動かすための手順です。コマンドは **PowerShell** で打ちます（Git Bash だと、画面のテストが失敗することがあるため）。

## 1. 全体の見取り図

アプリは **3 つの部品** で動いています。部品どうしは、次の順番で頼り合っているので、**起動は、下から順番**です。

| 順番 | 部品 | 役割 | ポート |
|---|---|---|---|
| ① | DB（PostgreSQL。Docker の中） | データをしまう倉庫 | 5432 |
| ② | バックエンド（Spring Boot） | 画面と DB の間の窓口 | 8080 |
| ③ | 画面（React。Vite） | ブラウザに表示される部分 | 5173 |

**止めるときは、逆の順番**（③ → ② → ①）です。

## 2. 最初の 1 回だけ：`.env` を作る

`.env` は、パスワードなどの秘密を書くファイルです。**Git には入りません**（公開されません）。

1. リポジトリ直下（`RaiseTimeLine/`）で、`.env.example` をコピーして、`.env` という名前にする。
   ```powershell
   Copy-Item .env.example .env
   ```
2. `.env` を開いて、`...` の所を書き換える。
   - `POSTGRES_PASSWORD`：好きなパスワード（ローカル専用）
   - `JWT_SECRET`：32 文字以上のランダムな文字列（ログインの札に署名する鍵）

`.env` を作ってあれば、この手順は、もう要りません。

## 3. 起動する

**ターミナルが 2 つ要ります。** バックエンドと画面は、起動したら動き続けるので、1 つのターミナルでは、次のコマンドが打てないためです（VS Code なら、ターミナルの `+` で増やせます）。

| 順番 | やること | コマンド | どこで打つか | 成功の目印 |
|---|---|---|---|---|
| ① | **Docker Desktop を起動**する（先に。タスクバーのクジラが落ち着くまで待つ） | （アプリを開く） | — | — |
| ① | DB を起動 | `docker compose up -d` | リポジトリ直下 | `raisetimeline-db` が Started / Healthy |
| ② | バックエンドを起動（**ターミナル 1**） | `.\gradlew.bat bootRun` | `backend/` | ログに `Started ...Application` が出る |
| ③ | 画面を起動（**ターミナル 2**） | `npm.cmd run dev` | `frontend/` | `http://localhost:5173/` と出る |

場所の移動は `cd` で行います。

```powershell
cd backend        # リポジトリ直下から backend へ
cd ..             # 1 つ上のフォルダへ戻る
cd frontend       # リポジトリ直下から frontend へ
```

### 今どこにいるか分からなくなったら

PowerShell の左の表示（`PS C:\...\RaiseTimeLine\frontend>`）の**末尾が、今いるフォルダ**です。コマンドを打つ前に、ここを見ます。

| やりたいこと | コマンド |
|---|---|
| 今いる場所を見る | `pwd` |
| 1 つ上へ戻る | `cd ..` |
| 2 つ上へ戻る | `cd ..\..`（`..` をつなげる） |
| **道のりを指定して、一発で戻る**（迷ったら、これが確実） | `cd C:\CursorProject\AI_Engineer_Course\RaiseTimeLine` |
| リポジトリの一番上へ戻る（どこにいても使える） | `cd (git rev-parse --show-toplevel)` |

たとえると、`cd ..` は「エレベーターで 1 階上へ」、道のりの指定は「住所を言って、タクシーで直接行く」です。

### 動いているかの確認

- バックエンド：ブラウザで `http://localhost:8080/actuator/health` を開き、`{"status":"UP"}` と出ればOK。
- 画面：ブラウザで `http://localhost:5173` を開く。

### コマンドの略語の意味

意味が分かると、覚えやすくなります。

| コマンド | 元の英語 | 意味 |
|---|---|---|
| `cd` | **c**hange **d**irectory | ディレクトリ（フォルダ）を変える |
| `pwd` | **p**rint **w**orking **d**irectory | 作業中のディレクトリ（今いる場所）を表示する |
| `ls` | **l**i**s**t | 中身を一覧する（PowerShell では `dir` も同じ） |
| `docker compose up -d` | up（立ち上げる）、`-d` は **d**etached（切り離して裏で動かす） | DB を起動する。`-d` を付けないと、ログが流れ続けて、次のコマンドが打てない |
| `docker compose down` | down（降ろす） | 止めて、片付ける |

## 4. 止める

| 順番 | 部品 | 止め方 |
|---|---|---|
| ③ | 画面 | ターミナル 2 で `Ctrl + C` |
| ② | バックエンド | ターミナル 1 で `Ctrl + C` |
| ① | DB | リポジトリ直下で `docker compose down` |

- 画面を止めるとき、「バッチ ジョブを終了しますか (Y/N)?」と聞かれたら、`Y` を押して Enter（`npm.cmd` を止めるときの Windows の確認。正常）。
- `docker compose down` では、**データは残ります**（次に起動すると、続きから使えます）。
- ⚠ `docker compose down -v` は、**データも全部消えます**。消してよいときだけ使う。
- 終わったら、Docker Desktop も閉じて構いません。

## 5. うまくいかないとき

| 症状 | 原因と対処 |
|---|---|
| `npm` を打つと、赤い「セキュリティ」のエラーが出る | PowerShell の安全設定で止められている。**`npm.cmd`** と打つ（`npm.cmd run dev`、`npm.cmd test`） |
| `Port ... already in use`・`EADDRINUSE`（ポートが使用中） | 前回の起動が残っている。**別のポートで起動しない**。スキル [dev-port-conflict](../.claude/skills/dev-port-conflict/SKILL.md) の手順で、使っている物を確かめてから止める（Docker など、無関係な物は、勝手に止めない） |
| `docker compose up -d` が失敗する | Docker Desktop が起動していない。起動して、待ってから、もう一度 |
| バックエンドが、DB につなげないというエラーで落ちる | DB（①）が起動していない、または `.env` のパスワードが違う。`docker compose ps` で DB の状態を見る |
| `java`・`node` が見つからない | インストール直後は、シェルが知らない。**ターミナルを開き直す** |
| 画面のテスト（`npm.cmd test`）が失敗する | Git Bash ではなく、PowerShell で打つ |

## 6. テストなどを動かす（起動とは別）

| やりたいこと | コマンド | どこで |
|---|---|---|
| バックエンドのテスト＋静的チェック | `.\gradlew.bat check`（Docker Desktop が必要） | `backend/` |
| 画面のテスト／静的チェック／整形の確認／ビルド | `npm.cmd test` ／ `npm.cmd run lint` ／ `npm.cmd run format:check` ／ `npm.cmd run build` | `frontend/` |

## 関連

- ポート・コマンドの一覧（開発のルール側）：[CLAUDE.md](../CLAUDE.md) の 5
- 使っている技術：[技術スタック](tech-stack.md)
