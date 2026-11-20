-- フォロー（docs/database-design.md 2.5）。「どのユーザーが、どのユーザーをフォローしているか」の組を、1 行で持つ。
-- 主キーが (follower_id, followee_id) なので、同じ組の二重のフォローは、DB が止める。
-- CHECK で、自分自身のフォローは、DB でも止める（アプリの確認をすり抜けても、行は作れない）。
-- ユーザーが消えたら、その人が関わるフォローも、一緒に消える。
CREATE TABLE follows (
    follower_id BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    followee_id BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id),
    CONSTRAINT follows_not_self CHECK (follower_id <> followee_id)
);

-- 主キーの索引は「自分がフォローしている人」の検索に効く。
-- 「自分をフォローしている人（フォロワー）」の数え・一覧には、followee_id の索引が要る
CREATE INDEX idx_follows_followee_id ON follows (followee_id);
