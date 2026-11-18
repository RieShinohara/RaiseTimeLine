-- コメントと返信（docs/database-design.md 2.3）。返信は、parent_comment_id に「返信先のコメント」を入れる（1 段だけ）。
-- 投稿・ユーザー・返信先のコメントが消えたら、コメント・返信も一緒に消える（POST-2、CMT-1c）。
CREATE TABLE comments (
    id                BIGSERIAL    PRIMARY KEY,
    post_id           BIGINT       NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    user_id           BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    parent_comment_id BIGINT       REFERENCES comments (id) ON DELETE CASCADE,
    body              VARCHAR(280) NOT NULL,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 「投稿ごとのコメント一覧」と「投稿ごとの数え」を速くする
CREATE INDEX idx_comments_post_id ON comments (post_id);
-- 親を消すとき、返信を探す（連鎖して消す）のを速くする
CREATE INDEX idx_comments_parent_comment_id ON comments (parent_comment_id);
CREATE INDEX idx_comments_user_id ON comments (user_id);
