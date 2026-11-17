package com.example.raisetimeline.post;

import java.time.Instant;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// 投稿 API の、入力と出力の形（docs/features/02-post.md、04-timeline.md）
public final class PostDtos {

	private PostDtos() {
	}

	// 投稿・編集の入力。空は不可、280 文字まで。本文の前後の空白は、取ってから検査・保存する（B9）。
	// 検査（@NotBlank・@Size）は、このコンストラクタのあとに行われるので、取った後の文字数で数える
	public record PostRequest(
			@NotBlank(message = "本文を入力してください")
			@Size(max = 280, message = "本文は 280 文字までです")
			String body) {

		public PostRequest {
			// strip() は、全角の空白も取る（trim() は、半角の空白と制御文字だけ）
			body = body == null ? null : body.strip();
		}

	}

	// 投稿者。メールアドレスは、他の人に見せない（入れない）
	public record AuthorResponse(Long id, String username, String displayName) {
	}

	// updatedAt が空でなければ、「編集済み」（POST-1）
	public record PostResponse(Long id, String body, Instant createdAt, Instant updatedAt, AuthorResponse author) {

		static PostResponse from(Post post) {
			return new PostResponse(post.getId(), post.getBody(), post.getCreatedAt(), post.getUpdatedAt(),
					new AuthorResponse(post.getUserId(), post.getUsername(), post.getDisplayName()));
		}

	}

	// hasNext：このあとにも、続き（もっと古い投稿）があるか（無限スクロールで、読み込みを続けるかの判断）
	public record PostPageResponse(List<PostResponse> posts, boolean hasNext) {
	}

	public record NewCountResponse(long count) {
	}

}
