-- 続きの指定を、日時でなく投稿の id（主キー。もとから索引つき）にしたので、日時の索引は使わない
DROP INDEX idx_posts_created_at;
