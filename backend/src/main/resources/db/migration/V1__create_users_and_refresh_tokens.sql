-- ユーザー（docs/database-design.md 2.1）
CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL,
    username      VARCHAR(30)  NOT NULL,
    display_name  VARCHAR(50)  NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    icon_key      VARCHAR(255),
    bio           VARCHAR(160),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- メールアドレスは、小文字にそろえて保存する（大文字小文字は区別しない）
CREATE UNIQUE INDEX uq_users_email ON users (email);
-- ユーザー名は、大文字小文字を区別せずに重複を防ぐ。検索・重複の確認も速くなる
CREATE UNIQUE INDEX uq_users_username ON users (lower(username));

-- リフレッシュトークン（docs/database-design.md 2.6）
CREATE TABLE refresh_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token      VARCHAR(36) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_refresh_tokens_token ON refresh_tokens (token);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
