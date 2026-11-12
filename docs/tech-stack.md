# 技術スタック

講義の内容に従う。**1本目（TaskManagement）と同じ技術で、バージョンも同じ**（講義の指示。2026-11-12）。下の版は、TaskManagement で確かめた版（`TaskManagement/docs/tech-stack.md`）。**環境構築の時点で、動くことを確かめて、確定する。**

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
| DB への接続 | Spring Data JPA ＋ PostgreSQL ドライバ | |
| DB の構造の管理 | Flyway | `ddl-auto` は `validate` |
| 画面 | React 19.3.1 ＋ TypeScript 7.0.2 | |
| 画面のビルド | Vite 8.3.4 | |
| スタイル | Tailwind CSS 4.3.3 | |
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
- 認証（ログイン）の方式、パスワードの扱い
- 画像のアップロードと S3（保存先、公開・非公開、サイズ・種類の制限）
- ロードバランサー（費用が大きい。使う範囲）
