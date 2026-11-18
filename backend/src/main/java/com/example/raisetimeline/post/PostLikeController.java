package com.example.raisetimeline.post;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.raisetimeline.post.PostDtos.LikeResponse;

// いいね。ログインが必要（SecurityConfig の「それ以外はログイン必須」）
@RestController
@RequestMapping("/api/posts/{id}/like")
public class PostLikeController {

	private final PostLikeService postLikeService;

	public PostLikeController(PostLikeService postLikeService) {
		this.postLikeService = postLikeService;
	}

	@PutMapping
	public LikeResponse like(@PathVariable Long id, @AuthenticationPrincipal Long userId) {
		return postLikeService.like(userId, id);
	}

	@DeleteMapping
	public LikeResponse unlike(@PathVariable Long id, @AuthenticationPrincipal Long userId) {
		return postLikeService.unlike(userId, id);
	}

}
