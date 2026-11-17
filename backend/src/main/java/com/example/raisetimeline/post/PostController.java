package com.example.raisetimeline.post;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.example.raisetimeline.post.PostDtos.NewCountResponse;
import com.example.raisetimeline.post.PostDtos.PostPageResponse;
import com.example.raisetimeline.post.PostDtos.PostRequest;
import com.example.raisetimeline.post.PostDtos.PostResponse;

import jakarta.validation.Valid;

// @AuthenticationPrincipal Long userId は、アクセストークンの持ち主の ID。ログインしていなければ null
@RestController
@RequestMapping("/api/posts")
public class PostController {

	private final PostService postService;

	public PostController(PostService postService) {
		this.postService = postService;
	}

	// タイムライン（新しい順）。ログインなしで見られる（TL-3）
	@GetMapping
	// before：この投稿 id より古いものを返す（省略なら最新から）
	public PostPageResponse list(@RequestParam(required = false) Long before,
			@RequestParam(defaultValue = "20") int size) {
		return postService.list(before, size);
	}

	// after（投稿 id）より新しい投稿の件数（30 秒ごとの確認用）。投稿が 1 件もないときは、after=0
	@GetMapping("/new-count")
	public NewCountResponse newCount(@RequestParam long after, @AuthenticationPrincipal Long userId) {
		return postService.newCount(after, userId);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public PostResponse create(@Valid @RequestBody PostRequest request, @AuthenticationPrincipal Long userId) {
		return postService.create(userId, request.body());
	}

	@PutMapping("/{id}")
	public PostResponse update(@PathVariable Long id, @Valid @RequestBody PostRequest request,
			@AuthenticationPrincipal Long userId) {
		return postService.update(userId, id, request.body());
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@PathVariable Long id, @AuthenticationPrincipal Long userId) {
		postService.delete(userId, id);
	}

}
