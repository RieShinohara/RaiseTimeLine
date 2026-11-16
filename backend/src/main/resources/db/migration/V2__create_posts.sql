-- 投稿（docs/database-design.md 2.2）。画像の列（image_key）は、画像の機能のときに足す
CREATE TABLE posts (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    body       VARCHAR(280)  NOT NULL,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
    -- 編集していなければ空。入っていれば「編集済み」と表示する（POST-1）
    updated_at TIMESTAMPTZ
);

-- タイムライン（新しい順）と、新着の件数（ある日時より新しいもの）を速くする
CREATE INDEX idx_posts_created_at ON posts (created_at DESC, id DESC);
CREATE INDEX idx_posts_user_id ON posts (user_id);
