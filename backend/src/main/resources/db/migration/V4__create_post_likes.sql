-- いいね（docs/database-design.md 2.4）。「どの投稿に、どのユーザーが」の組を、1 行で持つ。
-- 主キーが (post_id, user_id) なので、同じ人の二重のいいねは、DB が止める。
-- 投稿やユーザーが消えたら、いいねも一緒に消える（POST-2）。
-- 主キーの索引は「投稿ごとの数え」に効く。「ユーザーごとの検索」用の索引は、プロフィールで必要になったときに足す
CREATE TABLE post_likes (
    post_id    BIGINT      NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, user_id)
);
