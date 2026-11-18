package com.example.raisetimeline.comment;

import java.time.Instant;
import java.util.List;

import com.example.raisetimeline.post.PostDtos.AuthorResponse;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// コメント API の、入力と出力の形（docs/features/05-comment.md）
public final class CommentDtos {

	private CommentDtos() {
	}

	// コメント・返信の入力。parentCommentId が入っていれば返信。空は不可、280 文字まで（CMT-2）。
	// 前後の空白は、取ってから検査・保存する（投稿と同じ）
	public record CommentRequest(
			@NotBlank(message = "本文を入力してください")
			@Size(max = 280, message = "本文は 280 文字までです")
			String body,
			Long parentCommentId) {

		public CommentRequest {
			body = body == null ? null : body.strip();
		}

	}

	// 返信（1 段だけなので、replies は持たない）
	public record ReplyResponse(Long id, String body, Instant createdAt, AuthorResponse author) {

		static ReplyResponse from(Comment c) {
			return new ReplyResponse(c.getId(), c.getBody(), c.getCreatedAt(),
					new AuthorResponse(c.getUserId(), c.getUsername(), c.getDisplayName()));
		}

	}

	// コメント。返信は、古い順
	public record CommentResponse(Long id, String body, Instant createdAt, AuthorResponse author,
			List<ReplyResponse> replies) {

		static CommentResponse from(Comment c, List<ReplyResponse> replies) {
			return new CommentResponse(c.getId(), c.getBody(), c.getCreatedAt(),
					new AuthorResponse(c.getUserId(), c.getUsername(), c.getDisplayName()), replies);
		}

	}

	// コメント一覧。commentCount は、返信を含む合計
	public record CommentListResponse(List<CommentResponse> comments, long commentCount) {
	}

}
