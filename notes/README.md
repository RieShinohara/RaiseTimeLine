# 学習ノート

AIエンジニア養成コースの学習記録です。Claude Code と一緒に、SNS アプリ（RaiseTimeLine）を作る中で学んだことを、あとから見返せるようにまとめています。
1本目（タスク管理アプリ）と同じ技術（Java + Spring Boot + PostgreSQL + React）で作ります。

| ノート | 内容 |
|---|---|
| [01-auth-basics.md](01-auth-basics.md) | 認証の基礎：トークン、JWT、セッション方式との違い、CSRF・XSS・CORS、札の保存場所 |
| [02-future-feature-ideas.md](02-future-feature-ideas.md) | 将来の機能のアイデア：絵文字（手間、文字数の数え方の落とし穴、次のアプリで決めること） |
| [03-auth-implementation.md](03-auth-implementation.md) | 認証の実装：ファイルの役割（レストランのたとえ）、ログインの流れ、AuthService の読み方、札の自動更新、つまずき |
| [04-quality-check-1.md](04-quality-check-1.md) | 品質チェック（1回目）：道具と読んで確かめること、「部品だけあって使われていないコード」、文字数とバイト数、応答時間の差 |
| [05-posts-api.md](05-posts-api.md) | 投稿の API：API 設計の表の読み方、状態コード（401 と 403）、N+1 を避ける JOIN、ページ番号方式の弱点、日時の細かさ |
| [06-timeline-frontend.md](06-timeline-frontend.md) | タイムラインの画面：無限スクロール（IntersectionObserver）、フック、続きの目印（id 方式）、モーダルの作り |
| [07-quality-check-2.md](07-quality-check-2.md) | 品質チェック（2回目）：確認と実行の間の競合、動かして確かめる、ボタンの名前と読み上げ、N+1 の予行 |
| [08-review-a.md](08-review-a.md) | 復習 A（問題と自分の答え）：全体の地図、画面と DB の間にサーバーを置く理由、画面とサーバーの二重チェック、JWT の署名、札の自動更新 |
| [09-review-c.md](09-review-c.md) | 復習 C：id・user_id・SQL の基本（表の見方）、`#{}` と SQL インジェクション、N+1（1 + N）の入口、更新の「隙間」（B8） |
| [10-review-d.md](10-review-d.md) | 復習 D：品質チェックの道具の役割（Checkstyle・SpotBugs・oxlint・Prettier・tsc・テスト・ArchUnit・CI）、3 枚の網、curl の読み方、401 と 403 |
| [11-likes-api-n-plus-one.md](11-likes-api-n-plus-one.md) | いいねの API と N+1 問題：「41 回」を「3 回」にする、GROUP BY と IN、SQL の回数をテストで数える、二重のいいねを防ぐ（主キーの組み合わせ） |
| [12-review-b.md](12-review-b.md) | 復習 B：パスワードのハッシュ（BCrypt・塩）、ログイン失敗の文言（ユーザー列挙の防止）、CORS は「利用者を守る」ブラウザの決まり、Cookie と CSRF、curl は誰でも使える普通の道具、XSS と React の書き方、攻撃の種類と守る場所の表 |
| [13-likes-frontend.md](13-likes-frontend.md) | いいねの画面：結果を待ってから変える、一覧を読むときにも札が要る、二重に送らない（useRef の印）、押した状態を色だけで伝えない、テストの想定のずれ |
| [14-comments-api.md](14-comments-api.md) | コメントの API：自分の表を指す（返信）、`ON DELETE CASCADE` で連鎖して消す、入れ子は 1 回の SQL、削除の権限（401・403・404）、N+1 の予想と結果 |
| [15-comments-frontend.md](15-comments-frontend.md) | コメントの画面：URL の引数（useParams）、書いたあとは一覧を読み直す、入力欄の使い回し、画面の権限と本当の権限、つまずき |
| [16-quality-check-3.md](16-quality-check-3.md) | 品質チェック（3回目）：読んだことと動かして確かめたことの区別、認可を curl で確かめる（403 は 3 人目が要る）、「見えない」と「消えた」の違い、起動ログの警告、確かめる→する の隙間、見出しの中にボタンを入れない |
| [17-backend-qc3-fixes.md](17-backend-qc3-fixes.md) | 品質チェック 3 回目の指摘を直す（バックエンド）：直す前にテストを失敗させる、確かめるとするの隙間を DB の制約が止める、エラーの形を 1 か所でそろえる、使わない部品でも定義しないと Spring が勝手に作る |
