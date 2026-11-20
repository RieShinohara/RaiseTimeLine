package com.example.raisetimeline.follow;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.raisetimeline.follow.FollowDtos.FollowResponse;

// フォロー。ログインが必要（SecurityConfig の「それ以外はログイン必須」）
@RestController
@RequestMapping("/api/users/{username}/follow")
public class FollowController {

	private final FollowService followService;

	public FollowController(FollowService followService) {
		this.followService = followService;
	}

	@PutMapping
	public FollowResponse follow(@PathVariable String username, @AuthenticationPrincipal Long userId) {
		return followService.follow(userId, username);
	}

	@DeleteMapping
	public FollowResponse unfollow(@PathVariable String username, @AuthenticationPrincipal Long userId) {
		return followService.unfollow(userId, username);
	}

}
