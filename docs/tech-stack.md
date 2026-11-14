# 技術スタック

講義の内容に従う。**1本目（TaskManagement）と同じ技術で、バージョンも同じ**（講義の指示。2026-11-12）。ただし、**UI の部品だけは、Tailwind CSS をやめて、Material UI にする**（2026-11-14 ユーザーが決定。下の「4」）。下の版は、TaskManagement で確かめた版（`TaskManagement/docs/tech-stack.md`）。**環境構築の時点で、動くことを確かめて、確定する。**

## 1. 決まっている条件
- 複数のユーザーが使う SNS アプリ（ログイン・ユーザー登録あり）
- 画像の保存先は AWS S3 などのクラウド
- インフラ（予定。変わるかもしれない）：AWS の EC2・RDS・ロードバランサー・S3
- 動作環境：Windows、Chrome ブラウザ（開発）

## 2. 技術（TaskManagement と同じ）
| 部分 | 技術・版 | 備考 |
|---|---|---|
| バックエンド | Java 25（LTS）＋ Spring Boot 4.1.1 | |
| ビルド（サーバー側） | Gradle 9.8.1（Gradle Wrapper） | |
| DB | PostgreSQL 18（開発は Docker） | |
| DB への接続 | **MyBatis**（`mybatis-spring-boot-starter`）＋ PostgreSQL ドライバ | TaskManagement の Spring Data JPA からの変更（2026-11-14 ユーザー決定。講義にそろえ、SQL を自分で書く経験をする）。**版は、環境構築のとき、Spring Boot 4.1.1 との組み合わせを確かめて決める** |
| 認証 | **Spring Security ＋ JWT**（`jjwt`）。パスワードは BCrypt | 2026-11-14 決定（[01 認証](features/01-auth.md) 3.5）。JWT の署名の鍵は、リポジトリに入れない |
| DB の構造の管理 | Flyway | `ddl-auto` は `validate` |
| 画面 | React 19.3.1 ＋ TypeScript 7.0.2 | |
| 画面のビルド | Vite 8.3.4 | |
| UI の部品・見た目 | **Material UI**（`@mui/material`） | TaskManagement の Tailwind CSS からの変更。**版は、環境構築のとき、React・TypeScript との組み合わせを確かめて決める**（先生は 7） |
| 画面のテスト | Vitest 5.0.4 | |
| Node.js | 24 LTS（24.22.1） | |
| 画面側の静的チェック・整形 | oxlint・Prettier 3.9.10 | |
| サーバー側の静的チェック | Checkstyle・SpotBugs・JaCoCo | |
| テスト | JUnit ＋ Testcontainers（サーバー側）、Vitest（画面側） | |
| API 形式 | REST API | |
| CI | GitHub Actions（Ubuntu 24.04 に固定） | |
| IaC | Terraform ＋ AWS | |
| バージョン管理 | Git ＋ GitHub | |

## 3. 今回、新しく出てくるもの（要件定義で決める）
- 認証（ログイン）の方式、パスワードの扱い（**決定済み**：JWT ＋ Spring Security、BCrypt。上の表）
- 画像のアップロードと S3（保存先、公開・非公開、サイズ・種類の制限）
- ロードバランサー（費用が大きい。使う範囲）

## 4. 講義の先生の構成との違い（2026-11-14。ユーザーがスクリーンショットで確認）
先生の技術スタックは、次のとおり。**私たちは、UI の部品を先生にそろえ、ほかの版は、TaskManagement のままにする**（ユーザー決定）。

| 項目 | 先生 | 私たち | 決めた方針 |
|---|---|---|---|
| UI の部品 | Material UI 7 | Material UI（版は環境構築で確定） | **先生にそろえる**。Tailwind CSS は、使わない（Material UI と役割が重なり、設定の衝突が起きやすいため） |
| React | 19.2.x | 19.3.1 | TaskManagement のまま |
| TypeScript | 5.9.x | 7.0.2 | TaskManagement のまま |
| Vite | 7.3.x | 8.3.4 | TaskManagement のまま |
| Spring Boot | 4.0.3 | 4.1.1 | TaskManagement のまま |
| Gradle | 9.3.1 | 9.8.1 | TaskManagement のまま |
| PostgreSQL | 17 | 18 | TaskManagement のまま |
| Java | 25 | 25 | 同じ |
| DB への接続 | MyBatis | MyBatis（版は環境構築で確定） | **先生にそろえる**（2026-11-14 ユーザー決定。1本目の Spring Data JPA からの変更。先生は、最初 jOOQ を計画し、MyBatis に変えた） |
| 配置 | AWS（EC2・RDS・ALB・S3）、Terraform、Nginx、systemd | 同じ種類 | 同じ |

- **版を新しいまま使う理由**：1本目・2本目で、動かした実績がある。ただし、講義の画面と、細かい所で違いが出ることがある（エラーのときは、版の違いを疑う。メンターには、使っている版を伝える）
- **Material UI の版**：Material UI は、React・TypeScript の版と、組み合わせの相性がある。環境構築のとき、動くことを確かめて決め、この文書を更新する
- Material UI は、1本目の Tailwind CSS の代わり。2本目（BizRequestTracker）で使った Vuetify と、同じ種類（Material Design の部品集）の、React 版
