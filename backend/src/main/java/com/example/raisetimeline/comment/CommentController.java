package com.example.raisetimeline.comment;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.example.raisetimeline.comment.CommentDtos.CommentListResponse;
import com.example.raisetimeline.comment.CommentDtos.CommentRequest;
import com.example.raisetimeline.comment.CommentDtos.CommentResponse;

import jakarta.validation.Valid;

@RestController
public class CommentController {

	private final CommentService commentService;

	public CommentController(CommentService commentService) {
		this.commentService = commentService;
	}

	// 一覧は、ログインなしで見られる（SecurityConfig）
	@GetMapping("/api/posts/{postId}/comments")
	public CommentListResponse list(@PathVariable Long postId) {
		return commentService.list(postId);
	}

	@PostMapping("/api/posts/{postId}/comments")
	@ResponseStatus(HttpStatus.CREATED)
	public CommentResponse create(@PathVariable Long postId, @Valid @RequestBody CommentRequest request,
			@AuthenticationPrincipal Long userId) {
		return commentService.create(userId, postId, request);
	}

	@DeleteMapping("/api/comments/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@PathVariable Long id, @AuthenticationPrincipal Long userId) {
		commentService.delete(userId, id);
	}

}
