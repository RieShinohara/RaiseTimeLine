package com.example.raisetimeline.post;

import java.time.Instant;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// 投稿 API の、入力と出力の形（docs/features/02-post.md、04-timeline.md）
public final class PostDtos {

	private PostDtos() {
	}

	// 投稿・編集の入力。空は不可、280 文字まで
	public record PostRequest(
			@NotBlank(message = "本文を入力してください")
			@Size(max = 280, message = "本文は 280 文字までです")
			String body) {
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

	// hasNext：このあとにも、続きがあるか（無限スクロールで、読み込みを続けるかの判断）
	public record PostPageResponse(List<PostResponse> posts, int page, int size, boolean hasNext) {
	}

	public record NewCountResponse(long count) {
	}

}
